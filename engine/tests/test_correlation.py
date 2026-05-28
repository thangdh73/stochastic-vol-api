"""Tests for partial correlation (Iman–Conover and Gaussian copula)."""

import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mmra_engine.correlation import (
    CorrelationPair,
    apply_input_correlations,
    build_correlation_matrix,
    gaussian_copula,
    iman_conover,
    matrix_from_pairs,
    merge_pairs_with_matrix,
    normal_scores,
    normalize_correlation_mode,
    pairs_from_matrix,
    pearson_rho,
    spearman_rho,
    validate_correlation_matrix,
)
from mmra_engine.serialization import (
    simulation_input_from_dict,
    simulation_input_to_dict,
)
from mmra_engine.simulation import run_simulation
from mmra_engine.validation_cases import make_pm3xd_h1ss10_input


class TestCorrelationMatrix(unittest.TestCase):
    def test_build_from_pairs(self):
        ids = ["area", "net_pay", "porosity"]
        pairs = [CorrelationPair("area", "net_pay", 0.5)]
        R = build_correlation_matrix(ids, pairs)
        self.assertAlmostEqual(R[0, 1], 0.5)
        validate_correlation_matrix(R)

    def test_non_psd_raises(self):
        ids = ["a", "b", "c"]
        pairs = [
            CorrelationPair("a", "b", 0.9),
            CorrelationPair("a", "c", -0.9),
            CorrelationPair("b", "c", 0.9),
        ]
        R = build_correlation_matrix(ids, pairs)
        with self.assertRaises(ValueError):
            validate_correlation_matrix(R)


class TestCorrelationMatrixIO(unittest.TestCase):
    def test_pairs_from_matrix_and_back(self):
        variables = ["porosity", "saturation", "net_pay"]
        values = [
            [1.0, 0.5, 0.0],
            [0.5, 1.0, 0.0],
            [0.0, 0.0, 1.0],
        ]
        pairs = pairs_from_matrix(variables, values)
        self.assertEqual(len(pairs), 1)
        self.assertEqual(pairs[0].variable_a, "porosity")
        self.assertAlmostEqual(pairs[0].rho, 0.5)
        spec = matrix_from_pairs(variables, pairs)
        self.assertAlmostEqual(spec.values[0][1], 0.5)

    def test_serialization_includes_matrix(self):
        inp = make_pm3xd_h1ss10_input()
        inp.correlations = [
            CorrelationPair("porosity", "saturation", 0.4, enabled=True),
        ]
        data = simulation_input_to_dict(inp)
        self.assertIn("correlation_matrix", data)
        self.assertIn("porosity", data["correlation_matrix"]["variables"])
        restored = simulation_input_from_dict(data)
        pair = next(
            p for p in restored.correlations
            if {p.variable_a, p.variable_b} == {"porosity", "saturation"}
        )
        self.assertTrue(pair.enabled)
        self.assertAlmostEqual(pair.rho, 0.4)

    def test_matrix_overrides_pairs_on_load(self):
        inp = make_pm3xd_h1ss10_input()
        data = simulation_input_to_dict(inp)
        data["correlations"] = []
        data["correlation_matrix"] = {
            "variables": ["porosity", "saturation"],
            "values": [[1.0, 0.6], [0.6, 1.0]],
        }
        restored = simulation_input_from_dict(data)
        merged = merge_pairs_with_matrix(
            restored.correlations,
            data["correlation_matrix"]["variables"],
            data["correlation_matrix"]["values"],
        )
        enabled = [p for p in merged if p.enabled]
        self.assertEqual(len(enabled), 1)
        self.assertAlmostEqual(enabled[0].rho, 0.6)


class TestNormalizeMode(unittest.TestCase):
    def test_aliases(self):
        self.assertEqual(normalize_correlation_mode("gaussian"), "gaussian_copula")
        self.assertEqual(normalize_correlation_mode("copula"), "gaussian_copula")
        self.assertEqual(normalize_correlation_mode("rank_correlation"), "rank")


class TestImanConover(unittest.TestCase):
    def test_high_positive_correlation(self):
        rng = np.random.default_rng(42)
        n = 5000
        samples = {
            "area": rng.uniform(100, 1000, n),
            "net_pay": rng.uniform(10, 100, n),
        }
        R = build_correlation_matrix(
            ["area", "net_pay"],
            [CorrelationPair("area", "net_pay", 0.85)],
        )
        out = iman_conover(samples, ["area", "net_pay"], R, rng)
        rho = spearman_rho(out["area"], out["net_pay"])
        self.assertGreater(rho, 0.75)

    def test_zero_correlation_near_independent(self):
        rng = np.random.default_rng(99)
        n = 3000
        samples = {
            "porosity": rng.uniform(0.1, 0.3, n),
            "saturation": rng.uniform(0.4, 0.8, n),
        }
        R = build_correlation_matrix(
            ["porosity", "saturation"],
            [CorrelationPair("porosity", "saturation", 0.0)],
        )
        out = iman_conover(samples, ["porosity", "saturation"], R, rng)
        rho = spearman_rho(out["porosity"], out["saturation"])
        self.assertLess(abs(rho), 0.15)


class TestGaussianCopula(unittest.TestCase):
    def test_high_positive_pearson_on_normal_scores(self):
        rng = np.random.default_rng(7)
        n = 8000
        samples = {
            "porosity": rng.uniform(0.1, 0.3, n),
            "saturation": rng.uniform(0.4, 0.8, n),
        }
        target_rho = 0.6
        R = build_correlation_matrix(
            ["porosity", "saturation"],
            [CorrelationPair("porosity", "saturation", target_rho)],
        )
        out = gaussian_copula(samples, ["porosity", "saturation"], R, rng)
        z1 = normal_scores(out["porosity"])
        z2 = normal_scores(out["saturation"])
        rho = pearson_rho(z1, z2)
        self.assertGreater(rho, target_rho - 0.08)

    def test_apply_input_gaussian_mode(self):
        rng = np.random.default_rng(11)
        n = 4000
        samples = {
            "porosity": rng.uniform(0.1, 0.3, n),
            "saturation": rng.uniform(0.4, 0.8, n),
        }
        pairs = [CorrelationPair("porosity", "saturation", 0.55, enabled=True)]
        out, label = apply_input_correlations(
            samples, "oil", "gaussian_copula", pairs, rng
        )
        self.assertIn("gaussian_copula", label)
        rho = pearson_rho(normal_scores(out["porosity"]), normal_scores(out["saturation"]))
        self.assertGreater(rho, 0.4)


class TestSimulationWithCorrelation(unittest.TestCase):
    def test_pm3xd_with_porosity_saturation_correlation(self):
        """PM3X-D area is fixed; correlate stochastic porosity vs saturation."""
        inp = make_pm3xd_h1ss10_input(seed=42, n_iterations=3000)
        inp.correlation_mode = "rank"
        inp.correlations = [
            CorrelationPair("porosity", "saturation", 0.5, enabled=True),
        ]
        r_ind = run_simulation(
            make_pm3xd_h1ss10_input(seed=42, n_iterations=3000)
        )
        r_corr = run_simulation(inp)
        self.assertIn("rank", r_corr.correlation_mode.lower())
        rho = spearman_rho(
            r_corr.arrays["porosity"],
            r_corr.arrays["saturation"],
        )
        self.assertGreater(rho, 0.35)
        # Correlated run should differ from independent
        self.assertNotAlmostEqual(
            r_corr.total_mmboe.mean_trimmed,
            r_ind.total_mmboe.mean_trimmed,
            delta=0.01,
        )

    def test_pm3xd_gaussian_copula_porosity_saturation(self):
        inp = make_pm3xd_h1ss10_input(seed=42, n_iterations=3000)
        inp.correlation_mode = "gaussian_copula"
        inp.correlations = [
            CorrelationPair("porosity", "saturation", 0.5, enabled=True),
        ]
        r = run_simulation(inp)
        self.assertIn("gaussian_copula", r.correlation_mode.lower())
        rho = pearson_rho(
            normal_scores(r.arrays["porosity"]),
            normal_scores(r.arrays["saturation"]),
        )
        self.assertGreater(rho, 0.3)


if __name__ == "__main__":
    unittest.main()
