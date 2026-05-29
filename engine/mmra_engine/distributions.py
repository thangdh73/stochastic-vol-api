"""
distributions.py – Distribution definitions and sampling.

Supported distribution types:
    fixed       – constant value (no uncertainty)
    uniform     – Uniform(lower, upper)
    normal      – Normal(mu, sigma) fitted from P90/P10 (and optional P50)
    lognormal   – Lognormal fitted from P90/P10 in original space
    triangular  – Triangular(min, mode, max)
    beta        – Beta fitted from P90/P10 and bounds via scipy.optimize

Percentile convention (P10-large):
    P90 display value = conservative/small resource (CDF q=0.10)
    P10 display value = upside/large resource    (CDF q=0.90)

Random number generation uses numpy.random.default_rng(seed).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional

import numpy as np
from numpy.random import Generator
from scipy import optimize, stats

from .constants import Z90


class DistributionType(str, Enum):
    FIXED = "fixed"
    UNIFORM = "uniform"
    NORMAL = "normal"
    LOGNORMAL = "lognormal"
    TRIANGULAR = "triangular"
    BETA = "beta"
    PERT = "pert"


@dataclass
class DistributionDef:
    """
    Full specification of an uncertain variable's distribution.

    All numeric parameters must already be in canonical units
    (fractions for percents, feet for thickness, acres for area, etc.)
    before this object is constructed.
    """

    variable_id: str
    display_name: str
    distribution_type: DistributionType
    unit: str = ""
    canonical_unit: str = ""

    # Percentile inputs (P10-large convention: p90 < p10 for positive vars)
    p90: Optional[float] = None   # conservative / small value
    p50: Optional[float] = None   # median (optional for some distributions)
    p10: Optional[float] = None   # upside / large value

    # Fixed distribution
    fixed_value: Optional[float] = None

    # Triangular
    tri_min: Optional[float] = None
    tri_mode: Optional[float] = None
    tri_max: Optional[float] = None

    # Beta / uniform bounds
    min_bound: Optional[float] = None
    max_bound: Optional[float] = None

    # Clips (applied after sampling)
    low_clip: Optional[float] = None
    high_clip: Optional[float] = None

    notes: str = ""

    # When True, P50 participates in fitting (3-point skew) for normal / lognormal / beta.
    skew_enabled: bool = False

    # Solved parameters (filled in by fitting routines)
    solved_alpha: Optional[float] = field(default=None, repr=False)
    solved_beta: Optional[float] = field(default=None, repr=False)
    solved_mu: Optional[float] = field(default=None, repr=False)
    solved_sigma: Optional[float] = field(default=None, repr=False)


# ---------------------------------------------------------------------------
# Beta fitting
# ---------------------------------------------------------------------------

def _beta_fit_objective(params: np.ndarray, y10: float, y90: float) -> np.ndarray:
    """
    Residual function for fitting Beta(alpha, beta) to two CDF quantiles.

    Convention:
        BetaCDF(y10; alpha, beta) = 0.10   (P90 display = smaller value)
        BetaCDF(y90; alpha, beta) = 0.90   (P10 display = larger value)

    Parameters are log-transformed to enforce positivity.
    """
    alpha = math.exp(params[0])
    beta_ = math.exp(params[1])
    r1 = stats.beta.cdf(y10, alpha, beta_) - 0.10
    r2 = stats.beta.cdf(y90, alpha, beta_) - 0.90
    return np.array([r1, r2])


def _pert_resolve_bounds(dist: DistributionDef) -> tuple[float, float, float]:
    """Resolve PERT min / mode / max from explicit fields or P90 / P50 / P10."""
    lo = dist.tri_min
    mode = dist.tri_mode
    hi = dist.tri_max
    if lo is None:
        lo = dist.low_clip if dist.low_clip is not None else dist.p90
    if mode is None:
        mode = dist.p50 if dist.p50 is not None else (
            (dist.p90 + dist.p10) / 2.0
            if dist.p90 is not None and dist.p10 is not None
            else None
        )
    if hi is None:
        hi = dist.high_clip if dist.high_clip is not None else dist.p10
    if lo is None or mode is None or hi is None:
        raise ValueError(
            f"PERT distribution '{dist.variable_id}' could not resolve min/mode/max. "
            "Provide p90, p50, and p10 (or tri_min, tri_mode, tri_max)."
        )
    return float(lo), float(mode), float(hi)


def _pert_alpha_beta(
    lo: float,
    mode: float,
    hi: float,
    *,
    lamb: float = 4.0,
) -> tuple[float, float]:
    """Classic PERT beta shape parameters (min, mode, max)."""
    span = hi - lo
    if span <= 0:
        raise ValueError("PERT: max must be greater than min.")
    if not (lo <= mode <= hi):
        raise ValueError("PERT: mode must lie between min and max.")
    alpha = 1.0 + lamb * (mode - lo) / span
    beta_ = 1.0 + lamb * (hi - mode) / span
    return alpha, beta_


def fit_beta(
    p90_value: float,
    p10_value: float,
    a: float,
    b: float,
) -> tuple[float, float]:
    """
    Fit Beta distribution parameters (alpha, beta) so that:
        P(X <= p90_value) = 0.10  (P90 display = conservative)
        P(X <= p10_value) = 0.90  (P10 display = upside)

    Parameters
    ----------
    p90_value : float
        Conservative (smaller) value in canonical units.
    p10_value : float
        Upside (larger) value in canonical units.
    a : float
        Lower bound of the beta distribution in canonical units.
    b : float
        Upper bound of the beta distribution in canonical units.

    Returns
    -------
    (alpha, beta) : tuple[float, float]
        Fitted shape parameters.

    Raises
    ------
    ValueError
        If bounds do not enclose the P90/P10 values, or if fitting fails.
    """
    if not (a <= p90_value <= b):
        raise ValueError(
            f"P90 value {p90_value} must be within bounds [{a}, {b}]."
        )
    if not (a <= p10_value <= b):
        raise ValueError(
            f"P10 value {p10_value} must be within bounds [{a}, {b}]."
        )
    if p90_value >= p10_value:
        raise ValueError(
            f"P10 value ({p10_value}) must be greater than P90 value ({p90_value})."
        )
    if a >= b:
        raise ValueError(f"Lower bound {a} must be less than upper bound {b}.")

    # Normalise to [0, 1]
    span = b - a
    y10 = (p90_value - a) / span   # normalised P90 (smaller)
    y90 = (p10_value - a) / span   # normalised P10 (larger)

    # Initial guess: symmetric beta with alpha=beta=2
    x0 = np.array([math.log(2.0), math.log(2.0)])

    result = optimize.root(
        _beta_fit_objective,
        x0,
        args=(y10, y90),
        method="hybr",
        tol=1e-10,
        options={"maxfev": 2000},
    )

    if not result.success:
        # Retry with a different starting point
        for a0, b0 in [(1.0, 1.0), (3.0, 3.0), (0.5, 0.5), (5.0, 2.0), (2.0, 5.0)]:
            result = optimize.root(
                _beta_fit_objective,
                np.array([math.log(a0), math.log(b0)]),
                args=(y10, y90),
                method="hybr",
                tol=1e-10,
                options={"maxfev": 2000},
            )
            if result.success:
                break

    if not result.success:
        raise ValueError(
            f"Beta fitting did not converge for P90={p90_value}, P10={p10_value}, "
            f"a={a}, b={b}. Residual: {result.fun}"
        )

    alpha = math.exp(result.x[0])
    beta_ = math.exp(result.x[1])
    return alpha, beta_


# ---------------------------------------------------------------------------
# Normal / lognormal parameterization
# ---------------------------------------------------------------------------

def _fit_normal(
    p90_value: float,
    p10_value: float,
    p50_value: Optional[float] = None,
    skew_enabled: bool = False,
) -> tuple[float, float]:
    """
    Fit Normal(mu, sigma) from P90 and P10 display values.

    When skew_enabled and p50 is set, mu = p50. Otherwise mu is the P90/P10 midpoint.
    """
    sigma = max((p10_value - p90_value) / (2.0 * Z90), 1e-12)
    if skew_enabled and p50_value is not None:
        mu = p50_value
    elif p50_value is not None and not skew_enabled:
        mu = (p90_value + p10_value) / 2.0
    elif p50_value is not None:
        mu = p50_value
    else:
        mu = (p90_value + p10_value) / 2.0
    return mu, sigma


def _lognormal_3pt_residual(
    params: np.ndarray, p90_value: float, p50_value: float, p10_value: float
) -> np.ndarray:
    mu = params[0]
    sigma = max(math.exp(params[1]), 1e-12)
    z_vals = [stats.norm.ppf(0.1), stats.norm.ppf(0.5), stats.norm.ppf(0.9)]
    targets = [p90_value, p50_value, p10_value]
    preds = [math.exp(mu + sigma * z) for z in z_vals]
    return np.array([(p - t) / max(abs(t), 1e-12) for p, t in zip(preds, targets)])


def _fit_lognormal_3pt(p90_value: float, p50_value: float, p10_value: float) -> tuple[float, float]:
    if p90_value <= 0 or p50_value <= 0 or p10_value <= 0:
        raise ValueError("Lognormal skew fit requires positive P90, P50, and P10.")
    if not (p90_value <= p50_value <= p10_value):
        raise ValueError("Lognormal skew fit requires P90 <= P50 <= P10.")
    mu0, sigma0 = _fit_lognormal(p90_value, p10_value)
    x0 = np.array([mu0, math.log(max(sigma0, 1e-12))])
    result = optimize.least_squares(
        _lognormal_3pt_residual,
        x0,
        args=(p90_value, p50_value, p10_value),
        method="trf",
    )
    if not result.success:
        raise ValueError("Lognormal 3-point (skew) fit did not converge.")
    return float(result.x[0]), max(math.exp(float(result.x[1])), 1e-12)


def _fit_lognormal(
    p90_value: float,
    p10_value: float,
    p50_value: Optional[float] = None,
    skew_enabled: bool = False,
) -> tuple[float, float]:
    """
    Fit Lognormal from P90 and P10 display values.

    When skew_enabled with P50, fits all three percentiles (asymmetric / skewed lognormal).
    """
    if skew_enabled and p50_value is not None:
        return _fit_lognormal_3pt(p90_value, p50_value, p10_value)
    if p90_value <= 0 or p10_value <= 0:
        raise ValueError("Lognormal P90 and P10 values must be positive.")
    if p10_value < p90_value:
        raise ValueError("P10 must be >= P90 for positive resource variables.")
    ln_p90 = math.log(p90_value)
    ln_p10 = math.log(p10_value)
    sigma_ln = max((ln_p10 - ln_p90) / (2.0 * Z90), 1e-12)
    mu_ln = (ln_p90 + ln_p10) / 2.0
    return mu_ln, sigma_ln


def _beta_3pt_residual(
    params: np.ndarray, y90: float, y50: float, y10: float
) -> np.ndarray:
    alpha = math.exp(params[0])
    beta_ = math.exp(params[1])
    qs = [0.1, 0.5, 0.9]
    targets = [y90, y50, y10]
    preds = [stats.beta.ppf(q, alpha, beta_) for q in qs]
    return np.array([p - t for p, t in zip(preds, targets)])


def fit_beta_3pt(
    p90_value: float,
    p50_value: float,
    p10_value: float,
    a: float,
    b: float,
) -> tuple[float, float]:
    """Fit Beta(alpha, beta) to P90, P50, and P10 (skew / 3-point)."""
    if not (a <= p90_value <= b and a <= p50_value <= b and a <= p10_value <= b):
        raise ValueError("P90, P50, and P10 must lie within [min_bound, max_bound].")
    if not (p90_value <= p50_value <= p10_value):
        raise ValueError("Beta skew fit requires P90 <= P50 <= P10.")
    span = b - a
    if span <= 0:
        raise ValueError("Beta bounds must satisfy min_bound < max_bound.")
    y90 = (p90_value - a) / span
    y50 = (p50_value - a) / span
    y10 = (p10_value - a) / span
    alpha0, beta0 = fit_beta(p90_value, p10_value, a, b)
    x0 = np.array([math.log(max(alpha0, 1e-6)), math.log(max(beta0, 1e-6))])
    result = optimize.least_squares(
        _beta_3pt_residual,
        x0,
        args=(y90, y50, y10),
        method="trf",
    )
    if not result.success:
        raise ValueError("Beta 3-point (skew) fit did not converge.")
    return math.exp(float(result.x[0])), math.exp(float(result.x[1]))


# ---------------------------------------------------------------------------
# Public sampling function
# ---------------------------------------------------------------------------

def sample_distribution(
    dist: DistributionDef,
    n: int,
    rng: Generator,
) -> np.ndarray:
    """
    Draw *n* samples from *dist* using NumPy generator *rng*.

    Clips are NOT applied here; call apply_clips() separately.

    Parameters
    ----------
    dist : DistributionDef
        Fully specified distribution definition (canonical units).
    n : int
        Number of samples to draw.
    rng : Generator
        NumPy random generator (numpy.random.default_rng(seed)).

    Returns
    -------
    np.ndarray, shape (n,)
    """
    dt = dist.distribution_type

    if dt == DistributionType.FIXED:
        if dist.fixed_value is None:
            raise ValueError(
                f"Fixed distribution '{dist.variable_id}' has no fixed_value."
            )
        return np.full(n, dist.fixed_value)

    elif dt == DistributionType.UNIFORM:
        lo = dist.min_bound if dist.min_bound is not None else dist.p90
        hi = dist.max_bound if dist.max_bound is not None else dist.p10
        if lo is None or hi is None:
            raise ValueError(
                f"Uniform distribution '{dist.variable_id}' requires min_bound and max_bound "
                f"(or p90/p10 as surrogate)."
            )
        return rng.uniform(lo, hi, size=n)

    elif dt == DistributionType.NORMAL:
        if dist.p90 is None or dist.p10 is None:
            raise ValueError(
                f"Normal distribution '{dist.variable_id}' requires p90 and p10."
            )
        mu, sigma = _fit_normal(dist.p90, dist.p10, dist.p50, dist.skew_enabled)
        dist.solved_mu = mu
        dist.solved_sigma = sigma
        return rng.normal(mu, sigma, size=n)

    elif dt == DistributionType.LOGNORMAL:
        if dist.p90 is None or dist.p10 is None:
            raise ValueError(
                f"Lognormal distribution '{dist.variable_id}' requires p90 and p10."
            )
        if dist.skew_enabled and dist.p50 is None:
            raise ValueError(
                f"Lognormal distribution '{dist.variable_id}' has skew_enabled but no p50."
            )
        mu_ln, sigma_ln = _fit_lognormal(
            dist.p90, dist.p10, dist.p50, dist.skew_enabled
        )
        dist.solved_mu = mu_ln
        dist.solved_sigma = sigma_ln
        return np.exp(rng.normal(mu_ln, sigma_ln, size=n))

    elif dt == DistributionType.TRIANGULAR:
        lo = dist.tri_min
        mode = dist.tri_mode
        hi = dist.tri_max

        # Fallback if explicit triangular params not given
        if lo is None:
            lo = dist.low_clip if dist.low_clip is not None else dist.p90
        if mode is None:
            mode = dist.p50 if dist.p50 is not None else (
                (dist.p90 + dist.p10) / 2.0 if dist.p90 is not None and dist.p10 is not None else None
            )
        if hi is None:
            hi = dist.high_clip if dist.high_clip is not None else dist.p10

        if lo is None or mode is None or hi is None:
            raise ValueError(
                f"Triangular distribution '{dist.variable_id}' could not resolve "
                f"min/mode/max. Provide tri_min, tri_mode, tri_max explicitly."
            )
        # scipy triangular: c = (mode - min) / (max - min)
        span = hi - lo
        if span <= 0:
            raise ValueError(
                f"Triangular distribution '{dist.variable_id}': max must be > min."
            )
        c = (mode - lo) / span
        # Use scipy to draw; rng compatible via its random_state argument
        # Convert to numpy-rng compatible: use rng.uniform for CDF inversion
        # scipy.stats.triang.rvs with random_state accepts a np.random.Generator
        return stats.triang.rvs(c, loc=lo, scale=span, size=n, random_state=rng)

    elif dt == DistributionType.BETA:
        a = dist.min_bound if dist.min_bound is not None else 0.0
        b = dist.max_bound if dist.max_bound is not None else 1.0
        if dist.p90 is None or dist.p10 is None:
            raise ValueError(
                f"Beta distribution '{dist.variable_id}' requires p90 and p10."
            )
        if dist.skew_enabled:
            if dist.p50 is None:
                raise ValueError(
                    f"Beta distribution '{dist.variable_id}' has skew_enabled but no p50."
                )
            alpha, beta_ = fit_beta_3pt(dist.p90, dist.p50, dist.p10, a, b)
        else:
            alpha, beta_ = fit_beta(dist.p90, dist.p10, a, b)
        dist.solved_alpha = alpha
        dist.solved_beta = beta_
        # Sample from standard Beta then rescale
        raw = rng.beta(alpha, beta_, size=n)
        return a + raw * (b - a)

    elif dt == DistributionType.PERT:
        lo, mode, hi = _pert_resolve_bounds(dist)
        if hi <= lo:
            raise ValueError(
                f"PERT distribution '{dist.variable_id}': max must be > min."
            )
        alpha, beta_ = _pert_alpha_beta(lo, mode, hi)
        dist.solved_alpha = alpha
        dist.solved_beta = beta_
        raw = rng.beta(alpha, beta_, size=n)
        return lo + raw * (hi - lo)

    else:
        raise ValueError(f"Unknown distribution type: {dt}")


def apply_clips(
    samples: np.ndarray,
    low_clip: Optional[float],
    high_clip: Optional[float],
) -> np.ndarray:
    """
    Apply hard clips to a sample array.

    Parameters
    ----------
    samples : np.ndarray
        Raw sample values.
    low_clip : float or None
        If provided, values below this are clamped to low_clip.
    high_clip : float or None
        If provided, values above this are clamped to high_clip.

    Returns
    -------
    np.ndarray
        Clipped sample values (same shape as input).
    """
    if low_clip is not None:
        samples = np.maximum(samples, low_clip)
    if high_clip is not None:
        samples = np.minimum(samples, high_clip)
    return samples


# ---------------------------------------------------------------------------
# Representative values for perturbation tornado (OAT P50 / P90 / P10)
# ---------------------------------------------------------------------------

def distribution_repr_values(dist: DistributionDef) -> Dict[str, float]:
    """
    Return P50 (base), P90 (conservative input), P10 (upside input) in canonical units.

    Uses MMRA P10-large convention: P90 is the smaller representative value for
    positive resource drivers; P10 is the larger.
    """
    dt = dist.distribution_type

    if dt == DistributionType.FIXED:
        if dist.fixed_value is None:
            raise ValueError(f"Fixed distribution '{dist.variable_id}' has no fixed_value.")
        v = float(dist.fixed_value)
        return {"p50": v, "p90": v, "p10": v}

    if dt in (DistributionType.TRIANGULAR, DistributionType.PERT):
        lo, mode, hi = _pert_resolve_bounds(dist)
        return {"p50": float(mode), "p90": float(lo), "p10": float(hi)}

    if dt == DistributionType.UNIFORM:
        lo = dist.min_bound if dist.min_bound is not None else dist.p90
        hi = dist.max_bound if dist.max_bound is not None else dist.p10
        if lo is None or hi is None:
            raise ValueError(f"Uniform distribution '{dist.variable_id}' needs bounds or p90/p10.")
        mid = (float(lo) + float(hi)) / 2.0
        return {"p50": mid, "p90": float(lo), "p10": float(hi)}

    if dist.p90 is None or dist.p10 is None:
        raise ValueError(
            f"Distribution '{dist.variable_id}' requires p90 and p10 for perturbation tornado."
        )
    p90 = float(dist.p90)
    p10 = float(dist.p10)
    if dt == DistributionType.NORMAL:
        p50, _ = _fit_normal(
            p90, p10, dist.p50 if dist.skew_enabled else None, dist.skew_enabled
        )
    elif dt == DistributionType.LOGNORMAL:
        if dist.skew_enabled and dist.p50 is not None:
            p50 = float(dist.p50)
        else:
            mu_ln, _ = _fit_lognormal(p90, p10)
            p50 = math.exp(mu_ln)
    elif dt == DistributionType.BETA:
        a = dist.min_bound if dist.min_bound is not None else 0.0
        b = dist.max_bound if dist.max_bound is not None else 1.0
        if dist.skew_enabled and dist.p50 is not None:
            p50 = float(dist.p50)
        else:
            alpha, beta_ = fit_beta(p90, p10, a, b)
            p50 = a + (alpha / (alpha + beta_)) * (b - a)
    elif dist.p50 is not None:
        p50 = float(dist.p50)
    else:
        p50 = (p90 + p10) / 2.0

    return {"p50": p50, "p90": p90, "p10": p10}
