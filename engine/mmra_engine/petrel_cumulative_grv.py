"""
petrel_cumulative_grv.py – Petrel cumulative 1P/2P/3P GRV + linked structure-scale MC.

One iteration draws one structure percentile (field-linked by default), applies segment
triangular scales, and computes GIIP_1P, GIIP_2P, GIIP_3P per segment and field totals.

Gas expansion uses GEF (scf/reservoir ft³) via calculate_giip — not Bg division.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

import numpy as np

from .constants import ACFT_TO_RESERVOIR_FT3, M3_TO_ACFT
from .distributions import DistributionType, apply_clips, sample_distribution
from .petrel_cumulative_groups import (
    PETREL_STRUCTURE_SCALE_PARAMETER,
    VAR_TO_DIST_ATTR,
    expand_uncertainty_group_tank_keys,
    is_stochastic_distribution,
)
from .resource_units import (
    gas_display_scale,
    gas_display_unit_label,
    gas_summary_for_display,
)
from .serialization import percentile_summary_to_dict
from .simulation import SimulationInput
from .stats import calculate_percentile_summary
from .volumetrics import calculate_giip, calculate_hcpv, calculate_nrv_from_grv

FILL_FRACTION = 1.0
QC_TOL = 1e-9

ROCK_VOLUME_UNITS = frozenset({
    "acre_ft",
    "thousand_acre_ft",
    "ft3",
    "m3",
    "thousand_ft3",
    "thousand_m3",
    "million_ft3",
    "million_m3",
})


def triangular_ppf(u: float, low: float, mode: float, high: float) -> float:
    """Inverse CDF of a triangular distribution on [low, high] with given mode."""
    if not np.isfinite(u):
        raise ValueError("u must be finite")
    u = float(np.clip(u, 0.0, 1.0))
    low, mode, high = float(low), float(mode), float(high)
    if low > mode or mode > high:
        raise ValueError("Triangular parameters require low <= mode <= high.")
    if high == low:
        return low
    if mode == low:
        return low + (high - low) * np.sqrt(u)
    if mode == high:
        return high - (high - low) * np.sqrt(1.0 - u)
    c = (mode - low) / (high - low)
    if u <= c:
        return low + np.sqrt(u * (high - low) * (mode - low))
    return high - np.sqrt((1.0 - u) * (high - low) * (high - mode))


def display_grv_to_acft(value: float, unit: str) -> float:
    """Convert a GRV value from display/input unit to canonical acre-ft."""
    u = (unit or "acre_ft").lower().strip()
    if u not in ROCK_VOLUME_UNITS:
        raise ValueError(f"Unsupported rock volume unit: {unit}")
    v = float(value)
    if u == "acre_ft":
        return v
    if u == "thousand_acre_ft":
        return v * 1_000.0
    if u == "ft3":
        return v / ACFT_TO_RESERVOIR_FT3
    if u == "m3":
        return v * M3_TO_ACFT
    if u == "thousand_ft3":
        return v * 1_000.0 / ACFT_TO_RESERVOIR_FT3
    if u == "thousand_m3":
        return v * 1_000.0 * M3_TO_ACFT
    if u == "million_ft3":
        return v * 1_000_000.0 / ACFT_TO_RESERVOIR_FT3
    if u == "million_m3":
        return v * 1_000_000.0 * M3_TO_ACFT
    raise ValueError(f"Unsupported rock volume unit: {unit}")


def acft_to_display_grv(value_acft: float, unit: str) -> float:
    """Convert canonical acre-ft GRV to display unit."""
    u = (unit or "acre_ft").lower().strip()
    v = float(value_acft)
    if u == "acre_ft":
        return v
    if u == "thousand_acre_ft":
        return v / 1_000.0
    if u == "ft3":
        return v * ACFT_TO_RESERVOIR_FT3
    if u == "m3":
        return v / M3_TO_ACFT
    if u == "thousand_ft3":
        return v * ACFT_TO_RESERVOIR_FT3 / 1_000.0
    if u == "thousand_m3":
        return v / M3_TO_ACFT / 1_000.0
    if u == "million_ft3":
        return v * ACFT_TO_RESERVOIR_FT3 / 1_000_000.0
    if u == "million_m3":
        return v / M3_TO_ACFT / 1_000_000.0
    raise ValueError(f"Unsupported rock volume unit: {unit}")


@dataclass
class PetrelSegmentInput:
    """One segment/reservoir row in the Petrel cumulative GRV matrix."""

    tank_key: str
    segment_id: str
    reservoir_id: str
    segment_label: str = ""
    grv_1p_acft: float = 0.0
    grv_2p_acft: float = 0.0
    grv_3p_acft: float = 0.0
    scale_low: float = 0.85
    scale_mode: float = 1.0
    scale_high: float = 1.17
    enabled: bool = True


@dataclass
class GrvValidationIssue:
    tank_key: str
    code: str
    message: str
    severity: str = "ERROR"


@dataclass
class GrvValidationResult:
    ok: bool
    issues: List[GrvValidationIssue] = field(default_factory=list)
    increments: Dict[str, Dict[str, float]] = field(default_factory=dict)


def validate_grv_inputs(segments: Sequence[PetrelSegmentInput]) -> GrvValidationResult:
    """Validate monotonic cumulative GRV and non-negative increments."""
    issues: List[GrvValidationIssue] = []
    increments: Dict[str, Dict[str, float]] = {}
    for seg in segments:
        if not seg.enabled:
            continue
        g1, g2, g3 = seg.grv_1p_acft, seg.grv_2p_acft, seg.grv_3p_acft
        inc1, inc2, inc3 = g1, g2 - g1, g3 - g2
        increments[seg.tank_key] = {"p1_inc": inc1, "p2_inc": inc2, "p3_inc": inc3}
        if any(v < 0 for v in (g1, g2, g3)):
            issues.append(
                GrvValidationIssue(seg.tank_key, "GRV_NEGATIVE", "GRV values must be >= 0.")
            )
        if not (g1 <= g2 <= g3):
            issues.append(
                GrvValidationIssue(
                    seg.tank_key,
                    "GRV_ORDER",
                    "GRV_1P <= GRV_2P <= GRV_3P required.",
                )
            )
        if any(v < 0 for v in (inc1, inc2, inc3)):
            issues.append(
                GrvValidationIssue(
                    seg.tank_key,
                    "GRV_INCREMENT",
                    "Incremental GRV (P1, P2−P1, P3−P2) must be >= 0.",
                )
            )
        sl, sm, sh = seg.scale_low, seg.scale_mode, seg.scale_high
        if not (sl > 0 and sm > 0 and sh > 0):
            issues.append(
                GrvValidationIssue(
                    seg.tank_key,
                    "SCALE_POSITIVE",
                    "Structure scale low/mode/high must be > 0.",
                )
            )
        if not (sl <= sm <= sh):
            issues.append(
                GrvValidationIssue(
                    seg.tank_key,
                    "SCALE_ORDER",
                    "Structure scale requires low <= mode <= high.",
                )
            )
    return GrvValidationResult(ok=not issues, issues=issues, increments=increments)


def scaled_grv_preview(
    grv_acft: float,
    scale_low: float,
    scale_mode: float,
    scale_high: float,
    display_unit: str = "acre_ft",
) -> Dict[str, float]:
    """Deterministic scaled GRV at structure low/mode/high (display units)."""
    return {
        "low": acft_to_display_grv(grv_acft * scale_low, display_unit),
        "mode": acft_to_display_grv(grv_acft * scale_mode, display_unit),
        "high": acft_to_display_grv(grv_acft * scale_high, display_unit),
    }


def _seed_for(*parts: str, base_seed: int) -> int:
    raw = "|".join(parts) + f"|{base_seed}"
    h = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:8]
    return int(h, 16)


def _rank_map(scores: np.ndarray) -> np.ndarray:
    return np.argsort(np.argsort(scores, kind="mergesort"), kind="mergesort")


def build_structure_scale_group_map(
    uncertainty_groups: Sequence[Any],
    tank_keys: Sequence[str],
    segment_ids: Sequence[str],
    reservoir_ids: Sequence[str],
) -> Dict[str, str]:
    """Map each active tank to a structure-scale group id (at most one group per tank)."""
    active = set(tank_keys)
    out: Dict[str, str] = {}
    for group in uncertainty_groups:
        if getattr(group, "parameter", None) != PETREL_STRUCTURE_SCALE_PARAMETER:
            continue
        for tk in expand_uncertainty_group_tank_keys(group, segment_ids, reservoir_ids):
            if tk in active:
                out[tk] = group.id
    return out


def scores_to_uniform_percentiles(scores: np.ndarray) -> np.ndarray:
    """Map Gaussian group scores to (0,1) uniforms via empirical CDF ranks."""
    n = len(scores)
    if n == 0:
        return np.asarray([], dtype=float)
    ranks = _rank_map(np.asarray(scores, dtype=float))
    return (ranks + 0.5) / float(n)


def build_structure_scale_uniform_by_tank(
    tank_keys: Sequence[str],
    tank_key_to_group: Mapping[str, str],
    group_scores: Mapping[str, np.ndarray],
    n: int,
    base_seed: int,
) -> Dict[str, np.ndarray]:
    """
    Per-tank uniform percentiles for triangular structure scale.

    Tanks in the same dependency group share one percentile draw per iteration;
    each segment still applies its own triangular low/mode/high.
    """
    rng = np.random.default_rng(_seed_for("petrel_field_structure", base_seed=base_seed))
    u_field = rng.random(n)
    group_u: Dict[str, np.ndarray] = {}
    for gid, scores in group_scores.items():
        if scores is None or len(scores) != n:
            continue
        group_u[gid] = scores_to_uniform_percentiles(np.asarray(scores, dtype=float))

    out: Dict[str, np.ndarray] = {}
    for tk in tank_keys:
        gid = tank_key_to_group.get(tk)
        if gid and gid in group_u:
            out[tk] = group_u[gid]
        else:
            out[tk] = u_field
    return out


def build_group_scores(
    group_ids: Sequence[str],
    n: int,
    base_seed: int,
    correlation_mode: str = "independent",
    correlation_matrix: Optional[Sequence[Sequence[float]]] = None,
    matrix_group_ids: Optional[Sequence[str]] = None,
) -> Dict[str, np.ndarray]:
    """Gaussian copula / rank scores per uncertainty group (adapter-compatible)."""
    groups = list(group_ids)
    if not groups:
        return {}
    rng = np.random.default_rng(_seed_for("petrel_group_scores", base_seed=base_seed))
    k = len(groups)
    z = rng.standard_normal((n, k))
    mode = (correlation_mode or "independent").lower()
    if mode in ("rank", "gaussian_copula") and correlation_matrix and matrix_group_ids:
        idx = {gid: i for i, gid in enumerate(matrix_group_ids)}
        r = np.eye(k, dtype=float)
        for i, ga in enumerate(groups):
            for j, gb in enumerate(groups):
                if i == j:
                    continue
                ia, ib = idx.get(ga), idx.get(gb)
                if ia is None or ib is None:
                    continue
                r[i, j] = max(-1.0, min(1.0, float(correlation_matrix[ia][ib])))
        try:
            l = np.linalg.cholesky(r)
            z = z @ l.T
        except np.linalg.LinAlgError:
            pass
    return {gid: z[:, i] for i, gid in enumerate(groups)}


def _constant_from_dist(dist: DistributionDef, n: int) -> np.ndarray:
    if dist.distribution_type == DistributionType.FIXED:
        if dist.fixed_value is None:
            raise ValueError(f"Fixed distribution '{dist.variable_id}' has no fixed_value.")
        return np.full(n, float(dist.fixed_value), dtype=float)
    if dist.p50 is not None:
        return np.full(n, float(dist.p50), dtype=float)
    raise ValueError(f"Cannot resolve constant for '{dist.variable_id}'.")


def _sample_var(
    inp: SimulationInput,
    var: str,
    n: int,
    rng: np.random.Generator,
    override: Optional[np.ndarray],
) -> np.ndarray:
    if override is not None and len(override) == n:
        return np.asarray(override, dtype=float)
    attr = VAR_TO_DIST_ATTR.get(var)
    if not attr:
        raise ValueError(f"Unknown petro variable: {var}")
    dist = getattr(inp, attr, None)
    if dist is None:
        raise ValueError(f"Missing distribution for {var} on tank.")
    if not is_stochastic_distribution(dist):
        return _constant_from_dist(dist, n)
    vals = sample_distribution(dist, n, rng)
    return apply_clips(vals, dist.low_clip, dist.high_clip)


def _linked_samples_for_group(
    inp: SimulationInput,
    var: str,
    n: int,
    base_seed: int,
    group_id: str,
    group_scores: Mapping[str, np.ndarray],
    stream_key: str,
) -> Optional[np.ndarray]:
    gid = group_id
    if gid not in group_scores:
        return None
    dist_attr = VAR_TO_DIST_ATTR.get(var)
    if not dist_attr:
        return None
    dist = getattr(inp, dist_attr, None)
    if not is_stochastic_distribution(dist):
        return _constant_from_dist(dist, n)
    rng = np.random.default_rng(_seed_for("petrel_marginal", stream_key, var, base_seed=base_seed))
    vals = sample_distribution(dist, n, rng)
    vals = apply_clips(vals, dist.low_clip, dist.high_clip)
    ranks = _rank_map(group_scores[gid])
    return np.sort(vals)[ranks]


def build_petro_sample_arrays(
    tank_inputs: Mapping[str, SimulationInput],
    tank_keys: Sequence[str],
    var_to_group: Mapping[str, Mapping[str, str]],
    group_scores: Mapping[str, np.ndarray],
    n: int,
    base_seed: int,
) -> Tuple[Dict[str, Dict[str, np.ndarray]], Dict[str, np.ndarray]]:
    """
    Build per-tank NTG/PORO/Sw arrays and per-reservoir GEF arrays.

    Ungrouped stochastic inputs: independent random samples per tank.
    Grouped inputs: linked percentile via group_scores (and group correlation matrix upstream).
    Fixed inputs: constant (not random).
    """
    per_tank: Dict[str, Dict[str, np.ndarray]] = {}
    reservoir_ids = sorted({k.split("::", 1)[1] for k in tank_keys if "::" in k})
    reservoir_gef: Dict[str, np.ndarray] = {}

    # GEF: one independent draw per reservoir unless tanks share a gef group
    gef_group_to_reservoirs: Dict[str, List[str]] = {}
    for tank_key in tank_keys:
        gid = var_to_group.get(tank_key, {}).get("gef")
        res_id = tank_key.split("::", 1)[1]
        if gid:
            gef_group_to_reservoirs.setdefault(gid, [])
            if res_id not in gef_group_to_reservoirs[gid]:
                gef_group_to_reservoirs[gid].append(res_id)

    assigned_gef: set[str] = set()
    for gid, res_list in gef_group_to_reservoirs.items():
        ref_key = next(k for k in tank_keys if k.endswith(f"::{res_list[0]}"))
        linked = _linked_samples_for_group(
            tank_inputs[ref_key],
            "gef",
            n,
            base_seed,
            gid,
            group_scores,
            f"gef_group:{gid}",
        )
        if linked is not None:
            for res_id in res_list:
                reservoir_gef[res_id] = linked
                assigned_gef.add(res_id)

    for res_id in reservoir_ids:
        if res_id in assigned_gef:
            continue
        ref_key = next(k for k in tank_keys if k.endswith(f"::{res_id}"))
        rng = np.random.default_rng(_seed_for("reservoir_gef", res_id, base_seed=base_seed))
        reservoir_gef[res_id] = _sample_var(tank_inputs[ref_key], "gef", n, rng, None)

    for tank_key in tank_keys:
        inp = tank_inputs[tank_key]
        groups = var_to_group.get(tank_key, {})
        samples: Dict[str, np.ndarray] = {}
        for var in ("net_to_gross", "porosity", "saturation"):
            gid = groups.get(var)
            override = None
            if gid:
                override = _linked_samples_for_group(
                    inp, var, n, base_seed, gid, group_scores, f"{tank_key}:{gid}"
                )
            rng = np.random.default_rng(
                _seed_for("petrel_tank", tank_key, var, base_seed=base_seed)
            )
            samples[var] = _sample_var(inp, var, n, rng, override)
        per_tank[tank_key] = samples

    return per_tank, reservoir_gef


def compute_segment_giip_triple(
    grv_1p: float,
    grv_2p: float,
    grv_3p: float,
    scale: float,
    ntg: float,
    porosity: float,
    sw: float,
    gef: float,
) -> Tuple[float, float, float]:
    """Deterministic GIIP for 1P/2P/3P at one scale and petro point."""
    shc = 1.0 - sw
    out: List[float] = []
    for grv in (grv_1p, grv_2p, grv_3p):
        scaled = grv * scale
        nrv = float(calculate_nrv_from_grv(scaled, FILL_FRACTION, ntg))
        hcpv = float(calculate_hcpv(nrv, porosity, shc))
        out.append(float(calculate_giip(hcpv, gef)))
    return out[0], out[1], out[2]


@dataclass
class PetrelCumulativeMcResult:
    n_iterations: int
    seed: int
    grv_unit: str
    gas_unit: str
    independent_structure_scale: bool
    iteration_qc_pass: bool
    iteration_qc_violations: int
    formula_note: str = (
        "GIIP from GRV×NTG×φ×(1−Sw) via HCPV and GEF (scf/res ft³); trap fill = 1.0."
    )
    field_rollup: Dict[str, Any] = field(default_factory=dict)
    segments: List[Dict[str, Any]] = field(default_factory=list)
    arrays: Dict[str, List[float]] = field(default_factory=dict)


def run_petrel_cumulative_mc(
    segments: Sequence[PetrelSegmentInput],
    tank_inputs: Mapping[str, SimulationInput],
    *,
    n_iterations: int,
    seed: int,
    grv_display_unit: str = "acre_ft",
    gas_resource_unit: str = "BCF",
    independent_structure_scale: bool = False,
    include_arrays: bool = False,
    petro_samples: Optional[Mapping[str, Mapping[str, np.ndarray]]] = None,
    reservoir_gef_samples: Optional[Mapping[str, np.ndarray]] = None,
    structure_u_by_tank: Optional[Mapping[str, np.ndarray]] = None,
) -> PetrelCumulativeMcResult:
    """Single MC loop computing linked structure scale and 1P/2P/3P GIIP together."""
    validation = validate_grv_inputs(segments)
    if not validation.ok:
        msgs = "; ".join(i.message for i in validation.issues)
        raise ValueError(f"GRV validation failed: {msgs}")

    active = [s for s in segments if s.enabled]
    if not active:
        raise ValueError("No enabled segments for Petrel cumulative simulation.")

    n = int(n_iterations)
    rng = np.random.default_rng(seed)
    use_group_structure = (
        structure_u_by_tank is not None and not independent_structure_scale
    )
    u_linked = rng.random(n) if not use_group_structure else None
    u_indep: Dict[str, np.ndarray] = {}
    if independent_structure_scale:
        for seg in active:
            u_indep[seg.tank_key] = rng.random(n)

    if petro_samples is None or reservoir_gef_samples is None:
        petro_samples, reservoir_gef_samples = build_petro_sample_arrays(
            tank_inputs,
            [s.tank_key for s in active],
            {},
            {},
            n,
            seed,
        )

    total_1p = np.zeros(n, dtype=float)
    total_2p = np.zeros(n, dtype=float)
    total_3p = np.zeros(n, dtype=float)
    seg_arrays: Dict[str, Dict[str, np.ndarray]] = {
        s.tank_key: {
            "giip_1p": np.zeros(n),
            "giip_2p": np.zeros(n),
            "giip_3p": np.zeros(n),
        }
        for s in active
    }
    violations = 0

    for i in range(n):
        field_1 = field_2 = field_3 = 0.0
        for seg in active:
            if independent_structure_scale:
                u = u_indep[seg.tank_key][i]
            elif use_group_structure:
                u_arr = structure_u_by_tank.get(seg.tank_key)
                if u_arr is None or len(u_arr) != n:
                    raise ValueError(
                        f"Missing structure percentile array for tank {seg.tank_key}."
                    )
                u = float(u_arr[i])
            else:
                u = float(u_linked[i])  # type: ignore[index]
            scale = triangular_ppf(
                u, seg.scale_low, seg.scale_mode, seg.scale_high
            )
            petro = petro_samples[seg.tank_key]
            ntg = float(petro["net_to_gross"][i])
            poro = float(petro["porosity"][i])
            sw = float(petro["saturation"][i])
            gef = float(reservoir_gef_samples[seg.reservoir_id][i])
            g1, g2, g3 = compute_segment_giip_triple(
                seg.grv_1p_acft,
                seg.grv_2p_acft,
                seg.grv_3p_acft,
                scale,
                ntg,
                poro,
                sw,
                gef,
            )
            if not (g1 <= g2 + QC_TOL and g2 <= g3 + QC_TOL):
                violations += 1
            seg_arrays[seg.tank_key]["giip_1p"][i] = g1
            seg_arrays[seg.tank_key]["giip_2p"][i] = g2
            seg_arrays[seg.tank_key]["giip_3p"][i] = g3
            field_1 += g1
            field_2 += g2
            field_3 += g3
        if not (field_1 <= field_2 + QC_TOL and field_2 <= field_3 + QC_TOL):
            violations += 1
        total_1p[i] = field_1
        total_2p[i] = field_2
        total_3p[i] = field_3

    ref_inp = tank_inputs[active[0].tank_key]
    gas_unit = gas_resource_unit or getattr(ref_inp, "gas_resource_unit", "BCF") or "BCF"

    def _summary(arr: np.ndarray, label: str) -> Dict[str, Any]:
        s = calculate_percentile_summary(arr, label, gas_unit)
        disp = gas_summary_for_display(s, ref_inp)
        return percentile_summary_to_dict(disp)

    field_out = {
        "1P": _summary(total_1p, "Field GIIP 1P"),
        "2P": _summary(total_2p, "Field GIIP 2P"),
        "3P": _summary(total_3p, "Field GIIP 3P"),
    }
    seg_out: List[Dict[str, Any]] = []
    for seg in active:
        arrs = seg_arrays[seg.tank_key]
        seg_out.append(
            {
                "tank_key": seg.tank_key,
                "segment_id": seg.segment_id,
                "reservoir_id": seg.reservoir_id,
                "label": seg.segment_label or seg.segment_id,
                "1P": _summary(arrs["giip_1p"], f"{seg.segment_id} GIIP 1P"),
                "2P": _summary(arrs["giip_2p"], f"{seg.segment_id} GIIP 2P"),
                "3P": _summary(arrs["giip_3p"], f"{seg.segment_id} GIIP 3P"),
            }
        )

    # Summaries are emitted in display units (gas_summary_for_display). Scale the raw
    # canonical arrays by the same factor and report the display label so the frontend
    # exceedance curve and its P10/P50/P90/mean markers share one scale.
    display_scale = gas_display_scale(gas_unit)
    display_label = gas_display_unit_label(gas_unit)

    result = PetrelCumulativeMcResult(
        n_iterations=n,
        seed=seed,
        grv_unit=grv_display_unit,
        gas_unit=display_label,
        independent_structure_scale=independent_structure_scale,
        iteration_qc_pass=violations == 0,
        iteration_qc_violations=violations,
        field_rollup=field_out,
        segments=seg_out,
    )
    if include_arrays:
        result.arrays = {
            "total_giip_1p": (total_1p * display_scale).tolist(),
            "total_giip_2p": (total_2p * display_scale).tolist(),
            "total_giip_3p": (total_3p * display_scale).tolist(),
        }
        for seg in active:
            tk = seg.tank_key
            result.arrays[f"{tk}::giip_1p"] = (seg_arrays[tk]["giip_1p"] * display_scale).tolist()
            result.arrays[f"{tk}::giip_2p"] = (seg_arrays[tk]["giip_2p"] * display_scale).tolist()
            result.arrays[f"{tk}::giip_3p"] = (seg_arrays[tk]["giip_3p"] * display_scale).tolist()
    return result


def segment_from_dict(
    tank_key: str,
    data: Mapping[str, Any],
    *,
    grv_unit: str,
    segment_id: str = "",
    reservoir_id: str = "",
    segment_label: str = "",
    enabled: bool = True,
) -> PetrelSegmentInput:
    sid, rid = (tank_key.split("::", 1) + [""])[:2]
    return PetrelSegmentInput(
        tank_key=tank_key,
        segment_id=segment_id or sid,
        reservoir_id=reservoir_id or rid,
        segment_label=segment_label or data.get("label", sid),
        grv_1p_acft=display_grv_to_acft(float(data["grv_1p"]), grv_unit),
        grv_2p_acft=display_grv_to_acft(float(data["grv_2p"]), grv_unit),
        grv_3p_acft=display_grv_to_acft(float(data["grv_3p"]), grv_unit),
        scale_low=float(data.get("scale_low", 0.85)),
        scale_mode=float(data.get("scale_mode", 1.0)),
        scale_high=float(data.get("scale_high", 1.17)),
        enabled=enabled,
    )


def validation_result_to_dict(v: GrvValidationResult) -> Dict[str, Any]:
    return {
        "ok": v.ok,
        "issues": [
            {
                "tank_key": i.tank_key,
                "code": i.code,
                "message": i.message,
                "severity": i.severity,
            }
            for i in v.issues
        ],
        "increments": v.increments,
    }


def result_to_dict(result: PetrelCumulativeMcResult, *, include_arrays: bool = False) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "n_iterations": result.n_iterations,
        "seed": result.seed,
        "grv_unit": result.grv_unit,
        "gas_unit": result.gas_unit,
        "independent_structure_scale": result.independent_structure_scale,
        "iteration_qc_pass": result.iteration_qc_pass,
        "iteration_qc_violations": result.iteration_qc_violations,
        "formula_note": result.formula_note,
        "field": result.field_rollup,
        "segments": result.segments,
    }
    if include_arrays and result.arrays:
        out["arrays"] = result.arrays
    return out
