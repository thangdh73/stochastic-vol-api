"""
units.py – Unit conversion helper.

All internal calculations use canonical units:
    Area        → acres
    Thickness   → feet
    NRV         → acre-ft
    Porosity    → fraction (0–1)
    Saturation  → fraction (0–1)
    Recovery    → fraction (0–1)
    FVF         → rb/stb
    GOR         → scf/stb
    GEF         → scf/reservoir ft³
    Oil volume  → MMbbl
    Gas volume  → Bcf
    BOE         → MMBOE
"""

from .constants import (
    KM2_TO_ACRES,
    ACRES_TO_KM2,
    METRES_TO_FEET,
    FEET_TO_METRES,
    ACFT_TO_RESERVOIR_FT3,
    FT3_TO_ACFT,
    ACFT_TO_M3,
    M3_TO_ACFT,
    BBL_TO_MMBBL,
    MMBBL_TO_BBL,
    SCF_TO_BCF,
    BCF_TO_SCF,
    BCF_TO_MMSCF,
    MMSCF_TO_BCF,
)

# Mapping (from_unit, to_unit) → scale factor
# All values: result = value * scale
_CONVERSION_FACTORS: dict[tuple[str, str], float] = {
    # Area
    ("km2", "acres"):   KM2_TO_ACRES,
    ("km²", "acres"):   KM2_TO_ACRES,
    ("acres", "km2"):   ACRES_TO_KM2,
    ("acres", "km²"):   ACRES_TO_KM2,
    ("acres", "acres"): 1.0,
    ("km2", "km2"):     1.0,
    ("km²", "km²"):     1.0,
    # Thickness
    ("m", "ft"):        METRES_TO_FEET,
    ("metres", "ft"):   METRES_TO_FEET,
    ("metres", "feet"): METRES_TO_FEET,
    ("m", "feet"):      METRES_TO_FEET,
    ("ft", "m"):        FEET_TO_METRES,
    ("ft", "metres"):   FEET_TO_METRES,
    ("feet", "m"):      FEET_TO_METRES,
    ("feet", "metres"): FEET_TO_METRES,
    ("ft", "ft"):       1.0,
    ("feet", "ft"):     1.0,
    ("ft", "feet"):     1.0,
    ("feet", "feet"):   1.0,
    # Rock volume (canonical acre-ft)
    ("acre-ft", "acre-ft"): 1.0,
    ("acre-ft", "acft"): 1.0,
    ("acft", "acre-ft"): 1.0,
    ("acre-ft", "ft3"): ACFT_TO_RESERVOIR_FT3,
    ("acre-ft", "ft³"): ACFT_TO_RESERVOIR_FT3,
    ("ft3", "acre-ft"): FT3_TO_ACFT,
    ("ft³", "acre-ft"): FT3_TO_ACFT,
    ("acre-ft", "m3"): ACFT_TO_M3,
    ("acre-ft", "m³"): ACFT_TO_M3,
    ("m3", "acre-ft"): M3_TO_ACFT,
    ("m³", "acre-ft"): M3_TO_ACFT,
    ("m", "m"):         1.0,
    ("metres", "m"):    1.0,
    ("m", "metres"):    1.0,
    ("metres", "metres"): 1.0,
    # Liquid volumes
    ("bbl", "mmbbl"):   BBL_TO_MMBBL,
    ("mmbbl", "bbl"):   MMBBL_TO_BBL,
    ("bbl", "bbl"):     1.0,
    ("mmbbl", "mmbbl"): 1.0,
    # Gas volumes
    ("scf", "bcf"):     SCF_TO_BCF,
    ("bcf", "scf"):     BCF_TO_SCF,
    ("bcf", "mmscf"):   BCF_TO_MMSCF,
    ("mmscf", "bcf"):   MMSCF_TO_BCF,
    ("scf", "scf"):     1.0,
    ("bcf", "bcf"):     1.0,
    ("mmscf", "mmscf"): 1.0,
    # Percent ↔ fraction
    ("%", "fraction"):  0.01,
    ("fraction", "%"):  100.0,
    ("%", "%"):         1.0,
    ("fraction", "fraction"): 1.0,
}


def convert_units(value: float, from_unit: str, to_unit: str) -> float:
    """
    Convert *value* from *from_unit* to *to_unit*.

    Parameters
    ----------
    value : float
        The numeric value to convert.
    from_unit : str
        Source unit string (case-insensitive).
    to_unit : str
        Target unit string (case-insensitive).

    Returns
    -------
    float
        Converted value.

    Raises
    ------
    ValueError
        If the (from_unit, to_unit) pair is not supported.
    """
    if from_unit == to_unit:
        return value

    key = (from_unit.lower().strip(), to_unit.lower().strip())
    if key in _CONVERSION_FACTORS:
        return value * _CONVERSION_FACTORS[key]

    # Try with original casing stored in dict (already lowered above)
    raise ValueError(
        f"Unsupported unit conversion: '{from_unit}' → '{to_unit}'. "
        f"Supported pairs: {sorted(set(f'{a}→{b}' for a,b in _CONVERSION_FACTORS))}"
    )


def pct_to_fraction(value: float) -> float:
    """Convert a percentage (e.g. 17.8) to a fraction (0.178)."""
    return value / 100.0


def fraction_to_pct(value: float) -> float:
    """Convert a fraction (0.178) to a percentage (17.8)."""
    return value * 100.0
