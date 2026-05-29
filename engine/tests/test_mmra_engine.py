"""
test_mmra_engine.py – Unit and integration tests for the MMRA calculation engine.

Run with:
    python -m unittest discover -s tests

Coverage:
    Unit tests:
        - Unit conversion constants
        - convert_units() helper
        - Percent-to-fraction conversion
        - apply_clips()
        - Percentile extraction on known arrays
        - Trimmed mean calculation
        - Volumetric formulas: oil, gas, solution gas, condensate, MMBOE
        - Pg / category chance calculations
        - Distribution parameter validation (beta fit sanity check)
        - Normal and lognormal parameterization

    Integration tests:
        - Oil formula deterministic full run (Validation Case 2)
        - Gas formula deterministic full run (Validation Case 3)
        - PM3X-D input loading and Pg calculation (Validation Case 1)
        - Simulation reproducibility with fixed seed
        - Output summary generation
        - Percentile convention ordering (P99 < P90 < P50 < P10 < P01)
"""

import math
import sys
import os
import unittest

import numpy as np

# Ensure the workspace is on the path so mmra_engine can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mmra_engine.constants import (
    KM2_TO_ACRES,
    METRES_TO_FEET,
    ACFT_TO_RESERVOIR_FT3,
    BBL_PER_ACFT,
    BBL_TO_MMBBL,
    SCF_TO_BCF,
    BCF_TO_MMSCF,
    DEFAULT_GAS_OIL_RATIO,
    Z90,
)
from mmra_engine.units import convert_units, pct_to_fraction, fraction_to_pct
from mmra_engine.distributions import (
    DistributionDef,
    DistributionType,
    apply_clips,
    fit_beta,
    sample_distribution,
)
from mmra_engine.stats import calculate_percentile_summary, trimmed_mean
from mmra_engine.volumetrics import (
    calculate_condensate,
    calculate_giip,
    calculate_hcpv,
    calculate_mmboe,
    calculate_nrv,
    calculate_productive_area,
    calculate_recoverable_gas,
    calculate_recoverable_oil,
    calculate_solution_gas,
    calculate_stoiip,
)
from mmra_engine.chance import calculate_category_chance, calculate_pg, calculate_pg_risked_mean
from mmra_engine.simulation import run_simulation
from mmra_engine.validation_cases import (
    OIL_FORMULA_EXPECTED,
    GAS_FORMULA_EXPECTED,
    PM3XD_PG_EXPECTED,
    make_oil_formula_case,
    make_gas_formula_case,
    make_pm3xd_h1ss10_input,
)

# ---------------------------------------------------------------------------
# Tolerance constants
# ---------------------------------------------------------------------------

UNIT_CONV_REL_TOL = 1e-9
FORMULA_REL_TOL = 0.0001        # 0.01%
PG_ABS_TOL = 1e-8
PERCENTILE_ABS_TOL = 1e-10


# ---------------------------------------------------------------------------
# Helper assertions
# ---------------------------------------------------------------------------

def assert_rel_close(test_case, actual, expected, rtol, msg=""):
    """Assert |actual - expected| / |expected| <= rtol."""
    if expected == 0.0:
        test_case.assertAlmostEqual(actual, expected, delta=rtol, msg=msg)
    else:
        rel_err = abs(actual - expected) / abs(expected)
        test_case.assertLessEqual(
            rel_err, rtol,
            msg=f"{msg} | actual={actual:.10g}, expected={expected:.10g}, rel_err={rel_err:.2e}"
        )


# ===========================================================================
# 1. Constants
# ===========================================================================

class TestConstants(unittest.TestCase):

    def test_km2_to_acres(self):
        """1 km² should be 247.105381467 acres."""
        self.assertAlmostEqual(KM2_TO_ACRES, 247.105381467, places=9)

    def test_metres_to_feet(self):
        """1 metre should be 3.280839895 feet."""
        self.assertAlmostEqual(METRES_TO_FEET, 3.280839895, places=9)

    def test_acft_to_reservoir_ft3(self):
        """1 acre-ft = 43,560 reservoir ft³."""
        self.assertEqual(ACFT_TO_RESERVOIR_FT3, 43_560.0)

    def test_bbl_per_acft(self):
        """BBL_PER_ACFT should be 7,758.36735."""
        self.assertAlmostEqual(BBL_PER_ACFT, 7_758.36735, places=5)

    def test_bbl_to_mmbbl(self):
        self.assertAlmostEqual(BBL_TO_MMBBL, 1.0e-6, places=12)

    def test_scf_to_bcf(self):
        self.assertAlmostEqual(SCF_TO_BCF, 1.0e-9, places=15)

    def test_bcf_to_mmscf(self):
        self.assertEqual(BCF_TO_MMSCF, 1_000.0)

    def test_default_gas_oil_ratio(self):
        """Default gas-oil ratio must be 6 mcf/bbl."""
        self.assertEqual(DEFAULT_GAS_OIL_RATIO, 6.0)

    def test_z90(self):
        """Z90 must equal scipy.stats.norm.ppf(0.90)."""
        from scipy import stats
        expected = stats.norm.ppf(0.90)
        self.assertAlmostEqual(Z90, expected, places=12)


# ===========================================================================
# 2. Unit conversions
# ===========================================================================

class TestUnitConversions(unittest.TestCase):

    def test_km2_to_acres(self):
        result = convert_units(1.0, "km2", "acres")
        assert_rel_close(self, result, KM2_TO_ACRES, UNIT_CONV_REL_TOL)

    def test_acres_to_km2_roundtrip(self):
        val = 500.0  # acres
        assert_rel_close(self, convert_units(convert_units(val, "acres", "km2"), "km2", "acres"), val, 1e-9)

    def test_metres_to_feet(self):
        result = convert_units(1.0, "m", "ft")
        assert_rel_close(self, result, METRES_TO_FEET, UNIT_CONV_REL_TOL)

    def test_feet_to_metres_roundtrip(self):
        val = 32.808
        assert_rel_close(self, convert_units(convert_units(val, "ft", "m"), "m", "ft"), val, 1e-9)

    def test_pct_to_fraction(self):
        self.assertAlmostEqual(pct_to_fraction(17.8), 0.178, places=12)
        self.assertAlmostEqual(pct_to_fraction(100.0), 1.0, places=12)
        self.assertAlmostEqual(pct_to_fraction(0.0), 0.0, places=12)

    def test_fraction_to_pct(self):
        self.assertAlmostEqual(fraction_to_pct(0.178), 17.8, places=10)

    def test_same_unit_returns_value(self):
        self.assertEqual(convert_units(42.0, "acres", "acres"), 42.0)

    def test_unsupported_raises(self):
        with self.assertRaises(ValueError):
            convert_units(1.0, "bananas", "oranges")

    def test_bbl_to_mmbbl(self):
        result = convert_units(1_000_000.0, "bbl", "mmbbl")
        self.assertAlmostEqual(result, 1.0, places=10)

    def test_scf_to_bcf(self):
        result = convert_units(1_000_000_000.0, "scf", "bcf")
        self.assertAlmostEqual(result, 1.0, places=10)

    def test_bcf_to_mmscf(self):
        result = convert_units(1.0, "bcf", "mmscf")
        self.assertEqual(result, 1_000.0)


# ===========================================================================
# 3. Clips
# ===========================================================================

class TestApplyClips(unittest.TestCase):

    def test_low_clip(self):
        arr = np.array([-1.0, 0.0, 0.5, 1.0])
        clipped = apply_clips(arr, 0.0, None)
        np.testing.assert_array_equal(clipped, [0.0, 0.0, 0.5, 1.0])

    def test_high_clip(self):
        arr = np.array([0.0, 0.5, 1.0, 1.5])
        clipped = apply_clips(arr, None, 1.0)
        np.testing.assert_array_equal(clipped, [0.0, 0.5, 1.0, 1.0])

    def test_both_clips(self):
        arr = np.array([-5.0, 0.0, 0.5, 1.0, 5.0])
        clipped = apply_clips(arr, 0.0, 1.0)
        np.testing.assert_array_equal(clipped, [0.0, 0.0, 0.5, 1.0, 1.0])

    def test_no_clips(self):
        arr = np.array([1.0, 2.0, 3.0])
        clipped = apply_clips(arr, None, None)
        np.testing.assert_array_equal(clipped, arr)


# ===========================================================================
# 4. Percentile extraction
# ===========================================================================

class TestPercentileSummary(unittest.TestCase):

    def setUp(self):
        # Known uniform array 1..100 for exact quantile tests
        self.uniform_100 = np.arange(1.0, 101.0)

    def test_p50_uniform(self):
        """P50 of [1..100] with linear interpolation should be 50.5."""
        result = calculate_percentile_summary(self.uniform_100, "test", "unit")
        self.assertAlmostEqual(result.p50, 50.5, places=10)

    def test_p90_label(self):
        """P90 label = quantile(q=0.10) of [1..100] = 10.9."""
        result = calculate_percentile_summary(self.uniform_100, "test", "unit")
        expected = float(np.quantile(self.uniform_100, 0.10, method="linear"))
        self.assertAlmostEqual(result.p90, expected, places=10)

    def test_p10_label(self):
        """P10 label = quantile(q=0.90) of [1..100] = 90.1."""
        result = calculate_percentile_summary(self.uniform_100, "test", "unit")
        expected = float(np.quantile(self.uniform_100, 0.90, method="linear"))
        self.assertAlmostEqual(result.p10, expected, places=10)

    def test_p99_label(self):
        result = calculate_percentile_summary(self.uniform_100, "test", "unit")
        expected = float(np.quantile(self.uniform_100, 0.01, method="linear"))
        self.assertAlmostEqual(result.p99, expected, places=10)

    def test_p01_label(self):
        result = calculate_percentile_summary(self.uniform_100, "test", "unit")
        expected = float(np.quantile(self.uniform_100, 0.99, method="linear"))
        self.assertAlmostEqual(result.p01, expected, places=10)

    def test_ordering_positive(self):
        """P99 < P90 < P50 < P10 < P01 for a positive distribution."""
        rng = np.random.default_rng(0)
        arr = rng.lognormal(1.0, 0.5, size=10_000)
        result = calculate_percentile_summary(arr, "test", "unit")
        self.assertLess(result.p99, result.p90)
        self.assertLess(result.p90, result.p50)
        self.assertLess(result.p50, result.p10)
        self.assertLess(result.p10, result.p01)

    def test_trimmed_mean_between_p99_p01(self):
        """Trimmed mean must be between P99 and P01 labels."""
        rng = np.random.default_rng(1)
        arr = rng.lognormal(1.0, 0.5, size=10_000)
        result = calculate_percentile_summary(arr, "test", "unit")
        self.assertGreaterEqual(result.mean_trimmed, result.p99)
        self.assertLessEqual(result.mean_trimmed, result.p01)

    def test_fixed_array_exact(self):
        """All quantiles of a constant array should equal the constant."""
        arr = np.full(1000, 5.0)
        result = calculate_percentile_summary(arr, "test", "unit")
        self.assertAlmostEqual(result.p99, 5.0, places=10)
        self.assertAlmostEqual(result.p50, 5.0, places=10)
        self.assertAlmostEqual(result.p01, 5.0, places=10)
        self.assertAlmostEqual(result.mean_trimmed, 5.0, places=10)

    def test_empty_array_raises(self):
        with self.assertRaises(ValueError):
            calculate_percentile_summary(np.array([]), "test", "unit")

    def test_trimmed_mean_function(self):
        arr = np.arange(1.0, 101.0)
        # Should be mean of values between q0.01=1.99 and q0.99=99.01
        tm = trimmed_mean(arr)
        self.assertGreater(tm, 1.0)
        self.assertLess(tm, 100.0)


# ===========================================================================
# 5. Volumetric formulas (deterministic)
# ===========================================================================

class TestVolumetricFormulas(unittest.TestCase):

    def test_productive_area(self):
        """PA = area × percent_fill."""
        self.assertAlmostEqual(calculate_productive_area(1000.0, 1.0), 1000.0)
        self.assertAlmostEqual(calculate_productive_area(1000.0, 0.75), 750.0)

    def test_nrv(self):
        """NRV = PA × NP × GCF."""
        self.assertAlmostEqual(calculate_nrv(1000.0, 10.0, 1.0), 10_000.0)
        self.assertAlmostEqual(calculate_nrv(1000.0, 10.0, 0.9), 9_000.0)

    def test_hcpv(self):
        """HCPV = NRV × phi × Shc."""
        self.assertAlmostEqual(calculate_hcpv(10_000.0, 0.20, 0.70), 1_400.0)

    def test_stoiip(self):
        """STOIIP = HCPV × 7758.36735 / Bo / 1e6."""
        expected = OIL_FORMULA_EXPECTED.stoiip_mmbbl
        result = calculate_stoiip(1_400.0, 1.4)
        assert_rel_close(self, result, expected, FORMULA_REL_TOL, "STOIIP")

    def test_recoverable_oil(self):
        """Recoverable oil = STOIIP × RE_oil."""
        expected = OIL_FORMULA_EXPECTED.recoverable_oil_mmbbl
        stoiip = calculate_stoiip(1_400.0, 1.4)
        result = calculate_recoverable_oil(stoiip, 0.35)
        assert_rel_close(self, result, expected, FORMULA_REL_TOL, "Recoverable oil")

    def test_solution_gas(self):
        """Solution gas = RecOil [MMbbl] × GOR [scf/stb] / 1000."""
        expected = OIL_FORMULA_EXPECTED.solution_gas_bcf
        rec_oil = OIL_FORMULA_EXPECTED.recoverable_oil_mmbbl
        result = calculate_solution_gas(rec_oil, 600.0, 1.0)
        assert_rel_close(self, result, expected, FORMULA_REL_TOL, "Solution gas")

    def test_giip(self):
        """GIIP = HCPV × 43560 × GEF / 1e9."""
        expected = GAS_FORMULA_EXPECTED.giip_bcf
        result = calculate_giip(1_400.0, 200.0)
        assert_rel_close(self, result, expected, FORMULA_REL_TOL, "GIIP")

    def test_recoverable_gas(self):
        """Recoverable gas = GIIP × RE_gas."""
        expected = GAS_FORMULA_EXPECTED.recoverable_gas_bcf
        giip = calculate_giip(1_400.0, 200.0)
        result = calculate_recoverable_gas(giip, 0.80)
        assert_rel_close(self, result, expected, FORMULA_REL_TOL, "Recoverable gas")

    def test_condensate(self):
        """Condensate [MMbbl] = RecGas [Bcf] × CY [bbl/MMscf] / 1000."""
        # 10 Bcf × 50 bbl/MMscf / 1000 = 0.5 MMbbl
        result = calculate_condensate(10.0, 50.0)
        self.assertAlmostEqual(result, 0.5, places=10)

    def test_mmboe_oil_only(self):
        """MMBOE with gas=0 equals liquids."""
        result = calculate_mmboe(5.0, 0.0, 6.0)
        self.assertAlmostEqual(result, 5.0, places=10)

    def test_mmboe_gas_only(self):
        """MMBOE = gas_bcf / 6 for gas-only case."""
        result = calculate_mmboe(0.0, 12.0, 6.0)
        self.assertAlmostEqual(result, 2.0, places=10)

    def test_mmboe_oil_formula_case(self):
        """Total MMBOE for oil formula case must match expected."""
        expected = OIL_FORMULA_EXPECTED.total_mmboe
        rec_oil = OIL_FORMULA_EXPECTED.recoverable_oil_mmbbl
        sol_gas = OIL_FORMULA_EXPECTED.solution_gas_bcf
        result = calculate_mmboe(rec_oil, sol_gas, 6.0)
        assert_rel_close(self, result, expected, FORMULA_REL_TOL, "Total MMBOE oil")

    def test_mmboe_gas_formula_case(self):
        """Total MMBOE for gas formula case must match expected."""
        expected = GAS_FORMULA_EXPECTED.total_mmboe
        rec_gas = GAS_FORMULA_EXPECTED.recoverable_gas_bcf
        result = calculate_mmboe(0.0, rec_gas, 6.0)
        assert_rel_close(self, result, expected, FORMULA_REL_TOL, "Total MMBOE gas")

    def test_oil_chain_full_deterministic(self):
        """Full oil formula chain must reproduce spec values within 0.01%."""
        pa = calculate_productive_area(1_000.0, 1.0)
        nrv = calculate_nrv(pa, 10.0, 1.0)
        hcpv = calculate_hcpv(nrv, 0.20, 0.70)
        stoiip = calculate_stoiip(hcpv, 1.4)
        rec_oil = calculate_recoverable_oil(stoiip, 0.35)
        sol_gas = calculate_solution_gas(rec_oil, 600.0, 1.0)
        total = calculate_mmboe(rec_oil, sol_gas, 6.0)

        assert_rel_close(self, stoiip,   OIL_FORMULA_EXPECTED.stoiip_mmbbl,          FORMULA_REL_TOL, "STOIIP")
        assert_rel_close(self, rec_oil,  OIL_FORMULA_EXPECTED.recoverable_oil_mmbbl, FORMULA_REL_TOL, "RecOil")
        assert_rel_close(self, sol_gas,  OIL_FORMULA_EXPECTED.solution_gas_bcf,      FORMULA_REL_TOL, "SolGas")
        assert_rel_close(self, total,    OIL_FORMULA_EXPECTED.total_mmboe,           FORMULA_REL_TOL, "MMBOE")

    def test_gas_chain_full_deterministic(self):
        """Full gas formula chain must reproduce spec values within 0.01%."""
        pa = calculate_productive_area(1_000.0, 1.0)
        nrv = calculate_nrv(pa, 10.0, 1.0)
        hcpv = calculate_hcpv(nrv, 0.20, 0.70)
        giip = calculate_giip(hcpv, 200.0)
        rec_gas = calculate_recoverable_gas(giip, 0.80)
        total = calculate_mmboe(0.0, rec_gas, 6.0)

        assert_rel_close(self, giip,    GAS_FORMULA_EXPECTED.giip_bcf,           FORMULA_REL_TOL, "GIIP")
        assert_rel_close(self, rec_gas, GAS_FORMULA_EXPECTED.recoverable_gas_bcf, FORMULA_REL_TOL, "RecGas")
        assert_rel_close(self, total,   GAS_FORMULA_EXPECTED.total_mmboe,         FORMULA_REL_TOL, "MMBOE gas")

    def test_numpy_array_inputs(self):
        """Volumetric functions must accept ndarray inputs."""
        arr = np.array([1000.0, 2000.0])
        pa = calculate_productive_area(arr, 1.0)
        np.testing.assert_array_almost_equal(pa, [1000.0, 2000.0])


# ===========================================================================
# 6. Chance calculations
# ===========================================================================

class TestChanceCalculations(unittest.TestCase):

    def test_category_chance_weak_link(self):
        """Category chance = minimum of sub-factors."""
        self.assertAlmostEqual(calculate_category_chance([0.9, 0.8, 0.7]), 0.7)
        self.assertAlmostEqual(calculate_category_chance([1.0]), 1.0)
        self.assertAlmostEqual(calculate_category_chance([0.5, 0.5]), 0.5)

    def test_category_chance_single(self):
        self.assertAlmostEqual(calculate_category_chance([0.65]), 0.65)

    def test_category_chance_empty_raises(self):
        with self.assertRaises(ValueError):
            calculate_category_chance([])

    def test_category_chance_out_of_range_raises(self):
        with self.assertRaises(ValueError):
            calculate_category_chance([1.5])

    def test_pg_workbook_case(self):
        """Pg for PM3X-D = 0.90 × 0.65 × 0.60 × 0.60 × 0.60 = 0.12636."""
        chance_cats = {
            "source":           [0.90],
            "timing_migration": [0.65],
            "reservoir":        [0.60],
            "closure":          [0.60],
            "containment":      [0.60],
        }
        pg = calculate_pg(chance_cats)
        self.assertAlmostEqual(pg, PM3XD_PG_EXPECTED, delta=PG_ABS_TOL)

    def test_pg_exact_arithmetic(self):
        """Verify Pg = 0.90 × 0.65 × 0.60^3 exactly."""
        expected = 0.90 * 0.65 * 0.60 * 0.60 * 0.60
        self.assertAlmostEqual(expected, 0.12636, places=10)
        chance_cats = {
            "a": [0.90],
            "b": [0.65],
            "c": [0.60],
            "d": [0.60],
            "e": [0.60],
        }
        pg = calculate_pg(chance_cats)
        self.assertAlmostEqual(pg, expected, delta=1e-15)

    def test_pg_risked_mean(self):
        """Pg-risked mean = unrisked trimmed mean × Pg."""
        chance_cats = {"a": [0.5]}
        result = calculate_pg_risked_mean(chance_cats, 10.0)
        self.assertAlmostEqual(result.pg, 0.5, places=10)
        self.assertAlmostEqual(result.pg_risked_mean, 5.0, places=10)

    def test_pg_all_ones(self):
        """Pg with all chance factors = 1.0 should be 1.0."""
        cats = {k: [1.0] for k in ["a", "b", "c"]}
        self.assertAlmostEqual(calculate_pg(cats), 1.0, places=10)

    def test_pg_zero_factor(self):
        """A zero chance factor makes Pg = 0."""
        cats = {"a": [0.9], "b": [0.0], "c": [0.8]}
        self.assertAlmostEqual(calculate_pg(cats), 0.0, places=10)


# ===========================================================================
# 7. Distribution sampling
# ===========================================================================

class TestDistributionSampling(unittest.TestCase):

    def _rng(self, seed=42):
        return np.random.default_rng(seed)

    def test_fixed_distribution(self):
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.FIXED,
            fixed_value=3.14,
        )
        samples = sample_distribution(dist, 100, self._rng())
        np.testing.assert_array_equal(samples, np.full(100, 3.14))

    def test_uniform_sampling_range(self):
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.UNIFORM,
            min_bound=0.0, max_bound=1.0,
        )
        samples = sample_distribution(dist, 10_000, self._rng())
        self.assertGreaterEqual(samples.min(), 0.0)
        self.assertLessEqual(samples.max(), 1.0)
        self.assertAlmostEqual(np.mean(samples), 0.5, delta=0.02)

    def test_normal_sampling_mean(self):
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.NORMAL,
            p90=80.0, p10=120.0,  # mu=100, sigma=(120-80)/(2*1.2816)
        )
        samples = sample_distribution(dist, 50_000, self._rng())
        self.assertAlmostEqual(np.mean(samples), 100.0, delta=0.5)

    def test_lognormal_sampling_median(self):
        """Median of lognormal samples ≈ exp(mu_ln)."""
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.LOGNORMAL,
            p90=100.0, p10=1000.0,
        )
        samples = sample_distribution(dist, 50_000, self._rng())
        # Expected median = exp((ln(100)+ln(1000))/2) = exp((4.605+6.908)/2) = exp(5.756)
        import math
        expected_median = math.exp((math.log(100) + math.log(1000)) / 2)
        actual_median = float(np.median(samples))
        assert_rel_close(self, actual_median, expected_median, 0.02, "Lognormal median")

    def test_beta_sampling_bounds(self):
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.BETA,
            p90=0.14, p10=0.22,
            min_bound=0.01, max_bound=0.40,
        )
        samples = sample_distribution(dist, 5_000, self._rng())
        self.assertGreaterEqual(samples.min(), 0.01 - 1e-10)
        self.assertLessEqual(samples.max(), 0.40 + 1e-10)

    def test_triangular_sampling(self):
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.TRIANGULAR,
            tri_min=0.0, tri_mode=0.5, tri_max=1.0,
        )
        samples = sample_distribution(dist, 5_000, self._rng())
        self.assertGreaterEqual(samples.min(), 0.0 - 1e-10)
        self.assertLessEqual(samples.max(), 1.0 + 1e-10)
        self.assertAlmostEqual(np.mean(samples), (0.0 + 0.5 + 1.0) / 3, delta=0.05)

    def test_reproducibility(self):
        """Same seed → same samples."""
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.LOGNORMAL,
            p90=100.0, p10=1000.0,
        )
        s1 = sample_distribution(dist, 1000, np.random.default_rng(99))
        s2 = sample_distribution(dist, 1000, np.random.default_rng(99))
        np.testing.assert_array_equal(s1, s2)

    def test_normal_skew_uses_p50_as_mean(self):
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.NORMAL,
            p90=80.0, p10=120.0, p50=110.0,
            skew_enabled=True,
        )
        samples = sample_distribution(dist, 50_000, self._rng())
        self.assertAlmostEqual(np.mean(samples), 110.0, delta=0.5)

    def test_lognormal_skew_differs_from_two_point_fit(self):
        """Skew fit balances P90, P50, and P10 — median shifts toward P50 vs 2-point fit."""
        import math

        dist_skew = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.LOGNORMAL,
            p90=100.0, p50=400.0, p10=1000.0,
            skew_enabled=True,
        )
        dist_plain = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.LOGNORMAL,
            p90=100.0, p10=1000.0,
        )
        samples_skew = sample_distribution(dist_skew, 50_000, self._rng())
        samples_plain = sample_distribution(dist_plain, 50_000, self._rng(99))
        median_skew = float(np.median(samples_skew))
        median_plain = float(np.median(samples_plain))
        two_point_median = math.exp((math.log(100) + math.log(1000)) / 2)
        self.assertGreater(median_skew, median_plain)
        self.assertGreater(median_skew, two_point_median)

    def test_beta_skew_percentiles_near_targets(self):
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.BETA,
            p90=0.12, p50=0.18, p10=0.28,
            min_bound=0.01, max_bound=0.40,
            skew_enabled=True,
        )
        samples = sample_distribution(dist, 50_000, self._rng())
        # P90 (low) = 10th CDF percentile; P10 (high) = 90th CDF percentile
        self.assertAlmostEqual(float(np.percentile(samples, 10)), 0.12, delta=0.03)
        self.assertAlmostEqual(float(np.percentile(samples, 50)), 0.18, delta=0.04)
        self.assertAlmostEqual(float(np.percentile(samples, 90)), 0.28, delta=0.03)

    def test_missing_fixed_value_raises(self):
        dist = DistributionDef(
            variable_id="x", display_name="X",
            distribution_type=DistributionType.FIXED,
        )
        with self.assertRaises(ValueError):
            sample_distribution(dist, 10, self._rng())


# ===========================================================================
# 8. Beta fitting
# ===========================================================================

class TestBetaFitting(unittest.TestCase):

    def test_fit_beta_cdf_accuracy(self):
        """Fitted beta CDF must satisfy BetaCDF(y10) ≈ 0.10 and BetaCDF(y90) ≈ 0.90."""
        from scipy.stats import beta as scipy_beta

        p90_val, p10_val = 0.14, 0.22
        a, b = 0.01, 0.40
        alpha, beta_ = fit_beta(p90_val, p10_val, a, b)

        y10 = (p90_val - a) / (b - a)
        y90 = (p10_val - a) / (b - a)

        cdf_at_y10 = scipy_beta.cdf(y10, alpha, beta_)
        cdf_at_y90 = scipy_beta.cdf(y90, alpha, beta_)

        self.assertAlmostEqual(cdf_at_y10, 0.10, places=6)
        self.assertAlmostEqual(cdf_at_y90, 0.90, places=6)

    def test_fit_beta_porosity(self):
        """Beta fit for PM3X-D porosity values."""
        from scipy.stats import beta as scipy_beta

        p90, p10 = 0.1406, 0.2205
        a, b = 0.01, 0.40
        alpha, beta_ = fit_beta(p90, p10, a, b)

        self.assertGreater(alpha, 0)
        self.assertGreater(beta_, 0)

        y10 = (p90 - a) / (b - a)
        y90 = (p10 - a) / (b - a)
        self.assertAlmostEqual(scipy_beta.cdf(y10, alpha, beta_), 0.10, places=5)
        self.assertAlmostEqual(scipy_beta.cdf(y90, alpha, beta_), 0.90, places=5)

    def test_fit_beta_bounds_violation_raises(self):
        with self.assertRaises(ValueError):
            fit_beta(0.5, 0.8, 0.6, 1.0)  # p90=0.5 < a=0.6

    def test_fit_beta_p90_ge_p10_raises(self):
        with self.assertRaises(ValueError):
            fit_beta(0.5, 0.3, 0.0, 1.0)  # p90 > p10


# ===========================================================================
# 9. Integration: Deterministic simulation runs
# ===========================================================================

class TestDeterministicSimulation(unittest.TestCase):

    def test_oil_formula_simulation(self):
        """
        Simulation Case 2: all-Fixed distributions should reproduce
        deterministic oil formula results within 0.01%.
        """
        inp = make_oil_formula_case(seed=42, n_iterations=1000)
        result = run_simulation(inp)

        # STOIIP (all iterations identical → P50 = mean = fixed value)
        assert_rel_close(
            self, result.stoiip.p50, OIL_FORMULA_EXPECTED.stoiip_mmbbl,
            FORMULA_REL_TOL, "Sim STOIIP P50"
        )
        assert_rel_close(
            self, result.recoverable_oil.p50,
            OIL_FORMULA_EXPECTED.recoverable_oil_mmbbl,
            FORMULA_REL_TOL, "Sim RecOil P50"
        )
        assert_rel_close(
            self, result.solution_gas.p50, OIL_FORMULA_EXPECTED.solution_gas_bcf,
            FORMULA_REL_TOL, "Sim SolGas P50"
        )
        assert_rel_close(
            self, result.total_mmboe.p50, OIL_FORMULA_EXPECTED.total_mmboe,
            FORMULA_REL_TOL, "Sim MMBOE P50"
        )

    def test_gas_formula_simulation(self):
        """
        Simulation Case 3: all-Fixed distributions should reproduce
        deterministic gas formula results within 0.01%.
        """
        inp = make_gas_formula_case(seed=42, n_iterations=1000)
        result = run_simulation(inp)

        assert_rel_close(
            self, result.giip.p50, GAS_FORMULA_EXPECTED.giip_bcf,
            FORMULA_REL_TOL, "Sim GIIP P50"
        )
        assert_rel_close(
            self, result.recoverable_gas.p50,
            GAS_FORMULA_EXPECTED.recoverable_gas_bcf,
            FORMULA_REL_TOL, "Sim RecGas P50"
        )
        assert_rel_close(
            self, result.total_mmboe.p50, GAS_FORMULA_EXPECTED.total_mmboe,
            FORMULA_REL_TOL, "Sim MMBOE gas P50"
        )

    def test_oil_formula_mean_equals_fixed(self):
        """For fixed distributions, trimmed mean must equal the fixed value."""
        inp = make_oil_formula_case(seed=42, n_iterations=1000)
        result = run_simulation(inp)
        assert_rel_close(
            self, result.stoiip.mean_trimmed,
            OIL_FORMULA_EXPECTED.stoiip_mmbbl,
            FORMULA_REL_TOL, "Sim STOIIP mean"
        )

    def test_no_gas_arrays_in_oil_case(self):
        """Oil simulation should not produce gas summaries."""
        inp = make_oil_formula_case(seed=42, n_iterations=1000)
        result = run_simulation(inp)
        self.assertIsNone(result.giip)
        self.assertIsNone(result.recoverable_gas)

    def test_no_oil_arrays_in_gas_case(self):
        """Gas simulation should not produce oil summaries."""
        inp = make_gas_formula_case(seed=42, n_iterations=1000)
        result = run_simulation(inp)
        self.assertIsNone(result.stoiip)
        self.assertIsNone(result.recoverable_oil)


# ===========================================================================
# 10. Integration: Reproducibility
# ===========================================================================

class TestReproducibility(unittest.TestCase):

    def test_same_seed_same_results(self):
        """Running with identical inputs and seed must yield identical output."""
        inp = make_pm3xd_h1ss10_input(seed=777, n_iterations=2000)
        r1 = run_simulation(inp)
        r2 = run_simulation(inp)
        self.assertAlmostEqual(r1.stoiip.p50, r2.stoiip.p50, places=10)
        self.assertAlmostEqual(r1.recoverable_oil.p50, r2.recoverable_oil.p50, places=10)
        self.assertAlmostEqual(r1.total_mmboe.mean_trimmed, r2.total_mmboe.mean_trimmed, places=10)

    def test_different_seeds_different_results(self):
        """Different seeds must produce different output (probabilistic case)."""
        inp1 = make_pm3xd_h1ss10_input(seed=1, n_iterations=2000)
        inp2 = make_pm3xd_h1ss10_input(seed=2, n_iterations=2000)
        r1 = run_simulation(inp1)
        r2 = run_simulation(inp2)
        # It is astronomically unlikely that these are equal
        self.assertNotAlmostEqual(r1.stoiip.p50, r2.stoiip.p50, places=3)


# ===========================================================================
# 11. Integration: PM3X-D chance validation
# ===========================================================================

class TestPM3XDChance(unittest.TestCase):

    def test_pg_exact(self):
        """PM3X-D Pg must equal 0.12636 within 1e-8 absolute."""
        inp = make_pm3xd_h1ss10_input(seed=42, n_iterations=1000)
        result = run_simulation(inp)
        self.assertIsNotNone(result.pg_result)
        self.assertAlmostEqual(result.pg_result.pg, PM3XD_PG_EXPECTED, delta=PG_ABS_TOL)

    def test_pg_risked_mean_positive(self):
        """Pg-risked mean must be positive."""
        inp = make_pm3xd_h1ss10_input(seed=42, n_iterations=1000)
        result = run_simulation(inp)
        self.assertGreater(result.pg_result.pg_risked_mean, 0.0)

    def test_pg_risked_mean_less_than_unrisked(self):
        """Pg-risked mean < unrisked mean (Pg < 1)."""
        inp = make_pm3xd_h1ss10_input(seed=42, n_iterations=1000)
        result = run_simulation(inp)
        self.assertLess(result.pg_result.pg_risked_mean,
                        result.pg_result.unrisked_trimmed_mean)


# ===========================================================================
# 12. Integration: PM3X-D percentile ordering
# ===========================================================================

class TestPM3XDPercentileOrdering(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        inp = make_pm3xd_h1ss10_input(seed=42, n_iterations=5_000)
        cls.result = run_simulation(inp)

    def test_stoiip_ordering(self):
        s = self.result.stoiip
        self.assertLess(s.p99, s.p90)
        self.assertLess(s.p90, s.p50)
        self.assertLess(s.p50, s.p10)
        self.assertLess(s.p10, s.p01)

    def test_recoverable_oil_ordering(self):
        s = self.result.recoverable_oil
        self.assertLess(s.p99, s.p90)
        self.assertLess(s.p90, s.p50)
        self.assertLess(s.p50, s.p10)
        self.assertLess(s.p10, s.p01)

    def test_total_mmboe_ordering(self):
        s = self.result.total_mmboe
        self.assertLess(s.p99, s.p90)
        self.assertLess(s.p90, s.p50)
        self.assertLess(s.p50, s.p10)
        self.assertLess(s.p10, s.p01)

    def test_solution_gas_ordering(self):
        s = self.result.solution_gas
        self.assertLess(s.p99, s.p90)
        self.assertLess(s.p90, s.p50)
        self.assertLess(s.p50, s.p10)
        self.assertLess(s.p10, s.p01)

    def test_all_values_positive(self):
        """All resource output statistics must be non-negative."""
        for summ in [
            self.result.stoiip,
            self.result.recoverable_oil,
            self.result.solution_gas,
            self.result.total_mmboe,
        ]:
            self.assertGreaterEqual(summ.p99, 0.0, msg=f"{summ.product_name} P99 < 0")

    def test_metadata(self):
        r = self.result
        self.assertEqual(r.prospect_name, "PM3X-D H1ss10")
        self.assertIn("engine_version", r.__dataclass_fields__)
        self.assertIn("independent", r.correlation_mode)

    def test_raw_arrays_shape(self):
        """Raw arrays must have n_iterations entries."""
        n = self.result.n_iterations
        for key, arr in self.result.arrays.items():
            self.assertEqual(len(arr), n, msg=f"Array '{key}' length mismatch")


# ===========================================================================
# 13. Validation: output summary generation
# ===========================================================================

class TestOutputSummaryGeneration(unittest.TestCase):

    def test_summary_fields_present(self):
        inp = make_oil_formula_case(seed=42, n_iterations=1000)
        result = run_simulation(inp)
        for field in ("p99", "p90", "p50", "mean_trimmed", "p10", "p01"):
            val = getattr(result.stoiip, field)
            self.assertIsNotNone(val)
            self.assertTrue(math.isfinite(val))

    def test_summary_unit_labels(self):
        inp = make_oil_formula_case(seed=42, n_iterations=1000)
        result = run_simulation(inp)
        self.assertEqual(result.stoiip.unit, "MMBO")
        self.assertEqual(result.recoverable_oil.unit, "MMBO")
        self.assertEqual(result.solution_gas.unit, "BCF")
        self.assertEqual(result.total_mmboe.unit, "MMBOE")

    def test_n_samples_stored(self):
        n = 1000
        inp = make_oil_formula_case(seed=42, n_iterations=n)
        result = run_simulation(inp)
        self.assertEqual(result.stoiip.n_samples, n)

    def test_minimum_iterations_blocking(self):
        inp = make_oil_formula_case(seed=42, n_iterations=500)
        with self.assertRaises(ValueError):
            run_simulation(inp)


if __name__ == "__main__":
    unittest.main()
