"""
MMRA Engine – Probabilistic Resource & Risk Evaluator
Standalone Python calculation engine (no UI).

Modules:
    constants        – Unit conversion constants and physical defaults.
    units            – convert_units() helper and unit-system definitions.
    distributions    – Distribution dataclasses and sampling functions.
    stats            – Percentile summary and trimmed-mean functions.
    volumetrics      – Deterministic volumetric formula functions.
    chance           – Weak-link chance and Pg calculations.
    simulation       – Monte Carlo simulation orchestration.
    validation_cases – Workbook-derived validation cases and scaffolds.
    validation       – QA/QC validation module (pre-flight checks).

Engine version: 0.1.0
"""

ENGINE_VERSION = "0.2.0"

from .constants import (
    KM2_TO_ACRES,
    METRES_TO_FEET,
    ACFT_TO_RESERVOIR_FT3,
    BBL_PER_ACFT,
    BBL_TO_MMBBL,
    SCF_TO_BCF,
    BCF_TO_MMSCF,
    DEFAULT_GAS_OIL_RATIO,
)
from .units import convert_units
from .distributions import (
    DistributionType,
    DistributionDef,
    sample_distribution,
    apply_clips,
    distribution_repr_values,
)
from .stats import calculate_percentile_summary, PercentileSummary
from .volumetrics import (
    calculate_productive_area,
    calculate_nrv,
    calculate_hcpv,
    calculate_stoiip,
    calculate_recoverable_oil,
    calculate_solution_gas,
    calculate_giip,
    calculate_recoverable_gas,
    calculate_condensate,
    calculate_mmboe,
)
from .chance import calculate_pg, calculate_category_chance, PgRiskedResult
from .correlation import (
    CORRELATION_MODES,
    CorrelationPair,
    RECOMMENDED_PAIRS,
    apply_input_correlations,
    gaussian_copula,
    iman_conover,
    normalize_correlation_mode,
    variables_for_fluid,
)
from .simulation import run_simulation, SimulationInput, SimulationResult
from .validation import (
    ValidationSeverity,
    ERROR,
    WARNING,
    INFO,
    ValidationIssue,
    ValidationReport,
    validate_distribution_def,
    validate_simulation_input,
    validate_chance_categories,
)
from .serialization import (
    SCHEMA_VERSION,
    compute_input_hash,
    distribution_to_dict,
    distribution_from_dict,
    simulation_input_to_dict,
    simulation_input_from_dict,
    simulation_input_to_json,
    simulation_input_from_json,
    simulation_result_to_dict,
    simulation_result_from_dict,
    validation_report_to_dict,
    validation_report_from_dict,
    percentile_summary_to_dict,
)
from .export import (
    simulation_result_to_csv_tables,
    write_simulation_result_csv,
    write_simulation_result_excel,
)
from .perturbation_tornado import (
    PerturbationTornadoDriver,
    PerturbationTornadoResult,
    compute_perturbation_tornado,
    perturbation_tornado_to_dict,
)

__all__ = [
    "ENGINE_VERSION",
    # constants
    "KM2_TO_ACRES",
    "METRES_TO_FEET",
    "ACFT_TO_RESERVOIR_FT3",
    "BBL_PER_ACFT",
    "BBL_TO_MMBBL",
    "SCF_TO_BCF",
    "BCF_TO_MMSCF",
    "DEFAULT_GAS_OIL_RATIO",
    # units
    "convert_units",
    # distributions
    "DistributionType",
    "DistributionDef",
    "sample_distribution",
    "apply_clips",
    "distribution_repr_values",
    # stats
    "calculate_percentile_summary",
    "PercentileSummary",
    # volumetrics
    "calculate_productive_area",
    "calculate_nrv",
    "calculate_hcpv",
    "calculate_stoiip",
    "calculate_recoverable_oil",
    "calculate_solution_gas",
    "calculate_giip",
    "calculate_recoverable_gas",
    "calculate_condensate",
    "calculate_mmboe",
    # chance
    "calculate_pg",
    "calculate_category_chance",
    "PgRiskedResult",
    # correlation
    "CORRELATION_MODES",
    "CorrelationPair",
    "RECOMMENDED_PAIRS",
    "apply_input_correlations",
    "gaussian_copula",
    "iman_conover",
    "normalize_correlation_mode",
    "variables_for_fluid",
    # simulation
    "run_simulation",
    "SimulationInput",
    "SimulationResult",
    # validation
    "ValidationSeverity",
    "ERROR",
    "WARNING",
    "INFO",
    "ValidationIssue",
    "ValidationReport",
    "validate_distribution_def",
    "validate_simulation_input",
    "validate_chance_categories",
    # serialization
    "SCHEMA_VERSION",
    "compute_input_hash",
    "distribution_to_dict",
    "distribution_from_dict",
    "simulation_input_to_dict",
    "simulation_input_from_dict",
    "simulation_input_to_json",
    "simulation_input_from_json",
    "simulation_result_to_dict",
    "simulation_result_from_dict",
    "validation_report_to_dict",
    "validation_report_from_dict",
    "percentile_summary_to_dict",
    # export
    "simulation_result_to_csv_tables",
    "write_simulation_result_csv",
    "write_simulation_result_excel",
    # perturbation tornado
    "PerturbationTornadoDriver",
    "PerturbationTornadoResult",
    "compute_perturbation_tornado",
    "perturbation_tornado_to_dict",
]
