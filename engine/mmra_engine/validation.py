"""
validation.py – QA/QC validation module for the MMRA calculation engine.

Provides structured validation of DistributionDef and SimulationInput objects
before simulation execution.  The module does NOT modify the engine's runtime
behaviour; it is a pre-flight checking layer.

Design notes
------------
* P10-large convention: P90 is the conservative / small value,
  P10 is the upside / large value.  For positive resource variables
  the ordering must be P90 < P10 (otherwise ``P10 < P90`` is an error).
* All numeric physical-range limits are sourced from
  ``mmra_engine/constants.py`` or derived from the workbook admin defaults
  documented in the Technical Calculation Specification.
* The validator is *purely functional*: it never raises; all findings are
  returned as a ``ValidationReport``.

Blocking errors (severity ERROR) prevent simulation from running.
Warnings (severity WARNING) are informational; simulation may proceed.
Info messages (severity INFO) are advisory only.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any

from .constants import (
    POROSITY_MIN_FRACTION,
    POROSITY_MAX_FRACTION,
    HC_SAT_MIN_FRACTION,
    HC_SAT_MAX_FRACTION,
    OIL_FVF_MIN,
    OIL_FVF_MAX,
    GEF_MIN,
    GEF_MAX,
    CHANCE_MIN,
    CHANCE_MAX,
    MIN_ITERATION_COUNT,
    MAX_ITERATION_COUNT,
)
from .distributions import DistributionDef, DistributionType


# ---------------------------------------------------------------------------
# Severity
# ---------------------------------------------------------------------------

class ValidationSeverity(str, Enum):
    """Severity levels for validation findings."""
    ERROR   = "ERROR"    # blocking – simulation must not run
    WARNING = "WARNING"  # advisory – simulation may run
    INFO    = "INFO"     # informational only


# Convenience aliases for callers that prefer attribute-style access
ERROR   = ValidationSeverity.ERROR
WARNING = ValidationSeverity.WARNING
INFO    = ValidationSeverity.INFO


# ---------------------------------------------------------------------------
# ValidationIssue
# ---------------------------------------------------------------------------

@dataclass
class ValidationIssue:
    """
    A single validation finding.

    Attributes
    ----------
    code : str
        Short machine-readable identifier, e.g. ``"P10_LT_P90"``.
    severity : ValidationSeverity
        ERROR, WARNING, or INFO.
    module : str
        Which module / section raised the issue, e.g. ``"distribution"``,
        ``"simulation_input"``, ``"chance"``.
    field : str
        The field or variable name that triggered the issue,
        e.g. ``"area_dist.p10"``.
    message : str
        Human-readable description.
    recommended_action : str, optional
        Suggested corrective action.
    value : Any, optional
        The offending value (for display / logging).
    """
    code:               str
    severity:           ValidationSeverity
    module:             str
    field:              str
    message:            str
    recommended_action: Optional[str] = None
    value:              Optional[Any] = None


# ---------------------------------------------------------------------------
# ValidationReport
# ---------------------------------------------------------------------------

@dataclass
class ValidationReport:
    """
    Aggregated collection of ``ValidationIssue`` objects.

    Usage
    -----
    ::

        report = validate_simulation_input(sim_input)
        if report.has_errors:
            for issue in report.errors:
                print(issue.message)
        else:
            result = run_simulation(sim_input)
    """

    issues: List[ValidationIssue] = field(default_factory=list)

    # ------------------------------------------------------------------
    # Mutation helpers
    # ------------------------------------------------------------------

    def add_issue(self, issue: ValidationIssue) -> None:
        """Append a single ``ValidationIssue``."""
        self.issues.append(issue)

    def extend(self, other: "ValidationReport") -> None:
        """Merge all issues from *other* into this report."""
        self.issues.extend(other.issues)

    # ------------------------------------------------------------------
    # Filtered views
    # ------------------------------------------------------------------

    @property
    def errors(self) -> List[ValidationIssue]:
        """Return only ERROR-severity issues."""
        return [i for i in self.issues if i.severity == ValidationSeverity.ERROR]

    @property
    def warnings(self) -> List[ValidationIssue]:
        """Return only WARNING-severity issues."""
        return [i for i in self.issues if i.severity == ValidationSeverity.WARNING]

    @property
    def infos(self) -> List[ValidationIssue]:
        """Return only INFO-severity issues."""
        return [i for i in self.issues if i.severity == ValidationSeverity.INFO]

    @property
    def has_errors(self) -> bool:
        """``True`` when at least one ERROR exists."""
        return any(i.severity == ValidationSeverity.ERROR for i in self.issues)

    @property
    def can_run_simulation(self) -> bool:
        """
        ``True`` when there are no blocking ERRORs and simulation may proceed.
        """
        return not self.has_errors

    def by_module(self, module: str) -> List[ValidationIssue]:
        """Return all issues for a given *module* name."""
        return [i for i in self.issues if i.module == module]

    # ------------------------------------------------------------------
    # Representation
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        n_err  = len(self.errors)
        n_warn = len(self.warnings)
        n_info = len(self.infos)
        return (
            f"ValidationReport(errors={n_err}, warnings={n_warn}, infos={n_info}, "
            f"can_run={self.can_run_simulation})"
        )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _issue(
    code: str,
    severity: ValidationSeverity,
    module: str,
    field: str,
    message: str,
    recommended_action: Optional[str] = None,
    value: Optional[Any] = None,
) -> ValidationIssue:
    """Factory shortcut for ``ValidationIssue``."""
    return ValidationIssue(
        code=code,
        severity=severity,
        module=module,
        field=field,
        message=message,
        recommended_action=recommended_action,
        value=value,
    )


def _err(code, module, field, message, recommended_action=None, value=None):
    return _issue(code, ERROR, module, field, message, recommended_action, value)


def _warn(code, module, field, message, recommended_action=None, value=None):
    return _issue(code, WARNING, module, field, message, recommended_action, value)


def _info(code, module, field, message, recommended_action=None, value=None):
    return _issue(code, INFO, module, field, message, recommended_action, value)


def _is_finite(v: Optional[float]) -> bool:
    """Return True if v is a non-None, finite number."""
    return v is not None and math.isfinite(v)


def _warn_if_fixed_nrv_input(
    dist: Optional[DistributionDef],
    field_prefix: str,
    display_name: str,
    module: str,
    report: ValidationReport,
) -> None:
    """Fixed GRV-route inputs do not vary in MC — no tornado/Spearman sensitivity."""
    if dist is None:
        return
    if getattr(dist, "distribution_type", None) != DistributionType.FIXED:
        return
    report.add_issue(_warn(
        "NRV_INPUT_FIXED", module, field_prefix,
        f"{display_name} is a fixed value; it will not drive uncertainty in "
        "STOIIP/tornado charts (Spearman ρ = 0).",
        recommended_action=(
            f"Set {field_prefix} to lognormal or triangular on NRV / GRV "
            "if you want NTG or fill sensitivity."
        ),
        value=getattr(dist, "fixed_value", None),
    ))


# ---------------------------------------------------------------------------
# validate_distribution_def
# ---------------------------------------------------------------------------

def validate_distribution_def(
    distribution: DistributionDef,
    module: str = "distribution",
    field_prefix: str = "",
    variable_kind: str = "generic",
    limits: Optional[Dict[str, float]] = None,
) -> ValidationReport:
    """
    Validate a single ``DistributionDef`` object.

    Parameters
    ----------
    distribution : DistributionDef
        The distribution definition to validate.
    module : str
        Module tag for all issues produced (default ``"distribution"``).
    field_prefix : str
        Optional prefix prepended to field names (e.g. ``"area_dist"``).
    variable_kind : str
        Semantic kind of the variable.  Recognised values:

        * ``"positive_resource"`` – P90, P10 must be strictly positive and
          P90 < P10 (e.g. area, net pay).
        * ``"fraction"`` – values must be in [0, 1].
        * ``"porosity"`` – fraction + workbook range [1 %, 40 %].
        * ``"saturation"`` – fraction + workbook range [15 %, 95 %].
        * ``"fvf"`` – FVF range [1.0, 4.0] rb/stb (warning outside).
        * ``"gef"`` – GEF range [25, 750] scf/res ft³ (warning outside).
        * ``"generic"`` – no additional range checks.

    limits : dict, optional
        Override or extend range checks.  Recognised keys:
        ``warn_min``, ``warn_max``, ``error_min``, ``error_max``.

    Returns
    -------
    ValidationReport
        All issues found; empty report means the distribution is clean.
    """
    report = ValidationReport()
    dist   = distribution
    fp     = f"{field_prefix}." if field_prefix else ""
    vid    = dist.variable_id or field_prefix or "unknown"

    def _f(subfield: str) -> str:
        return f"{fp}{subfield}" if fp else subfield

    dt = dist.distribution_type

    # ------------------------------------------------------------------
    # Fixed distribution
    # ------------------------------------------------------------------
    if dt == DistributionType.FIXED:
        if dist.fixed_value is None:
            report.add_issue(_err(
                "FIXED_VALUE_MISSING", module, _f("fixed_value"),
                f"Fixed distribution '{vid}' has no fixed_value set.",
                recommended_action="Set fixed_value to a valid numeric constant.",
            ))
            return report  # nothing else to check

        fv = dist.fixed_value
        if not math.isfinite(fv):
            report.add_issue(_err(
                "FIXED_VALUE_NOT_FINITE", module, _f("fixed_value"),
                f"Fixed distribution '{vid}': fixed_value={fv!r} is not finite.",
                value=fv,
            ))

        # Clip consistency for fixed
        if dist.low_clip is not None and fv < dist.low_clip:
            report.add_issue(_err(
                "FIXED_OUTSIDE_CLIPS", module, _f("fixed_value"),
                f"Fixed distribution '{vid}': fixed_value={fv} is below low_clip={dist.low_clip}. "
                "All samples will be clipped to low_clip.",
                recommended_action="Set fixed_value >= low_clip or remove the clip.",
                value=fv,
            ))
        if dist.high_clip is not None and fv > dist.high_clip:
            report.add_issue(_err(
                "FIXED_OUTSIDE_CLIPS", module, _f("fixed_value"),
                f"Fixed distribution '{vid}': fixed_value={fv} is above high_clip={dist.high_clip}. "
                "All samples will be clipped to high_clip.",
                recommended_action="Set fixed_value <= high_clip or remove the clip.",
                value=fv,
            ))

        # Range checks for fixed value using variable_kind / limits
        report.extend(_check_range(fv, vid, _f("fixed_value"), module,
                                   variable_kind, limits, is_fixed=True))
        return report

    # ------------------------------------------------------------------
    # Clip sanity (non-fixed)
    # ------------------------------------------------------------------
    if dist.low_clip is not None and dist.high_clip is not None:
        if dist.low_clip > dist.high_clip:
            report.add_issue(_err(
                "LOW_CLIP_GT_HIGH_CLIP", module, _f("low_clip"),
                f"Distribution '{vid}': low_clip={dist.low_clip} > high_clip={dist.high_clip}.",
                recommended_action="Ensure low_clip < high_clip.",
                value=dist.low_clip,
            ))

    # ------------------------------------------------------------------
    # Percentile-based distributions (normal, lognormal, beta)
    # ------------------------------------------------------------------
    if dt in (DistributionType.NORMAL,
              DistributionType.LOGNORMAL,
              DistributionType.BETA):

        p90 = dist.p90
        p10 = dist.p10
        p50 = dist.p50

        # Required numeric check
        if p90 is None or not math.isfinite(p90):
            report.add_issue(_err(
                "P90_MISSING_OR_INVALID", module, _f("p90"),
                f"Distribution '{vid}': p90 is missing or non-finite.",
                recommended_action="Provide a finite numeric P90 value.",
                value=p90,
            ))
        if p10 is None or not math.isfinite(p10):
            report.add_issue(_err(
                "P10_MISSING_OR_INVALID", module, _f("p10"),
                f"Distribution '{vid}': p10 is missing or non-finite.",
                recommended_action="Provide a finite numeric P10 value.",
                value=p10,
            ))

        # If either p90/p10 invalid we cannot do further ordering checks
        if not (_is_finite(p90) and _is_finite(p10)):
            return report

        # Lognormal / positive_resource: strictly positive
        if dt == DistributionType.LOGNORMAL or variable_kind == "positive_resource":
            if p90 <= 0:
                report.add_issue(_err(
                    "LOGNORMAL_P90_NOT_POSITIVE", module, _f("p90"),
                    f"Distribution '{vid}': p90={p90} must be > 0 for lognormal / positive-resource variables.",
                    value=p90,
                ))
            if p10 <= 0:
                report.add_issue(_err(
                    "LOGNORMAL_P10_NOT_POSITIVE", module, _f("p10"),
                    f"Distribution '{vid}': p10={p10} must be > 0 for lognormal / positive-resource variables.",
                    value=p10,
                ))

        # P10 must be >= P90 (P10-large convention: P90 is conservative)
        if p10 < p90:
            report.add_issue(_err(
                "P10_LT_P90", module, _f("p10"),
                f"Distribution '{vid}': P10={p10} < P90={p90}. "
                "In P10-large convention P10 is the upside value and must be >= P90.",
                recommended_action="Swap P90 and P10, or correct the input values.",
                value=p10,
            ))

        if (dt in (DistributionType.LOGNORMAL, DistributionType.BETA, DistributionType.NORMAL)
                and dist.skew_enabled
                and (p50 is None or not math.isfinite(p50))):
            report.add_issue(_err(
                "SKEW_P50_REQUIRED", module, _f("p50"),
                f"Distribution '{vid}': skew_enabled requires a valid P50 between P90 and P10.",
                recommended_action="Set P50 or turn off skew distribution.",
            ))

        # P50 ordering: P90 <= P50 <= P10
        if p50 is not None and math.isfinite(p50):
            if p50 < p90:
                report.add_issue(_err(
                    "P50_OUTSIDE_P90_P10", module, _f("p50"),
                    f"Distribution '{vid}': P50={p50} < P90={p90}. P50 must be between P90 and P10.",
                    recommended_action="Correct P50 so that P90 <= P50 <= P10.",
                    value=p50,
                ))
            elif p50 > p10:
                report.add_issue(_err(
                    "P50_OUTSIDE_P90_P10", module, _f("p50"),
                    f"Distribution '{vid}': P50={p50} > P10={p10}. P50 must be between P90 and P10.",
                    recommended_action="Correct P50 so that P90 <= P50 <= P10.",
                    value=p50,
                ))

        # Wide-uncertainty range warning (P10/P90 ratio > 10 for positive vars)
        if p90 is not None and p90 > 0 and p10 is not None:
            ratio = p10 / p90
            if ratio > 10.0:
                report.add_issue(_warn(
                    "WIDE_UNCERTAINTY_RANGE", module, _f("p10"),
                    f"Distribution '{vid}': P10/P90 ratio={ratio:.1f} (P90={p90}, P10={p10}). "
                    "This is a very wide uncertainty range – verify inputs.",
                    recommended_action="Check that P90 and P10 are in the correct units and convention.",
                    value=ratio,
                ))

        # P50 lognormal consistency check (advisory) — only when skew is off
        if (dt == DistributionType.LOGNORMAL
                and not dist.skew_enabled
                and p50 is not None
                and math.isfinite(p50)
                and p90 is not None and p90 > 0
                and p10 is not None and p10 > 0
                and p10 >= p90):
            import math as _math
            ln_p50_fit = (_math.log(p90) + _math.log(p10)) / 2.0
            p50_fit    = _math.exp(ln_p50_fit)
            if p50 > 0:
                rel_diff = abs(p50 - p50_fit) / p50_fit
                if rel_diff > 0.10:
                    report.add_issue(_warn(
                        "P50_LOGNORMAL_INCONSISTENT", module, _f("p50"),
                        f"Distribution '{vid}': stated P50={p50:.4g} differs from the two-point "
                        f"lognormal fit P50={p50_fit:.4g} by {rel_diff*100:.1f}%. "
                        "The engine uses P90/P10 to parameterise the lognormal; P50 is informational only.",
                        recommended_action=(
                            "Enable skew distribution to fit P90, P50, and P10 together, "
                            "or adjust P50 to match the two-point fit."
                        ),
                        value=p50,
                    ))

        # Beta-specific: bounds must enclose P90 and P10
        if dt == DistributionType.BETA:
            a = dist.min_bound if dist.min_bound is not None else 0.0
            b = dist.max_bound if dist.max_bound is not None else 1.0

            if a >= b:
                report.add_issue(_err(
                    "BETA_BOUNDS_INVALID", module, _f("min_bound"),
                    f"Beta distribution '{vid}': min_bound={a} >= max_bound={b}.",
                    recommended_action="Set min_bound < max_bound.",
                    value=a,
                ))
            else:
                # Check P90 inside [a, b]
                if _is_finite(p90) and not (a <= p90 <= b):
                    report.add_issue(_err(
                        "BETA_P90_OUTSIDE_BOUNDS", module, _f("p90"),
                        f"Beta distribution '{vid}': P90={p90} is outside bounds [{a}, {b}].",
                        recommended_action="Extend bounds or adjust P90 so that a <= P90 <= b.",
                        value=p90,
                    ))
                # Check P10 inside [a, b]
                if _is_finite(p10) and not (a <= p10 <= b):
                    report.add_issue(_err(
                        "BETA_P10_OUTSIDE_BOUNDS", module, _f("p10"),
                        f"Beta distribution '{vid}': P10={p10} is outside bounds [{a}, {b}].",
                        recommended_action="Extend bounds or adjust P10 so that a <= P10 <= b.",
                        value=p10,
                    ))

        # Range checks on central tendency for non-fixed
        central = p50 if (p50 is not None and math.isfinite(p50)) else (
            (p90 + p10) / 2.0 if (_is_finite(p90) and _is_finite(p10)) else None
        )
        if central is not None:
            report.extend(_check_range(central, vid, _f("p50/mid"), module,
                                       variable_kind, limits, is_fixed=False))
        # Also check p90 / p10 extremes
        if _is_finite(p90):
            report.extend(_check_range(p90, vid, _f("p90"), module,
                                       variable_kind, limits, is_fixed=False,
                                       check_warn=False))
        if _is_finite(p10):
            report.extend(_check_range(p10, vid, _f("p10"), module,
                                       variable_kind, limits, is_fixed=False,
                                       check_warn=False))

    # ------------------------------------------------------------------
    # Uniform distribution
    # ------------------------------------------------------------------
    elif dt == DistributionType.UNIFORM:
        lo = dist.min_bound if dist.min_bound is not None else dist.p90
        hi = dist.max_bound if dist.max_bound is not None else dist.p10

        if lo is None or not math.isfinite(lo):
            report.add_issue(_err(
                "UNIFORM_MISSING_LOWER", module, _f("min_bound"),
                f"Uniform distribution '{vid}': lower bound (min_bound or p90) is missing.",
            ))
        if hi is None or not math.isfinite(hi):
            report.add_issue(_err(
                "UNIFORM_MISSING_UPPER", module, _f("max_bound"),
                f"Uniform distribution '{vid}': upper bound (max_bound or p10) is missing.",
            ))
        if _is_finite(lo) and _is_finite(hi) and lo >= hi:
            report.add_issue(_err(
                "UNIFORM_LOWER_GE_UPPER", module, _f("min_bound"),
                f"Uniform distribution '{vid}': lower={lo} >= upper={hi}.",
                value=lo,
            ))
        # Range checks
        if _is_finite(lo) and _is_finite(hi):
            mid = (lo + hi) / 2.0
            report.extend(_check_range(mid, vid, _f("mid"), module,
                                       variable_kind, limits, is_fixed=False))

    # ------------------------------------------------------------------
    # Triangular distribution
    # ------------------------------------------------------------------
    elif dt == DistributionType.TRIANGULAR:
        lo = dist.tri_min
        mode = dist.tri_mode
        hi = dist.tri_max
        # Same fallbacks as sample_distribution / distribution_repr_values
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

        if lo is None or not math.isfinite(lo):
            report.add_issue(_err(
                "TRIANGULAR_MISSING_MIN", module, _f("tri_min"),
                f"Triangular distribution '{vid}': tri_min is missing.",
            ))
        if hi is None or not math.isfinite(hi):
            report.add_issue(_err(
                "TRIANGULAR_MISSING_MAX", module, _f("tri_max"),
                f"Triangular distribution '{vid}': tri_max is missing.",
            ))
        if mode is None or not math.isfinite(mode):
            report.add_issue(_err(
                "TRIANGULAR_MISSING_MODE", module, _f("tri_mode"),
                f"Triangular distribution '{vid}': tri_mode is missing.",
            ))
        if _is_finite(lo) and _is_finite(hi) and lo >= hi:
            report.add_issue(_err(
                "TRIANGULAR_MIN_GE_MAX", module, _f("tri_min"),
                f"Triangular distribution '{vid}': tri_min={lo} >= tri_max={hi}.",
                value=lo,
            ))
        if (_is_finite(lo) and _is_finite(hi) and _is_finite(mode)
                and not (lo <= mode <= hi)):
            report.add_issue(_err(
                "TRIANGULAR_MODE_OUTSIDE_BOUNDS", module, _f("tri_mode"),
                f"Triangular distribution '{vid}': tri_mode={mode} is outside "
                f"[tri_min={lo}, tri_max={hi}].",
                value=mode,
            ))

    # ------------------------------------------------------------------
    # PERT distribution (P90 / P50 / P10 → min / mode / max)
    # ------------------------------------------------------------------
    elif dt == DistributionType.PERT:
        from .distributions import _pert_resolve_bounds

        try:
            lo, mode, hi = _pert_resolve_bounds(dist)
        except ValueError as exc:
            report.add_issue(_err(
                "PERT_MISSING_PERCENTILES", module, _f("p90"),
                str(exc),
            ))
            return report

        if not math.isfinite(lo) or not math.isfinite(mode) or not math.isfinite(hi):
            report.add_issue(_err(
                "PERT_INVALID_PERCENTILES", module, _f("p90"),
                f"PERT distribution '{vid}': p90, p50, and p10 must be finite numbers.",
            ))
            return report

        if lo >= hi:
            report.add_issue(_err(
                "PERT_MIN_GE_MAX", module, _f("p90"),
                f"PERT distribution '{vid}': p90={lo} must be less than p10={hi}.",
                value=lo,
            ))
        if not (lo <= mode <= hi):
            report.add_issue(_err(
                "PERT_MODE_OUTSIDE_BOUNDS", module, _f("p50"),
                f"PERT distribution '{vid}': p50={mode} must lie between p90={lo} and p10={hi}.",
                value=mode,
            ))
        report.extend(_check_range(mode, vid, _f("p50"), module,
                                   variable_kind, limits, is_fixed=False))

    return report


# ---------------------------------------------------------------------------
# _check_range  – shared range-check helper
# ---------------------------------------------------------------------------

_KIND_LIMITS = {
    # variable_kind → (warn_min, warn_max, error_min, error_max)
    # warn thresholds trigger WARNING outside recommended range
    # error thresholds trigger ERROR for physically impossible values
    "porosity":   (POROSITY_MIN_FRACTION, POROSITY_MAX_FRACTION,    0.0, 1.0),
    "saturation": (HC_SAT_MIN_FRACTION,   HC_SAT_MAX_FRACTION,       0.0, 1.0),
    "fraction":   (0.0,                   1.0,                       0.0, 1.0),
    "fvf":        (OIL_FVF_MIN,           OIL_FVF_MAX,               0.0, float("inf")),
    "gef":        (GEF_MIN,               GEF_MAX,                   0.0, float("inf")),
    "positive_resource": (0.0,            float("inf"),              0.0, float("inf")),
    "generic":    (None,                  None,                      None, None),
}


def _check_range(
    value: float,
    vid: str,
    field: str,
    module: str,
    variable_kind: str,
    limits: Optional[Dict[str, float]],
    *,
    is_fixed: bool = False,
    check_warn: bool = True,
) -> ValidationReport:
    """Return a ValidationReport with range findings for *value*."""
    report = ValidationReport()

    # Resolve limits
    row = _KIND_LIMITS.get(variable_kind, _KIND_LIMITS["generic"])
    warn_min_k, warn_max_k, err_min_k, err_max_k = row

    # Override with caller-supplied limits
    if limits:
        warn_min_k = limits.get("warn_min", warn_min_k)
        warn_max_k = limits.get("warn_max", warn_max_k)
        err_min_k  = limits.get("error_min", err_min_k)
        err_max_k  = limits.get("error_max", err_max_k)

    # ------------------------------------------------------------------
    # Blocking errors: physically impossible values
    # ------------------------------------------------------------------
    if err_min_k is not None and value < err_min_k:
        report.add_issue(_err(
            "VALUE_PHYSICALLY_IMPOSSIBLE_LOW", module, field,
            f"Variable '{vid}': value={value!r} is below the physically possible "
            f"minimum={err_min_k} for kind '{variable_kind}'.",
            recommended_action=f"Set value >= {err_min_k}.",
            value=value,
        ))
    if err_max_k is not None and math.isfinite(err_max_k) and value > err_max_k:
        report.add_issue(_err(
            "VALUE_PHYSICALLY_IMPOSSIBLE_HIGH", module, field,
            f"Variable '{vid}': value={value!r} is above the physically possible "
            f"maximum={err_max_k} for kind '{variable_kind}'.",
            recommended_action=f"Set value <= {err_max_k}.",
            value=value,
        ))

    # ------------------------------------------------------------------
    # Warnings: outside recommended range (skip if error already raised)
    # ------------------------------------------------------------------
    if check_warn and not report.has_errors:
        if warn_min_k is not None and value < warn_min_k:
            report.add_issue(_warn(
                "VALUE_BELOW_RECOMMENDED", module, field,
                f"Variable '{vid}': value={value!r} is below the recommended "
                f"minimum={warn_min_k} for kind '{variable_kind}'. "
                "Verify this is intentional.",
                value=value,
            ))
        if warn_max_k is not None and math.isfinite(warn_max_k) and value > warn_max_k:
            report.add_issue(_warn(
                "VALUE_ABOVE_RECOMMENDED", module, field,
                f"Variable '{vid}': value={value!r} is above the recommended "
                f"maximum={warn_max_k} for kind '{variable_kind}'. "
                "Verify this is intentional.",
                value=value,
            ))

    return report


# ---------------------------------------------------------------------------
# validate_chance_categories
# ---------------------------------------------------------------------------

def validate_chance_categories(
    categories: Dict[str, List[float]],
) -> ValidationReport:
    """
    Validate chance category sub-factors.

    Parameters
    ----------
    categories : dict
        Mapping of category name → list of sub-factor fractions.

    Returns
    -------
    ValidationReport
        Issues include:

        * **ERROR** – any sub-factor outside [0, 1].
        * **WARNING** – expected 5 standard categories not all present.
        * **INFO** – all variables treated as independent (no correlation).
    """
    report  = ValidationReport()
    module  = "chance"
    EXPECTED_CATS = {
        "source", "timing_migration", "reservoir", "closure", "containment"
    }

    if not categories:
        report.add_issue(_warn(
            "CHANCE_CATEGORIES_EMPTY", module, "chance_categories",
            "No chance categories provided. Pg will not be calculated.",
            recommended_action="Provide at least one chance category.",
        ))
        return report

    # Per-factor range checks
    for cat_name, sub_factors in categories.items():
        if not sub_factors:
            report.add_issue(_err(
                "CHANCE_CATEGORY_NO_SUBFACTORS", module,
                f"chance_categories.{cat_name}",
                f"Chance category '{cat_name}' has no sub-factors.",
                recommended_action="Provide at least one sub-factor for each category.",
            ))
            continue

        for idx, v in enumerate(sub_factors):
            field_name = f"chance_categories.{cat_name}[{idx}]"
            if v is None:
                continue
            if not math.isfinite(v):
                report.add_issue(_err(
                    "CHANCE_NOT_FINITE", module, field_name,
                    f"Chance sub-factor '{cat_name}[{idx}]'={v!r} is not finite.",
                    value=v,
                ))
            elif v < CHANCE_MIN or v > CHANCE_MAX:
                report.add_issue(_err(
                    "CHANCE_OUT_OF_RANGE", module, field_name,
                    f"Chance sub-factor '{cat_name}[{idx}]'={v} is outside [0, 1]. "
                    "All chance values must be fractions (0–1).",
                    recommended_action=(
                        "If value was entered as a percentage, divide by 100."
                    ),
                    value=v,
                ))

    # Completeness warning
    provided_cats = set(categories.keys())
    missing = EXPECTED_CATS - provided_cats
    if missing:
        report.add_issue(_warn(
            "CHANCE_CATEGORIES_INCOMPLETE", module, "chance_categories",
            f"Expected geologic chance categories {sorted(EXPECTED_CATS)} but "
            f"the following are missing: {sorted(missing)}. "
            "Pg will be computed from the supplied categories only.",
            recommended_action=(
                "Add the missing categories, or confirm the reduced set is intentional."
            ),
        ))

    # Independence info
    report.add_issue(_info(
        "CORRELATIONS_INDEPENDENT", module, "chance_categories",
        "All chance sub-factors within a category are treated independently "
        "using weak-link logic (minimum value). "
        "Sub-factor correlation is not modelled in this version.",
    ))

    return report


# ---------------------------------------------------------------------------
# validate_complex_traps
# ---------------------------------------------------------------------------

def validate_complex_traps(sim_input: Any) -> ValidationReport:
    """Validate downdip complex trap configuration."""
    report = ValidationReport()
    module = "complex_trap"
    ct = getattr(sim_input, "complex_trap", None)
    if ct is None or not getattr(ct, "enabled", False):
        return report

    report.add_issue(_info(
        "COMPLEX_TRAP_ENABLED", module, "complex_trap",
        f"Complex trap extension enabled (method {getattr(ct, 'method', 'A')}).",
    ))

    el1 = getattr(ct, "element_1", None)
    if el1 is None or not getattr(el1, "enabled", False):
        report.add_issue(_warn(
            "COMPLEX_TRAP_NO_ELEMENT", module, "complex_trap.element_1",
            "Complex trap is enabled but element 1 is not configured.",
        ))
        return report

    p1 = float(getattr(el1, "seal_confidence", 0.5))
    if p1 < 0.0 or p1 > 1.0:
        report.add_issue(_err(
            "COMPLEX_TRAP_CONFIDENCE", module, "complex_trap.element_1.seal_confidence",
            f"Seal confidence must be 0–1 (fraction); got {p1}.",
            value=p1,
        ))

    max1 = float(getattr(el1, "max_area_acres", 0.0))
    if max1 <= 0.0:
        report.add_issue(_err(
            "COMPLEX_TRAP_MAX_AREA", module, "complex_trap.element_1.max_area_acres",
            "Element 1 max area must be positive (acres).",
            value=max1,
        ))

    num = int(getattr(ct, "num_elements", 1))
    if num >= 2:
        el2 = getattr(ct, "element_2", None)
        if el2 is None or not getattr(el2, "enabled", False):
            report.add_issue(_warn(
                "COMPLEX_TRAP_EL2_MISSING", module, "complex_trap.element_2",
                "Two elements selected but element 2 is not enabled.",
            ))
        else:
            max2 = float(getattr(el2, "max_area_acres", 0.0))
            if max2 <= 0.0:
                report.add_issue(_err(
                    "COMPLEX_TRAP_MAX_AREA", module, "complex_trap.element_2.max_area_acres",
                    "Element 2 max area must be positive (acres).",
                    value=max2,
                ))
            if max2 < max1:
                report.add_issue(_warn(
                    "COMPLEX_TRAP_MAX_ORDER", module, "complex_trap",
                    "Element 2 max is less than element 1 max; workbook typically uses "
                    "element 2 as the larger downdip envelope.",
                ))

    area_dist = getattr(sim_input, "area_dist", None)
    if area_dist is not None and max1 > 0:
        closed = None
        if getattr(area_dist, "distribution_type", None) == DistributionType.FIXED:
            closed = getattr(area_dist, "fixed_value", None)
        elif getattr(area_dist, "p50", None) is not None:
            closed = area_dist.p50
        if closed is not None and closed > max1:
            report.add_issue(_warn(
                "COMPLEX_TRAP_MAX_BELOW_CLOSED", module, "complex_trap",
                f"Closed area ({closed:.0f} ac) exceeds element 1 max ({max1:.0f} ac); "
                "updip minimum may exceed trap caps on all iterations.",
            ))

    method = getattr(sim_input, "estimating_method", "area_net_pay_yield")
    grv_dist = getattr(sim_input, "grv_dist", None)
    if method == "nrv_grv_yield" and grv_dist is not None and max1 > 0:
        grv_p10 = getattr(grv_dist, "p10", None)
        grv_p90 = getattr(grv_dist, "p90", None) or getattr(grv_dist, "fixed_value", None)
        if grv_p10 is not None and max1 > grv_p10 * 1.05:
            report.add_issue(_warn(
                "COMPLEX_TRAP_GRV_CAP_HIGH", module, "complex_trap.element_1.max_area_acres",
                f"Element 1 max ({max1:,.0f} acre-ft) is above GRV P10 ({grv_p10:,.0f} acre-ft). "
                "Set element caps between GRV P90 and P10 (in the same canonical units) "
                "or results may barely change.",
            ))
        if grv_p90 is not None and max1 < grv_p90 * 0.95:
            report.add_issue(_warn(
                "COMPLEX_TRAP_GRV_CAP_LOW", module, "complex_trap.element_1.max_area_acres",
                f"Element 1 max ({max1:,.0f} acre-ft) is below GRV P90 ({grv_p90:,.0f} acre-ft). "
                "Use P90–P10 GRV values as element caps (workbook percentile anchors).",
            ))

    return report


# ---------------------------------------------------------------------------
# validate_correlations
# ---------------------------------------------------------------------------

def validate_correlations(sim_input: Any) -> ValidationReport:
    """Validate correlation_mode and correlation pair specifications."""
    from .correlation import (
        CORRELATION_MODES,
        build_correlation_matrix,
        correlatable_variables_for_input,
        normalize_correlation_mode,
        validate_correlation_matrix,
    )

    report = ValidationReport()
    module = "correlation"
    ft = getattr(sim_input, "fluid_type", "oil") or "oil"
    raw_mode = getattr(sim_input, "correlation_mode", "independent") or "independent"
    mode = normalize_correlation_mode(raw_mode)
    pairs = getattr(sim_input, "correlations", None) or []

    if mode not in CORRELATION_MODES:
        report.add_issue(_err(
            "CORRELATION_MODE_INVALID", module, "correlation_mode",
            f"correlation_mode='{raw_mode}' is not recognised. "
            "Use 'independent', 'rank', or 'gaussian_copula'.",
            value=raw_mode,
        ))
        return report

    if mode == "independent" or not pairs:
        report.add_issue(_info(
            "CORRELATIONS_INDEPENDENT", module, "correlation_mode",
            "Input variables will be sampled independently.",
        ))
        return report

    enabled = [p for p in pairs if getattr(p, "enabled", True)]
    if not enabled:
        report.add_issue(_warn(
            "CORRELATIONS_NONE_ENABLED", module, "correlations",
            f"correlation_mode='{mode}' but no pairs are enabled; "
            "simulation will use independent sampling.",
        ))
        return report

    from .calculation_toggles import (
        apply_oil_recovery,
        gor_active_for_correlations,
    )

    active = correlatable_variables_for_input(
        ft.lower(),
        estimating_method=getattr(sim_input, "estimating_method", "area_net_pay_yield"),
        nrv_entry_mode=getattr(sim_input, "nrv_entry_mode", "grv_fill_ntg"),
        gor_present=gor_active_for_correlations(sim_input),
        condensate_present=getattr(sim_input, "condensate_yield_dist", None) is not None,
        oil_recovery_present=apply_oil_recovery(sim_input),
    )
    active_set = set(active)
    used = set()
    for p in enabled:
        if p.variable_a not in active_set or p.variable_b not in active_set:
            report.add_issue(_warn(
                "CORRELATION_PAIR_INACTIVE_METHOD", module, "correlations",
                f"Pair ({p.variable_a}, {p.variable_b}) is not used for the current "
                f"estimating method; it will be ignored in simulation.",
                recommended_action="Remove the pair or switch estimating method on Prospect Setup.",
            ))
        used.add(p.variable_a)
        used.add(p.variable_b)
    correlate_ids = [v for v in active if v in used]

    dist_attr = {
        "area": "area_dist",
        "percent_fill": "percent_fill_dist",
        "net_pay": "net_pay_dist",
        "geometric_correction": "geometric_correction_dist",
        "porosity": "porosity_dist",
        "saturation": "saturation_dist",
        "oil_recovery": "oil_recovery_dist",
        "fvf": "fvf_dist",
        "gor": "gor_dist",
        "solution_gas_recovery": "solution_gas_recovery_dist",
        "gas_recovery": "gas_recovery_dist",
        "gef": "gef_dist",
        "condensate_yield": "condensate_yield_dist",
    }

    from .distributions import DistributionType

    for p in enabled:
        for vid in (p.variable_a, p.variable_b):
            if vid not in active:
                report.add_issue(_err(
                    "CORRELATION_VAR_INVALID", module, f"correlations.{vid}",
                    f"Variable '{vid}' is not valid for fluid_type='{ft}'.",
                    value=vid,
                ))
            attr = dist_attr.get(vid)
            dist = getattr(sim_input, attr, None) if attr else None
            if dist is not None and getattr(dist, "distribution_type", None) == DistributionType.FIXED:
                report.add_issue(_warn(
                    "CORRELATION_VAR_FIXED", module, f"correlations.{vid}",
                    f"Variable '{vid}' uses a fixed distribution; correlation "
                    "has no effect on a constant input.",
                    value=vid,
                ))

    if len(correlate_ids) >= 2:
        try:
            R = build_correlation_matrix(correlate_ids, enabled)
            validate_correlation_matrix(R)
        except ValueError as exc:
            report.add_issue(_err(
                "CORRELATION_MATRIX_INVALID", module, "correlations",
                str(exc),
            ))
    else:
        report.add_issue(_warn(
            "CORRELATIONS_INSUFFICIENT", module, "correlations",
            "Fewer than two correlatable variables in enabled pairs.",
        ))

    if mode == "rank":
        report.add_issue(_info(
            "CORRELATIONS_RANK", module, "correlation_mode",
            f"Rank correlation (Iman–Conover) enabled with {len(enabled)} pair(s).",
        ))
    else:
        report.add_issue(_info(
            "CORRELATIONS_GAUSSIAN", module, "correlation_mode",
            f"Gaussian copula enabled with {len(enabled)} pair(s) "
            "(Pearson ρ on normal scores).",
        ))
    return report


# ---------------------------------------------------------------------------
# validate_simulation_input
# ---------------------------------------------------------------------------

def validate_simulation_input(sim_input: Any) -> ValidationReport:
    """
    Validate a ``SimulationInput`` object before running the simulation.

    Checks include:

    * Required distributions present for the declared fluid type.
    * ``n_iterations`` within [MIN_ITERATION_COUNT, MAX_ITERATION_COUNT].
    * All present distributions individually validated.
    * ``chance_categories`` validated if provided.
    * Correlation independence advisory.

    Parameters
    ----------
    sim_input : SimulationInput
        The simulation specification to validate.

    Returns
    -------
    ValidationReport
        Consolidated report with all issues.
    """
    report = ValidationReport()
    module = "simulation_input"

    # ------------------------------------------------------------------
    # fluid_type
    # ------------------------------------------------------------------
    ft = getattr(sim_input, "fluid_type", None)
    if ft is None:
        report.add_issue(_err(
            "FLUID_TYPE_MISSING", module, "fluid_type",
            "fluid_type is not set.",
            recommended_action="Set fluid_type to 'oil', 'gas', or 'gas_condensate'.",
        ))
        ft = ""
    else:
        ft = ft.lower()
        if ft not in ("oil", "gas", "gas_condensate"):
            report.add_issue(_err(
                "FLUID_TYPE_INVALID", module, "fluid_type",
                f"fluid_type='{ft}' is not recognised. Expected 'oil', 'gas', or 'gas_condensate'.",
                value=ft,
            ))

    # ------------------------------------------------------------------
    # n_iterations
    # ------------------------------------------------------------------
    n_iter = getattr(sim_input, "n_iterations", None)
    if n_iter is None:
        report.add_issue(_err(
            "N_ITERATIONS_MISSING", module, "n_iterations",
            "n_iterations is not set.",
            recommended_action=f"Set n_iterations >= {MIN_ITERATION_COUNT}.",
        ))
    else:
        if n_iter < MIN_ITERATION_COUNT:
            report.add_issue(_err(
                "N_ITERATIONS_TOO_LOW", module, "n_iterations",
                f"n_iterations={n_iter} is below the minimum of {MIN_ITERATION_COUNT:,}. "
                "Simulation statistics will be unreliable.",
                recommended_action=f"Set n_iterations >= {MIN_ITERATION_COUNT}.",
                value=n_iter,
            ))
        if n_iter > MAX_ITERATION_COUNT:
            report.add_issue(_err(
                "N_ITERATIONS_TOO_HIGH", module, "n_iterations",
                f"n_iterations={n_iter} exceeds the configured maximum of "
                f"{MAX_ITERATION_COUNT:,}.",
                recommended_action=f"Set n_iterations <= {MAX_ITERATION_COUNT}.",
                value=n_iter,
            ))

    # ------------------------------------------------------------------
    # Estimating method
    # ------------------------------------------------------------------
    est_method = getattr(sim_input, "estimating_method", "area_net_pay_yield") or "area_net_pay_yield"
    if est_method not in ("area_net_pay_yield", "nrv_grv_yield"):
        report.add_issue(_err(
            "ESTIMATING_METHOD_INVALID", module, "estimating_method",
            f"estimating_method='{est_method}' is not recognised.",
            recommended_action="Use 'area_net_pay_yield' or 'nrv_grv_yield'.",
            value=est_method,
        ))
        est_method = "area_net_pay_yield"

    # ------------------------------------------------------------------
    # Required distributions (method-specific + HC yield)
    # ------------------------------------------------------------------
    if est_method == "nrv_grv_yield":
        nrv_mode = getattr(sim_input, "nrv_entry_mode", "grv_fill_ntg") or "grv_fill_ntg"
        if nrv_mode == "direct":
            if getattr(sim_input, "nrv_direct_dist", None) is None:
                report.add_issue(_err(
                    "REQUIRED_DIST_MISSING", module, "nrv_direct_dist",
                    "nrv_direct_dist is required for NRV direct entry.",
                    recommended_action="Set nrv_direct_dist on the NRV / GRV tab.",
                ))
            else:
                report.extend(validate_distribution_def(
                    sim_input.nrv_direct_dist, module=module,
                    field_prefix="nrv_direct_dist", variable_kind="positive_resource",
                ))
            mult_dist = getattr(sim_input, "nrv_direct_multiplier_dist", None)
            if mult_dist is None:
                mult_dist = DistributionDef(
                    variable_id="nrv_direct_multiplier",
                    display_name="NRV multiply factor",
                    distribution_type=DistributionType.FIXED,
                    unit="fraction",
                    canonical_unit="fraction",
                    fixed_value=float(
                        getattr(sim_input, "nrv_direct_multiplier", 1.0) or 1.0
                    ),
                )
            report.extend(validate_distribution_def(
                mult_dist,
                module=module,
                field_prefix="nrv_direct_multiplier_dist",
                variable_kind="positive_resource",
            ))
        elif nrv_mode == "petrel_marginals":
            from .petrel_grv import petrel_marginals_from_dict, build_grv_matrix_3x3

            raw_pm = getattr(sim_input, "petrel_grv_marginals", None)
            pm = (
                raw_pm
                if raw_pm is not None and hasattr(raw_pm, "depth_grv")
                else petrel_marginals_from_dict(raw_pm if isinstance(raw_pm, dict) else None)
            )
            if pm is None:
                report.add_issue(_err(
                    "REQUIRED_PETREL_MARGINALS",
                    module,
                    "petrel_grv_marginals",
                    "petrel_grv_marginals is required for Petrel GRV mode (3 depth + 3 contact GRV values).",
                    recommended_action="Enter Petrel structural and contact GRV cases on Input → Rock volume.",
                ))
            else:
                try:
                    build_grv_matrix_3x3(pm)
                except ValueError as exc:
                    report.add_issue(_err(
                        "PETREL_MARGINALS_INVALID",
                        module,
                        "petrel_grv_marginals",
                        str(exc),
                        recommended_action="Check six GRV values and weights.",
                    ))
                d_mid = pm.depth_grv[1]
                c_mid = pm.contact_grv[1]
                if abs(d_mid - c_mid) / max(d_mid, c_mid, 1.0) > 0.05:
                    report.add_issue(_warn(
                        "PETREL_MID_MISMATCH",
                        module,
                        "petrel_grv_marginals",
                        f"P50 structural GRV ({d_mid}) and P50 contact GRV ({c_mid}) differ by >5%. "
                        "Petrel mid cases should align at the same base case.",
                        recommended_action="Reconcile Petrel mid structure and mid contact runs.",
                    ))
            ntg = getattr(sim_input, "net_to_gross_dist", None)
            if ntg is None:
                report.add_issue(_err(
                    "REQUIRED_DIST_MISSING", module, "net_to_gross_dist",
                    "net_to_gross_dist is required for NRV method.",
                    recommended_action="Set NTG on HC yield or rock volume.",
                ))
            else:
                report.extend(validate_distribution_def(
                    ntg, module=module, field_prefix="net_to_gross_dist", variable_kind="fraction",
                ))
        else:
            for attr, vkind in [
                ("grv_dist", "positive_resource"),
                ("grv_percent_fill_dist", "fraction"),
                ("net_to_gross_dist", "fraction"),
            ]:
                dist = getattr(sim_input, attr, None)
                if dist is None:
                    report.add_issue(_err(
                        "REQUIRED_DIST_MISSING", module, attr,
                        f"Required distribution '{attr}' is not provided for NRV method.",
                        recommended_action=f"Set {attr} on the NRV / GRV tab.",
                    ))
                else:
                    report.extend(validate_distribution_def(
                        dist, module=module, field_prefix=attr, variable_kind=vkind,
                    ))
                    labels = {
                        "grv_percent_fill_dist": "Percent trap fill",
                        "net_to_gross_dist": "Net/Gross (NTG)",
                    }
                    if attr in labels:
                        _warn_if_fixed_nrv_input(
                            dist, attr, labels[attr], module, report,
                        )
        if getattr(sim_input, "cross_check_enabled", False):
            dist = getattr(sim_input, "cross_check_area_dist", None)
            if dist is None:
                report.add_issue(_err(
                    "REQUIRED_DIST_MISSING", module, "cross_check_area_dist",
                    "cross_check_area_dist is required when Area–NP cross-check is enabled.",
                    recommended_action="Enable cross-check only after setting productive area.",
                ))
            else:
                report.extend(validate_distribution_def(
                    dist, module=module, field_prefix="cross_check_area_dist",
                    variable_kind="positive_resource",
                ))
    else:
        for attr, vkind in [
            ("area_dist", "positive_resource"),
            ("net_pay_dist", "positive_resource"),
        ]:
            dist = getattr(sim_input, attr, None)
            if dist is None:
                report.add_issue(_err(
                    "REQUIRED_DIST_MISSING", module, attr,
                    f"Required distribution '{attr}' is not provided.",
                    recommended_action=f"Set {attr}.",
                ))
            else:
                report.extend(validate_distribution_def(
                    dist, module=module, field_prefix=attr, variable_kind=vkind,
                ))
        for attr, vkind in [
            ("percent_fill_dist", "fraction"),
            ("geometric_correction_dist", "fraction"),
        ]:
            dist = getattr(sim_input, attr, None)
            if dist is not None:
                report.extend(validate_distribution_def(
                    dist, module=module, field_prefix=attr, variable_kind=vkind,
                ))

    for attr, vkind in [
        ("porosity_dist", "porosity"),
        ("saturation_dist", "saturation"),
    ]:
        dist = getattr(sim_input, attr, None)
        if dist is None:
            report.add_issue(_err(
                "REQUIRED_DIST_MISSING", module, attr,
                f"Required distribution '{attr}' is not provided.",
                recommended_action=f"Set {attr}.",
            ))
        else:
            report.extend(validate_distribution_def(
                dist, module=module, field_prefix=attr, variable_kind=vkind,
            ))

    # ------------------------------------------------------------------
    # Fluid-type specific required distributions
    # ------------------------------------------------------------------
    if ft == "oil":
        from .calculation_toggles import (
            apply_oil_recovery,
            requires_oil_recovery_dist,
            requires_solution_gas_dists,
        )

        _OIL_REQUIRED = [("fvf_dist", "fvf")]
        if requires_oil_recovery_dist(sim_input):
            _OIL_REQUIRED.insert(0, ("oil_recovery_dist", "fraction"))
        for attr, vkind in _OIL_REQUIRED:
            dist = getattr(sim_input, attr, None)
            if dist is None:
                report.add_issue(_err(
                    "REQUIRED_DIST_MISSING", module, attr,
                    f"Required distribution '{attr}' is not provided for fluid_type='oil'.",
                    recommended_action=f"Set {attr}.",
                ))
            else:
                sub = validate_distribution_def(dist, module=module,
                                                field_prefix=attr,
                                                variable_kind=vkind)
                report.extend(sub)

        if requires_solution_gas_dists(sim_input):
            for attr, vkind in [
                ("gor_dist", "positive_resource"),
                ("solution_gas_recovery_dist", "fraction"),
            ]:
                dist = getattr(sim_input, attr, None)
                if dist is None:
                    report.add_issue(_err(
                        "REQUIRED_DIST_MISSING", module, attr,
                        f"Required distribution '{attr}' when include_solution_gas is enabled.",
                        recommended_action=f"Set {attr} or disable solution gas.",
                    ))
                else:
                    report.extend(validate_distribution_def(
                        dist, module=module, field_prefix=attr, variable_kind=vkind,
                    ))

        # Optional distributions – validate if present
        for attr, vkind in [
            ("gor_dist",                    "positive_resource"),
            ("solution_gas_recovery_dist",  "fraction"),
            ("percent_fill_dist",           "fraction"),
            ("geometric_correction_dist",   "fraction"),
        ]:
            if requires_solution_gas_dists(sim_input) and attr in (
                "gor_dist",
                "solution_gas_recovery_dist",
            ):
                continue
            dist = getattr(sim_input, attr, None)
            if dist is not None:
                sub = validate_distribution_def(dist, module=module,
                                                field_prefix=attr,
                                                variable_kind=vkind)
                report.extend(sub)

    elif ft in ("gas", "gas_condensate"):
        _GAS_REQUIRED = [
            ("gas_recovery_dist", "fraction"),
            ("gef_dist",          "gef"),
        ]
        for attr, vkind in _GAS_REQUIRED:
            dist = getattr(sim_input, attr, None)
            if dist is None:
                report.add_issue(_err(
                    "REQUIRED_DIST_MISSING", module, attr,
                    f"Required distribution '{attr}' is not provided for fluid_type='{ft}'.",
                    recommended_action=f"Set {attr}.",
                ))
            else:
                sub = validate_distribution_def(dist, module=module,
                                                field_prefix=attr,
                                                variable_kind=vkind)
                report.extend(sub)

        for attr, vkind in [
            ("condensate_yield_dist",       "positive_resource"),
            ("percent_fill_dist",           "fraction"),
            ("geometric_correction_dist",   "fraction"),
        ]:
            dist = getattr(sim_input, attr, None)
            if dist is not None:
                sub = validate_distribution_def(dist, module=module,
                                                field_prefix=attr,
                                                variable_kind=vkind)
                report.extend(sub)

    # ------------------------------------------------------------------
    # Chance categories (optional but validated when present)
    # ------------------------------------------------------------------
    from .calculation_toggles import include_chance as toggle_include_chance
    from .calculation_toggles import uses_ccop_risk

    chance_cats = getattr(sim_input, "chance_categories", None)
    if toggle_include_chance(sim_input) and chance_cats and not uses_ccop_risk(sim_input):
        sub = validate_chance_categories(chance_cats)
        report.extend(sub)

    # ------------------------------------------------------------------
    # Complex traps
    # ------------------------------------------------------------------
    report.extend(validate_complex_traps(sim_input))

    # ------------------------------------------------------------------
    # Rank correlation (partial matrix)
    # ------------------------------------------------------------------
    report.extend(validate_correlations(sim_input))

    # ------------------------------------------------------------------
    # Notes field advisory
    # ------------------------------------------------------------------
    notes = getattr(sim_input, "notes", None)
    if not notes:
        report.add_issue(_warn(
            "NOTES_MISSING", module, "notes",
            "No prospect notes or rationale provided. "
            "Adding notes improves audit traceability.",
            recommended_action=(
                "Populate the 'notes' field with geological rationale and data source references."
            ),
        ))

    return report


# ---------------------------------------------------------------------------
# validate_module_scope – per-tab preview (subset of full-case validation)
# ---------------------------------------------------------------------------

MODULE_SCOPES = ("area", "net_pay", "hc_yield", "chance", "nrv")


def _validate_n_iterations(sim_input: Any, module: str, report: ValidationReport) -> None:
    n_iter = getattr(sim_input, "n_iterations", None)
    if n_iter is None:
        report.add_issue(_err(
            "N_ITERATIONS_MISSING", module, "n_iterations",
            "n_iterations is not set.",
            recommended_action=f"Set n_iterations >= {MIN_ITERATION_COUNT}.",
        ))
    else:
        if n_iter < MIN_ITERATION_COUNT:
            report.add_issue(_err(
                "N_ITERATIONS_TOO_LOW", module, "n_iterations",
                f"n_iterations={n_iter} is below the minimum of {MIN_ITERATION_COUNT:,}.",
                recommended_action=f"Set n_iterations >= {MIN_ITERATION_COUNT}.",
                value=n_iter,
            ))
        if n_iter > MAX_ITERATION_COUNT:
            report.add_issue(_err(
                "N_ITERATIONS_TOO_HIGH", module, "n_iterations",
                f"n_iterations={n_iter} exceeds the maximum of {MAX_ITERATION_COUNT:,}.",
                recommended_action=f"Set n_iterations <= {MAX_ITERATION_COUNT}.",
                value=n_iter,
            ))


def validate_module_scope(sim_input: Any, scope: str) -> ValidationReport:
    """
    Validate only the inputs required for a scoped module preview.

    Parameters
    ----------
    sim_input : SimulationInput
    scope : str
        One of ``area``, ``net_pay``, ``hc_yield``, ``chance``.
    """
    scope_key = (scope or "").lower().strip()
    report = ValidationReport()
    module = f"module_{scope_key}"

    if scope_key not in MODULE_SCOPES:
        report.add_issue(_err(
            "MODULE_SCOPE_INVALID", module, "scope",
            f"Unknown module scope {scope!r}. Use: {', '.join(MODULE_SCOPES)}.",
        ))
        return report

    _validate_n_iterations(sim_input, module, report)

    if scope_key == "area":
        dist = getattr(sim_input, "area_dist", None)
        if dist is None:
            report.add_issue(_err(
                "REQUIRED_DIST_MISSING", module, "area_dist",
                "Closed area distribution is required for Area module preview.",
                recommended_action="Set area_dist on the Area tab.",
            ))
        else:
            report.extend(validate_distribution_def(
                dist, module=module, field_prefix="area_dist",
                variable_kind="positive_resource",
            ))
        for attr, vkind in [
            ("percent_fill_dist", "fraction"),
            ("geometric_correction_dist", "fraction"),
        ]:
            dist = getattr(sim_input, attr, None)
            if dist is not None:
                report.extend(validate_distribution_def(
                    dist, module=module, field_prefix=attr, variable_kind=vkind,
                ))
        report.extend(validate_complex_traps(sim_input))

    elif scope_key == "net_pay":
        dist = getattr(sim_input, "net_pay_dist", None)
        if dist is None:
            report.add_issue(_err(
                "REQUIRED_DIST_MISSING", module, "net_pay_dist",
                "Net pay distribution is required for Net Pay module preview.",
                recommended_action="Set net_pay_dist on the Net Pay tab.",
            ))
        else:
            report.extend(validate_distribution_def(
                dist, module=module, field_prefix="net_pay_dist",
                variable_kind="positive_resource",
            ))

    elif scope_key == "hc_yield":
        ft = getattr(sim_input, "fluid_type", None)
        if ft is None:
            report.add_issue(_err(
                "FLUID_TYPE_MISSING", module, "fluid_type",
                "fluid_type is not set.",
                recommended_action="Set fluid_type to 'oil', 'gas', or 'gas_condensate'.",
            ))
            ft = ""
        else:
            ft = ft.lower()
            if ft not in ("oil", "gas", "gas_condensate"):
                report.add_issue(_err(
                    "FLUID_TYPE_INVALID", module, "fluid_type",
                    f"fluid_type='{ft}' is not recognised.",
                    value=ft,
                ))

        for attr, vkind in [
            ("porosity_dist", "porosity"),
            ("saturation_dist", "saturation"),
        ]:
            dist = getattr(sim_input, attr, None)
            if dist is None:
                report.add_issue(_err(
                    "REQUIRED_DIST_MISSING", module, attr,
                    f"Required distribution '{attr}' is not provided for HC Yield preview.",
                    recommended_action=f"Set {attr}.",
                ))
            else:
                report.extend(validate_distribution_def(
                    dist, module=module, field_prefix=attr, variable_kind=vkind,
                ))

        if ft == "oil":
            from .calculation_toggles import (
                requires_oil_recovery_dist,
                requires_solution_gas_dists,
            )

            if requires_oil_recovery_dist(sim_input):
                dist = getattr(sim_input, "oil_recovery_dist", None)
                if dist is None:
                    report.add_issue(_err(
                        "REQUIRED_DIST_MISSING", module, "oil_recovery_dist",
                        "Required distribution 'oil_recovery_dist' for fluid_type='oil'.",
                        recommended_action="Set oil_recovery_dist or disable oil recovery.",
                    ))
                else:
                    report.extend(validate_distribution_def(
                        dist, module=module, field_prefix="oil_recovery_dist",
                        variable_kind="fraction",
                    ))
            dist = getattr(sim_input, "fvf_dist", None)
            if dist is None:
                report.add_issue(_err(
                    "REQUIRED_DIST_MISSING", module, "fvf_dist",
                    "Required distribution 'fvf_dist' for fluid_type='oil'.",
                    recommended_action="Set fvf_dist.",
                ))
            else:
                report.extend(validate_distribution_def(
                    dist, module=module, field_prefix="fvf_dist", variable_kind="fvf",
                ))
            if requires_solution_gas_dists(sim_input):
                for attr, vkind in [
                    ("gor_dist", "positive_resource"),
                    ("solution_gas_recovery_dist", "fraction"),
                ]:
                    dist = getattr(sim_input, attr, None)
                    if dist is None:
                        report.add_issue(_err(
                            "REQUIRED_DIST_MISSING", module, attr,
                            f"Required distribution '{attr}' when include_solution_gas is enabled.",
                            recommended_action=f"Set {attr} or disable solution gas.",
                        ))
                    else:
                        report.extend(validate_distribution_def(
                            dist, module=module, field_prefix=attr, variable_kind=vkind,
                        ))
            else:
                for attr, vkind in [
                    ("gor_dist", "positive_resource"),
                    ("solution_gas_recovery_dist", "fraction"),
                ]:
                    dist = getattr(sim_input, attr, None)
                    if dist is not None:
                        report.extend(validate_distribution_def(
                            dist, module=module, field_prefix=attr, variable_kind=vkind,
                        ))

        elif ft in ("gas", "gas_condensate"):
            for attr, vkind in [
                ("gas_recovery_dist", "fraction"),
                ("gef_dist", "gef"),
            ]:
                dist = getattr(sim_input, attr, None)
                if dist is None:
                    report.add_issue(_err(
                        "REQUIRED_DIST_MISSING", module, attr,
                        f"Required distribution '{attr}' for fluid_type='{ft}'.",
                        recommended_action=f"Set {attr}.",
                    ))
                else:
                    report.extend(validate_distribution_def(
                        dist, module=module, field_prefix=attr, variable_kind=vkind,
                    ))
            dist = getattr(sim_input, "condensate_yield_dist", None)
            if dist is not None:
                report.extend(validate_distribution_def(
                    dist, module=module, field_prefix="condensate_yield_dist",
                    variable_kind="positive_resource",
                ))

    elif scope_key == "chance":
        from .calculation_toggles import include_chance as toggle_include_chance
        from .calculation_toggles import uses_ccop_risk

        if not toggle_include_chance(sim_input):
            report.add_issue(_info(
                "CHANCE_DISABLED", module, "include_chance",
                "Chance evaluation is disabled; Pg will not be calculated.",
            ))
        elif uses_ccop_risk(sim_input):
            if not getattr(sim_input, "ccop_risk", None):
                report.add_issue(_warn(
                    "CCOP_RISK_EMPTY", module, "ccop_risk",
                    "CCOP risk model selected but ccop_risk is empty.",
                    recommended_action="Enter CCOP reservoir, trap, charge, and retention factors.",
                ))
        else:
            chance_cats = getattr(sim_input, "chance_categories", None)
            if not chance_cats:
                report.add_issue(_warn(
                    "CHANCE_CATEGORIES_EMPTY", module, "chance_categories",
                    "No chance categories defined; Pg preview will be empty.",
                    recommended_action="Enter sub-factors for each geologic category.",
                ))
            else:
                report.extend(validate_chance_categories(chance_cats))

    elif scope_key == "nrv":
        est_method = getattr(sim_input, "estimating_method", "area_net_pay_yield")
        if est_method != "nrv_grv_yield":
            report.add_issue(_warn(
                "NRV_SCOPE_WRONG_METHOD", module, "estimating_method",
                "NRV preview is intended when estimating method is Net Rock Volume × HC Yield.",
                recommended_action="Switch estimating method on Prospect Setup.",
            ))
        nrv_mode = getattr(sim_input, "nrv_entry_mode", "grv_fill_ntg") or "grv_fill_ntg"
        if nrv_mode == "direct":
            dist = getattr(sim_input, "nrv_direct_dist", None)
            if dist is None:
                report.add_issue(_err(
                    "REQUIRED_DIST_MISSING", module, "nrv_direct_dist",
                    "NRV direct distribution is required.",
                    recommended_action="Set nrv_direct_dist.",
                ))
            else:
                report.extend(validate_distribution_def(
                    dist, module=module, field_prefix="nrv_direct_dist",
                    variable_kind="positive_resource",
                ))
            mult_dist = getattr(sim_input, "nrv_direct_multiplier_dist", None)
            if mult_dist is not None:
                report.extend(validate_distribution_def(
                    mult_dist,
                    module=module,
                    field_prefix="nrv_direct_multiplier_dist",
                    variable_kind="positive_resource",
                ))
        elif nrv_mode == "petrel_marginals":
            from .petrel_grv import petrel_marginals_from_dict, build_grv_matrix_3x3

            raw_pm = getattr(sim_input, "petrel_grv_marginals", None)
            pm = (
                raw_pm
                if raw_pm is not None and hasattr(raw_pm, "depth_grv")
                else petrel_marginals_from_dict(raw_pm if isinstance(raw_pm, dict) else None)
            )
            if pm is None:
                report.add_issue(_err(
                    "REQUIRED_PETREL_MARGINALS",
                    module,
                    "petrel_grv_marginals",
                    "petrel_grv_marginals is required for Petrel GRV preview.",
                    recommended_action="Enter Petrel GRV cases on Rock volume.",
                ))
            else:
                try:
                    build_grv_matrix_3x3(pm)
                except ValueError as exc:
                    report.add_issue(_err(
                        "PETREL_MARGINALS_INVALID",
                        module,
                        "petrel_grv_marginals",
                        str(exc),
                    ))
            ntg = getattr(sim_input, "net_to_gross_dist", None)
            if ntg is None:
                report.add_issue(_err(
                    "REQUIRED_DIST_MISSING", module, "net_to_gross_dist",
                    "net_to_gross_dist is required for NRV preview.",
                ))
            else:
                report.extend(validate_distribution_def(
                    ntg, module=module, field_prefix="net_to_gross_dist", variable_kind="fraction",
                ))
        else:
            for attr, vkind in [
                ("grv_dist", "positive_resource"),
                ("grv_percent_fill_dist", "fraction"),
                ("net_to_gross_dist", "fraction"),
            ]:
                dist = getattr(sim_input, attr, None)
                if dist is None:
                    report.add_issue(_err(
                        "REQUIRED_DIST_MISSING", module, attr,
                        f"'{attr}' is required for NRV preview.",
                        recommended_action=f"Set {attr}.",
                    ))
                else:
                    report.extend(validate_distribution_def(
                        dist, module=module, field_prefix=attr, variable_kind=vkind,
                    ))
                    labels = {
                        "grv_percent_fill_dist": "Percent trap fill",
                        "net_to_gross_dist": "Net/Gross (NTG)",
                    }
                    if attr in labels:
                        _warn_if_fixed_nrv_input(
                            dist, attr, labels[attr], module, report,
                        )

    return report
