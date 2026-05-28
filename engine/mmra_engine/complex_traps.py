"""
complex_traps.py – Downdip complex traps (MMRA v4.4 Repsol workbook).

Method A (workbook default for Area and NRV): sort the volumetric sample, log-rescale
the distribution to each element cap percentile, then branch on P(seal) per iteration.

Method B (Area only in workbook): if sample exceeds an element cap and the seal fails,
truncate to that cap exactly.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Literal, Tuple

import numpy as np
from numpy.random import Generator


@dataclass
class ComplexTrapElement:
    """One downdip complex-trap seal element (max volume at that closure level)."""

    enabled: bool = False
    max_area_acres: float = 0.0  # acres, acre-ft, or GRV volume in canonical units
    seal_confidence: float = 0.5  # P(seal), fraction 0–1
    notes: str = ""


@dataclass
class ComplexTrapConfig:
    """
    Complex trap extension beyond the updip (4-way) volume.

    element_1 : first downdip seal — smallest extension when seals fail
    element_2 : second downdip seal — intermediate extension (2-element case)
    """

    enabled: bool = False
    method: Literal["A", "B"] = "A"
    num_elements: int = 1
    element_1: ComplexTrapElement = field(default_factory=ComplexTrapElement)
    element_2: ComplexTrapElement = field(default_factory=ComplexTrapElement)

    def active_element_count(self) -> int:
        if not self.enabled:
            return 0
        n = 1 if self.element_1.enabled else 0
        if self.num_elements >= 2 and self.element_2.enabled:
            n += 1
        return n


def _log10_safe(x: float) -> float:
    return float(np.log10(max(x, 1e-30)))


def _element_scale_factor(element_value: float, p99: float, p01: float) -> float:
    denom = _log10_safe(p01) - _log10_safe(p99)
    if abs(denom) < 1e-15:
        return 0.0
    return (_log10_safe(element_value) - _log10_safe(p99)) / denom


def _rescale_to_element(volume: np.ndarray, p99: float, scale_factor: float) -> np.ndarray:
    """Log-linear rescale each sample toward element_value (workbook Method A)."""
    log_p99 = _log10_safe(p99)
    out = np.empty_like(volume, dtype=float)
    for i, v in enumerate(volume):
        log_v = _log10_safe(float(v))
        if v < p99:
            log_out = log_p99 - (log_p99 - log_v) * scale_factor
        else:
            log_out = log_p99 + (log_v - log_p99) * scale_factor
        out[i] = 10.0**log_out
    return out


def _build_rescaled_arrays(
    sorted_volume: np.ndarray,
    element1_value: float,
    element2_value: float | None,
) -> Tuple[np.ndarray, np.ndarray | None]:
    n = len(sorted_volume)
    if n == 0:
        return sorted_volume.copy(), None
    idx_p99 = max(0, int(n * 0.01) - 1) if n > 1 else 0
    idx_p01 = min(n - 1, int(n * 0.99))
    p99 = float(sorted_volume[idx_p99])
    p01 = float(sorted_volume[idx_p01])

    sf1 = _element_scale_factor(element1_value, p99, p01)
    rescaled_1 = _rescale_to_element(sorted_volume, p99, sf1)

    rescaled_2 = None
    if element2_value is not None:
        sf2 = _element_scale_factor(element2_value, p99, p01)
        rescaled_2 = _rescale_to_element(sorted_volume, p99, sf2)

    return rescaled_1, rescaled_2


def apply_complex_trap_method_a_workbook(
    volume: np.ndarray,
    config: ComplexTrapConfig,
    rng: Generator,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    MMRA v4 Method A on a single volumetric variable (GRV, closed area, NRV, etc.).

    Returns adjusted volume and scenario codes:
      0 = constrained to element 1 (smallest),
      1 = constrained to element 2 (middle, two-element only),
      2 = full trap (seal success / both seal).
    """
    vol = np.asarray(volume, dtype=float).copy()
    n = len(vol)
    scenario = np.zeros(n, dtype=np.int8)

    if n == 0 or not config.element_1.enabled:
        return vol, scenario

    el1 = config.element_1
    el2 = config.element_2
    use_two = config.num_elements >= 2 and el2.enabled
    p_a = float(np.clip(el1.seal_confidence, 0.0, 1.0))
    p_b = float(np.clip(el2.seal_confidence, 0.0, 1.0)) if use_two else 0.0
    cap1 = float(el1.max_area_acres)
    cap2 = float(el2.max_area_acres) if use_two else 0.0

    order = np.argsort(vol, kind="stable")
    sorted_vol = vol[order]
    rescaled_1, rescaled_2 = _build_rescaled_arrays(
        sorted_vol, cap1, cap2 if use_two else None
    )

    sorted_out = sorted_vol.copy()
    sorted_scenario = np.zeros(n, dtype=np.int8)

    if not use_two:
        for i in range(n):
            if rng.random() > p_a:
                sorted_out[i] = rescaled_1[i]
                sorted_scenario[i] = 0
            else:
                sorted_scenario[i] = 2
    else:
        assert rescaled_2 is not None
        chance_both = p_a * p_b
        chance_1 = p_a * (1.0 - p_b)
        for i in range(n):
            r = rng.random()
            if r < chance_both:
                sorted_scenario[i] = 2
            elif r < chance_both + chance_1:
                sorted_out[i] = rescaled_2[i]
                sorted_scenario[i] = 1
            else:
                sorted_out[i] = rescaled_1[i]
                sorted_scenario[i] = 0

    out = np.empty(n, dtype=float)
    scen_out = np.empty(n, dtype=np.int8)
    out[order] = sorted_out
    scen_out[order] = sorted_scenario
    return out, scen_out


def apply_complex_trap_method_b_workbook(
    volume: np.ndarray,
    config: ComplexTrapConfig,
    rng: Generator,
) -> Tuple[np.ndarray, np.ndarray]:
    """MMRA v4 Method B — cap at element volume when sample exceeds cap and seal fails."""
    vol = np.asarray(volume, dtype=float).copy()
    n = len(vol)
    scenario = np.zeros(n, dtype=np.int8)

    if n == 0 or not config.element_1.enabled:
        return vol, scenario

    el1 = config.element_1
    el2 = config.element_2
    use_two = config.num_elements >= 2 and el2.enabled
    p_a = float(np.clip(el1.seal_confidence, 0.0, 1.0))
    p_b = float(np.clip(el2.seal_confidence, 0.0, 1.0)) if use_two else 0.0
    cap1 = float(el1.max_area_acres)
    cap2 = float(el2.max_area_acres) if use_two else 0.0

    for i in range(n):
        v = float(vol[i])
        if not use_two:
            if v > cap1 and rng.random() > p_a:
                vol[i] = cap1
                scenario[i] = 0
            elif v > cap1:
                scenario[i] = 2
            else:
                scenario[i] = 2
            continue

        if v > cap1:
            if rng.random() > p_a:
                vol[i] = cap1
                scenario[i] = 0
            elif v > cap2 and rng.random() > p_b:
                vol[i] = cap2
                scenario[i] = 1
            else:
                scenario[i] = 2
        else:
            scenario[i] = 2

    return vol, scenario


def apply_complex_trap_volume(
    volume: np.ndarray,
    config: ComplexTrapConfig,
    rng: Generator,
) -> Tuple[np.ndarray, np.ndarray]:
    """Apply configured complex-trap method to a single volumetric array."""
    vol = np.asarray(volume, dtype=float)

    if not config.enabled or config.active_element_count() == 0 or not config.element_1.enabled:
        return vol.copy(), np.zeros(len(vol), dtype=np.int8)

    method = (config.method or "A").upper()
    if method == "B":
        return apply_complex_trap_method_b_workbook(vol, config, rng)
    return apply_complex_trap_method_a_workbook(vol, config, rng)


def apply_complex_trap_productive_area(
    closed_area_acres: np.ndarray,
    percent_fill: np.ndarray,
    config: ComplexTrapConfig,
    rng: Generator,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Workbook Area path: complex trap on closed area, then productive area = closed × fill.
    """
    closed = np.asarray(closed_area_acres, dtype=float)
    pf = np.asarray(percent_fill, dtype=float)

    if not config.enabled or config.active_element_count() == 0:
        return closed * pf, np.zeros(len(closed), dtype=np.int8)

    adjusted_closed, scenario = apply_complex_trap_volume(closed, config, rng)
    return adjusted_closed * pf, scenario


def apply_complex_trap_grv(
    grv: np.ndarray,
    percent_fill: np.ndarray,
    net_to_gross: np.ndarray,
    config: ComplexTrapConfig,
    rng: Generator,
    *,
    direct_nrv: bool = False,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Workbook NRV path: complex trap on GRV (or direct NRV), then NRV = volume × fill × NTG.

    When direct_nrv is True, trap logic applies to the NRV sample directly (no GRV split).
    """
    fill = np.asarray(percent_fill, dtype=float)
    ntg = np.asarray(net_to_gross, dtype=float)

    # Workbook NRV wizard uses Method A only (VBA comment Apr 2011).
    if (config.method or "A").upper() != "A":
        config = replace(config, method="A")

    if direct_nrv:
        nrv_in = np.asarray(grv, dtype=float)
        if not config.enabled or config.active_element_count() == 0:
            return nrv_in.copy(), nrv_in.copy(), np.zeros(len(nrv_in), dtype=np.int8)
        nrv_out, scenario = apply_complex_trap_volume(nrv_in, config, rng)
        return nrv_out, nrv_out, scenario

    grv_arr = np.asarray(grv, dtype=float)
    if not config.enabled or config.active_element_count() == 0:
        nrv = grv_arr * fill * ntg
        return grv_arr, nrv, np.zeros(len(grv_arr), dtype=np.int8)

    grv_out, scenario = apply_complex_trap_volume(grv_arr, config, rng)
    nrv = grv_out * fill * ntg
    return grv_out, nrv, scenario


# Backward-compatible aliases (tests / imports)
apply_complex_trap_method_a = apply_complex_trap_method_a_workbook
apply_complex_trap_method_b = apply_complex_trap_method_b_workbook


SCENARIO_LABELS = {
    0: "4-way / updip only (seal failed)",
    1: "3-way (1 element seals)",
    2: "3-way (2 elements seal)",
}
