"""Bridge between Pydantic API models and the mmra_engine package."""

from __future__ import annotations

import io
import hashlib
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import numpy as np

# Project root / engine on path
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_ENGINE_DIR = _PROJECT_ROOT / "engine"
if str(_ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(_ENGINE_DIR))

from mmra_engine import ENGINE_VERSION  # noqa: E402
from mmra_engine.export import (  # noqa: E402
    simulation_result_to_csv_tables,
    write_simulation_result_excel,
)
from mmra_engine.serialization import (  # noqa: E402
    SCHEMA_VERSION,
    compute_input_hash,
    percentile_summary_to_dict,
    simulation_input_from_dict,
    simulation_input_to_dict,
    simulation_result_to_dict,
    validation_report_to_dict,
)
from mmra_engine.module_preview import run_module_preview  # noqa: E402
from mmra_engine.simulation import SimulationInput, SimulationResult, run_simulation  # noqa: E402
from mmra_engine.stats import calculate_percentile_summary  # noqa: E402
from mmra_engine.resource_units import oil_summary_for_display, gas_summary_for_display  # noqa: E402
from mmra_engine.distributions import sample_distribution, apply_clips, distribution_repr_values  # noqa: E402
from mmra_engine.perturbation_tornado import (  # noqa: E402
    compute_perturbation_tornado,
    evaluate_volumetrics_scalar,
    perturbation_tornado_to_dict,
)
from mmra_engine.correlation import CorrelationPair  # noqa: E402
from mmra_engine.validation import (  # noqa: E402
    ValidationReport,
    validate_module_scope,
    validate_simulation_input,
)
from mmra_engine.validation_cases import (  # noqa: E402
    PM3XD_WORKBOOK_TARGETS,
    make_pm3xd_h1ss10_input,
)

from ..schemas.simulation import (  # noqa: E402
    GroupDependencyContext,
    SimulationInputBody,
)

_GROUP_PARAM_TO_VAR = {
    "grv": "grv",
    "grv_percent_fill": "grv_percent_fill",
    "net_to_gross": "net_to_gross",
    "area": "area",
    "percent_fill": "percent_fill",
    "net_pay": "net_pay",
    "geometric_correction": "geometric_correction",
    "porosity": "porosity",
    "saturation": "saturation",
    "oil_recovery": "oil_recovery",
    "fvf": "fvf",
    "gor": "gor",
    "solution_gas_recovery": "solution_gas_recovery",
    "gas_recovery": "gas_recovery",
    "gef": "gef",
    "condensate_yield": "condensate_yield",
    "nrv_direct": "nrv_direct",
}

_VAR_TO_DIST_ATTR = {
    "area": "area_dist",
    "percent_fill": "percent_fill_dist",
    "net_pay": "net_pay_dist",
    "geometric_correction": "geometric_correction_dist",
    "grv": "grv_dist",
    "grv_percent_fill": "grv_percent_fill_dist",
    "net_to_gross": "net_to_gross_dist",
    "nrv_direct": "nrv_direct_dist",
    "porosity": "porosity_dist",
    "saturation": "saturation_dist",
    "oil_recovery": "oil_recovery_dist",
    "fvf": "fvf_dist",
    "gor": "gor_dist",
    "solution_gas_recovery": "solution_gas_recovery_dist",
    "gas_recovery": "gas_recovery_dist",
    "gef": "gef_dist",
    "condensate_yield": "condensate_yield_dist",
}


def _group_member_matches(
    member: Any,
    *,
    active_segment_id: str,
    active_reservoir_id: str,
    all_segments: bool,
    all_reservoirs: bool,
) -> bool:
    seg_ok = (
        all_segments
        or member.segment_id in ("*", active_segment_id)
        or member.segment_id == active_segment_id
    )
    res_ok = (
        all_reservoirs
        or member.reservoir_id in ("*", active_reservoir_id)
        or member.reservoir_id == active_reservoir_id
    )
    return seg_ok and res_ok


def _build_active_group_map(
    context: GroupDependencyContext,
    active_segment_id: str,
    active_reservoir_id: str,
) -> Dict[str, str]:
    active_map: Dict[str, str] = {}
    for group in context.uncertainty_groups:
        variable = _GROUP_PARAM_TO_VAR.get(group.parameter)
        if not variable:
            continue
        in_active = any(
            _group_member_matches(
                member,
                active_segment_id=active_segment_id,
                active_reservoir_id=active_reservoir_id,
                all_segments=bool(group.all_segments),
                all_reservoirs=bool(group.all_reservoirs),
            )
            for member in group.members
        )
        if (group.all_segments and group.all_reservoirs) or in_active:
            active_map[variable] = group.id
    return active_map


def _apply_group_dependency_context(
    inp: SimulationInput,
    context: Optional[GroupDependencyContext],
    active_segment_id: Optional[str] = None,
    active_reservoir_id: Optional[str] = None,
) -> Tuple[SimulationInput, Dict[str, str], Dict[str, str]]:
    if not context or not context.uncertainty_groups:
        return inp, {}, {}
    seg_id = active_segment_id or context.active_segment_id
    res_id = active_reservoir_id or context.active_reservoir_id
    active_var_to_group = _build_active_group_map(context, seg_id, res_id)
    if not active_var_to_group:
        # No groups cover active tank -> keep per-tank settings as-is.
        return inp, {}, {}

    group_name_by_id = {g.id: g.name for g in context.uncertainty_groups}
    mode = context.group_correlation_mode or "independent"
    if mode == "independent":
        inp.correlation_mode = "independent"
        inp.correlations = []
        return inp, active_var_to_group, group_name_by_id

    matrix = context.group_correlation_matrix
    if not matrix or not matrix.group_ids:
        inp.correlation_mode = "independent"
        inp.correlations = []
        return inp, active_var_to_group, group_name_by_id

    ids = list(matrix.group_ids)
    pairs: list[CorrelationPair] = []
    active_vars = list(active_var_to_group.keys())
    for i in range(len(active_vars)):
        for j in range(i + 1, len(active_vars)):
            a = active_vars[i]
            b = active_vars[j]
            ga = active_var_to_group[a]
            gb = active_var_to_group[b]
            if ga == gb:
                continue
            try:
                ia = ids.index(ga)
                ib = ids.index(gb)
            except ValueError:
                continue
            rho = float(matrix.values[ia][ib])
            if abs(rho) <= 1e-12:
                continue
            pairs.append(
                CorrelationPair(
                    variable_a=a,
                    variable_b=b,
                    rho=max(-1.0, min(1.0, rho)),
                    enabled=True,
                    notes=f"group:{ga}<->{gb}",
                )
            )
    inp.correlation_mode = mode
    inp.correlations = pairs
    return inp, active_var_to_group, group_name_by_id


def _summary_from_array(
    arr: Optional[Any],
    name: str,
    unit: str,
    inp: SimulationInput,
    kind: str,
):
    if arr is None:
        return None
    s = calculate_percentile_summary(np.asarray(arr, dtype=float), name, unit)
    if kind == "oil":
        return oil_summary_for_display(s, inp)
    if kind == "gas":
        return gas_summary_for_display(s, inp)
    return s


def _seed_for(*parts: str, base_seed: int) -> int:
    raw = "|".join(parts) + f"|{base_seed}"
    h = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:8]
    return int(h, 16)


def _build_group_scores(
    context: GroupDependencyContext,
    n: int,
    base_seed: int,
) -> Dict[str, np.ndarray]:
    groups = [g.id for g in context.uncertainty_groups]
    if not groups:
        return {}
    rng = np.random.default_rng(_seed_for("group_scores", base_seed=base_seed))
    k = len(groups)
    Z = rng.standard_normal((n, k))
    mode = (context.group_correlation_mode or "independent").lower()
    matrix = context.group_correlation_matrix
    if mode in ("rank", "gaussian_copula") and matrix and matrix.group_ids:
        idx = {gid: i for i, gid in enumerate(matrix.group_ids)}
        R = np.eye(k, dtype=float)
        for i, ga in enumerate(groups):
            for j, gb in enumerate(groups):
                if i == j:
                    continue
                ia = idx.get(ga)
                ib = idx.get(gb)
                if ia is None or ib is None:
                    continue
                rho = float(matrix.values[ia][ib])
                R[i, j] = max(-1.0, min(1.0, rho))
        try:
            L = np.linalg.cholesky(R)
            Z = Z @ L.T
        except np.linalg.LinAlgError:
            # Safe fallback: keep independent draws if matrix is non-PSD.
            pass
    return {gid: Z[:, i] for i, gid in enumerate(groups)}


def _rank_map(scores: np.ndarray) -> np.ndarray:
    return np.argsort(np.argsort(scores, kind="mergesort"), kind="mergesort")


def _build_sample_overrides(
    inp: SimulationInput,
    tank_key: str,
    var_to_group: Dict[str, str],
    group_scores: Dict[str, np.ndarray],
) -> Dict[str, np.ndarray]:
    n = inp.n_iterations
    overrides: Dict[str, np.ndarray] = {}
    for var, gid in var_to_group.items():
        dist_attr = _VAR_TO_DIST_ATTR.get(var)
        if not dist_attr:
            continue
        dist = getattr(inp, dist_attr, None)
        if dist is None:
            continue
        scores = group_scores.get(gid)
        if scores is None or len(scores) != n:
            continue
        rng = np.random.default_rng(_seed_for("marginal", tank_key, var, base_seed=inp.seed))
        vals = sample_distribution(dist, n, rng)
        vals = apply_clips(vals, dist.low_clip, dist.high_clip)
        ranks = _rank_map(scores)
        overrides[var] = np.sort(vals)[ranks]
    return overrides


def _simulate_multi_tank(
    body: SimulationInputBody,
    context: GroupDependencyContext,
    include_arrays: bool,
) -> Tuple[SimulationInput, ValidationReport, SimulationResult, Dict[str, Any]]:
    tank_items = list((context.tank_inputs or {}).items())
    if not tank_items:
        raise ValueError("Multi-tank simulation requested but tank_inputs is empty.")

    tank_results: Dict[str, SimulationResult] = {}
    group_driver_map: Dict[str, Dict[str, str]] = {}
    first_inp: Optional[SimulationInput] = None
    first_report: Optional[ValidationReport] = None

    first_body = tank_items[0][1]
    base_seed = int(getattr(first_body, "seed", 42))
    base_n = int(getattr(first_body, "n_iterations", 5000))
    group_scores = _build_group_scores(context, base_n, base_seed=base_seed)

    for tank_key, tank_body in tank_items:
        if "::" not in tank_key:
            continue
        seg_id, res_id = tank_key.split("::", 1)
        inp = body_to_engine_input(tank_body)
        if inp.n_iterations != base_n:
            raise ValueError("All tanks must share the same n_iterations for multi-tank rollup.")
        var_to_group = _build_active_group_map(context, seg_id, res_id)
        group_name_by_id = {g.id: g.name for g in context.uncertainty_groups}
        inp.correlation_mode = "independent"
        inp.correlations = []
        inp._skip_input_correlations = True
        inp._sample_overrides = _build_sample_overrides(inp, tank_key, var_to_group, group_scores)
        report = validate_simulation_input(inp)
        if report.has_errors:
            raise ValueError(f"Validation failed for tank {tank_key}")
        result = run_simulation(inp)
        tank_results[tank_key] = result
        if first_inp is None:
            first_inp = inp
            first_report = report
        if seg_id == context.active_segment_id and res_id == context.active_reservoir_id:
            group_driver_map = {
                variable: {
                    "group_id": gid,
                    "group_name": group_name_by_id.get(gid, gid),
                }
                for variable, gid in var_to_group.items()
            }

    def summaries_for_arrays(arrays: Dict[str, Any], inp: SimulationInput) -> Dict[str, Any]:
        out: Dict[str, Any] = {}
        if "stoiip_mmbbl" in arrays:
            out["stoiip"] = percentile_summary_to_dict(
                oil_summary_for_display(
                    calculate_percentile_summary(np.asarray(arrays["stoiip_mmbbl"], dtype=float), "STOIIP", "MMbbl"),
                    inp,
                )
            )
        if "recoverable_oil_mmbbl" in arrays:
            out["recoverable_oil"] = percentile_summary_to_dict(
                oil_summary_for_display(
                    calculate_percentile_summary(
                        np.asarray(arrays["recoverable_oil_mmbbl"], dtype=float),
                        "Recoverable Oil",
                        "MMbbl",
                    ),
                    inp,
                )
            )
        if "solution_gas_bcf" in arrays:
            out["solution_gas"] = percentile_summary_to_dict(
                gas_summary_for_display(
                    calculate_percentile_summary(
                        np.asarray(arrays["solution_gas_bcf"], dtype=float),
                        "Solution Gas",
                        "Bcf",
                    ),
                    inp,
                )
            )
        if "giip_bcf" in arrays:
            out["giip"] = percentile_summary_to_dict(
                gas_summary_for_display(
                    calculate_percentile_summary(np.asarray(arrays["giip_bcf"], dtype=float), "GIIP", "Bcf"),
                    inp,
                )
            )
        if "recoverable_gas_bcf" in arrays:
            out["recoverable_gas"] = percentile_summary_to_dict(
                gas_summary_for_display(
                    calculate_percentile_summary(
                        np.asarray(arrays["recoverable_gas_bcf"], dtype=float),
                        "Recoverable Gas",
                        "Bcf",
                    ),
                    inp,
                )
            )
        if "condensate_mmbbl" in arrays:
            out["condensate"] = percentile_summary_to_dict(
                oil_summary_for_display(
                    calculate_percentile_summary(
                        np.asarray(arrays["condensate_mmbbl"], dtype=float),
                        "Condensate",
                        "MMbbl",
                    ),
                    inp,
                )
            )
        if "total_mmboe" in arrays:
            out["total_mmboe"] = percentile_summary_to_dict(
                calculate_percentile_summary(
                    np.asarray(arrays["total_mmboe"], dtype=float),
                    "Total Geologic Pre-drill",
                    getattr(inp, "total_resource_unit", "MMBOE") or "MMBOE",
                )
            )
        return out

    if not tank_results or first_inp is None or first_report is None:
        raise ValueError("No valid tanks for multi-tank simulation.")

    n = next(iter(tank_results.values())).n_iterations
    sum_keys = [
        "nrv_acft",
        "hcpv_acft",
        "stoiip_mmbbl",
        "recoverable_oil_mmbbl",
        "solution_gas_bcf",
        "giip_bcf",
        "recoverable_gas_bcf",
        "condensate_mmbbl",
        "total_mmboe",
    ]
    agg_arrays: Dict[str, Any] = {}
    for key in sum_keys:
        vec = None
        for tr in tank_results.values():
            arr = tr.arrays.get(key)
            if arr is None:
                continue
            vec = np.asarray(arr, dtype=float) if vec is None else vec + np.asarray(arr, dtype=float)
        if vec is not None:
            agg_arrays[key] = vec

    # Keep active-tank sampled inputs for driver diagnostics (Spearman tornado labels/groups).
    active_key = f"{context.active_segment_id}::{context.active_reservoir_id}"
    if active_key in tank_results:
        for k, arr in tank_results[active_key].arrays.items():
            if k in (
                "area",
                "percent_fill",
                "net_pay_ft",
                "geometric_correction",
                "grv_acft",
                "grv_percent_fill",
                "net_to_gross",
                "porosity",
                "saturation",
                "oil_recovery",
                "fvf",
                "gor",
                "solution_gas_recovery",
                "gas_recovery",
                "gef",
                "condensate_yield",
            ):
                agg_arrays[k] = arr

    base = next(iter(tank_results.values()))
    agg_result = SimulationResult(
        prospect_name=base.prospect_name,
        fluid_type=base.fluid_type,
        zone_name=base.zone_name,
        seed=base.seed,
        n_iterations=base.n_iterations,
        gas_oil_ratio=base.gas_oil_ratio,
        run_timestamp=base.run_timestamp,
        engine_version=base.engine_version,
        input_hash=base.input_hash,
        correlation_mode=f"multi_tank:{context.group_correlation_mode}",
        complex_trap_method=base.complex_trap_method,
        complex_trap_scenario_counts=base.complex_trap_scenario_counts,
        percentile_convention=base.percentile_convention,
        unit_system_version=base.unit_system_version,
        clipping_applied=any(r.clipping_applied for r in tank_results.values()),
        stoiip=_summary_from_array(agg_arrays.get("stoiip_mmbbl"), "STOIIP", "MMbbl", first_inp, "oil"),
        recoverable_oil=_summary_from_array(
            agg_arrays.get("recoverable_oil_mmbbl"), "Recoverable Oil", "MMbbl", first_inp, "oil"
        ),
        solution_gas=_summary_from_array(
            agg_arrays.get("solution_gas_bcf"), "Solution Gas", "Bcf", first_inp, "gas"
        ),
        giip=_summary_from_array(agg_arrays.get("giip_bcf"), "GIIP", "Bcf", first_inp, "gas"),
        recoverable_gas=_summary_from_array(
            agg_arrays.get("recoverable_gas_bcf"), "Recoverable Gas", "Bcf", first_inp, "gas"
        ),
        condensate=_summary_from_array(
            agg_arrays.get("condensate_mmbbl"), "Condensate", "MMbbl", first_inp, "oil"
        ),
        total_mmboe=calculate_percentile_summary(
            np.asarray(agg_arrays.get("total_mmboe"), dtype=float),
            "Total Geologic Pre-drill",
            getattr(first_inp, "total_resource_unit", "MMBOE") or "MMBOE",
        )
        if "total_mmboe" in agg_arrays
        else None,
        pg_result=None,
        arrays=agg_arrays,
        warnings=[
            f"Multi-tank rollup across {len(tank_results)} tank(s).",
            "Group dependencies applied by tank from uncertainty groups; non-grouped inputs remain tank-level.",
        ],
        solution_gas_included=base.solution_gas_included,
        oil_recovery_applied=base.oil_recovery_applied,
        chance_applied=base.chance_applied,
        volume_basis=base.volume_basis,
    )

    response = {
        "schema_version": SCHEMA_VERSION,
        "engine_version": ENGINE_VERSION,
        "input_hash": compute_input_hash(first_inp),
        "input_hash_engine": agg_result.input_hash,
        "validation": validation_to_response(first_report, first_inp),
        "result": simulation_result_to_dict(agg_result, include_arrays=include_arrays),
        "group_driver_map": group_driver_map,
        "multi_tank": {
            "enabled": True,
            "tank_count": len(tank_results),
        },
    }
    # Results breakdown for UI (prospect/reservoir/segment/tank).
    tank_breakdown = []
    for tank_key, tr in tank_results.items():
        sid, rid = tank_key.split("::", 1)
        tank_breakdown.append(
            {
                "id": tank_key,
                "segment_id": sid,
                "reservoir_id": rid,
                "label": f"{rid}-{sid}",
                "summaries": summaries_for_arrays(tr.arrays, first_inp),
            }
        )

    reservoir_arrays: Dict[str, Dict[str, Any]] = {}
    segment_arrays: Dict[str, Dict[str, Any]] = {}
    keys = [
        "stoiip_mmbbl",
        "recoverable_oil_mmbbl",
        "solution_gas_bcf",
        "giip_bcf",
        "recoverable_gas_bcf",
        "condensate_mmbbl",
        "total_mmboe",
    ]
    for tank_key, tr in tank_results.items():
        sid, rid = tank_key.split("::", 1)
        reservoir_arrays.setdefault(rid, {})
        segment_arrays.setdefault(sid, {})
        for k in keys:
            arr = tr.arrays.get(k)
            if arr is None:
                continue
            reservoir_arrays[rid][k] = (
                np.asarray(arr, dtype=float)
                if k not in reservoir_arrays[rid]
                else reservoir_arrays[rid][k] + np.asarray(arr, dtype=float)
            )
            segment_arrays[sid][k] = (
                np.asarray(arr, dtype=float)
                if k not in segment_arrays[sid]
                else segment_arrays[sid][k] + np.asarray(arr, dtype=float)
            )
    response["breakdown"] = {
        "prospect": {"id": "prospect", "label": first_inp.prospect_name, "summaries": summaries_for_arrays(agg_arrays, first_inp)},
        "reservoirs": [
            {"id": rid, "label": rid, "summaries": summaries_for_arrays(arrs, first_inp)}
            for rid, arrs in reservoir_arrays.items()
        ],
        "segments": [
            {"id": sid, "label": sid, "summaries": summaries_for_arrays(arrs, first_inp)}
            for sid, arrs in segment_arrays.items()
        ],
        "tanks": tank_breakdown,
    }
    return first_inp, first_report, agg_result, response


def _group_membership_map(
    context: GroupDependencyContext,
) -> Dict[str, list[tuple[str, str]]]:
    out: Dict[str, list[tuple[str, str]]] = {}
    for g in context.uncertainty_groups:
        members: list[tuple[str, str]] = []
        if g.all_segments and g.all_reservoirs:
            for sid in context.segment_ids:
                for rid in context.reservoir_ids:
                    members.append((sid, rid))
        elif g.all_segments:
            res_ids = [m.reservoir_id for m in g.members if m.reservoir_id != "*"]
            for sid in context.segment_ids:
                for rid in res_ids:
                    members.append((sid, rid))
        elif g.all_reservoirs:
            seg_ids = [m.segment_id for m in g.members if m.segment_id != "*"]
            for sid in seg_ids:
                for rid in context.reservoir_ids:
                    members.append((sid, rid))
        else:
            for m in g.members:
                members.append((m.segment_id, m.reservoir_id))
        out[g.id] = members
    return out


def _multi_tank_group_tornado(
    context: GroupDependencyContext,
    target: str,
    scope_type: str = "prospect",
    scope_id: Optional[str] = None,
) -> Dict[str, Any]:
    tank_items = list((context.tank_inputs or {}).items())
    if not tank_items:
        raise ValueError("Group tornado requested but tank_inputs is empty.")

    tank_inputs: Dict[str, SimulationInput] = {}
    for tank_key, tank_body in tank_items:
        if "::" not in tank_key:
            continue
        inp = body_to_engine_input(tank_body)
        report = validate_simulation_input(inp)
        if report.has_errors:
            raise ValueError(f"Validation failed for tank {tank_key}")
        tank_inputs[tank_key] = inp

    if not tank_inputs:
        raise ValueError("No valid tank inputs for group tornado.")

    if scope_type in ("reservoir", "segment", "tank") and scope_id:
        scoped: Dict[str, SimulationInput] = {}
        for key, inp in tank_inputs.items():
            sid, rid = key.split("::", 1)
            if scope_type == "reservoir" and rid == scope_id:
                scoped[key] = inp
            elif scope_type == "segment" and sid == scope_id:
                scoped[key] = inp
            elif scope_type == "tank" and key == scope_id:
                scoped[key] = inp
        if scoped:
            tank_inputs = scoped

    active_key = f"{context.active_segment_id}::{context.active_reservoir_id}"
    active_inp = tank_inputs.get(active_key) or next(iter(tank_inputs.values()))
    active_tornado = compute_perturbation_tornado(active_inp, target_key=target)

    base_value = 0.0
    for inp in tank_inputs.values():
        base_value += float(evaluate_volumetrics_scalar(inp, {}).get(target, 0.0))

    member_map = _group_membership_map(context)
    drivers: list[Dict[str, Any]] = []
    for group in context.uncertainty_groups:
        var = _GROUP_PARAM_TO_VAR.get(group.parameter)
        if not var:
            continue
        members = set(member_map.get(group.id, []))
        low_total = 0.0
        high_total = 0.0
        has_any = False
        for tank_key, inp in tank_inputs.items():
            sid, rid = tank_key.split("::", 1)
            dist_attr = _VAR_TO_DIST_ATTR.get(var)
            dist = getattr(inp, dist_attr, None) if dist_attr else None
            if (sid, rid) in members and dist is not None:
                rv = distribution_repr_values(dist)
                low_total += float(evaluate_volumetrics_scalar(inp, {var: rv["p90"]}).get(target, 0.0))
                high_total += float(evaluate_volumetrics_scalar(inp, {var: rv["p10"]}).get(target, 0.0))
                has_any = True
            else:
                base_tank = float(evaluate_volumetrics_scalar(inp, {}).get(target, 0.0))
                low_total += base_tank
                high_total += base_tank
        drivers.append(
            {
                "driver_id": group.id,
                "label": group.name,
                "delta_low": low_total - base_value,
                "delta_high": high_total - base_value,
                "swing_low": 0.0,
                "swing_high": 0.0,
                "is_fixed": not has_any,
            }
        )

    drivers.sort(
        key=lambda d: max(abs(float(d["delta_low"])), abs(float(d["delta_high"]))),
        reverse=True,
    )
    return {
        "target_key": active_tornado.target_key,
        "target_label": active_tornado.target_label,
        "target_unit": active_tornado.target_unit,
        "base_value": base_value,
        "method_note": (
            "Prospect-level OAT tornado: one uncertainty group is swung to P90/P10 "
            "across all member tanks while non-member tanks stay at P50. Group "
            "correlations are not applied in OAT."
        ),
        "scope_type": scope_type,
        "scope_id": scope_id,
        "drivers": drivers,
    }


def body_to_engine_input(body: SimulationInputBody) -> SimulationInput:
    data = body.model_dump(exclude_none=False)
    # Pydantic leaves None for optional dists; serialization expects null keys
    for key in list(data.keys()):
        if key.endswith("_dist") and data[key] is None:
            data[key] = None
    inp = simulation_input_from_dict(data)
    from mmra_engine.calculation_toggles import sync_toggles_from_distributions

    return sync_toggles_from_distributions(inp)


def validation_to_response(report: ValidationReport, inp: SimulationInput) -> Dict[str, Any]:
    payload = validation_report_to_dict(report)
    payload["has_errors"] = report.has_errors
    payload["can_run_simulation"] = report.can_run_simulation
    payload["input_hash"] = compute_input_hash(inp)
    return payload


def get_pm3xd_input_body() -> Dict[str, Any]:
    inp = make_pm3xd_h1ss10_input()
    return simulation_input_to_dict(inp)


def validate_input(body: SimulationInputBody) -> Tuple[SimulationInput, Dict[str, Any]]:
    inp = body_to_engine_input(body)
    report = validate_simulation_input(inp)
    return inp, validation_to_response(report, inp)


def module_preview(
    body: SimulationInputBody,
    scope: str,
) -> Tuple[SimulationInput, ValidationReport, Optional[Dict[str, Any]], Dict[str, Any]]:
    """
    Scoped Monte Carlo preview for one workflow tab.

    Returns (input, report, payload_or_none, validation_dict).
    payload is None when validation has blocking errors.
    """
    inp = body_to_engine_input(body)
    report = validate_module_scope(inp, scope)
    report_dict = validation_to_response(report, inp)
    if report.has_errors:
        return inp, report, None, report_dict
    preview = run_module_preview(inp, scope)
    payload = {
        **preview,
        "input_hash": compute_input_hash(inp),
        "validation": report_dict,
    }
    return inp, report, payload, report_dict


def perturbation_tornado(
    body: SimulationInputBody,
    target: str = "total_mmboe",
    context: Optional[GroupDependencyContext] = None,
    scope_type: str = "prospect",
    scope_id: Optional[str] = None,
) -> Tuple[SimulationInput, ValidationReport, Dict[str, Any], Dict[str, Any]]:
    """Workbook-style OAT P10/P90 perturbation tornado (no Monte Carlo)."""
    if context and context.uncertainty_groups:
        inp = body_to_engine_input(body)
        report = validate_simulation_input(inp)
        report_dict = validation_to_response(report, inp)
        if report.has_errors:
            return inp, report, {}, report_dict
        ctx = context
        if not ctx.tank_inputs:
            # Fallback: still run group OAT on active tank if tank_inputs were not provided.
            active_key = f"{ctx.active_segment_id}::{ctx.active_reservoir_id}"
            ctx = ctx.model_copy(deep=True)
            ctx.tank_inputs = {active_key: body}
        tornado = _multi_tank_group_tornado(ctx, target, scope_type=scope_type, scope_id=scope_id)
        payload = {
            "schema_version": SCHEMA_VERSION,
            "engine_version": ENGINE_VERSION,
            "input_hash": compute_input_hash(inp),
            "validation": report_dict,
            "tornado": tornado,
            "multi_tank": {"enabled": len(ctx.tank_inputs) > 1, "group_oat": True},
            "debug_context": {
                "groups": len(ctx.uncertainty_groups),
                "tank_inputs": len(ctx.tank_inputs),
            },
        }
        return inp, report, payload, report_dict

    inp = body_to_engine_input(body)
    inp, var_to_group, group_name_by_id = _apply_group_dependency_context(inp, context)
    report = validate_simulation_input(inp)
    report_dict = validation_to_response(report, inp)
    if report.has_errors:
        return inp, report, {}, report_dict
    result = compute_perturbation_tornado(inp, target_key=target)
    for driver in result.drivers:
        gid = var_to_group.get(driver.driver_id)
        if gid:
            driver.label = group_name_by_id.get(gid, driver.label)
            driver.driver_id = gid
    payload = {
        "schema_version": SCHEMA_VERSION,
        "engine_version": ENGINE_VERSION,
        "input_hash": compute_input_hash(inp),
        "validation": report_dict,
        "tornado": perturbation_tornado_to_dict(result),
    }
    return inp, report, payload, report_dict


def simulate(
    body: SimulationInputBody,
    include_arrays: bool = False,
    context: Optional[GroupDependencyContext] = None,
) -> Tuple[SimulationInput, ValidationReport, SimulationResult, Dict[str, Any]]:
    if context and context.tank_inputs:
        return _simulate_multi_tank(body, context, include_arrays)
    inp = body_to_engine_input(body)
    inp, var_to_group, group_name_by_id = _apply_group_dependency_context(inp, context)
    report = validate_simulation_input(inp)
    if report.has_errors:
        raise ValueError("Validation failed")
    result = run_simulation(inp)
    response = {
        "schema_version": SCHEMA_VERSION,
        "engine_version": ENGINE_VERSION,
        "input_hash": compute_input_hash(inp),
        "input_hash_engine": result.input_hash,
        "validation": validation_to_response(report, inp),
        "result": simulation_result_to_dict(result, include_arrays=include_arrays),
    }
    if var_to_group:
        response["group_driver_map"] = {
            variable: {
                "group_id": gid,
                "group_name": group_name_by_id.get(gid, gid),
            }
            for variable, gid in var_to_group.items()
        }
    return inp, report, result, response


def build_csv_zip(
    inp: SimulationInput,
    result: SimulationResult,
    report: ValidationReport,
    include_workbook_targets: bool = False,
) -> bytes:
    targets = PM3XD_WORKBOOK_TARGETS if include_workbook_targets else None
    tables = simulation_result_to_csv_tables(
        result,
        input=inp,
        validation_report=report,
        workbook_targets=targets,
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, content in tables.items():
            zf.writestr(f"{name}.csv", content)
    buffer.seek(0)
    return buffer.getvalue()


def build_excel_bytes(
    inp: SimulationInput,
    result: SimulationResult,
    report: ValidationReport,
    include_workbook_targets: bool = False,
) -> bytes:
    targets = PM3XD_WORKBOOK_TARGETS if include_workbook_targets else None
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        path = Path(tmp.name)
    try:
        write_simulation_result_excel(
            path,
            result,
            input=inp,
            validation_report=report,
            workbook_targets=targets,
        )
        return path.read_bytes()
    finally:
        path.unlink(missing_ok=True)
