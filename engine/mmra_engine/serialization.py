"""
serialization.py – JSON-compatible conversion for engine dataclasses.

Pure Python only; no FastAPI/Pydantic imports.
"""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any, Dict, List, Optional

import numpy as np

from . import ENGINE_VERSION
from .chance import PgRiskedResult
from .complex_traps import ComplexTrapConfig, ComplexTrapElement
from .correlation import (
    CorrelationMatrix,
    CorrelationPair,
    correlatable_variables_for_input,
    filter_pairs_to_variables,
    matrix_from_pairs,
    merge_pairs_with_matrix,
)
from .distributions import DistributionDef, DistributionType
from .simulation import SimulationInput, SimulationResult
from .stats import PercentileSummary
from .validation import ValidationIssue, ValidationReport, ValidationSeverity

SCHEMA_VERSION = "1"


def _load_toggle_field(data: Dict[str, Any], name: str) -> Optional[bool]:
    """
    Load optional calculation toggle from JSON.

    Missing key or explicit null → None (infer from distributions in engine).
    """
    if name not in data:
        return None
    raw = data[name]
    if raw is None:
        return None
    return bool(raw)


def _json_safe_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, np.generic):
        v = float(value)
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    return value


def distribution_to_dict(dist: DistributionDef) -> Dict[str, Any]:
    return {
        "variable_id": dist.variable_id,
        "display_name": dist.display_name,
        "distribution_type": dist.distribution_type.value,
        "unit": dist.unit,
        "canonical_unit": dist.canonical_unit,
        "p90": dist.p90,
        "p50": dist.p50,
        "p10": dist.p10,
        "fixed_value": dist.fixed_value,
        "tri_min": dist.tri_min,
        "tri_mode": dist.tri_mode,
        "tri_max": dist.tri_max,
        "min_bound": dist.min_bound,
        "max_bound": dist.max_bound,
        "low_clip": dist.low_clip,
        "high_clip": dist.high_clip,
        "notes": dist.notes,
        "solved_alpha": dist.solved_alpha,
        "solved_beta": dist.solved_beta,
        "solved_mu": dist.solved_mu,
        "solved_sigma": dist.solved_sigma,
    }


def distribution_from_dict(data: Dict[str, Any]) -> DistributionDef:
    dtype = data.get("distribution_type")
    if dtype is None:
        raise ValueError("distribution_type is required")
    try:
        distribution_type = DistributionType(dtype)
    except ValueError as exc:
        raise ValueError(f"Unknown distribution_type: {dtype!r}") from exc

    return DistributionDef(
        variable_id=data["variable_id"],
        display_name=data["display_name"],
        distribution_type=distribution_type,
        unit=data.get("unit", ""),
        canonical_unit=data.get("canonical_unit", ""),
        p90=data.get("p90"),
        p50=data.get("p50"),
        p10=data.get("p10"),
        fixed_value=data.get("fixed_value"),
        tri_min=data.get("tri_min"),
        tri_mode=data.get("tri_mode"),
        tri_max=data.get("tri_max"),
        min_bound=data.get("min_bound"),
        max_bound=data.get("max_bound"),
        low_clip=data.get("low_clip"),
        high_clip=data.get("high_clip"),
        notes=data.get("notes", ""),
        solved_alpha=data.get("solved_alpha"),
        solved_beta=data.get("solved_beta"),
        solved_mu=data.get("solved_mu"),
        solved_sigma=data.get("solved_sigma"),
    )


def percentile_summary_to_dict(summary: PercentileSummary) -> Dict[str, Any]:
    return {
        "product_name": summary.product_name,
        "unit": summary.unit,
        "p99": summary.p99,
        "p90": summary.p90,
        "p50": summary.p50,
        "mean_trimmed": summary.mean_trimmed,
        "p10": summary.p10,
        "p01": summary.p01,
        "mean_full": summary.mean_full,
        "minimum": summary.minimum,
        "maximum": summary.maximum,
        "std_dev": summary.std_dev,
        "n_samples": summary.n_samples,
    }


def percentile_summary_from_dict(data: Dict[str, Any]) -> PercentileSummary:
    return PercentileSummary(
        product_name=data["product_name"],
        unit=data["unit"],
        p99=data["p99"],
        p90=data["p90"],
        p50=data["p50"],
        mean_trimmed=data["mean_trimmed"],
        p10=data["p10"],
        p01=data["p01"],
        mean_full=data.get("mean_full"),
        minimum=data.get("minimum"),
        maximum=data.get("maximum"),
        std_dev=data.get("std_dev"),
        n_samples=data.get("n_samples", 0),
    )


def pg_risked_result_to_dict(result: PgRiskedResult) -> Dict[str, Any]:
    out = {
        "pg": result.pg,
        "category_chances": result.category_chances,
        "unrisked_trimmed_mean": result.unrisked_trimmed_mean,
        "pg_risked_mean": result.pg_risked_mean,
        "resource_unit": result.resource_unit,
    }
    if result.risk_review is not None:
        out["risk_review"] = result.risk_review
    return out


def pg_risked_result_from_dict(data: Dict[str, Any]) -> PgRiskedResult:
    return PgRiskedResult(
        pg=data["pg"],
        category_chances=dict(data["category_chances"]),
        unrisked_trimmed_mean=data["unrisked_trimmed_mean"],
        pg_risked_mean=data["pg_risked_mean"],
        resource_unit=data.get("resource_unit", "MMBOE"),
        risk_review=data.get("risk_review"),
    )


_DIST_FIELDS = (
    "area_dist",
    "percent_fill_dist",
    "net_pay_dist",
    "geometric_correction_dist",
    "porosity_dist",
    "saturation_dist",
    "oil_recovery_dist",
    "fvf_dist",
    "gor_dist",
    "solution_gas_recovery_dist",
    "gas_recovery_dist",
    "gef_dist",
    "condensate_yield_dist",
    "grv_dist",
    "grv_percent_fill_dist",
    "net_to_gross_dist",
    "nrv_direct_dist",
    "nrv_direct_multiplier_dist",
    "cross_check_area_dist",
)


def correlation_pair_to_dict(pair: CorrelationPair) -> Dict[str, Any]:
    return {
        "variable_a": pair.variable_a,
        "variable_b": pair.variable_b,
        "rho": pair.rho,
        "enabled": pair.enabled,
        "notes": pair.notes,
    }


def correlation_matrix_to_dict(matrix: CorrelationMatrix) -> Dict[str, Any]:
    return matrix.to_dict()


def correlation_matrix_from_dict(data: Dict[str, Any]) -> CorrelationMatrix:
    return CorrelationMatrix.from_dict(data)


def complex_trap_element_to_dict(el: ComplexTrapElement) -> Dict[str, Any]:
    return {
        "enabled": el.enabled,
        "max_area_acres": el.max_area_acres,
        "seal_confidence": el.seal_confidence,
        "notes": el.notes,
    }


def complex_trap_element_from_dict(data: Dict[str, Any]) -> ComplexTrapElement:
    return ComplexTrapElement(
        enabled=bool(data.get("enabled", False)),
        max_area_acres=float(data.get("max_area_acres", 0.0)),
        seal_confidence=float(data.get("seal_confidence", 0.5)),
        notes=data.get("notes", ""),
    )


def complex_trap_to_dict(ct: ComplexTrapConfig) -> Dict[str, Any]:
    return {
        "enabled": ct.enabled,
        "method": ct.method,
        "num_elements": ct.num_elements,
        "element_1": complex_trap_element_to_dict(ct.element_1),
        "element_2": complex_trap_element_to_dict(ct.element_2),
    }


def complex_trap_from_dict(data: Optional[Dict[str, Any]]) -> ComplexTrapConfig:
    if not data:
        return ComplexTrapConfig()
    return ComplexTrapConfig(
        enabled=bool(data.get("enabled", False)),
        method=data.get("method", "A"),
        num_elements=int(data.get("num_elements", 1)),
        element_1=complex_trap_element_from_dict(data.get("element_1", {})),
        element_2=complex_trap_element_from_dict(data.get("element_2", {})),
    )


def correlation_pair_from_dict(data: Dict[str, Any]) -> CorrelationPair:
    return CorrelationPair(
        variable_a=data["variable_a"],
        variable_b=data["variable_b"],
        rho=float(data["rho"]),
        enabled=bool(data.get("enabled", True)),
        notes=data.get("notes", ""),
    )


def _correlatable_variables(inp: SimulationInput) -> List[str]:
    from .calculation_toggles import (
        apply_oil_recovery,
        gor_active_for_correlations,
    )

    vars_ = correlatable_variables_for_input(
        inp.fluid_type,
        estimating_method=getattr(inp, "estimating_method", "area_net_pay_yield"),
        nrv_entry_mode=getattr(inp, "nrv_entry_mode", "grv_fill_ntg"),
        gor_present=gor_active_for_correlations(inp),
        condensate_present=inp.condensate_yield_dist is not None,
        oil_recovery_present=apply_oil_recovery(inp),
    )
    return vars_


def _correlations_for_export(inp: SimulationInput) -> List[CorrelationPair]:
    return filter_pairs_to_variables(inp.correlations, _correlatable_variables(inp))


def simulation_input_to_dict(inp: SimulationInput) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "engine_version": ENGINE_VERSION,
        "prospect_name": inp.prospect_name,
        "fluid_type": inp.fluid_type,
        "zone_name": inp.zone_name,
        "country": inp.country,
        "basin": inp.basin,
        "formation": inp.formation,
        "notes": inp.notes,
        "n_iterations": inp.n_iterations,
        "seed": inp.seed,
        "gas_oil_ratio": inp.gas_oil_ratio,
        "chance_categories": inp.chance_categories,
        "risk_model": getattr(inp, "risk_model", "legacy"),
        "ccop_risk": getattr(inp, "ccop_risk", None),
        "correlation_mode": inp.correlation_mode,
        "correlations": [
            correlation_pair_to_dict(p)
            for p in _correlations_for_export(inp)
        ],
        "correlation_matrix": correlation_matrix_to_dict(
            matrix_from_pairs(
                _correlatable_variables(inp),
                _correlations_for_export(inp),
            )
        ),
        "complex_trap": complex_trap_to_dict(inp.complex_trap),
        "estimating_method": getattr(inp, "estimating_method", "area_net_pay_yield"),
        "nrv_entry_mode": getattr(inp, "nrv_entry_mode", "grv_fill_ntg"),
        "cross_check_enabled": getattr(inp, "cross_check_enabled", False),
        "grv_ntg_correlation": getattr(inp, "grv_ntg_correlation", 0.0),
        "oil_resource_unit": getattr(inp, "oil_resource_unit", "MMBO"),
        "gas_resource_unit": getattr(inp, "gas_resource_unit", "BCF"),
        "total_resource_unit": getattr(inp, "total_resource_unit", "MMBOE"),
        "area_input_unit": getattr(inp, "area_input_unit", "acres"),
        "grv_input_unit": getattr(inp, "grv_input_unit", "acre_ft"),
        "nrv_input_unit": getattr(inp, "nrv_input_unit", "acre_ft"),
        "include_solution_gas": (
            True if inp.include_solution_gas is None else inp.include_solution_gas
        ),
        "apply_oil_recovery": (
            True if inp.apply_oil_recovery is None else inp.apply_oil_recovery
        ),
        "include_chance": True if inp.include_chance is None else inp.include_chance,
    }
    for name in _DIST_FIELDS:
        dist = getattr(inp, name)
        payload[name] = distribution_to_dict(dist) if dist is not None else None
    return payload


def simulation_input_from_dict(data: Dict[str, Any]) -> SimulationInput:
    version = data.get("schema_version")
    if version != SCHEMA_VERSION:
        raise ValueError(
            f"Unsupported schema_version {version!r}; expected {SCHEMA_VERSION!r}"
        )

    kwargs: Dict[str, Any] = {
        "prospect_name": data.get("prospect_name", "Unnamed Prospect"),
        "fluid_type": data.get("fluid_type", "oil"),
        "zone_name": data.get("zone_name", "Zone 1"),
        "country": data.get("country", ""),
        "basin": data.get("basin", ""),
        "formation": data.get("formation", ""),
        "notes": data.get("notes", ""),
        "n_iterations": data.get("n_iterations", 5000),
        "seed": data.get("seed", 42),
        "gas_oil_ratio": data.get("gas_oil_ratio", 6.0),
        "chance_categories": data.get("chance_categories", {}),
        "risk_model": data.get("risk_model", "legacy"),
        "ccop_risk": data.get("ccop_risk"),
        "correlation_mode": data.get("correlation_mode", "independent"),
        "correlations": [
            correlation_pair_from_dict(p) for p in data.get("correlations", [])
        ],
        "complex_trap": complex_trap_from_dict(data.get("complex_trap")),
        "estimating_method": data.get("estimating_method", "area_net_pay_yield"),
        "nrv_entry_mode": data.get("nrv_entry_mode", "grv_fill_ntg"),
        "cross_check_enabled": bool(data.get("cross_check_enabled", False)),
        "grv_ntg_correlation": float(data.get("grv_ntg_correlation", 0.0)),
        "oil_resource_unit": data.get("oil_resource_unit", "MMBO"),
        "gas_resource_unit": data.get("gas_resource_unit", "BCF"),
        "total_resource_unit": data.get("total_resource_unit", "MMBOE"),
        "area_input_unit": data.get("area_input_unit", "acres"),
        "grv_input_unit": data.get("grv_input_unit", "acre_ft"),
        "nrv_input_unit": data.get("nrv_input_unit", "acre_ft"),
        "include_solution_gas": _load_toggle_field(data, "include_solution_gas"),
        "apply_oil_recovery": _load_toggle_field(data, "apply_oil_recovery"),
        "include_chance": _load_toggle_field(data, "include_chance"),
    }
    for name in _DIST_FIELDS:
        raw = data.get(name)
        kwargs[name] = distribution_from_dict(raw) if raw is not None else None

    if kwargs.get("nrv_direct_multiplier_dist") is None:
        legacy_mult = float(data.get("nrv_direct_multiplier", 1.0) or 1.0)
        kwargs["nrv_direct_multiplier_dist"] = distribution_from_dict(
            {
                "variable_id": "nrv_direct_multiplier",
                "display_name": "NRV multiply factor",
                "distribution_type": "fixed",
                "unit": "fraction",
                "canonical_unit": "fraction",
                "fixed_value": legacy_mult,
            }
        )

    inp = SimulationInput(**kwargs)
    matrix_raw = data.get("correlation_matrix")
    if matrix_raw:
        spec = correlation_matrix_from_dict(matrix_raw)
        if spec.variables and spec.values:
            inp.correlations = merge_pairs_with_matrix(
                inp.correlations,
                spec.variables,
                spec.values,
            )
    inp.correlations = _correlations_for_export(inp)
    return inp


def compute_input_hash(inp: SimulationInput) -> str:
    raw = json.dumps(simulation_input_to_dict(inp), sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def simulation_input_to_json(inp: SimulationInput) -> str:
    return json.dumps(simulation_input_to_dict(inp), sort_keys=True)


def simulation_input_from_json(text: str) -> SimulationInput:
    return simulation_input_from_dict(json.loads(text))


def validation_issue_to_dict(issue: ValidationIssue) -> Dict[str, Any]:
    return {
        "code": issue.code,
        "severity": issue.severity.value,
        "module": issue.module,
        "field": issue.field,
        "message": issue.message,
        "recommended_action": issue.recommended_action,
        "value": _json_safe_value(issue.value),
    }


def validation_issue_from_dict(data: Dict[str, Any]) -> ValidationIssue:
    try:
        severity = ValidationSeverity(data["severity"])
    except ValueError as exc:
        raise ValueError(f"Unknown severity: {data.get('severity')!r}") from exc
    return ValidationIssue(
        code=data["code"],
        severity=severity,
        module=data["module"],
        field=data["field"],
        message=data["message"],
        recommended_action=data.get("recommended_action"),
        value=data.get("value"),
    )


def validation_report_to_dict(report: ValidationReport) -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "issues": [validation_issue_to_dict(i) for i in report.issues],
    }


def validation_report_from_dict(data: Dict[str, Any]) -> ValidationReport:
    version = data.get("schema_version")
    if version != SCHEMA_VERSION:
        raise ValueError(
            f"Unsupported schema_version {version!r}; expected {SCHEMA_VERSION!r}"
        )
    report = ValidationReport()
    for item in data.get("issues", []):
        report.add_issue(validation_issue_from_dict(item))
    return report


def _optional_summary_to_dict(summary: Optional[PercentileSummary]) -> Optional[Dict[str, Any]]:
    return percentile_summary_to_dict(summary) if summary is not None else None


def _optional_summary_from_dict(data: Optional[Dict[str, Any]]) -> Optional[PercentileSummary]:
    return percentile_summary_from_dict(data) if data is not None else None


def simulation_result_to_dict(
    result: SimulationResult,
    include_arrays: bool = False,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "engine_version": result.engine_version,
        "prospect_name": result.prospect_name,
        "fluid_type": result.fluid_type,
        "zone_name": result.zone_name,
        "seed": result.seed,
        "n_iterations": result.n_iterations,
        "gas_oil_ratio": result.gas_oil_ratio,
        "run_timestamp": result.run_timestamp,
        "input_hash": result.input_hash,
        "correlation_mode": result.correlation_mode,
        "complex_trap_method": result.complex_trap_method,
        "complex_trap_scenario_counts": dict(result.complex_trap_scenario_counts),
        "percentile_convention": result.percentile_convention,
        "unit_system_version": result.unit_system_version,
        "clipping_applied": result.clipping_applied,
        "stoiip": _optional_summary_to_dict(result.stoiip),
        "recoverable_oil": _optional_summary_to_dict(result.recoverable_oil),
        "solution_gas": _optional_summary_to_dict(result.solution_gas),
        "giip": _optional_summary_to_dict(result.giip),
        "recoverable_gas": _optional_summary_to_dict(result.recoverable_gas),
        "condensate": _optional_summary_to_dict(result.condensate),
        "total_mmboe": _optional_summary_to_dict(result.total_mmboe),
        "pg_result": (
            pg_risked_result_to_dict(result.pg_result)
            if result.pg_result is not None
            else None
        ),
        "warnings": list(result.warnings),
        "solution_gas_included": result.solution_gas_included,
        "oil_recovery_applied": result.oil_recovery_applied,
        "chance_applied": result.chance_applied,
        "volume_basis": result.volume_basis,
    }
    if include_arrays:
        payload["arrays"] = {
            key: np.asarray(arr, dtype=float).tolist()
            for key, arr in result.arrays.items()
        }
    return payload


def simulation_result_from_dict(
    data: Dict[str, Any],
    include_arrays: bool = True,
) -> SimulationResult:
    version = data.get("schema_version")
    if version != SCHEMA_VERSION:
        raise ValueError(
            f"Unsupported schema_version {version!r}; expected {SCHEMA_VERSION!r}"
        )

    arrays: Dict[str, np.ndarray] = {}
    if include_arrays and "arrays" in data:
        for key, values in data["arrays"].items():
            arrays[key] = np.asarray(values, dtype=float)

    return SimulationResult(
        prospect_name=data["prospect_name"],
        fluid_type=data["fluid_type"],
        zone_name=data["zone_name"],
        seed=data["seed"],
        n_iterations=data["n_iterations"],
        gas_oil_ratio=data["gas_oil_ratio"],
        run_timestamp=data["run_timestamp"],
        engine_version=data["engine_version"],
        input_hash=data["input_hash"],
        correlation_mode=data.get("correlation_mode", "independent"),
        complex_trap_method=data.get("complex_trap_method", ""),
        complex_trap_scenario_counts=data.get("complex_trap_scenario_counts", {}),
        percentile_convention=data.get(
            "percentile_convention",
            "P10-large (P90=conservative, P10=upside)",
        ),
        unit_system_version=data.get("unit_system_version", "canonical-v1"),
        clipping_applied=data.get("clipping_applied", False),
        stoiip=_optional_summary_from_dict(data.get("stoiip")),
        recoverable_oil=_optional_summary_from_dict(data.get("recoverable_oil")),
        solution_gas=_optional_summary_from_dict(data.get("solution_gas")),
        giip=_optional_summary_from_dict(data.get("giip")),
        recoverable_gas=_optional_summary_from_dict(data.get("recoverable_gas")),
        condensate=_optional_summary_from_dict(data.get("condensate")),
        total_mmboe=_optional_summary_from_dict(data.get("total_mmboe")),
        pg_result=(
            pg_risked_result_from_dict(data["pg_result"])
            if data.get("pg_result") is not None
            else None
        ),
        arrays=arrays,
        warnings=list(data.get("warnings", [])),
        solution_gas_included=bool(data.get("solution_gas_included", True)),
        oil_recovery_applied=bool(data.get("oil_recovery_applied", True)),
        chance_applied=bool(data.get("chance_applied", True)),
        volume_basis=data.get("volume_basis", "recoverable"),
    )
