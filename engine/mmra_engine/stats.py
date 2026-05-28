"""
stats.py – Percentile summary and trimmed-mean functions.

Percentile convention (P10-large):
    P99 label → numpy quantile q=0.01
    P90 label → numpy quantile q=0.10
    P50 label → numpy quantile q=0.50
    P10 label → numpy quantile q=0.90
    P01 label → numpy quantile q=0.99

Displayed mean: trimmed mean between q0.01 and q0.99 inclusive
    (matches workbook Apply_TruncMean = TRUE, Mean P99→P01 display).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np

from .constants import PERCENTILE_QUANTILES


@dataclass
class PercentileSummary:
    """
    Resource summary statistics for a single output vector.

    All values are in the output's canonical unit (e.g. MMbbl, Bcf, MMBOE).
    """
    product_name: str
    unit: str

    p99: float
    p90: float
    p50: float
    mean_trimmed: float   # P99-to-P01 trimmed mean (workbook-aligned displayed mean)
    p10: float
    p01: float

    # Optional diagnostics
    mean_full: Optional[float] = None   # untrimmed arithmetic mean
    minimum: Optional[float] = None
    maximum: Optional[float] = None
    std_dev: Optional[float] = None
    n_samples: int = 0


def _numpy_quantile(values: np.ndarray, q: float) -> float:
    """
    Compute a single quantile using NumPy's linear interpolation method
    (Hyndman-Fan Type 7, equivalent to Excel PERCENTILE.INC).
    """
    # numpy >= 1.22 uses method=; older uses interpolation=
    try:
        return float(np.quantile(values, q, method="linear"))
    except TypeError:
        return float(np.quantile(values, q, interpolation="linear"))  # type: ignore[call-arg]


def calculate_percentile_summary(
    values: np.ndarray,
    product_name: str = "",
    unit: str = "",
    include_diagnostics: bool = True,
) -> PercentileSummary:
    """
    Compute P99/P90/P50/mean/P10/P01 summary from a simulation output vector.

    Parameters
    ----------
    values : np.ndarray
        1-D array of simulated output values (must be finite and non-empty).
    product_name : str
        Human-readable name for the output product.
    unit : str
        Display unit string (e.g. "MMbbl", "Bcf", "MMBOE").
    include_diagnostics : bool
        If True, also compute min, max, std_dev, and full untrimmed mean.

    Returns
    -------
    PercentileSummary
    """
    arr = np.asarray(values, dtype=float)
    arr = arr[np.isfinite(arr)]
    n = len(arr)

    if n == 0:
        raise ValueError("Cannot compute percentile summary on an empty array.")

    p99 = _numpy_quantile(arr, PERCENTILE_QUANTILES["P99"])
    p90 = _numpy_quantile(arr, PERCENTILE_QUANTILES["P90"])
    p50 = _numpy_quantile(arr, PERCENTILE_QUANTILES["P50"])
    p10 = _numpy_quantile(arr, PERCENTILE_QUANTILES["P10"])
    p01 = _numpy_quantile(arr, PERCENTILE_QUANTILES["P01"])

    # Trimmed mean: retain values where p99 <= x <= p01 (q0.01 to q0.99)
    mask = (arr >= p99) & (arr <= p01)
    trimmed = arr[mask]
    mean_trimmed = float(np.mean(trimmed)) if len(trimmed) > 0 else float(np.mean(arr))

    summary = PercentileSummary(
        product_name=product_name,
        unit=unit,
        p99=p99,
        p90=p90,
        p50=p50,
        mean_trimmed=mean_trimmed,
        p10=p10,
        p01=p01,
        n_samples=n,
    )

    if include_diagnostics:
        summary.mean_full = float(np.mean(arr))
        summary.minimum = float(np.min(arr))
        summary.maximum = float(np.max(arr))
        summary.std_dev = float(np.std(arr))

    return summary


def trimmed_mean(values: np.ndarray, q_lo: float = 0.01, q_hi: float = 0.99) -> float:
    """
    Calculate the arithmetic mean of *values* trimmed between quantile
    *q_lo* and *q_hi* inclusive.

    Parameters
    ----------
    values : np.ndarray
        1-D numeric array.
    q_lo : float
        Lower quantile (default 0.01 = P99 label).
    q_hi : float
        Upper quantile (default 0.99 = P01 label).

    Returns
    -------
    float
    """
    arr = np.asarray(values, dtype=float)
    lo = _numpy_quantile(arr, q_lo)
    hi = _numpy_quantile(arr, q_hi)
    mask = (arr >= lo) & (arr <= hi)
    trimmed = arr[mask]
    return float(np.mean(trimmed)) if len(trimmed) > 0 else float(np.mean(arr))
