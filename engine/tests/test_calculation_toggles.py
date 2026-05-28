"""Tests for optional calculation toggles (solution gas, oil recovery, chance)."""

import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mmra_engine.calculation_toggles import (
    include_chance,
    sync_toggles_from_distributions,
    uses_ccop_risk,
)
from mmra_engine.module_preview import run_chance_module_preview
from mmra_engine.serialization import (
    simulation_input_from_dict,
    simulation_input_to_dict,
    simulation_result_to_dict,
)
from mmra_engine.simulation import run_simulation
from mmra_engine.validation import validate_module_scope, validate_simulation_input
from mmra_engine.validation_cases import make_oil_formula_case


class TestCalculationToggles(unittest.TestCase):
    def test_include_solution_gas_false_excludes_arrays(self):
        inp = make_oil_formula_case(n_iterations=1000)
        inp.include_solution_gas = False
        inp.gor_dist = None
        inp.solution_gas_recovery_dist = None
        result = run_simulation(inp)
        self.assertNotIn("gor", result.arrays)
        self.assertNotIn("solution_gas_bcf", result.arrays)
        self.assertIsNone(result.solution_gas)
        self.assertFalse(result.solution_gas_included)
        # MMBOE oil-only: should match STOIIP-based path (no solution gas term)
        mmboe = result.arrays["total_mmboe"]
        rec_oil = result.arrays["recoverable_oil_mmbbl"]
        np.testing.assert_allclose(mmboe, rec_oil, rtol=1e-9)

    def test_apply_oil_recovery_false_proxy_stoiip(self):
        inp = make_oil_formula_case(n_iterations=1000)
        inp.apply_oil_recovery = False
        inp.oil_recovery_dist = None
        result = run_simulation(inp)
        stoiip = result.arrays["stoiip_mmbbl"]
        rec_oil = result.arrays["recoverable_oil_mmbbl"]
        np.testing.assert_allclose(rec_oil, stoiip, rtol=1e-9)
        self.assertFalse(result.oil_recovery_applied)
        self.assertEqual(result.volume_basis, "in_place_proxy")

    def test_include_chance_false_pg_na(self):
        inp = make_oil_formula_case(n_iterations=1000)
        inp.include_chance = False
        inp.chance_categories = {}
        result = run_simulation(inp)
        self.assertIsNone(result.pg_result)
        self.assertFalse(result.chance_applied)
        payload = simulation_result_to_dict(result)
        self.assertIsNone(payload["pg_result"])

    def test_ccop_chance_with_empty_legacy_categories(self):
        """CCOP must run when chance_categories is empty but ccop_risk is set."""
        inp = make_oil_formula_case(n_iterations=1000)
        inp.chance_categories = {}
        inp.risk_model = "ccop_v1"
        inp.ccop_risk = {
            "reservoir": {"facies_presence": 0.8, "effectiveness": 1.0},
            "trap": {"structure": 1.0, "seal_top": 1.0, "seal_lateral": 0.3},
            "charge": {"sources": [1.0], "source_combination": "or", "migration": 1.0},
            "retention": 1.0,
        }
        inp.include_chance = True
        synced = sync_toggles_from_distributions(inp)
        self.assertTrue(uses_ccop_risk(synced))
        self.assertTrue(include_chance(synced))
        self.assertTrue(synced.include_chance)
        result = run_simulation(synced)
        self.assertTrue(result.chance_applied)
        self.assertIsNotNone(result.pg_result)
        self.assertAlmostEqual(result.pg_result.pg, 0.24, places=6)
        _, summaries, _ = run_chance_module_preview(synced)
        pg_summary = summaries.get("pg") or {}
        self.assertAlmostEqual(pg_summary.get("pg"), 0.24, places=6)
        self.assertTrue(pg_summary.get("risk_review"))

    def test_serialization_defaults_toggles_true(self):
        inp = make_oil_formula_case()
        d = simulation_input_to_dict(inp)
        self.assertTrue(d["include_solution_gas"])
        self.assertTrue(d["apply_oil_recovery"])
        self.assertTrue(d["include_chance"])

    def test_null_oil_recovery_without_flag_skips_requirement(self):
        """Toggle-off clears dist; unset apply_oil_recovery + null dist must not block."""
        inp = make_oil_formula_case()
        inp.oil_recovery_dist = None
        report = validate_simulation_input(inp)
        self.assertFalse(
            any(
                i.code == "REQUIRED_DIST_MISSING" and "oil_recovery" in i.field
                for i in report.issues
            ),
        )

    def test_sync_toggles_when_dist_cleared_without_flag(self):
        inp = make_oil_formula_case()
        inp.oil_recovery_dist = None
        inp.apply_oil_recovery = None
        synced = sync_toggles_from_distributions(inp)
        self.assertFalse(synced.apply_oil_recovery)
        r = validate_module_scope(synced, "hc_yield")
        self.assertFalse(r.has_errors)

    def test_validation_toggles_off_succeeds(self):
        inp = make_oil_formula_case()
        inp.include_solution_gas = False
        inp.apply_oil_recovery = False
        inp.include_chance = False
        inp.gor_dist = None
        inp.solution_gas_recovery_dist = None
        inp.oil_recovery_dist = None
        inp.chance_categories = {}
        report = validate_simulation_input(inp)
        self.assertFalse(report.has_errors)


if __name__ == "__main__":
    unittest.main()
