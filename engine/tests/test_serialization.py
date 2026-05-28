"""Tests for mmra_engine.serialization."""

import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mmra_engine.serialization import (
    SCHEMA_VERSION,
    compute_input_hash,
    distribution_from_dict,
    distribution_to_dict,
    simulation_input_from_dict,
    simulation_input_to_dict,
    simulation_result_from_dict,
    simulation_result_to_dict,
    validation_report_from_dict,
    validation_report_to_dict,
)
from mmra_engine.simulation import run_simulation
from mmra_engine.validation import validate_simulation_input
from mmra_engine.validation_cases import (
    PM3XD_PG_EXPECTED,
    make_gas_formula_case,
    make_oil_formula_case,
    make_pm3xd_h1ss10_input,
)

PERCENTILE_ABS_TOL = 1e-10
PG_ABS_TOL = 1e-8
FORMULA_REL_TOL = 0.0001


def assert_rel_close(test_case, actual, expected, rel_tol, msg=""):
    if expected == 0:
        test_case.assertAlmostEqual(actual, expected, abs=rel_tol, msg=msg)
    else:
        test_case.assertAlmostEqual(
            actual, expected, delta=abs(expected) * rel_tol, msg=msg
        )


class TestDistributionSerialization(unittest.TestCase):
    def test_round_trip_pm3xd_area(self):
        inp = make_pm3xd_h1ss10_input()
        d = distribution_to_dict(inp.area_dist)
        restored = distribution_from_dict(d)
        self.assertEqual(restored.distribution_type, inp.area_dist.distribution_type)
        self.assertEqual(restored.fixed_value, inp.area_dist.fixed_value)


class TestOilGasInputRoundTrip(unittest.TestCase):
    def test_oil_formula_simulation_identity(self):
        original = make_oil_formula_case(seed=42, n_iterations=1000)
        restored = simulation_input_from_dict(simulation_input_to_dict(original))
        r1 = run_simulation(original)
        r2 = run_simulation(restored)
        assert_rel_close(
            self, r1.stoiip.p50, r2.stoiip.p50, FORMULA_REL_TOL, "STOIIP P50"
        )
        assert_rel_close(
            self,
            r1.total_mmboe.mean_trimmed,
            r2.total_mmboe.mean_trimmed,
            FORMULA_REL_TOL,
            "MMBOE mean",
        )

    def test_gas_formula_simulation_identity(self):
        original = make_gas_formula_case(seed=42, n_iterations=1000)
        restored = simulation_input_from_dict(simulation_input_to_dict(original))
        r1 = run_simulation(original)
        r2 = run_simulation(restored)
        assert_rel_close(self, r1.giip.p50, r2.giip.p50, FORMULA_REL_TOL, "GIIP P50")


class TestPM3XDSerialization(unittest.TestCase):
    def test_input_round_trip_fields(self):
        original = make_pm3xd_h1ss10_input(seed=42, n_iterations=5000)
        data = simulation_input_to_dict(original)
        self.assertEqual(data["schema_version"], SCHEMA_VERSION)
        restored = simulation_input_from_dict(data)
        self.assertEqual(restored.prospect_name, original.prospect_name)
        self.assertEqual(restored.seed, original.seed)
        self.assertEqual(restored.n_iterations, original.n_iterations)
        self.assertEqual(restored.chance_categories, original.chance_categories)
        self.assertEqual(
            restored.porosity_dist.distribution_type,
            original.porosity_dist.distribution_type,
        )

    def test_simulation_identity_after_round_trip(self):
        original = make_pm3xd_h1ss10_input(seed=42, n_iterations=5000)
        restored = simulation_input_from_dict(simulation_input_to_dict(original))
        r1 = run_simulation(original)
        r2 = run_simulation(restored)
        self.assertAlmostEqual(
            r1.pg_result.pg, r2.pg_result.pg, delta=PG_ABS_TOL
        )
        self.assertAlmostEqual(
            r1.pg_result.pg, PM3XD_PG_EXPECTED, delta=PG_ABS_TOL
        )
        for attr in ("p99", "p90", "p50", "mean_trimmed", "p10", "p01"):
            self.assertAlmostEqual(
                getattr(r1.total_mmboe, attr),
                getattr(r2.total_mmboe, attr),
                delta=PERCENTILE_ABS_TOL,
                msg=attr,
            )

    def test_result_json_round_trip(self):
        inp = make_pm3xd_h1ss10_input(seed=42, n_iterations=2000)
        result = run_simulation(inp)
        data = simulation_result_to_dict(result, include_arrays=False)
        text = json.dumps(data)
        loaded = json.loads(text)
        restored = simulation_result_from_dict(loaded, include_arrays=False)
        self.assertAlmostEqual(
            result.total_mmboe.mean_trimmed,
            restored.total_mmboe.mean_trimmed,
            delta=PERCENTILE_ABS_TOL,
        )

    def test_arrays_optional(self):
        inp = make_pm3xd_h1ss10_input(seed=42, n_iterations=1000)
        result = run_simulation(inp)
        data = simulation_result_to_dict(result, include_arrays=True)
        self.assertIn("arrays", data)
        self.assertEqual(len(data["arrays"]["total_mmboe"]), 1000)

    def test_validation_report_round_trip(self):
        inp = make_pm3xd_h1ss10_input()
        report = validate_simulation_input(inp)
        self.assertFalse(report.has_errors)
        restored = validation_report_from_dict(validation_report_to_dict(report))
        self.assertEqual(len(restored.issues), len(report.issues))
        self.assertEqual(restored.issues[0].severity, report.issues[0].severity)

    def test_unsupported_schema_version(self):
        with self.assertRaises(ValueError):
            simulation_input_from_dict({"schema_version": "99"})

    def test_compute_input_hash_stable(self):
        inp = make_pm3xd_h1ss10_input(seed=42)
        self.assertEqual(compute_input_hash(inp), compute_input_hash(inp))


if __name__ == "__main__":
    unittest.main()
