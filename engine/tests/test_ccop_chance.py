"""Tests for CCOP chance model and combination logic."""

import unittest

from mmra_engine.ccop_chance import (
    CCOP_DESCRIPTOR_LOOKUP,
    CcopChargeInput,
    CcopReservoirInput,
    CcopRiskInput,
    CcopTrapInput,
    build_ccop_risk_review,
    calculate_ccop_pg,
    calculate_pg_ccop_or_legacy,
    combine_probabilities,
    legacy_chance_to_ccop,
    probability_from_descriptor,
    weak_link,
)


class TestCcopCombination(unittest.TestCase):
    def test_or_two_sources(self):
        # CCOP example: PA=0.6, PB=0.3 -> P=0.72
        p = combine_probabilities([0.6, 0.3], "or")
        self.assertAlmostEqual(p, 0.72, places=6)

    def test_and_requires_both(self):
        p = combine_probabilities([0.6, 0.3], "and")
        self.assertAlmostEqual(p, 0.18, places=6)

    def test_weak_link_seal(self):
        self.assertAlmostEqual(weak_link([1.0, 0.3]), 0.3)


class TestCcopTiramExample(unittest.TestCase):
    """Example prospect mapped to CCOP factors -> Pg ≈ 0.24."""

    def test_tiram_pg(self):
        inp = CcopRiskInput(
            reservoir=CcopReservoirInput(facies_presence=0.8, effectiveness=1.0),
            trap=CcopTrapInput(structure=1.0, seal_top=1.0, seal_lateral=0.3),
            charge=CcopChargeInput(
                source_probabilities=[1.0],
                source_combination="or",
                migration=1.0,
            ),
            retention=1.0,
        )
        self.assertAlmostEqual(inp.pg(), 0.24, places=6)

    def test_dict_api(self):
        data = legacy_chance_to_ccop(
            {
                "source": [1.0],
                "timing_migration": [1.0],
                "closure": [1.0],
                "reservoir": [0.8, 1.0],
                "containment": [1.0, 0.3],
            }
        )
        data["charge"]["sources"] = [1.0]
        data["charge"]["migration"] = 1.0
        result = calculate_ccop_pg(data)
        self.assertAlmostEqual(result.pg, 0.24, places=6)


class TestRiskReview(unittest.TestCase):
    def test_comments_in_review(self):
        data = {
            "reservoir": {"facies_presence": 0.8, "effectiveness": 1.0},
            "trap": {"structure": 1.0, "seal_top": 1.0, "seal_lateral": 0.3},
            "charge": {"sources": [1.0], "source_combination": "or", "migration": 1.0},
            "retention": 1.0,
            "comments": {
                "source_a": "P=1 — proved gas in adjacent block / well",
            },
        }
        rows = build_ccop_risk_review(data)
        src = next(r for r in rows if r["label"] == "Mature source")
        self.assertEqual(src["comment"], "P=1 — proved gas in adjacent block / well")
        self.assertAlmostEqual(src["p"], 1.0)

    def test_pg_result_includes_review(self):
        data = legacy_chance_to_ccop(
            {
                "source": [1.0],
                "timing_migration": [1.0],
                "closure": [1.0],
                "reservoir": [0.8, 1.0],
                "containment": [1.0, 0.3],
            }
        )
        data["charge"]["sources"] = [1.0]
        data["charge"]["migration"] = 1.0
        result = calculate_pg_ccop_or_legacy({}, data, 100.0)
        self.assertIsNotNone(result.risk_review)
        self.assertGreater(len(result.risk_review), 0)


class TestDescriptors(unittest.TestCase):
    def test_lookup_count(self):
        self.assertEqual(len(CCOP_DESCRIPTOR_LOOKUP), 6)

    def test_certain(self):
        self.assertEqual(probability_from_descriptor("certain"), 1.0)


if __name__ == "__main__":
    unittest.main()
