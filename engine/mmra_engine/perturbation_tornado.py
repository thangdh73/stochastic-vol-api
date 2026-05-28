"""
perturbation_tornado.py – Workbook-style one-at-a-time (OAT) P10/P90 sensitivity tornado.

Base case: all active drivers at P50. Each driver is swung to P90 (low input) or P10
(high input) while others remain at P50. Correlations are not applied.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping, Optional, Tuple

from .calculation_toggles import (
    apply_oil_recovery,
    gor_active_for_correlations,
    include_solution_gas,
    oil_recovery_active_for_correlations,
)
from .correlation import correlatable_variables_for_input
from .distributions import DistributionDef, distribution_repr_values
from .simulation import SimulationInput, nrv_direct_multiplier_scalar
from .volumetrics import (
    calculate_condensate,
    calculate_giip,
    calculate_hcpv,
    calculate_mmboe,
    calculate_nrv,
    calculate_nrv_from_grv,
    calculate_productive_area,
    calculate_recoverable_gas,
    calculate_recoverable_oil,
    calculate_solution_gas,
    calculate_stoiip,
)

# correlatable variable id -> (SimulationInput dist attribute, scalar key in evaluate)
_DRIVER_MAP: Dict[str, Tuple[str, str]] = {
    "area": ("area_dist", "area"),
    "percent_fill": ("percent_fill_dist", "percent_fill"),
    "net_pay": ("net_pay_dist", "net_pay"),
    "geometric_correction": ("geometric_correction_dist", "geometric_correction"),
    "grv": ("grv_dist", "grv"),
    "grv_percent_fill": ("grv_percent_fill_dist", "grv_percent_fill"),
    "net_to_gross": ("net_to_gross_dist", "net_to_gross"),
    "nrv_direct": ("nrv_direct_dist", "nrv_direct"),
    "porosity": ("porosity_dist", "porosity"),
    "saturation": ("saturation_dist", "saturation"),
    "oil_recovery": ("oil_recovery_dist", "oil_recovery"),
    "fvf": ("fvf_dist", "fvf"),
    "gor": ("gor_dist", "gor"),
    "solution_gas_recovery": ("solution_gas_recovery_dist", "solution_gas_recovery"),
    "gas_recovery": ("gas_recovery_dist", "gas_recovery"),
    "gef": ("gef_dist", "gef"),
    "condensate_yield": ("condensate_yield_dist", "condensate_yield"),
}

_DRIVER_LABELS: Dict[str, str] = {
    "area": "Closed area",
    "percent_fill": "Percent fill",
    "net_pay": "Net pay",
    "geometric_correction": "Geometric correction",
    "grv": "GRV",
    "grv_percent_fill": "Percent trap fill",
    "net_to_gross": "Net/Gross",
    "nrv_direct": "NRV direct",
    "porosity": "Porosity",
    "saturation": "HC saturation",
    "oil_recovery": "Oil recovery",
    "fvf": "Oil FVF",
    "gor": "GOR",
    "solution_gas_recovery": "Solution gas recovery",
    "gas_recovery": "Gas recovery",
    "gef": "GEF",
    "condensate_yield": "Condensate yield",
}

VALID_TARGETS = frozenset({
    "total_mmboe",
    "stoiip_mmbbl",
    "recoverable_oil_mmbbl",
    "solution_gas_bcf",
    "giip_bcf",
    "recoverable_gas_bcf",
    "condensate_mmbbl",
    "hcpv_acft",
    "nrv_acft",
})


@dataclass
class PerturbationTornadoDriver:
    driver_id: str
    label: str
    delta_low: float
    delta_high: float
    swing_low: float
    swing_high: float
    is_fixed: bool = False


@dataclass
class PerturbationTornadoResult:
    target_key: str
    target_label: str
    target_unit: str
    base_value: float
    drivers: List[PerturbationTornadoDriver] = field(default_factory=list)
    method_note: str = (
        "One-at-a-time perturbation at input P50 base; P90/P10 swings per driver. "
        "Input correlations are not applied."
    )


def _estimating_method(inp: SimulationInput) -> str:
    return getattr(inp, "estimating_method", "area_net_pay_yield") or "area_net_pay_yield"


def _nrv_mode(inp: SimulationInput) -> str:
    return getattr(inp, "nrv_entry_mode", "grv_fill_ntg") or "grv_fill_ntg"


# HCPV drivers always required for volumetrics but omitted from NRV correlatable lists.
_VOLUMETRIC_HC_DRIVERS = ("porosity", "saturation")


def perturbation_driver_ids(inp: SimulationInput) -> List[str]:
    """Active scalar drivers for the current case (method + toggles)."""
    ft = inp.fluid_type.lower()
    cond = getattr(inp, "condensate_yield_dist", None) is not None
    ids = list(
        correlatable_variables_for_input(
            ft,
            estimating_method=_estimating_method(inp),
            nrv_entry_mode=_nrv_mode(inp),
            gor_present=gor_active_for_correlations(inp),
            condensate_present=cond,
            oil_recovery_present=oil_recovery_active_for_correlations(inp),
        )
    )
    id_set = set(ids)
    for driver_id in _VOLUMETRIC_HC_DRIVERS:
        if driver_id in id_set or driver_id not in _DRIVER_MAP:
            continue
        dist_attr, _ = _DRIVER_MAP[driver_id]
        if getattr(inp, dist_attr, None) is not None:
            ids.append(driver_id)
            id_set.add(driver_id)
    return [d for d in ids if d in _DRIVER_MAP]


def _default_target_key(inp: SimulationInput) -> str:
    ft = inp.fluid_type.lower()
    if ft == "oil":
        return "total_mmboe"
    return "total_mmboe"


def _required_scalar_bindings(inp: SimulationInput) -> List[Tuple[str, str]]:
    """(distribution attribute, scalar key) pairs required for volumetric evaluation."""
    method = _estimating_method(inp)
    bindings: List[Tuple[str, str]] = []
    if method == "nrv_grv_yield":
        if _nrv_mode(inp) == "direct":
            bindings.append(("nrv_direct_dist", "nrv_direct"))
        else:
            bindings.extend(
                [
                    ("grv_dist", "grv"),
                    ("grv_percent_fill_dist", "grv_percent_fill"),
                    ("net_to_gross_dist", "net_to_gross"),
                ]
            )
    else:
        bindings.extend(
            [
                ("area_dist", "area"),
                ("net_pay_dist", "net_pay"),
            ]
        )
    bindings.extend(
        [
            ("porosity_dist", "porosity"),
            ("saturation_dist", "saturation"),
        ]
    )
    ft = inp.fluid_type.lower()
    if ft == "oil":
        bindings.append(("fvf_dist", "fvf"))
        if apply_oil_recovery(inp):
            bindings.append(("oil_recovery_dist", "oil_recovery"))
        if include_solution_gas(inp):
            bindings.append(("gor_dist", "gor"))
            bindings.append(("solution_gas_recovery_dist", "solution_gas_recovery"))
    elif ft in ("gas", "gas_condensate"):
        bindings.append(("gas_recovery_dist", "gas_recovery"))
        bindings.append(("gef_dist", "gef"))
        if ft == "gas_condensate":
            bindings.append(("condensate_yield_dist", "condensate_yield"))
    return bindings


def _ensure_eval_scalars(
    inp: SimulationInput,
    scalars: Mapping[str, float],
) -> Dict[str, float]:
    """Fill any missing volumetric scalars from input distributions at P50."""
    out = dict(scalars)
    for dist_attr, scalar_key in _required_scalar_bindings(inp):
        if scalar_key in out:
            continue
        dist = getattr(inp, dist_attr, None)
        if dist is not None:
            out[scalar_key] = distribution_repr_values(dist)["p50"]

    method = _estimating_method(inp)
    if method == "area_net_pay_yield":
        out.setdefault("percent_fill", 1.0)
        out.setdefault("geometric_correction", 1.0)
    elif method == "nrv_grv_yield" and _nrv_mode(inp) != "direct":
        out.setdefault("grv_percent_fill", 1.0)

    ft = inp.fluid_type.lower()
    if ft == "oil":
        if not apply_oil_recovery(inp):
            out.setdefault("oil_recovery", 1.0)
        if include_solution_gas(inp):
            out.setdefault("solution_gas_recovery", 1.0)

    missing = [key for _, key in _required_scalar_bindings(inp) if key not in out]
    if ft == "oil" and not apply_oil_recovery(inp) and "oil_recovery" in missing:
        missing = [k for k in missing if k != "oil_recovery"]
    if missing:
        raise ValueError(
            "Missing required inputs for perturbation tornado: "
            + ", ".join(sorted(set(missing)))
        )
    return out


def _target_display_scale(target_key: str, inp: SimulationInput) -> float:
    from .resource_units import gas_display_scale, oil_display_scale

    if target_key in ("stoiip_mmbbl", "recoverable_oil_mmbbl", "condensate_mmbbl"):
        return oil_display_scale(getattr(inp, "oil_resource_unit", "MMBO") or "MMBO")
    if target_key in ("giip_bcf", "recoverable_gas_bcf", "solution_gas_bcf"):
        return gas_display_scale(getattr(inp, "gas_resource_unit", "BCF") or "BCF")
    return 1.0


def _target_unit(target_key: str, inp: SimulationInput) -> str:
    from .resource_units import gas_display_unit_label, oil_display_unit_label

    if target_key in ("stoiip_mmbbl", "recoverable_oil_mmbbl", "condensate_mmbbl"):
        return oil_display_unit_label(getattr(inp, "oil_resource_unit", "MMBO") or "MMBO")
    if target_key in ("giip_bcf", "recoverable_gas_bcf", "solution_gas_bcf"):
        return gas_display_unit_label(getattr(inp, "gas_resource_unit", "BCF") or "BCF")
    if target_key == "total_mmboe":
        return getattr(inp, "total_resource_unit", "MMBOE") or "MMBOE"
    if target_key == "hcpv_acft":
        return "acre-ft"
    if target_key == "nrv_acft":
        return "acre-ft"
    return ""


def evaluate_volumetrics_scalar(
    inp: SimulationInput,
    scalars: Mapping[str, float],
) -> Dict[str, float]:
    """Deterministic volumetric evaluation at fixed scalar inputs."""
    scalars = _ensure_eval_scalars(inp, scalars)
    ft = inp.fluid_type.lower()
    method = _estimating_method(inp)
    phi = float(scalars["porosity"])
    sat = float(scalars["saturation"])

    if method == "nrv_grv_yield":
        if _nrv_mode(inp) == "direct" or "nrv_direct" in scalars:
            nrv = float(scalars["nrv_direct"]) * nrv_direct_multiplier_scalar(inp)
        else:
            grv = float(scalars["grv"])
            fill = float(scalars.get("grv_percent_fill", 1.0))
            ntg = float(scalars.get("net_to_gross", 1.0))
            nrv = float(calculate_nrv_from_grv(grv, fill, ntg))
    else:
        area = float(scalars["area"])
        pf = float(scalars.get("percent_fill", 1.0))
        np_ft = float(scalars["net_pay"])
        gcf = float(scalars.get("geometric_correction", 1.0))
        pa = float(calculate_productive_area(area, pf))
        nrv = float(calculate_nrv(pa, np_ft, gcf))

    hcpv = float(calculate_hcpv(nrv, phi, sat))
    out: Dict[str, float] = {
        "nrv_acft": nrv,
        "hcpv_acft": hcpv,
        "porosity": phi,
        "saturation": sat,
    }

    gor_ratio = float(getattr(inp, "gas_oil_ratio", 6.0) or 6.0)

    if ft == "oil":
        bo = float(scalars["fvf"])
        re_oil = float(scalars.get("oil_recovery", 1.0))
        stoiip = float(calculate_stoiip(hcpv, bo))
        rec_oil = float(calculate_recoverable_oil(stoiip, re_oil))
        out["stoiip_mmbbl"] = stoiip
        out["recoverable_oil_mmbbl"] = rec_oil

        if include_solution_gas(inp) and "gor" in scalars:
            gor = float(scalars["gor"])
            sgre = float(scalars.get("solution_gas_recovery", 1.0))
            sol_gas = float(calculate_solution_gas(rec_oil, gor, sgre))
            out["solution_gas_bcf"] = sol_gas
            out["total_mmboe"] = float(
                calculate_mmboe(rec_oil, sol_gas, gor_ratio)
            )
        else:
            out["total_mmboe"] = float(calculate_mmboe(rec_oil, 0.0, gor_ratio))

    elif ft in ("gas", "gas_condensate"):
        re_gas = float(scalars["gas_recovery"])
        gef = float(scalars["gef"])
        giip = float(calculate_giip(hcpv, gef))
        rec_gas = float(calculate_recoverable_gas(giip, re_gas))
        out["giip_bcf"] = giip
        out["recoverable_gas_bcf"] = rec_gas
        if ft == "gas_condensate" and "condensate_yield" in scalars:
            cy = float(scalars["condensate_yield"])
            cond = float(calculate_condensate(rec_gas, cy))
            out["condensate_mmbbl"] = cond
            out["total_mmboe"] = float(calculate_mmboe(cond, rec_gas, gor_ratio))
        else:
            out["total_mmboe"] = float(calculate_mmboe(0.0, rec_gas, gor_ratio))
    else:
        raise ValueError(f"Unsupported fluid_type '{inp.fluid_type}'.")

    return out


def _build_base_scalars(inp: SimulationInput) -> Dict[str, float]:
    """P50 representative values for all active drivers."""
    scalars: Dict[str, float] = {}
    for driver_id in perturbation_driver_ids(inp):
        dist_attr, scalar_key = _DRIVER_MAP[driver_id]
        dist: Optional[DistributionDef] = getattr(inp, dist_attr, None)
        if dist is None:
            continue
        repr_vals = distribution_repr_values(dist)
        scalars[scalar_key] = repr_vals["p50"]

    method = _estimating_method(inp)
    if method == "area_net_pay_yield":
        scalars.setdefault("percent_fill", 1.0)
        scalars.setdefault("geometric_correction", 1.0)
    elif method == "nrv_grv_yield" and _nrv_mode(inp) != "direct":
        scalars.setdefault("grv_percent_fill", 1.0)

    ft = inp.fluid_type.lower()
    return _ensure_eval_scalars(inp, scalars)


def _repr_for_driver(dist: DistributionDef) -> Dict[str, float]:
    return distribution_repr_values(dist)


def compute_perturbation_tornado(
    inp: SimulationInput,
    target_key: Optional[str] = None,
) -> PerturbationTornadoResult:
    """
    Compute workbook-style OAT perturbation tornado for one output target.
    """
    key = target_key or _default_target_key(inp)
    if key not in VALID_TARGETS:
        raise ValueError(
            f"Unknown target_key {key!r}. Use one of: {', '.join(sorted(VALID_TARGETS))}."
        )

    base_scalars = _build_base_scalars(inp)
    if not base_scalars:
        raise ValueError("No active drivers with distributions for perturbation tornado.")

    base_out = evaluate_volumetrics_scalar(inp, base_scalars)
    if key not in base_out:
        raise ValueError(f"Target '{key}' is not available for fluid_type='{inp.fluid_type}'.")
    scale = _target_display_scale(key, inp)
    y_base = base_out[key] * scale

    drivers_out: List[PerturbationTornadoDriver] = []

    for driver_id in perturbation_driver_ids(inp):
        dist_attr, scalar_key = _DRIVER_MAP[driver_id]
        dist = getattr(inp, dist_attr, None)
        if dist is None:
            continue
        repr_vals = _repr_for_driver(dist)
        p50, p90, p10 = repr_vals["p50"], repr_vals["p90"], repr_vals["p10"]
        is_fixed = abs(p90 - p10) < 1e-12 * max(1.0, abs(p50))

        if is_fixed:
            drivers_out.append(
                PerturbationTornadoDriver(
                    driver_id=driver_id,
                    label=_DRIVER_LABELS.get(driver_id, driver_id),
                    delta_low=0.0,
                    delta_high=0.0,
                    swing_low=p90,
                    swing_high=p10,
                    is_fixed=True,
                )
            )
            continue

        low_scalars = dict(base_scalars)
        low_scalars[scalar_key] = p90
        high_scalars = dict(base_scalars)
        high_scalars[scalar_key] = p10

        y_low = evaluate_volumetrics_scalar(inp, low_scalars)[key] * scale
        y_high = evaluate_volumetrics_scalar(inp, high_scalars)[key] * scale

        drivers_out.append(
            PerturbationTornadoDriver(
                driver_id=driver_id,
                label=_DRIVER_LABELS.get(driver_id, driver_id),
                delta_low=y_low - y_base,
                delta_high=y_high - y_base,
                swing_low=p90,
                swing_high=p10,
                is_fixed=False,
            )
        )

    drivers_out.sort(
        key=lambda d: max(abs(d.delta_low), abs(d.delta_high)),
        reverse=True,
    )

    target_labels = {
        "total_mmboe": "Total geologic (MMBOE)",
        "stoiip_mmbbl": "STOIIP",
        "recoverable_oil_mmbbl": "Recoverable oil",
        "solution_gas_bcf": "Solution gas",
        "giip_bcf": "GIIP",
        "recoverable_gas_bcf": "Recoverable gas",
        "condensate_mmbbl": "Condensate",
        "hcpv_acft": "HCPV",
        "nrv_acft": "NRV",
    }

    return PerturbationTornadoResult(
        target_key=key,
        target_label=target_labels.get(key, key),
        target_unit=_target_unit(key, inp),
        base_value=y_base,
        drivers=drivers_out,
    )


def perturbation_tornado_to_dict(result: PerturbationTornadoResult) -> Dict[str, Any]:
    return {
        "target_key": result.target_key,
        "target_label": result.target_label,
        "target_unit": result.target_unit,
        "base_value": result.base_value,
        "method_note": result.method_note,
        "drivers": [
            {
                "driver_id": d.driver_id,
                "label": d.label,
                "delta_low": d.delta_low,
                "delta_high": d.delta_high,
                "swing_low": d.swing_low,
                "swing_high": d.swing_high,
                "is_fixed": d.is_fixed,
            }
            for d in result.drivers
        ],
    }
