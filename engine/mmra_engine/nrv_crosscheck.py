"""
nrv_crosscheck.py – Area vs implied net pay reality check for NRV estimating method.
"""

from __future__ import annotations

from typing import List, Tuple

import numpy as np

from .stats import calculate_percentile_summary


def implied_net_pay_ft(nrv_acft: np.ndarray, area_acres: np.ndarray) -> np.ndarray:
    """Implied average net pay (ft) = NRV (acre-ft) / productive area (acres)."""
    area = np.asarray(area_acres, dtype=float)
    nrv = np.asarray(nrv_acft, dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        out = np.where(area > 0, nrv / area, 0.0)
    return out


def cross_check_warnings(
    nrv_acft: np.ndarray,
    area_acres: np.ndarray,
    min_flow_ft: float = 5.0,
    max_plausible_ft: float = 500.0,
) -> Tuple[List[str], bool]:
    """
    Return warning messages and whether implied NP looks deterministic (all equal).

    Uses P90/P10 of implied net pay for conservative/upside checks (P10-large).
    """
    warnings: List[str] = []
    imp = implied_net_pay_ft(nrv_acft, area_acres)
    summary = calculate_percentile_summary(imp, "Implied Net Pay", "ft")

    if np.allclose(imp, imp[0], rtol=0, atol=1e-9):
        warnings.append(
            "Implied net pay is deterministic across iterations — check that productive "
            "area variance is not larger than NRV variance (NRV variance must exceed area variance)."
        )
        return warnings, True

    if summary.p90 < min_flow_ft:
        warnings.append(
            f"Implied net pay P90 ({summary.p90:.1f} ft) may be too thin for sustained flow "
            f"(guideline ≥ {min_flow_ft:.0f} ft)."
        )
    if summary.p10 > max_plausible_ft:
        warnings.append(
            f"Implied net pay P10 ({summary.p10:.1f} ft) exceeds plausible formation thickness "
            f"(guideline ≤ {max_plausible_ft:.0f} ft)."
        )

    return warnings, False
