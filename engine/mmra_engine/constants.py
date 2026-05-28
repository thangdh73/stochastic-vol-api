"""
constants.py – Canonical unit conversion constants and physical defaults.

All constants are sourced from the MMRA Technical Calculation Specification.
"""

# ---------------------------------------------------------------------------
# Unit conversion constants
# ---------------------------------------------------------------------------

KM2_TO_ACRES: float = 247.105381467
"""Multiply km² by this factor to get acres."""

ACRES_TO_KM2: float = 1.0 / KM2_TO_ACRES
"""Multiply acres by this factor to get km²."""

METRES_TO_FEET: float = 3.280839895
"""Multiply metres by this factor to get feet."""

FEET_TO_METRES: float = 1.0 / METRES_TO_FEET
"""Multiply feet by this factor to get metres."""

ACFT_TO_RESERVOIR_FT3: float = 43_560.0
"""Multiply acre-ft by this factor to get reservoir ft³."""

FT3_TO_ACFT: float = 1.0 / ACFT_TO_RESERVOIR_FT3
"""Multiply ft³ by this factor to get acre-ft."""

# 1 ft = 0.3048 m → 1 ft³ = 0.3048³ m³; 1 acre-ft = 43,560 ft³
M3_PER_FT3: float = 0.3048**3
ACFT_TO_M3: float = ACFT_TO_RESERVOIR_FT3 * M3_PER_FT3
M3_TO_ACFT: float = 1.0 / ACFT_TO_M3
"""Multiply m³ by this factor to get acre-ft."""

BBL_PER_ACFT: float = 7_758.36735
"""Standard barrels per acre-foot of pore volume."""

BBL_TO_MMBBL: float = 1.0e-6
"""Multiply bbl by this factor to get MMbbl."""

MMBBL_TO_BBL: float = 1.0e6
"""Multiply MMbbl by this factor to get bbl."""

SCF_TO_BCF: float = 1.0e-9
"""Multiply scf by this factor to get Bcf."""

BCF_TO_SCF: float = 1.0e9
"""Multiply Bcf by this factor to get scf."""

BCF_TO_MMSCF: float = 1_000.0
"""Multiply Bcf by this factor to get MMscf."""

MMSCF_TO_BCF: float = 1.0 / BCF_TO_MMSCF
"""Multiply MMscf by this factor to get Bcf."""

# API barrel (42 US gal) → cubic metres
BBL_TO_M3: float = 0.158987294928
"""Multiply barrels by this factor to get m³."""

# Standard cubic feet per cubic metre (60 °F, 14.73 psia)
SCF_PER_CUBIC_METRE: float = 35.31466672148831
"""Multiply m³ by this factor to get standard cubic feet."""

DEFAULT_GAS_OIL_RATIO: float = 6.0
"""Default gas-oil conversion ratio in mcf/bbl (MMBOE = MMbbl + Bcf / 6)."""

# ---------------------------------------------------------------------------
# Physical / administrative default limits (from workbook admin settings)
# ---------------------------------------------------------------------------

POROSITY_MIN_FRACTION: float = 0.01   # 1%
POROSITY_MAX_FRACTION: float = 0.40   # 40%

HC_SAT_MIN_FRACTION: float = 0.15     # 15%
HC_SAT_MAX_FRACTION: float = 0.95     # 95%

OIL_FVF_MIN: float = 1.0             # rb/stb
OIL_FVF_MAX: float = 4.0             # rb/stb

GEF_MIN: float = 25.0                 # scf/reservoir ft³
GEF_MAX: float = 750.0                # scf/reservoir ft³

RECOVERY_EFF_MIN_FRACTION: float = 0.0
RECOVERY_EFF_MAX_FRACTION: float = 1.0

PERCENT_FILL_MIN_FRACTION: float = 0.0
PERCENT_FILL_MAX_FRACTION: float = 1.0

CHANCE_MIN: float = 0.0
CHANCE_MAX: float = 1.0

# ---------------------------------------------------------------------------
# Simulation defaults
# ---------------------------------------------------------------------------

DEFAULT_ITERATION_COUNT: int = 5_000
MIN_ITERATION_COUNT: int = 1_000
MAX_ITERATION_COUNT: int = 100_000

DEFAULT_SEED: int = 42

# ---------------------------------------------------------------------------
# Percentile convention
# ---------------------------------------------------------------------------
# P10-large convention: P90 label = small/conservative, P10 label = upside.
# CDF quantile values used with numpy.quantile(x, q, method="linear"):

PERCENTILE_QUANTILES: dict = {
    "P99": 0.01,
    "P90": 0.10,
    "P50": 0.50,
    "P10": 0.90,
    "P01": 0.99,
}

# z-score for the 90th percentile of the standard normal (used in dist fitting)
Z90: float = 1.2815515655446004
"""scipy.stats.norm.ppf(0.90) – used for normal and lognormal parameterization."""
