"""
module_preview.py – Scoped Monte Carlo preview for individual workflow tabs.

Each module samples only its own input parameters (plus dependencies required
for derived area/volumetric previews on that tab).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from numpy.random import Generator

from . import ENGINE_VERSION
from .ccop_chance import calculate_ccop_pg, calculate_pg_ccop_or_legacy
from .chance import calculate_pg, calculate_pg_risked_mean
from .complex_traps import (
    SCENARIO_LABELS,
    apply_complex_trap_grv,
    apply_complex_trap_productive_area,
)
from .serialization import SCHEMA_VERSION, percentile_summary_to_dict
from .simulation import SimulationInput, _sample
from .stats import calculate_percentile_summary
from .nrv_crosscheck import cross_check_warnings, implied_net_pay_ft
from .correlation import apply_pair_rank_correlation
from .volumetrics import calculate_nrv_from_grv, calculate_productive_area

MODULE_SCOPES = ("area", "net_pay", "hc_yield", "chance", "nrv", "full")

SCOPE_LABELS = {
    "area": "Area",
    "net_pay": "Net Pay",
    "hc_yield": "HC Yield",
    "chance": "Chance",
    "nrv": "NRV / GRV",
    "full": "Full case",
}


def _summary_dict(values: np.ndarray, name: str, unit: str) -> Dict[str, Any]:
    return percentile_summary_to_dict(
        calculate_percentile_summary(values, name, unit)
    )


def run_area_module_preview(
    inp: SimulationInput,
    rng: Generator,
) -> Tuple[Dict[str, np.ndarray], Dict[str, Any], Dict[str, Any]]:
    """Sample area, percent fill, GCF, complex trap → productive area."""
    n = inp.n_iterations
    area = _sample(inp.area_dist, n, rng)
    pf = _sample(inp.percent_fill_dist, n, rng, default_value=1.0)
    gcf = _sample(inp.geometric_correction_dist, n, rng, default_value=1.0)

    ct = inp.complex_trap
    meta: Dict[str, Any] = {}
    if ct.enabled and ct.active_element_count() > 0:
        pa, scen = apply_complex_trap_productive_area(area, pf, ct, rng)
        meta["complex_trap_method"] = f"complex_trap_method_{(ct.method or 'A').upper()}_workbook"
        meta["complex_trap_scenario_counts"] = {
            SCENARIO_LABELS[c]: int(np.sum(scen == c)) for c in (0, 1, 2)
        }
        arrays = {
            "area": area,
            "percent_fill": pf,
            "geometric_correction": gcf,
            "productive_area": pa,
            "complex_trap_scenario": scen.astype(float),
        }
    else:
        pa = calculate_productive_area(area, pf)
        arrays = {
            "area": area,
            "percent_fill": pf,
            "geometric_correction": gcf,
            "productive_area": pa,
        }

    summaries = {
        "area": _summary_dict(area, "Closed Area", "acres"),
        "productive_area": _summary_dict(pa, "Productive Area", "acres"),
    }
    return arrays, summaries, meta


def run_net_pay_module_preview(
    inp: SimulationInput,
    rng: Generator,
) -> Tuple[Dict[str, np.ndarray], Dict[str, Any], Dict[str, Any]]:
    n = inp.n_iterations
    np_samples = _sample(inp.net_pay_dist, n, rng)
    arrays = {"net_pay_ft": np_samples}
    summaries = {
        "net_pay_ft": _summary_dict(np_samples, "Net Pay", "ft"),
    }
    return arrays, summaries, {}


def run_hc_yield_module_preview(
    inp: SimulationInput,
    rng: Generator,
) -> Tuple[Dict[str, np.ndarray], Dict[str, Any], Dict[str, Any]]:
    n = inp.n_iterations
    ft = inp.fluid_type.lower()
    arrays: Dict[str, np.ndarray] = {
        "porosity": _sample(inp.porosity_dist, n, rng),
        "saturation": _sample(inp.saturation_dist, n, rng),
    }
    summaries = {
        "porosity": _summary_dict(arrays["porosity"], "Porosity", "fraction"),
        "saturation": _summary_dict(arrays["saturation"], "HC Saturation", "fraction"),
    }

    if ft == "oil":
        from .calculation_toggles import (
            apply_oil_recovery as toggle_apply_oil_recovery,
            include_solution_gas as toggle_include_solution_gas,
        )

        if toggle_apply_oil_recovery(inp):
            arrays["oil_recovery"] = _sample(inp.oil_recovery_dist, n, rng)
        else:
            arrays["oil_recovery"] = np.ones(n)
        arrays["fvf"] = _sample(inp.fvf_dist, n, rng)
        summaries["oil_recovery"] = _summary_dict(
            arrays["oil_recovery"], "Oil Recovery", "fraction"
        )
        summaries["fvf"] = _summary_dict(arrays["fvf"], "Oil FVF", "rb/stb")
        if toggle_include_solution_gas(inp):
            arrays["gor"] = _sample(inp.gor_dist, n, rng)
            summaries["gor"] = _summary_dict(arrays["gor"], "GOR", "scf/stb")
            arrays["solution_gas_recovery"] = _sample(
                inp.solution_gas_recovery_dist, n, rng
            )
    elif ft in ("gas", "gas_condensate"):
        arrays["gas_recovery"] = _sample(inp.gas_recovery_dist, n, rng)
        arrays["gef"] = _sample(inp.gef_dist, n, rng)
        summaries["gas_recovery"] = _summary_dict(
            arrays["gas_recovery"], "Gas Recovery", "fraction"
        )
        summaries["gef"] = _summary_dict(arrays["gef"], "GEF", "scf/reservoir ft3")
        if ft == "gas_condensate" and inp.condensate_yield_dist is not None:
            arrays["condensate_yield"] = _sample(inp.condensate_yield_dist, n, rng)
            summaries["condensate_yield"] = _summary_dict(
                arrays["condensate_yield"], "Condensate Yield", "bbl/MMscf"
            )

    return arrays, summaries, {}


def run_chance_module_preview(
    inp: SimulationInput,
) -> Tuple[Dict[str, np.ndarray], Dict[str, Any], Dict[str, Any]]:
    """Chance is deterministic from categories (no iteration vectors)."""
    meta: Dict[str, Any] = {}
    summaries: Dict[str, Any] = {}
    arrays: Dict[str, np.ndarray] = {}

    risk_model = getattr(inp, "risk_model", "legacy")
    ccop_data = getattr(inp, "ccop_risk", None)
    use_ccop = risk_model == "ccop_v1" and bool(ccop_data)
    if use_ccop or inp.chance_categories:
        if use_ccop:
            ccop_result = calculate_ccop_pg(inp.ccop_risk)
            pg = ccop_result.pg
            meta["pg"] = pg
            meta["category_chances"] = ccop_result.factor_probabilities
            meta["ccop_sub_factors"] = ccop_result.sub_factors
            risked = calculate_pg_ccop_or_legacy(
                inp.chance_categories, inp.ccop_risk, 1.0, "MMBOE"
            )
            meta["risk_review"] = risked.risk_review
        else:
            pg = calculate_pg(inp.chance_categories)
            meta["pg"] = pg
            meta["category_chances"] = {
                cat: calculate_pg({cat: factors})
                for cat, factors in inp.chance_categories.items()
            }
            risked = calculate_pg_risked_mean(
                inp.chance_categories, 1.0, resource_unit="MMBOE"
            )
        summaries["pg"] = {
            "pg": pg,
            "category_chances": meta["category_chances"],
            "unrisked_mean": 1.0,
            "pg_risked_mean": risked.pg_risked_mean,
            "resource_unit": "MMBOE (unit preview)",
            "risk_review": meta.get("risk_review"),
        }

    return arrays, summaries, meta


def run_nrv_module_preview(
    inp: SimulationInput,
    rng: Generator,
) -> Tuple[Dict[str, np.ndarray], Dict[str, Any], Dict[str, Any]]:
    """Sample GRV × fill × N/G (or direct NRV) → NRV; optional cross-check implied NP."""
    n = inp.n_iterations
    meta: Dict[str, Any] = {}
    ct = inp.complex_trap
    direct_nrv = getattr(inp, "nrv_entry_mode", "grv_fill_ntg") == "direct"
    ct_active = (
        ct is not None
        and ct.enabled
        and ct.active_element_count() > 0
        and not inp.cross_check_enabled
    )

    if direct_nrv:
        from .simulation import sample_nrv_direct_multiplier

        nrv_base = _sample(inp.nrv_direct_dist, n, rng) * sample_nrv_direct_multiplier(inp, n, rng)
        fill = np.ones(n)
        ntg = np.ones(n)
        if ct_active:
            nrv, grv, scen = apply_complex_trap_grv(
                nrv_base, fill, ntg, ct, rng, direct_nrv=True
            )
            meta["complex_trap_method"] = f"complex_trap_method_{(ct.method or 'A').upper()}_workbook"
            meta["complex_trap_scenario_counts"] = {
                SCENARIO_LABELS[c]: int(np.sum(scen == c)) for c in (0, 1, 2)
            }
        else:
            nrv = nrv_base
            grv = nrv
            scen = None
    else:
        grv = _sample(inp.grv_dist, n, rng)
        fill = _sample(inp.grv_percent_fill_dist, n, rng, default_value=1.0)
        ntg = _sample(inp.net_to_gross_dist, n, rng, default_value=1.0)
        rho_gn = float(getattr(inp, "grv_ntg_correlation", 0.0) or 0.0)
        if abs(rho_gn) > 1e-12:
            paired = apply_pair_rank_correlation(
                {"grv": grv, "net_to_gross": ntg}, "grv", "net_to_gross", rho_gn, rng
            )
            grv = paired["grv"]
            ntg = paired["net_to_gross"]
            meta["grv_ntg_correlation"] = rho_gn
        if ct_active:
            grv, nrv, scen = apply_complex_trap_grv(grv, fill, ntg, ct, rng, direct_nrv=False)
            meta["complex_trap_method"] = f"complex_trap_method_{(ct.method or 'A').upper()}_workbook"
            meta["complex_trap_scenario_counts"] = {
                SCENARIO_LABELS[c]: int(np.sum(scen == c)) for c in (0, 1, 2)
            }
        else:
            nrv = calculate_nrv_from_grv(grv, fill, ntg)
            scen = None

    arrays: Dict[str, np.ndarray] = {
        "grv_acft": grv,
        "grv_percent_fill": fill,
        "net_to_gross": ntg,
        "nrv_acft": nrv,
    }
    if scen is not None:
        arrays["complex_trap_scenario"] = scen.astype(float)
    summaries: Dict[str, Any] = {
        "nrv_acft": _summary_dict(nrv, "Net Rock Volume", "acre-ft"),
    }

    if inp.cross_check_enabled and inp.cross_check_area_dist is not None:
        cc_area = _sample(inp.cross_check_area_dist, n, rng)
        imp = implied_net_pay_ft(nrv, cc_area)
        arrays["cross_check_area_acres"] = cc_area
        arrays["implied_net_pay_ft"] = imp
        summaries["implied_net_pay_ft"] = _summary_dict(
            imp, "Implied Net Pay (cross-check)", "ft"
        )
        warns, _ = cross_check_warnings(nrv, cc_area)
        if warns:
            meta["cross_check_warnings"] = warns

    return arrays, summaries, meta


def run_module_preview(
    inp: SimulationInput,
    scope: str,
    seed: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Run a scoped preview simulation for one workflow tab.

    Raises ValueError if scope is unknown or required inputs are missing.
    """
    scope_key = scope.lower().strip()
    if scope_key not in MODULE_SCOPES:
        raise ValueError(
            f"Unknown module scope {scope!r}. Use one of: {', '.join(MODULE_SCOPES)}."
        )
    if scope_key == "full":
        raise ValueError("Use run_simulation() for scope='full'.")

    n = inp.n_iterations
    if n < 1000:
        raise ValueError(f"n_iterations={n} is below the minimum of 1,000.")

    rng = np.random.default_rng(seed if seed is not None else inp.seed)

    if scope_key == "area":
        if inp.area_dist is None:
            raise ValueError("area_dist is required for Area module preview.")
        arrays, summaries, meta = run_area_module_preview(inp, rng)
    elif scope_key == "net_pay":
        if inp.net_pay_dist is None:
            raise ValueError("net_pay_dist is required for Net Pay module preview.")
        arrays, summaries, meta = run_net_pay_module_preview(inp, rng)
    elif scope_key == "hc_yield":
        if inp.porosity_dist is None or inp.saturation_dist is None:
            raise ValueError("porosity and saturation are required for HC Yield preview.")
        arrays, summaries, meta = run_hc_yield_module_preview(inp, rng)
    elif scope_key == "chance":
        arrays, summaries, meta = run_chance_module_preview(inp)
    elif scope_key == "nrv":
        mode = getattr(inp, "nrv_entry_mode", "grv_fill_ntg")
        if mode == "direct":
            if inp.nrv_direct_dist is None:
                raise ValueError("nrv_direct_dist is required for NRV module preview.")
        else:
            for attr in ("grv_dist", "grv_percent_fill_dist", "net_to_gross_dist"):
                if getattr(inp, attr) is None:
                    raise ValueError(f"{attr} is required for NRV module preview.")
        arrays, summaries, meta = run_nrv_module_preview(inp, rng)
    else:
        raise ValueError(f"Unhandled scope {scope_key!r}")

    return {
        "scope": scope_key,
        "scope_label": SCOPE_LABELS.get(scope_key, scope_key),
        "schema_version": SCHEMA_VERSION,
        "engine_version": ENGINE_VERSION,
        "prospect_name": inp.prospect_name,
        "n_iterations": n,
        "seed": int(seed if seed is not None else inp.seed),
        "arrays": {k: v.tolist() for k, v in arrays.items()},
        "summaries": summaries,
        "metadata": meta,
    }
