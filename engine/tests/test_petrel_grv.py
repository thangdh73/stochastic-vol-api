"""Tests for Petrel 3+3 GRV marginal rollup."""

import unittest

import numpy as np

from mmra_engine.petrel_grv import (
    PetrelGrvMarginals,
    build_grv_matrix_3x3,
    petrel_contact_swing_scalars,
    petrel_depth_swing_scalars,
    sample_petrel_grv,
)


class TestPetrelGrvMarginals(unittest.TestCase):
    def test_build_matrix_multiplicative(self) -> None:
        pm = PetrelGrvMarginals(
            depth_grv=[8000.0, 10000.0, 12000.0],
            contact_grv=[9000.0, 10000.0, 11000.0],
        )
        m = build_grv_matrix_3x3(pm)
        self.assertAlmostEqual(m[1][1], 10000.0)
        self.assertAlmostEqual(m[0][1], 8000.0)
        self.assertAlmostEqual(m[2][2], 12000.0 * 11000.0 / 10000.0)

    def test_depth_marginal_averages(self) -> None:
        pm = PetrelGrvMarginals(
            depth_grv=[8000.0, 10000.0, 12000.0],
            contact_grv=[9000.0, 10000.0, 11000.0],
        )
        low, mid, high = petrel_depth_swing_scalars(pm)
        self.assertAlmostEqual(mid, 10000.0)
        self.assertLess(low, mid)
        self.assertGreater(high, mid)

    def test_sample_shapes(self) -> None:
        pm = PetrelGrvMarginals(
            depth_grv=[8000.0, 10000.0, 12000.0],
            contact_grv=[9000.0, 10000.0, 11000.0],
        )
        rng = np.random.default_rng(42)
        grv, d_idx, c_idx, _ = sample_petrel_grv(pm, 500, rng)
        self.assertEqual(grv.shape, (500,))
        self.assertTrue(np.all(grv > 0))


if __name__ == "__main__":
    unittest.main()
