"""Tests for resource display-unit scaling."""

import unittest

from mmra_engine.constants import BBL_TO_M3, BCF_TO_MMSCF, SCF_PER_CUBIC_METRE
from mmra_engine.resource_units import (
    BCF_PER_BSCM,
    gas_display_scale,
    gas_summary_for_display,
    oil_display_scale,
    oil_summary_for_display,
)
from mmra_engine.stats import PercentileSummary, calculate_percentile_summary
from tests.test_mmra_engine import make_oil_formula_case, run_simulation


class TestResourceUnitScales(unittest.TestCase):
    def test_gas_mmscf_scale(self):
        self.assertEqual(gas_display_scale("MMSCF"), BCF_TO_MMSCF)

    def test_gas_bscm_scale(self):
        self.assertAlmostEqual(gas_display_scale("Bscm"), 1.0 / BCF_PER_BSCM)
        self.assertAlmostEqual(BCF_PER_BSCM, SCF_PER_CUBIC_METRE)

    def test_oil_mmscm_scale(self):
        self.assertAlmostEqual(oil_display_scale("MMscm"), BBL_TO_M3)


class TestResourceUnitSimulation(unittest.TestCase):
    def test_mmscm_and_bscm_summaries(self):
        base = run_simulation(make_oil_formula_case(seed=7, n_iterations=2000))

        inp_bcf = make_oil_formula_case(seed=7, n_iterations=2000)
        inp_bcf.gas_resource_unit = "BCF"
        inp_bcf.oil_resource_unit = "MMBO"
        bcf = run_simulation(inp_bcf)

        inp_mmscm = make_oil_formula_case(seed=7, n_iterations=2000)
        inp_mmscm.oil_resource_unit = "MMscm"
        inp_mmscm.gas_resource_unit = "Bscm"
        alt = run_simulation(inp_mmscm)

        self.assertEqual(alt.stoiip.unit, "MMscm")
        self.assertEqual(alt.solution_gas.unit, "Bscm")
        self.assertAlmostEqual(
            alt.stoiip.p50,
            bcf.stoiip.p50 * BBL_TO_M3,
            places=6,
        )
        self.assertAlmostEqual(
            alt.solution_gas.p50,
            bcf.solution_gas.p50 / SCF_PER_CUBIC_METRE,
            places=6,
        )

    def test_mmscf_scales_values(self):
        inp = make_oil_formula_case(seed=3, n_iterations=1500)
        inp.gas_resource_unit = "MMSCF"
        res = run_simulation(inp)
        inp_bcf = make_oil_formula_case(seed=3, n_iterations=1500)
        inp_bcf.gas_resource_unit = "BCF"
        bcf = run_simulation(inp_bcf)
        self.assertAlmostEqual(res.solution_gas.p50, bcf.solution_gas.p50 * 1000.0, places=4)


class TestSummaryHelpers(unittest.TestCase):
    def test_apply_display_scale(self):
        raw = calculate_percentile_summary(
            __import__("numpy").array([1.0, 2.0, 3.0]),
            "Test",
            "Bcf",
        )

        class _Inp:
            gas_resource_unit = "Bscm"

        out = gas_summary_for_display(raw, _Inp())
        self.assertEqual(out.unit, "Bscm")
        self.assertAlmostEqual(out.p50, raw.p50 / SCF_PER_CUBIC_METRE)


if __name__ == "__main__":
    unittest.main()
