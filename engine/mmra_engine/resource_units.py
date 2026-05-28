"""
resource_units.py – Display-unit scaling for oil/gas resource summaries.

Canonical engine outputs: oil liquids in MMbbl, gas in Bcf.
"""

from __future__ import annotations

from typing import Literal

from .constants import BBL_TO_M3, BCF_TO_MMSCF, SCF_PER_CUBIC_METRE
from .stats import PercentileSummary

OilResourceUnit = Literal["MMBO", "MMSTB", "MMscm"]
GasResourceUnit = Literal["BCF", "MMSCF", "Bscm"]

# 1 billion standard m³ ≈ 35.314666721 Bcf (ideal-gas volume equivalence at STP)
BCF_PER_BSCM: float = SCF_PER_CUBIC_METRE  # 1e9 scf / 1e9 m³ in Bcf per Bscm

# 1 MMbbl → million m³ of liquid (API bbl → m³)
MMBBL_TO_MMSCM: float = BBL_TO_M3  # 10⁶ bbl × m³/bbl / 10⁶ = MMbbl × 0.158987...


def oil_display_scale(unit: str) -> float:
    """Multiply canonical MMbbl by this to get display-unit values."""
    u = (unit or "MMBO").upper()
    if u == "MMSCM":
        return MMBBL_TO_MMSCM
    return 1.0


def gas_display_scale(unit: str) -> float:
    """Multiply canonical Bcf by this to get display-unit values."""
    u = (unit or "BCF").upper()
    if u == "MMSCF":
        return BCF_TO_MMSCF
    if u == "BSCM":
        return 1.0 / BCF_PER_BSCM
    return 1.0


def oil_display_unit_label(unit: str) -> str:
    u = (unit or "MMBO").upper()
    if u == "MMSCM":
        return "MMscm"
    if u == "MMSTB":
        return "MMSTB"
    return "MMBO"


def gas_display_unit_label(unit: str) -> str:
    u = (unit or "BCF").upper()
    if u == "MMSCF":
        return "MMSCF"
    if u == "BSCM":
        return "Bscm"
    return "BCF"


def apply_display_scale(summary: PercentileSummary, scale: float, unit_label: str) -> PercentileSummary:
    """Return a copy of *summary* with numeric values scaled to display units."""
    if scale == 1.0 and summary.unit == unit_label:
        return summary
    s = scale

    def _m(v):
        return None if v is None else v * s

    return PercentileSummary(
        product_name=summary.product_name,
        unit=unit_label,
        p99=summary.p99 * s,
        p90=summary.p90 * s,
        p50=summary.p50 * s,
        mean_trimmed=summary.mean_trimmed * s,
        p10=summary.p10 * s,
        p01=summary.p01 * s,
        mean_full=_m(summary.mean_full),
        minimum=_m(summary.minimum),
        maximum=_m(summary.maximum),
        std_dev=_m(summary.std_dev),
        n_samples=summary.n_samples,
    )


def oil_summary_for_display(
    summary: PercentileSummary,
    inp,
    product_key: str = "stoiip",
) -> PercentileSummary:
    unit = getattr(inp, "oil_resource_unit", "MMBO") or "MMBO"
    scale = oil_display_scale(unit)
    label = oil_display_unit_label(unit)
    return apply_display_scale(summary, scale, label)


def gas_summary_for_display(
    summary: PercentileSummary,
    inp,
    product_key: str = "giip",
) -> PercentileSummary:
    unit = getattr(inp, "gas_resource_unit", "BCF") or "BCF"
    scale = gas_display_scale(unit)
    label = gas_display_unit_label(unit)
    return apply_display_scale(summary, scale, label)
