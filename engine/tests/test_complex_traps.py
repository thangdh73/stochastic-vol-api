"""Tests for MMRA v4 workbook complex trap logic."""

import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mmra_engine.complex_traps import (
    ComplexTrapConfig,
    ComplexTrapElement,
    apply_complex_trap_grv,
    apply_complex_trap_method_a_workbook,
    apply_complex_trap_method_b_workbook,
    apply_complex_trap_productive_area,
)


def _logspace_samples(n: int, low: float, high: float) -> np.ndarray:
    return np.logspace(np.log10(low), np.log10(high), n)


class TestComplexTrapMethodAWorkbook(unittest.TestCase):
    def test_single_element_always_seals_unchanged(self):
        vol = _logspace_samples(2000, 100.0, 400.0)
        cfg = ComplexTrapConfig(
            enabled=True,
            num_elements=1,
            element_1=ComplexTrapElement(
                enabled=True, max_area_acres=2000.0, seal_confidence=1.0
            ),
        )
        rng = np.random.default_rng(2)
        out, scen = apply_complex_trap_method_a_workbook(vol, cfg, rng)
        np.testing.assert_allclose(out, vol)
        self.assertEqual(int(np.sum(scen == 2)), 2000)

    def test_single_element_never_seals_rescaled(self):
        vol = _logspace_samples(2000, 100.0, 400.0)
        cfg = ComplexTrapConfig(
            enabled=True,
            num_elements=1,
            element_1=ComplexTrapElement(
                enabled=True, max_area_acres=200.0, seal_confidence=0.0
            ),
        )
        rng = np.random.default_rng(1)
        out, scen = apply_complex_trap_method_a_workbook(vol, cfg, rng)
        self.assertFalse(np.allclose(out, vol))
        self.assertEqual(int(np.sum(scen == 0)), 2000)
        self.assertTrue(np.all(out <= vol.max() + 1e-6))

    def test_two_elements_scenario_mix(self):
        vol = _logspace_samples(10000, 80.0, 500.0)
        cfg = ComplexTrapConfig(
            enabled=True,
            method="A",
            num_elements=2,
            element_1=ComplexTrapElement(
                enabled=True, max_area_acres=120.0, seal_confidence=0.5
            ),
            element_2=ComplexTrapElement(
                enabled=True, max_area_acres=300.0, seal_confidence=0.5
            ),
        )
        rng = np.random.default_rng(42)
        out, scen = apply_complex_trap_method_a_workbook(vol, cfg, rng)
        n0 = int(np.sum(scen == 0))
        n1 = int(np.sum(scen == 1))
        n2 = int(np.sum(scen == 2))
        self.assertGreater(n0, 1000)
        self.assertGreater(n1, 100)
        self.assertGreater(n2, 100)
        self.assertEqual(n0 + n1 + n2, 10000)
        self.assertTrue(np.all(out[scen == 2] == vol[scen == 2]))

    def test_method_b_caps_on_seal_fail(self):
        vol = np.array([50.0, 150.0, 250.0, 350.0])
        cfg = ComplexTrapConfig(
            enabled=True,
            method="B",
            num_elements=1,
            element_1=ComplexTrapElement(
                enabled=True, max_area_acres=200.0, seal_confidence=0.0
            ),
        )
        rng = np.random.default_rng(0)
        out, scen = apply_complex_trap_method_b_workbook(vol, cfg, rng)
        np.testing.assert_array_equal(out, [50.0, 150.0, 200.0, 200.0])

    def test_disabled_returns_base(self):
        closed = np.array([100.0, 200.0])
        pf = np.array([1.0, 0.8])
        cfg = ComplexTrapConfig(enabled=False)
        rng = np.random.default_rng(0)
        pa, scen = apply_complex_trap_productive_area(closed, pf, cfg, rng)
        np.testing.assert_allclose(pa, closed * pf)
        self.assertEqual(len(scen), 2)


class TestComplexTrapNrv(unittest.TestCase):
    def test_grv_trap_then_nrv(self):
        grv = _logspace_samples(5000, 100.0, 400.0)
        fill = np.full(5000, 0.85)
        ntg = np.full(5000, 0.55)
        cfg = ComplexTrapConfig(
            enabled=True,
            num_elements=1,
            element_1=ComplexTrapElement(
                enabled=True, max_area_acres=150.0, seal_confidence=0.0
            ),
        )
        rng = np.random.default_rng(7)
        grv_out, nrv, scen = apply_complex_trap_grv(grv, fill, ntg, cfg, rng)
        expected = grv_out * fill * ntg
        np.testing.assert_allclose(nrv, expected)
        self.assertFalse(np.allclose(grv_out, grv))
        self.assertEqual(int(np.sum(scen == 0)), 5000)


if __name__ == "__main__":
    unittest.main()
