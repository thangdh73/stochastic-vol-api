"""
validation_cases.py – Workbook-derived validation cases and deterministic scaffolds.

Contains:
    OIL_FORMULA_CASE      – Deterministic formula validation (Validation Case 2)
    GAS_FORMULA_CASE      – Deterministic formula validation (Validation Case 3)
    PM3XD_H1SS10_INPUT    – PM3X-D H1ss10 oil prospect inputs (Validation Case 1)

Expected outputs (from MMRA Technical Calculation Specification):
    Oil case:
        STOIIP             = 7.75836735 MMbbl
        Recoverable Oil    = 2.7154285725 MMbbl
        Solution Gas       = 1.6292571435 Bcf
        Total MMBOE        = 2.98697142975 MMBOE

    Gas case:
        GIIP               = 12.1968 Bcf
        Recoverable Gas    = 9.75744 Bcf
        Total MMBOE        = 1.62624 MMBOE

PM3X-D H1ss10 chance targets:
    Source = 0.90, Timing/Migration = 0.65, Reservoir = 0.60,
    Closure = 0.60, Containment = 0.60  →  Pg = 0.12636
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from .constants import METRES_TO_FEET
from .distributions import DistributionDef, DistributionType
from .simulation import SimulationInput


# ---------------------------------------------------------------------------
# Expected deterministic outputs (tolerance: 0.01%)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class DeterministicExpected:
    stoiip_mmbbl: float = 0.0
    recoverable_oil_mmbbl: float = 0.0
    solution_gas_bcf: float = 0.0
    giip_bcf: float = 0.0
    recoverable_gas_bcf: float = 0.0
    total_mmboe: float = 0.0


OIL_FORMULA_EXPECTED = DeterministicExpected(
    stoiip_mmbbl=7.75836735,
    recoverable_oil_mmbbl=2.7154285725,
    solution_gas_bcf=1.6292571435,
    total_mmboe=2.98697142975,
)

GAS_FORMULA_EXPECTED = DeterministicExpected(
    giip_bcf=12.1968,
    recoverable_gas_bcf=9.75744,
    total_mmboe=1.62624,
)

# Pg expected for PM3X-D H1ss10
PM3XD_PG_EXPECTED: float = 0.12636


# ---------------------------------------------------------------------------
# Helper: create a Fixed DistributionDef
# ---------------------------------------------------------------------------

def _fixed(variable_id: str, display_name: str, value: float, unit: str = "") -> DistributionDef:
    return DistributionDef(
        variable_id=variable_id,
        display_name=display_name,
        distribution_type=DistributionType.FIXED,
        fixed_value=value,
        unit=unit,
        canonical_unit=unit,
    )


# ---------------------------------------------------------------------------
# Validation Case 2: Deterministic Oil Formula Case
# ---------------------------------------------------------------------------
# Inputs (canonical units):
#   area         = 1000 acres,  percent_fill = 1.0 (100%)
#   net_pay      = 10 ft,       GCF = 1.0 (100%)
#   porosity     = 0.20 (20%),  saturation = 0.70 (70%)
#   Bo           = 1.4 rb/stb,  RE_oil = 0.35 (35%)
#   GOR          = 600 scf/stb, SGRE = 1.0 (100%)
# ---------------------------------------------------------------------------

def make_oil_formula_case(seed: int = 42, n_iterations: int = 1000) -> SimulationInput:
    """
    Build a SimulationInput for the deterministic oil formula validation.

    All variables are Fixed distributions, so the Monte Carlo
    should reproduce the deterministic expected outputs exactly.
    """
    return SimulationInput(
        prospect_name="Oil Formula Validation Case 2",
        fluid_type="oil",
        zone_name="Zone 1",
        notes="Deterministic unit formula validation – all distributions are Fixed.",
        n_iterations=n_iterations,
        seed=seed,
        gas_oil_ratio=6.0,

        area_dist=_fixed("area", "Closed Area", 1_000.0, "acres"),
        percent_fill_dist=_fixed("pf", "Percent Fill", 1.0, "fraction"),
        net_pay_dist=_fixed("np", "Net Pay", 10.0, "ft"),
        geometric_correction_dist=_fixed("gcf", "Geometric Correction", 1.0, "fraction"),
        porosity_dist=_fixed("phi", "Porosity", 0.20, "fraction"),
        saturation_dist=_fixed("sat", "HC Saturation", 0.70, "fraction"),
        oil_recovery_dist=_fixed("re_oil", "Oil Recovery", 0.35, "fraction"),
        fvf_dist=_fixed("bo", "Oil FVF", 1.4, "rb/stb"),
        gor_dist=_fixed("gor", "GOR", 600.0, "scf/stb"),
        solution_gas_recovery_dist=_fixed("sgre", "Solution Gas Recovery", 1.0, "fraction"),
    )


# ---------------------------------------------------------------------------
# Validation Case 3: Deterministic Gas Formula Case
# ---------------------------------------------------------------------------
# Inputs (canonical units):
#   area         = 1000 acres,  percent_fill = 1.0 (100%)
#   net_pay      = 10 ft,       GCF = 1.0 (100%)
#   porosity     = 0.20 (20%),  saturation = 0.70 (70%)
#   GEF          = 200 scf/reservoir ft³,  RE_gas = 0.80 (80%)
# ---------------------------------------------------------------------------

def make_gas_formula_case(seed: int = 42, n_iterations: int = 1000) -> SimulationInput:
    """
    Build a SimulationInput for the deterministic gas formula validation.
    """
    return SimulationInput(
        prospect_name="Gas Formula Validation Case 3",
        fluid_type="gas",
        zone_name="Zone 1",
        notes="Deterministic unit formula validation – all distributions are Fixed.",
        n_iterations=n_iterations,
        seed=seed,
        gas_oil_ratio=6.0,

        area_dist=_fixed("area", "Closed Area", 1_000.0, "acres"),
        percent_fill_dist=_fixed("pf", "Percent Fill", 1.0, "fraction"),
        net_pay_dist=_fixed("np", "Net Pay", 10.0, "ft"),
        geometric_correction_dist=_fixed("gcf", "Geometric Correction", 1.0, "fraction"),
        porosity_dist=_fixed("phi", "Porosity", 0.20, "fraction"),
        saturation_dist=_fixed("sat", "HC Saturation", 0.70, "fraction"),
        gas_recovery_dist=_fixed("re_gas", "Gas Recovery", 0.80, "fraction"),
        gef_dist=_fixed("gef", "Gas Expansion Factor", 200.0, "scf/reservoir ft3"),
    )


# ---------------------------------------------------------------------------
# Validation Case 1: PM3X-D H1ss10 Oil Prospect (Workbook case)
# ---------------------------------------------------------------------------
# Net pay in workbook is metres; conversion to feet is applied here.
# All percent distributions are as fractions.
# Beta bounds are the workbook admin defaults.
# ---------------------------------------------------------------------------

_NP_P90_M = 2.4    # metres
_NP_P50_M = 5.8    # metres
_NP_P10_M = 14.0   # metres

# Convert to feet for canonical unit
_NP_P90_FT = _NP_P90_M * METRES_TO_FEET
_NP_P50_FT = _NP_P50_M * METRES_TO_FEET
_NP_P10_FT = _NP_P10_M * METRES_TO_FEET


def make_pm3xd_h1ss10_input(
    seed: int = 42,
    n_iterations: int = 5_000,
) -> SimulationInput:
    """
    Build a SimulationInput for the PM3X-D H1ss10 oil prospect
    (Validation Case 1 from the workbook).

    Variable P90/P10 values are in canonical units (fractions, feet, scf/stb).
    Distribution types and bounds follow the specification.

    Note: This is a probabilistic case; outputs will vary by seed and iteration count.
    Workbook equivalence target is ±5% after distribution calibration.
    """

    # Area: Lognormal, P90=P50=P10=824 acres → effectively Fixed
    area_dist = DistributionDef(
        variable_id="area",
        display_name="Closed Area",
        distribution_type=DistributionType.FIXED,
        fixed_value=824.0,
        unit="acres",
        canonical_unit="acres",
    )

    # Percent fill: Beta, P90=P50=P10=100% → effectively Fixed at 1.0
    pf_dist = DistributionDef(
        variable_id="pf",
        display_name="Percent Fill",
        distribution_type=DistributionType.FIXED,
        fixed_value=1.0,
        unit="fraction",
        canonical_unit="fraction",
    )

    # Net pay: Lognormal in metres → convert to feet
    np_dist = DistributionDef(
        variable_id="net_pay",
        display_name="Net Pay",
        distribution_type=DistributionType.LOGNORMAL,
        p90=_NP_P90_FT,
        p50=_NP_P50_FT,
        p10=_NP_P10_FT,
        unit="ft",
        canonical_unit="ft",
    )

    # Geometric correction: Fixed 100% = 1.0
    gcf_dist = DistributionDef(
        variable_id="gcf",
        display_name="Geometric Correction Factor",
        distribution_type=DistributionType.FIXED,
        fixed_value=1.0,
        unit="fraction",
        canonical_unit="fraction",
    )

    # Porosity: Beta, P90=14.06%, P10=22.05%, bounds 1%–40%
    phi_dist = DistributionDef(
        variable_id="phi",
        display_name="Porosity",
        distribution_type=DistributionType.BETA,
        p90=0.1406,
        p50=0.1783,
        p10=0.2205,
        min_bound=0.01,
        max_bound=0.40,
        unit="fraction",
        canonical_unit="fraction",
    )

    # HC saturation: Beta, P90=44.18%, P10=79.20%, bounds 15%–95%
    sat_dist = DistributionDef(
        variable_id="sat",
        display_name="HC Saturation",
        distribution_type=DistributionType.BETA,
        p90=0.4418,
        p50=0.6251,
        p10=0.7920,
        min_bound=0.15,
        max_bound=0.95,
        unit="fraction",
        canonical_unit="fraction",
    )

    # Oil recovery efficiency: Beta, P90=29.94%, P10=40.08%, bounds 0%–100%
    re_dist = DistributionDef(
        variable_id="re_oil",
        display_name="Oil Recovery Efficiency",
        distribution_type=DistributionType.BETA,
        p90=0.2994,
        p50=0.3492,
        p10=0.4008,
        min_bound=0.0,
        max_bound=1.0,
        unit="fraction",
        canonical_unit="fraction",
    )

    # Oil FVF: Fixed at 1.4 rb/stb
    fvf_dist = DistributionDef(
        variable_id="fvf",
        display_name="Oil FVF",
        distribution_type=DistributionType.FIXED,
        fixed_value=1.4,
        unit="rb/stb",
        canonical_unit="rb/stb",
    )

    # GOR: Normal, P90=550.02, P10=711.01 scf/stb
    gor_dist = DistributionDef(
        variable_id="gor",
        display_name="Solution Gas Yield (GOR)",
        distribution_type=DistributionType.NORMAL,
        p90=550.02,
        p50=630.89,
        p10=711.01,
        unit="scf/stb",
        canonical_unit="scf/stb",
    )

    # Solution gas recovery: Fixed 100% = 1.0
    sgre_dist = DistributionDef(
        variable_id="sgre",
        display_name="Solution Gas Recovery Efficiency",
        distribution_type=DistributionType.FIXED,
        fixed_value=1.0,
        unit="fraction",
        canonical_unit="fraction",
    )

    # Chance categories (workbook validation targets)
    chance_categories: Dict[str, List[float]] = {
        "source":             [0.90],
        "timing_migration":   [0.65],
        "reservoir":          [0.60],
        "closure":            [0.60],
        "containment":        [0.60],
    }

    return SimulationInput(
        prospect_name="PM3X-D H1ss10",
        fluid_type="oil",
        zone_name="H1ss10",
        country="Malaysia",
        basin="Malay Basin",
        formation="H1ss10",
        notes="Pre-drill single zone. Workbook Validation Case 1.",
        n_iterations=n_iterations,
        seed=seed,
        gas_oil_ratio=6.0,

        area_dist=area_dist,
        percent_fill_dist=pf_dist,
        net_pay_dist=np_dist,
        geometric_correction_dist=gcf_dist,
        porosity_dist=phi_dist,
        saturation_dist=sat_dist,
        oil_recovery_dist=re_dist,
        fvf_dist=fvf_dist,
        gor_dist=gor_dist,
        solution_gas_recovery_dist=sgre_dist,

        chance_categories=chance_categories,
    )


# ---------------------------------------------------------------------------
# Workbook output targets for PM3X-D H1ss10 (for comparison, not assertion)
# ---------------------------------------------------------------------------

PM3XD_WORKBOOK_TARGETS = {
    "stoiip_mmbbl": {"P99": 1.59, "P90": 3.48, "P50": 9.33, "mean": 11.67, "P10": 23.40, "P01": 50.92},
    "recoverable_oil_mmbbl": {"P99": 0.54, "P90": 1.19, "P50": 3.23, "mean": 4.08, "P10": 8.25, "P01": 18.09},
    "solution_gas_bcf": {"P99": 0.32, "P90": 0.74, "P50": 2.04, "mean": 2.56, "P10": 5.24, "P01": 11.25},
    "total_mmboe": {"P99": 0.59, "P90": 1.32, "P50": 3.56, "mean": 4.50, "P10": 9.10, "P01": 19.94},
    "pg": PM3XD_PG_EXPECTED,
}
