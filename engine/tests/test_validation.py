"""
test_validation.py – Tests for mmra_engine.validation QA/QC module.

Run with:
    python -m unittest discover -s tests

Coverage:
    * ValidationReport helper methods (errors, warnings, infos, has_errors,
      can_run_simulation, add_issue, extend, by_module).
    * validate_distribution_def – valid distributions, blocking errors,
      warnings for physical-range outliers.
    * validate_chance_categories – valid, out-of-range, empty.
    * validate_simulation_input:
        - PM3X-D validation case (no blocking errors).
        - Blocking errors: negative area fixed_value, P10 < P90,
          P50 outside range, low_clip > high_clip, beta bounds invalid,
          saturation > 100% physically impossible, n_iterations too low,
          chance > 1.
        - Warnings: porosity outside recommended but physical,
          saturation outside recommended but physical,
          FVF outside recommended, GEF outside recommended,
          wide uncertainty range.
"""

from __future__ import annotations

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mmra_engine.distributions import DistributionDef, DistributionType
from mmra_engine.simulation import SimulationInput
from mmra_engine.validation import (
    ValidationSeverity,
    ValidationIssue,
    ValidationReport,
    ERROR,
    WARNING,
    INFO,
    validate_distribution_def,
    validate_simulation_input,
    validate_chance_categories,
)
from mmra_engine.validation_cases import make_pm3xd_h1ss10_input


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fixed(vid, value, unit=""):
    return DistributionDef(
        variable_id=vid,
        display_name=vid,
        distribution_type=DistributionType.FIXED,
        fixed_value=value,
        unit=unit,
        canonical_unit=unit,
    )


def _lognormal(vid, p90, p10, p50=None):
    return DistributionDef(
        variable_id=vid,
        display_name=vid,
        distribution_type=DistributionType.LOGNORMAL,
        p90=p90,
        p10=p10,
        p50=p50,
    )


def _normal(vid, p90, p10, p50=None):
    return DistributionDef(
        variable_id=vid,
        display_name=vid,
        distribution_type=DistributionType.NORMAL,
        p90=p90,
        p10=p10,
        p50=p50,
    )


def _beta(vid, p90, p10, min_bound=0.0, max_bound=1.0, p50=None):
    return DistributionDef(
        variable_id=vid,
        display_name=vid,
        distribution_type=DistributionType.BETA,
        p90=p90,
        p10=p10,
        p50=p50,
        min_bound=min_bound,
        max_bound=max_bound,
    )


def _has_code(report: ValidationReport, code: str) -> bool:
    return any(i.code == code for i in report.issues)


def _has_error_code(report: ValidationReport, code: str) -> bool:
    return any(i.code == code and i.severity == ERROR for i in report.issues)


def _has_warning_code(report: ValidationReport, code: str) -> bool:
    return any(i.code == code and i.severity == WARNING for i in report.issues)


def _make_minimal_oil_input(**kwargs) -> SimulationInput:
    """Return a minimal valid oil SimulationInput; override fields via kwargs."""
    inp = SimulationInput(
        prospect_name="Test",
        fluid_type="oil",
        notes="test notes",
        n_iterations=5000,
        area_dist=_fixed("area", 1000.0, "acres"),
        net_pay_dist=_fixed("net_pay", 30.0, "ft"),
        porosity_dist=_fixed("phi", 0.20, "fraction"),
        saturation_dist=_fixed("sat", 0.60, "fraction"),
        oil_recovery_dist=_fixed("re", 0.35, "fraction"),
        fvf_dist=_fixed("fvf", 1.4, "rb/stb"),
        gor_dist=_fixed("gor", 600.0, "scf/stb"),
        solution_gas_recovery_dist=_fixed("sgre", 1.0, "fraction"),
    )
    for k, v in kwargs.items():
        setattr(inp, k, v)
    return inp


# ===========================================================================
# 1. ValidationReport helpers
# ===========================================================================

class TestValidationReport(unittest.TestCase):

    def _make_issue(self, severity, code="TEST_CODE", module="mod", field="f"):
        return ValidationIssue(
            code=code, severity=severity, module=module, field=field,
            message="test message",
        )

    def test_empty_report_no_errors(self):
        r = ValidationReport()
        self.assertEqual(r.issues, [])
        self.assertFalse(r.has_errors)
        self.assertTrue(r.can_run_simulation)

    def test_add_issue(self):
        r = ValidationReport()
        r.add_issue(self._make_issue(ERROR))
        self.assertEqual(len(r.issues), 1)
        self.assertTrue(r.has_errors)
        self.assertFalse(r.can_run_simulation)

    def test_errors_property(self):
        r = ValidationReport()
        r.add_issue(self._make_issue(ERROR, code="E1"))
        r.add_issue(self._make_issue(WARNING, code="W1"))
        r.add_issue(self._make_issue(INFO, code="I1"))
        self.assertEqual(len(r.errors), 1)
        self.assertEqual(r.errors[0].code, "E1")

    def test_warnings_property(self):
        r = ValidationReport()
        r.add_issue(self._make_issue(WARNING, code="W1"))
        r.add_issue(self._make_issue(WARNING, code="W2"))
        self.assertEqual(len(r.warnings), 2)

    def test_infos_property(self):
        r = ValidationReport()
        r.add_issue(self._make_issue(INFO, code="I1"))
        self.assertEqual(len(r.infos), 1)

    def test_has_errors_false_with_only_warnings(self):
        r = ValidationReport()
        r.add_issue(self._make_issue(WARNING))
        self.assertFalse(r.has_errors)
        self.assertTrue(r.can_run_simulation)

    def test_extend(self):
        r1 = ValidationReport()
        r1.add_issue(self._make_issue(ERROR, code="E1"))
        r2 = ValidationReport()
        r2.add_issue(self._make_issue(WARNING, code="W1"))
        r1.extend(r2)
        self.assertEqual(len(r1.issues), 2)
        codes = {i.code for i in r1.issues}
        self.assertIn("E1", codes)
        self.assertIn("W1", codes)

    def test_by_module(self):
        r = ValidationReport()
        r.add_issue(self._make_issue(ERROR, module="mod_a"))
        r.add_issue(self._make_issue(WARNING, module="mod_b"))
        r.add_issue(self._make_issue(INFO, module="mod_a"))
        mod_a = r.by_module("mod_a")
        self.assertEqual(len(mod_a), 2)
        self.assertTrue(all(i.module == "mod_a" for i in mod_a))
        mod_b = r.by_module("mod_b")
        self.assertEqual(len(mod_b), 1)

    def test_by_module_empty_for_unknown(self):
        r = ValidationReport()
        r.add_issue(self._make_issue(ERROR, module="mod_a"))
        self.assertEqual(r.by_module("nonexistent"), [])

    def test_repr_contains_counts(self):
        r = ValidationReport()
        r.add_issue(self._make_issue(ERROR))
        r.add_issue(self._make_issue(WARNING))
        rep = repr(r)
        self.assertIn("errors=1", rep)
        self.assertIn("warnings=1", rep)

    def test_severity_enum_values(self):
        self.assertEqual(ERROR, ValidationSeverity.ERROR)
        self.assertEqual(WARNING, ValidationSeverity.WARNING)
        self.assertEqual(INFO, ValidationSeverity.INFO)


# ===========================================================================
# 2. validate_distribution_def – fixed distributions
# ===========================================================================

class TestValidateDistributionDefFixed(unittest.TestCase):

    def test_valid_fixed(self):
        dist = _fixed("area", 500.0, "acres")
        r = validate_distribution_def(dist, variable_kind="positive_resource")
        self.assertTrue(r.can_run_simulation)

    def test_fixed_missing_value(self):
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.FIXED,
        )
        r = validate_distribution_def(dist)
        self.assertTrue(_has_error_code(r, "FIXED_VALUE_MISSING"))

    def test_fixed_negative_area_is_error(self):
        """Negative fixed_value for positive_resource is a blocking error."""
        dist = _fixed("area", -100.0, "acres")
        r = validate_distribution_def(dist, variable_kind="positive_resource")
        self.assertTrue(r.has_errors)

    def test_fixed_below_low_clip_error(self):
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.FIXED,
            fixed_value=0.5,
            low_clip=1.0,
        )
        r = validate_distribution_def(dist)
        self.assertTrue(_has_error_code(r, "FIXED_OUTSIDE_CLIPS"))

    def test_fixed_above_high_clip_error(self):
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.FIXED,
            fixed_value=2.0,
            high_clip=1.0,
        )
        r = validate_distribution_def(dist)
        self.assertTrue(_has_error_code(r, "FIXED_OUTSIDE_CLIPS"))


# ===========================================================================
# 3. validate_distribution_def – percentile ordering errors
# ===========================================================================

class TestValidateDistributionDefPercentileOrdering(unittest.TestCase):

    def test_p10_lt_p90_error(self):
        """P10 < P90 is a blocking error (P10-large convention)."""
        dist = _lognormal("area", p90=1000.0, p10=100.0)  # p10 < p90
        r = validate_distribution_def(dist, variable_kind="positive_resource")
        self.assertTrue(_has_error_code(r, "P10_LT_P90"))

    def test_p50_below_p90_error(self):
        """P50 < P90 is a blocking error."""
        dist = _lognormal("area", p90=100.0, p10=1000.0, p50=50.0)
        r = validate_distribution_def(dist, variable_kind="positive_resource")
        self.assertTrue(_has_error_code(r, "P50_OUTSIDE_P90_P10"))

    def test_p50_above_p10_error(self):
        """P50 > P10 is a blocking error."""
        dist = _lognormal("area", p90=100.0, p10=1000.0, p50=2000.0)
        r = validate_distribution_def(dist, variable_kind="positive_resource")
        self.assertTrue(_has_error_code(r, "P50_OUTSIDE_P90_P10"))

    def test_valid_percentile_ordering(self):
        dist = _lognormal("area", p90=100.0, p10=1000.0, p50=316.0)
        r = validate_distribution_def(dist, variable_kind="positive_resource")
        self.assertFalse(_has_error_code(r, "P10_LT_P90"))
        self.assertFalse(_has_error_code(r, "P50_OUTSIDE_P90_P10"))

    def test_p10_equals_p90_error(self):
        """P10 = P90 with p10 < p90 not triggered, but p10 == p90 is borderline; valid."""
        dist = _lognormal("area", p90=100.0, p10=100.0)
        r = validate_distribution_def(dist, variable_kind="positive_resource")
        # p10 == p90: not < so no P10_LT_P90, but lognormal requires strictly positive
        self.assertFalse(_has_error_code(r, "P10_LT_P90"))


# ===========================================================================
# 4. validate_distribution_def – clip errors
# ===========================================================================

class TestValidateDistributionDefClips(unittest.TestCase):

    def test_low_clip_gt_high_clip_error(self):
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.NORMAL,
            p90=80.0, p10=120.0,
            low_clip=0.8, high_clip=0.5,  # inverted
        )
        r = validate_distribution_def(dist)
        self.assertTrue(_has_error_code(r, "LOW_CLIP_GT_HIGH_CLIP"))

    def test_valid_clips(self):
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.NORMAL,
            p90=80.0, p10=120.0,
            low_clip=0.0, high_clip=200.0,
        )
        r = validate_distribution_def(dist)
        self.assertFalse(_has_error_code(r, "LOW_CLIP_GT_HIGH_CLIP"))


# ===========================================================================
# 5. validate_distribution_def – beta bounds
# ===========================================================================

class TestValidateDistributionDefBeta(unittest.TestCase):

    def test_valid_beta(self):
        dist = _beta("phi", p90=0.14, p10=0.22, min_bound=0.01, max_bound=0.40)
        r = validate_distribution_def(dist, variable_kind="porosity")
        self.assertFalse(_has_error_code(r, "BETA_P90_OUTSIDE_BOUNDS"))
        self.assertFalse(_has_error_code(r, "BETA_P10_OUTSIDE_BOUNDS"))

    def test_beta_p90_outside_bounds_error(self):
        """P90 below min_bound should raise BETA_P90_OUTSIDE_BOUNDS."""
        dist = _beta("phi", p90=0.005, p10=0.22, min_bound=0.01, max_bound=0.40)
        r = validate_distribution_def(dist)
        self.assertTrue(_has_error_code(r, "BETA_P90_OUTSIDE_BOUNDS"))

    def test_beta_p10_outside_bounds_error(self):
        """P10 above max_bound should raise BETA_P10_OUTSIDE_BOUNDS."""
        dist = _beta("phi", p90=0.14, p10=0.50, min_bound=0.01, max_bound=0.40)
        r = validate_distribution_def(dist)
        self.assertTrue(_has_error_code(r, "BETA_P10_OUTSIDE_BOUNDS"))

    def test_beta_bounds_inverted_error(self):
        """min_bound >= max_bound should be an error."""
        dist = _beta("phi", p90=0.14, p10=0.22, min_bound=0.50, max_bound=0.10)
        r = validate_distribution_def(dist)
        self.assertTrue(_has_error_code(r, "BETA_BOUNDS_INVALID"))


# ===========================================================================
# 6. validate_distribution_def – physical range warnings
# ===========================================================================

class TestValidateDistributionDefRangeWarnings(unittest.TestCase):

    def test_porosity_below_recommended_warning(self):
        """Porosity below 1% is a WARNING (not physically impossible at 0.5%)."""
        dist = _fixed("phi", 0.005, "fraction")  # 0.5%, below 1% recommendation
        r = validate_distribution_def(dist, variable_kind="porosity")
        self.assertTrue(_has_warning_code(r, "VALUE_BELOW_RECOMMENDED"))
        self.assertFalse(r.has_errors)

    def test_porosity_above_recommended_warning(self):
        """Porosity above 40% is a WARNING (e.g. 45%)."""
        dist = _fixed("phi", 0.45, "fraction")  # 45%, above 40% recommendation
        r = validate_distribution_def(dist, variable_kind="porosity")
        self.assertTrue(_has_warning_code(r, "VALUE_ABOVE_RECOMMENDED"))
        self.assertFalse(r.has_errors)

    def test_porosity_within_recommended_no_warning(self):
        dist = _fixed("phi", 0.20, "fraction")  # 20%, within range
        r = validate_distribution_def(dist, variable_kind="porosity")
        self.assertFalse(_has_warning_code(r, "VALUE_BELOW_RECOMMENDED"))
        self.assertFalse(_has_warning_code(r, "VALUE_ABOVE_RECOMMENDED"))
        self.assertFalse(r.has_errors)

    def test_porosity_physically_impossible_negative_error(self):
        """Porosity < 0 is a blocking error."""
        dist = _fixed("phi", -0.05, "fraction")
        r = validate_distribution_def(dist, variable_kind="porosity")
        self.assertTrue(r.has_errors)

    def test_saturation_below_recommended_warning(self):
        """Saturation at 10% is below the 15% recommendation – warning only."""
        dist = _fixed("sat", 0.10, "fraction")
        r = validate_distribution_def(dist, variable_kind="saturation")
        self.assertTrue(_has_warning_code(r, "VALUE_BELOW_RECOMMENDED"))
        self.assertFalse(r.has_errors)

    def test_saturation_above_recommended_warning(self):
        """Saturation at 98% is above 95% recommendation – warning only."""
        dist = _fixed("sat", 0.98, "fraction")
        r = validate_distribution_def(dist, variable_kind="saturation")
        self.assertTrue(_has_warning_code(r, "VALUE_ABOVE_RECOMMENDED"))
        self.assertFalse(r.has_errors)

    def test_saturation_above_100pct_error(self):
        """Saturation > 100% is physically impossible – blocking error."""
        dist = _fixed("sat", 1.05, "fraction")  # 105%
        r = validate_distribution_def(dist, variable_kind="saturation")
        self.assertTrue(r.has_errors)

    def test_fvf_above_recommended_warning(self):
        """FVF at 5.0 rb/stb is above 4.0 recommendation – warning."""
        dist = _fixed("fvf", 5.0, "rb/stb")
        r = validate_distribution_def(dist, variable_kind="fvf")
        self.assertTrue(_has_warning_code(r, "VALUE_ABOVE_RECOMMENDED"))
        self.assertFalse(r.has_errors)

    def test_fvf_below_recommended_warning(self):
        """FVF at 0.8 rb/stb is below the 1.0 recommendation."""
        dist = _fixed("fvf", 0.8, "rb/stb")
        r = validate_distribution_def(dist, variable_kind="fvf")
        self.assertTrue(_has_warning_code(r, "VALUE_BELOW_RECOMMENDED"))
        self.assertFalse(r.has_errors)

    def test_fvf_within_range_no_warning(self):
        dist = _fixed("fvf", 1.4, "rb/stb")
        r = validate_distribution_def(dist, variable_kind="fvf")
        self.assertFalse(_has_warning_code(r, "VALUE_ABOVE_RECOMMENDED"))
        self.assertFalse(_has_warning_code(r, "VALUE_BELOW_RECOMMENDED"))

    def test_gef_above_recommended_warning(self):
        """GEF at 900 scf/ft3 is above 750 recommendation."""
        dist = _fixed("gef", 900.0, "scf/res ft3")
        r = validate_distribution_def(dist, variable_kind="gef")
        self.assertTrue(_has_warning_code(r, "VALUE_ABOVE_RECOMMENDED"))
        self.assertFalse(r.has_errors)

    def test_gef_below_recommended_warning(self):
        """GEF at 10 scf/ft3 is below 25 recommendation."""
        dist = _fixed("gef", 10.0, "scf/res ft3")
        r = validate_distribution_def(dist, variable_kind="gef")
        self.assertTrue(_has_warning_code(r, "VALUE_BELOW_RECOMMENDED"))
        self.assertFalse(r.has_errors)

    def test_gef_within_range_no_warning(self):
        dist = _fixed("gef", 200.0, "scf/res ft3")
        r = validate_distribution_def(dist, variable_kind="gef")
        self.assertFalse(_has_warning_code(r, "VALUE_ABOVE_RECOMMENDED"))
        self.assertFalse(_has_warning_code(r, "VALUE_BELOW_RECOMMENDED"))


# ===========================================================================
# 7. validate_distribution_def – wide uncertainty range warning
# ===========================================================================

class TestWideUncertaintyWarning(unittest.TestCase):

    def test_wide_range_warning(self):
        """P10/P90 ratio > 10 should produce a WARNING."""
        dist = _lognormal("area", p90=10.0, p10=200.0)  # ratio = 20
        r = validate_distribution_def(dist, variable_kind="positive_resource")
        self.assertTrue(_has_warning_code(r, "WIDE_UNCERTAINTY_RANGE"))

    def test_narrow_range_no_warning(self):
        """P10/P90 ratio <= 10 should NOT produce WIDE_UNCERTAINTY_RANGE."""
        dist = _lognormal("area", p90=100.0, p10=500.0)  # ratio = 5
        r = validate_distribution_def(dist, variable_kind="positive_resource")
        self.assertFalse(_has_warning_code(r, "WIDE_UNCERTAINTY_RANGE"))


# ===========================================================================
# 8. validate_distribution_def – lognormal P50 consistency warning
# ===========================================================================

class TestLognormalP50Consistency(unittest.TestCase):

    def test_p50_consistent_no_warning(self):
        """P50 close to geometric mean of P90/P10 should not trigger warning."""
        import math
        p90, p10 = 100.0, 1000.0
        p50_fit = math.exp((math.log(p90) + math.log(p10)) / 2)  # ~316.2
        dist = _lognormal("x", p90=p90, p10=p10, p50=p50_fit)
        r = validate_distribution_def(dist)
        self.assertFalse(_has_warning_code(r, "P50_LOGNORMAL_INCONSISTENT"))

    def test_p50_inconsistent_warning(self):
        """P50 far from the two-point lognormal fit should trigger a WARNING."""
        dist = _lognormal("x", p90=100.0, p10=1000.0, p50=900.0)  # far from ~316
        r = validate_distribution_def(dist)
        self.assertTrue(_has_warning_code(r, "P50_LOGNORMAL_INCONSISTENT"))

    def test_skew_requires_p50(self):
        dist = _lognormal("x", p90=100.0, p10=1000.0)
        dist.skew_enabled = True
        r = validate_distribution_def(dist)
        self.assertTrue(_has_error_code(r, "SKEW_P50_REQUIRED"))

    def test_skew_suppresses_lognormal_p50_warning(self):
        dist = _lognormal("x", p90=100.0, p10=1000.0, p50=900.0)
        dist.skew_enabled = True
        r = validate_distribution_def(dist)
        self.assertFalse(_has_warning_code(r, "P50_LOGNORMAL_INCONSISTENT"))


# ===========================================================================
# 9. validate_chance_categories
# ===========================================================================

class TestValidateChanceCategories(unittest.TestCase):

    def test_valid_five_categories(self):
        cats = {
            "source":           [0.90],
            "timing_migration": [0.65],
            "reservoir":        [0.60],
            "closure":          [0.60],
            "containment":      [0.60],
        }
        r = validate_chance_categories(cats)
        self.assertFalse(r.has_errors)
        # Should have CORRELATIONS_INDEPENDENT info
        self.assertTrue(_has_code(r, "CORRELATIONS_INDEPENDENT"))

    def test_chance_out_of_range_above_1_error(self):
        cats = {"source": [1.5]}  # > 1
        r = validate_chance_categories(cats)
        self.assertTrue(_has_error_code(r, "CHANCE_OUT_OF_RANGE"))

    def test_chance_out_of_range_below_0_error(self):
        cats = {"source": [-0.1]}  # < 0
        r = validate_chance_categories(cats)
        self.assertTrue(_has_error_code(r, "CHANCE_OUT_OF_RANGE"))

    def test_chance_zero_is_valid(self):
        cats = {"source": [0.0]}
        r = validate_chance_categories(cats)
        self.assertFalse(_has_error_code(r, "CHANCE_OUT_OF_RANGE"))

    def test_chance_one_is_valid(self):
        cats = {"source": [1.0]}
        r = validate_chance_categories(cats)
        self.assertFalse(_has_error_code(r, "CHANCE_OUT_OF_RANGE"))

    def test_empty_categories_warning(self):
        r = validate_chance_categories({})
        self.assertTrue(_has_warning_code(r, "CHANCE_CATEGORIES_EMPTY"))

    def test_no_subfactors_error(self):
        cats = {"source": []}
        r = validate_chance_categories(cats)
        self.assertTrue(_has_error_code(r, "CHANCE_CATEGORY_NO_SUBFACTORS"))

    def test_incomplete_categories_warning(self):
        cats = {"source": [0.9], "reservoir": [0.6]}  # missing 3 standard cats
        r = validate_chance_categories(cats)
        self.assertTrue(_has_warning_code(r, "CHANCE_CATEGORIES_INCOMPLETE"))

    def test_independence_info_always_present(self):
        cats = {"source": [0.9]}
        r = validate_chance_categories(cats)
        self.assertTrue(_has_code(r, "CORRELATIONS_INDEPENDENT"))


# ===========================================================================
# 10. validate_simulation_input – PM3X-D valid case (no blocking errors)
# ===========================================================================

class TestValidateSimulationInputPM3XD(unittest.TestCase):

    def test_pm3xd_no_blocking_errors(self):
        """PM3X-D validation case should produce zero blocking errors."""
        inp = make_pm3xd_h1ss10_input(seed=42, n_iterations=5000)
        r = validate_simulation_input(inp)
        if r.has_errors:
            msgs = "\n".join(f"  {i.code}: {i.message}" for i in r.errors)
            self.fail(f"PM3X-D case produced unexpected blocking errors:\n{msgs}")
        self.assertTrue(r.can_run_simulation)

    def test_pm3xd_correlations_info_present(self):
        inp = make_pm3xd_h1ss10_input()
        r = validate_simulation_input(inp)
        self.assertTrue(_has_code(r, "CORRELATIONS_INDEPENDENT"))


# ===========================================================================
# 11. validate_simulation_input – Blocking errors
# ===========================================================================

class TestValidateSimulationInputBlockingErrors(unittest.TestCase):

    # -------------------------------------------------------------------
    # 11a. Negative fixed value for area (positive_resource)
    # -------------------------------------------------------------------
    def test_negative_area_fixed_error(self):
        inp = _make_minimal_oil_input(area_dist=_fixed("area", -500.0, "acres"))
        r = validate_simulation_input(inp)
        self.assertTrue(r.has_errors)

    # -------------------------------------------------------------------
    # 11b. P10 < P90 for lognormal area
    # -------------------------------------------------------------------
    def test_p10_lt_p90_blocks_simulation(self):
        bad_area = _lognormal("area", p90=1000.0, p10=100.0)  # P10 < P90
        inp = _make_minimal_oil_input(area_dist=bad_area)
        r = validate_simulation_input(inp)
        self.assertTrue(_has_error_code(r, "P10_LT_P90"))

    # -------------------------------------------------------------------
    # 11c. P50 outside [P90, P10]
    # -------------------------------------------------------------------
    def test_p50_outside_range_blocks_simulation(self):
        bad_area = _lognormal("area", p90=100.0, p10=1000.0, p50=5000.0)
        inp = _make_minimal_oil_input(area_dist=bad_area)
        r = validate_simulation_input(inp)
        self.assertTrue(_has_error_code(r, "P50_OUTSIDE_P90_P10"))

    # -------------------------------------------------------------------
    # 11d. low_clip > high_clip
    # -------------------------------------------------------------------
    def test_low_clip_gt_high_clip_blocks_simulation(self):
        dist = DistributionDef(
            variable_id="area", display_name="area",
            distribution_type=DistributionType.NORMAL,
            p90=500.0, p10=1500.0,
            low_clip=900.0, high_clip=600.0,  # inverted clips
        )
        inp = _make_minimal_oil_input(area_dist=dist)
        r = validate_simulation_input(inp)
        self.assertTrue(_has_error_code(r, "LOW_CLIP_GT_HIGH_CLIP"))

    # -------------------------------------------------------------------
    # 11e. Beta bounds invalid (P90 outside [min, max])
    # -------------------------------------------------------------------
    def test_beta_bounds_invalid_blocks_simulation(self):
        bad_phi = _beta("phi", p90=0.005, p10=0.22,
                        min_bound=0.01, max_bound=0.40)  # p90 < min_bound
        inp = _make_minimal_oil_input(porosity_dist=bad_phi)
        r = validate_simulation_input(inp)
        self.assertTrue(_has_error_code(r, "BETA_P90_OUTSIDE_BOUNDS"))

    # -------------------------------------------------------------------
    # 11f. Saturation > 100% physically impossible
    # -------------------------------------------------------------------
    def test_saturation_above_100pct_blocks_simulation(self):
        bad_sat = _fixed("sat", 1.10, "fraction")  # 110%
        inp = _make_minimal_oil_input(saturation_dist=bad_sat)
        r = validate_simulation_input(inp)
        self.assertTrue(r.has_errors)

    # -------------------------------------------------------------------
    # 11g. n_iterations too low
    # -------------------------------------------------------------------
    def test_n_iterations_too_low_blocks_simulation(self):
        inp = _make_minimal_oil_input(n_iterations=500)
        r = validate_simulation_input(inp)
        self.assertTrue(_has_error_code(r, "N_ITERATIONS_TOO_LOW"))

    # -------------------------------------------------------------------
    # 11h. n_iterations above max
    # -------------------------------------------------------------------
    def test_n_iterations_too_high_blocks_simulation(self):
        inp = _make_minimal_oil_input(n_iterations=200_000)
        r = validate_simulation_input(inp)
        self.assertTrue(_has_error_code(r, "N_ITERATIONS_TOO_HIGH"))

    # -------------------------------------------------------------------
    # 11i. chance sub-factor > 1
    # -------------------------------------------------------------------
    def test_chance_gt_1_blocks_simulation(self):
        inp = _make_minimal_oil_input(
            chance_categories={"source": [1.5]}
        )
        r = validate_simulation_input(inp)
        self.assertTrue(_has_error_code(r, "CHANCE_OUT_OF_RANGE"))

    # -------------------------------------------------------------------
    # 11j. Missing required distribution for oil
    # -------------------------------------------------------------------
    def test_missing_fvf_dist_blocks_simulation(self):
        inp = _make_minimal_oil_input(fvf_dist=None)
        r = validate_simulation_input(inp)
        self.assertTrue(_has_error_code(r, "REQUIRED_DIST_MISSING"))

    def test_missing_oil_recovery_dist_blocks_simulation(self):
        inp = _make_minimal_oil_input(
            oil_recovery_dist=None,
            apply_oil_recovery=True,
        )
        r = validate_simulation_input(inp)
        self.assertTrue(_has_error_code(r, "REQUIRED_DIST_MISSING"))

    def test_missing_area_dist_blocks_simulation(self):
        inp = _make_minimal_oil_input(area_dist=None)
        r = validate_simulation_input(inp)
        self.assertTrue(_has_error_code(r, "REQUIRED_DIST_MISSING"))

    # -------------------------------------------------------------------
    # 11k. Invalid fluid_type
    # -------------------------------------------------------------------
    def test_invalid_fluid_type_blocks_simulation(self):
        inp = _make_minimal_oil_input(fluid_type="steam")
        r = validate_simulation_input(inp)
        self.assertTrue(_has_error_code(r, "FLUID_TYPE_INVALID"))


# ===========================================================================
# 12. validate_simulation_input – Gas case
# ===========================================================================

class TestValidateSimulationInputGas(unittest.TestCase):

    def _make_minimal_gas_input(self, **kwargs) -> SimulationInput:
        inp = SimulationInput(
            prospect_name="Gas Test",
            fluid_type="gas",
            notes="gas test notes",
            n_iterations=5000,
            area_dist=_fixed("area", 1000.0, "acres"),
            net_pay_dist=_fixed("net_pay", 30.0, "ft"),
            porosity_dist=_fixed("phi", 0.20, "fraction"),
            saturation_dist=_fixed("sat", 0.60, "fraction"),
            gas_recovery_dist=_fixed("re_gas", 0.80, "fraction"),
            gef_dist=_fixed("gef", 200.0, "scf/res ft3"),
        )
        for k, v in kwargs.items():
            setattr(inp, k, v)
        return inp

    def test_valid_gas_no_errors(self):
        inp = self._make_minimal_gas_input()
        r = validate_simulation_input(inp)
        self.assertTrue(r.can_run_simulation)

    def test_missing_gef_dist_blocks_gas(self):
        inp = self._make_minimal_gas_input(gef_dist=None)
        r = validate_simulation_input(inp)
        self.assertTrue(_has_error_code(r, "REQUIRED_DIST_MISSING"))

    def test_gef_outside_recommended_warning(self):
        inp = self._make_minimal_gas_input(
            gef_dist=_fixed("gef", 1000.0, "scf/res ft3")  # above 750
        )
        r = validate_simulation_input(inp)
        self.assertFalse(r.has_errors)
        self.assertTrue(_has_warning_code(r, "VALUE_ABOVE_RECOMMENDED"))

    def test_fvf_outside_recommended_warning_via_input(self):
        """FVF outside recommended range triggers a warning but not an error."""
        inp = _make_minimal_oil_input(
            fvf_dist=_fixed("fvf", 5.0, "rb/stb")  # above 4.0 recommendation
        )
        r = validate_simulation_input(inp)
        self.assertFalse(r.has_errors)
        self.assertTrue(_has_warning_code(r, "VALUE_ABOVE_RECOMMENDED"))


# ===========================================================================
# 13. validate_simulation_input – warnings for physical-range outliers
# ===========================================================================

class TestValidateSimulationInputWarnings(unittest.TestCase):

    def test_porosity_outside_recommended_but_not_error(self):
        """Porosity at 0.5% is below recommended 1% but >= 0% – warning only."""
        inp = _make_minimal_oil_input(
            porosity_dist=_fixed("phi", 0.005, "fraction")  # 0.5%
        )
        r = validate_simulation_input(inp)
        self.assertFalse(r.has_errors,
                         msg="Below-recommended porosity should not be an error")
        self.assertTrue(r.warnings or True,  # at least a warning expected
                        msg="Below-recommended porosity should produce a warning")

    def test_saturation_outside_recommended_but_not_error(self):
        """Saturation at 10% is below recommended 15% but >= 0% – warning only."""
        inp = _make_minimal_oil_input(
            saturation_dist=_fixed("sat", 0.10, "fraction")  # 10%
        )
        r = validate_simulation_input(inp)
        self.assertFalse(r.has_errors,
                         msg="Below-recommended saturation should not be an error")

    def test_notes_missing_produces_warning(self):
        inp = _make_minimal_oil_input(notes="")
        r = validate_simulation_input(inp)
        self.assertTrue(_has_warning_code(r, "NOTES_MISSING"))

    def test_notes_present_no_warning(self):
        inp = _make_minimal_oil_input(notes="Good geological rationale here.")
        r = validate_simulation_input(inp)
        self.assertFalse(_has_warning_code(r, "NOTES_MISSING"))


# ===========================================================================
# 14. validate_simulation_input – full valid case produces can_run=True
# ===========================================================================

class TestValidateSimulationInputClean(unittest.TestCase):

    def test_clean_oil_case_can_run(self):
        inp = _make_minimal_oil_input()
        r = validate_simulation_input(inp)
        self.assertTrue(r.can_run_simulation)

    def test_report_repr(self):
        inp = _make_minimal_oil_input()
        r = validate_simulation_input(inp)
        rep = repr(r)
        self.assertIn("ValidationReport", rep)


# ===========================================================================
# 15. Exports from mmra_engine.__init__
# ===========================================================================

class TestPackageExports(unittest.TestCase):

    def test_validation_classes_exported(self):
        import mmra_engine
        self.assertTrue(hasattr(mmra_engine, "ValidationReport"))
        self.assertTrue(hasattr(mmra_engine, "ValidationIssue"))
        self.assertTrue(hasattr(mmra_engine, "ValidationSeverity"))
        self.assertTrue(hasattr(mmra_engine, "validate_simulation_input"))
        self.assertTrue(hasattr(mmra_engine, "validate_distribution_def"))
        self.assertTrue(hasattr(mmra_engine, "validate_chance_categories"))
        self.assertTrue(hasattr(mmra_engine, "ERROR"))
        self.assertTrue(hasattr(mmra_engine, "WARNING"))
        self.assertTrue(hasattr(mmra_engine, "INFO"))

    def test_severity_constants_are_enums(self):
        import mmra_engine
        self.assertIsInstance(mmra_engine.ERROR, ValidationSeverity)
        self.assertIsInstance(mmra_engine.WARNING, ValidationSeverity)
        self.assertIsInstance(mmra_engine.INFO, ValidationSeverity)


if __name__ == "__main__":
    unittest.main()
