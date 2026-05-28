"""Pydantic API schemas (separate from engine dataclasses)."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class CorrelationPairSpec(BaseModel):
    variable_a: str
    variable_b: str
    rho: float = Field(ge=-1.0, le=1.0)
    enabled: bool = True
    notes: str = ""


class ComplexTrapElementSpec(BaseModel):
    enabled: bool = False
    max_area_acres: float = Field(default=0.0, ge=0.0)
    seal_confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    notes: str = ""


class ComplexTrapConfigSpec(BaseModel):
    enabled: bool = False
    method: Literal["A", "B"] = "A"
    num_elements: int = Field(default=1, ge=1, le=2)
    element_1: ComplexTrapElementSpec = Field(default_factory=ComplexTrapElementSpec)
    element_2: ComplexTrapElementSpec = Field(default_factory=ComplexTrapElementSpec)


class CorrelationMatrixSpec(BaseModel):
    """Symmetric correlation matrix; off-diagonals map to pair list."""

    variables: List[str] = Field(default_factory=list)
    values: List[List[float]] = Field(default_factory=list)


class DistributionSpec(BaseModel):
    variable_id: str
    display_name: str
    distribution_type: str
    unit: str = ""
    canonical_unit: str = ""
    p90: Optional[float] = None
    p50: Optional[float] = None
    p10: Optional[float] = None
    fixed_value: Optional[float] = None
    tri_min: Optional[float] = None
    tri_mode: Optional[float] = None
    tri_max: Optional[float] = None
    min_bound: Optional[float] = None
    max_bound: Optional[float] = None
    low_clip: Optional[float] = None
    high_clip: Optional[float] = None
    notes: str = ""
    solved_alpha: Optional[float] = None
    solved_beta: Optional[float] = None
    solved_mu: Optional[float] = None
    solved_sigma: Optional[float] = None


class SimulationInputBody(BaseModel):
    """HTTP body matching engine serialization schema v1."""

    schema_version: Literal["1"] = "1"
    engine_version: Optional[str] = None
    prospect_name: str = "Unnamed Prospect"
    fluid_type: str = "oil"
    zone_name: str = "Zone 1"
    country: str = ""
    basin: str = ""
    formation: str = ""
    notes: str = ""
    n_iterations: int = Field(default=5000, ge=1000, le=100_000)
    seed: int = 42
    gas_oil_ratio: float = 6.0
    chance_categories: Dict[str, List[float]] = Field(default_factory=dict)
    risk_model: Literal["legacy", "ccop_v1"] = "legacy"
    ccop_risk: Optional[Dict[str, Any]] = None
    correlation_mode: Literal["independent", "rank", "gaussian_copula"] = "independent"
    correlations: List[CorrelationPairSpec] = Field(default_factory=list)
    correlation_matrix: Optional[CorrelationMatrixSpec] = None
    complex_trap: Optional[ComplexTrapConfigSpec] = None
    estimating_method: Literal["area_net_pay_yield", "nrv_grv_yield"] = "area_net_pay_yield"
    nrv_entry_mode: Literal["grv_fill_ntg", "direct"] = "grv_fill_ntg"
    cross_check_enabled: bool = False
    grv_ntg_correlation: float = Field(default=0.0, ge=-1.0, le=1.0)
    oil_resource_unit: Literal["MMBO", "MMSTB", "MMscm"] = "MMBO"
    gas_resource_unit: Literal["BCF", "MMSCF", "Bscm"] = "BCF"
    total_resource_unit: Literal["MMBOE"] = "MMBOE"
    area_input_unit: Literal["acres", "sq_km"] = "acres"
    grv_input_unit: Literal[
        "acre_ft",
        "thousand_acre_ft",
        "ft3",
        "m3",
        "thousand_ft3",
        "thousand_m3",
        "million_ft3",
        "million_m3",
    ] = "acre_ft"
    nrv_input_unit: Literal[
        "acre_ft",
        "thousand_acre_ft",
        "ft3",
        "m3",
        "thousand_ft3",
        "thousand_m3",
        "million_ft3",
        "million_m3",
    ] = "acre_ft"
    include_solution_gas: Optional[bool] = None
    apply_oil_recovery: Optional[bool] = None
    include_chance: Optional[bool] = None

    area_dist: Optional[DistributionSpec] = None
    percent_fill_dist: Optional[DistributionSpec] = None
    net_pay_dist: Optional[DistributionSpec] = None
    geometric_correction_dist: Optional[DistributionSpec] = None
    porosity_dist: Optional[DistributionSpec] = None
    saturation_dist: Optional[DistributionSpec] = None
    oil_recovery_dist: Optional[DistributionSpec] = None
    fvf_dist: Optional[DistributionSpec] = None
    gor_dist: Optional[DistributionSpec] = None
    solution_gas_recovery_dist: Optional[DistributionSpec] = None
    gas_recovery_dist: Optional[DistributionSpec] = None
    gef_dist: Optional[DistributionSpec] = None
    condensate_yield_dist: Optional[DistributionSpec] = None
    grv_dist: Optional[DistributionSpec] = None
    grv_percent_fill_dist: Optional[DistributionSpec] = None
    net_to_gross_dist: Optional[DistributionSpec] = None
    nrv_direct_dist: Optional[DistributionSpec] = None
    nrv_direct_multiplier_dist: Optional[DistributionSpec] = None
    cross_check_area_dist: Optional[DistributionSpec] = None


class SimulateOptions(BaseModel):
    include_arrays: bool = False


class UncertaintyGroupMemberSpec(BaseModel):
    segment_id: str
    reservoir_id: str


class UncertaintyParameterGroupSpec(BaseModel):
    id: str
    name: str
    parameter: str
    members: List[UncertaintyGroupMemberSpec] = Field(default_factory=list)
    all_segments: bool = False
    all_reservoirs: bool = False
    notes: Optional[str] = None


class GroupCorrelationMatrixSpec(BaseModel):
    group_ids: List[str] = Field(default_factory=list)
    values: List[List[float]] = Field(default_factory=list)


class GroupDependencyContext(BaseModel):
    active_segment_id: str
    active_reservoir_id: str
    segment_ids: List[str] = Field(default_factory=list)
    reservoir_ids: List[str] = Field(default_factory=list)
    uncertainty_groups: List[UncertaintyParameterGroupSpec] = Field(default_factory=list)
    group_correlation_mode: Literal["independent", "rank", "gaussian_copula"] = "independent"
    group_correlation_matrix: Optional[GroupCorrelationMatrixSpec] = None
    tank_inputs: Dict[str, SimulationInputBody] = Field(default_factory=dict)


class SimulateRequest(BaseModel):
    input: SimulationInputBody
    options: SimulateOptions = Field(default_factory=SimulateOptions)
    context: Optional[GroupDependencyContext] = None


class ModulePreviewRequest(BaseModel):
    input: SimulationInputBody
    scope: Literal["area", "net_pay", "hc_yield", "chance", "nrv"]


class PerturbationTornadoRequest(BaseModel):
    input: SimulationInputBody
    target: str = "total_mmboe"
    context: Optional[GroupDependencyContext] = None
    scope_type: Literal["prospect", "reservoir", "segment", "tank"] = "prospect"
    scope_id: Optional[str] = None


class ExportRequest(BaseModel):
    input: SimulationInputBody
    include_workbook_targets: bool = False


class HealthResponse(BaseModel):
    status: str
    engine_version: str
    schema_version: str
    api_features: List[str] = Field(
        default_factory=lambda: [
            "validate",
            "simulate",
            "simulate_preview",
            "tornado_perturbation",
            "export",
        ],
    )


class ValidationReportResponse(BaseModel):
    schema_version: str
    has_errors: bool
    can_run_simulation: bool
    issues: List[Dict[str, Any]]
    input_hash: str


class SimulateResponse(BaseModel):
    schema_version: str
    engine_version: str
    input_hash: str
    input_hash_engine: str
    validation: ValidationReportResponse
    result: Dict[str, Any]


class CsvExportResponse(BaseModel):
    tables: Dict[str, str]
    filename: str = "mmra_export.zip"


class ErrorResponse(BaseModel):
    detail: str
    validation: Optional[ValidationReportResponse] = None
