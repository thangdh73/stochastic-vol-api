"""
petrel_grv.py – GRV from Petrel structural + fluid-contact marginal cases (3 + 3).

When Petrel provides three GRV values for depth/structure (at fixed mid contact) and
three for fluid contact (at fixed mid structure), build a 3×3 GRV matrix and sample
depth × contact cases each Monte Carlo iteration.

Combination (default): multiplicative from P50 anchor
    GRV[d,c] = GRV_mid × (depth_grv[d] / depth_grv[mid]) × (contact_grv[c] / contact_grv[mid])
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Sequence, Tuple

import numpy as np

CASE_LABELS = ("P90", "P50", "P10")


@dataclass
class PetrelGrvMarginals:
    """Three structural GRVs (mid contact) + three contact GRVs (mid structure)."""

    depth_grv: List[float]
    contact_grv: List[float]
    depth_weights: List[float] = field(default_factory=lambda: [1 / 3, 1 / 3, 1 / 3])
    contact_weights: List[float] = field(default_factory=lambda: [1 / 3, 1 / 3, 1 / 3])
    grv_matrix_3x3: Optional[List[List[float]]] = None

    def __post_init__(self) -> None:
        if len(self.depth_grv) != 3 or len(self.contact_grv) != 3:
            raise ValueError("depth_grv and contact_grv must each have 3 values (P90, P50, P10).")
        if len(self.depth_weights) != 3 or len(self.contact_weights) != 3:
            raise ValueError("depth_weights and contact_weights must each have 3 values.")
        _validate_positive(self.depth_grv, "depth_grv")
        _validate_positive(self.contact_grv, "contact_grv")
        _normalize_weights(self.depth_weights)
        _normalize_weights(self.contact_weights)


def _validate_positive(values: Sequence[float], name: str) -> None:
    for i, v in enumerate(values):
        if v is None or not np.isfinite(v) or v <= 0:
            raise ValueError(f"{name}[{i}] must be a positive finite number.")


def _normalize_weights(weights: List[float]) -> None:
    s = float(sum(weights))
    if s <= 0:
        raise ValueError("Case weights must sum to a positive value.")
    for i in range(len(weights)):
        weights[i] = float(weights[i]) / s


def petrel_marginals_from_dict(data: Optional[dict]) -> Optional[PetrelGrvMarginals]:
    if not data:
        return None
    return PetrelGrvMarginals(
        depth_grv=[float(x) for x in data["depth_grv"]],
        contact_grv=[float(x) for x in data["contact_grv"]],
        depth_weights=[float(x) for x in data.get("depth_weights", [1 / 3, 1 / 3, 1 / 3])],
        contact_weights=[float(x) for x in data.get("contact_weights", [1 / 3, 1 / 3, 1 / 3])],
        grv_matrix_3x3=data.get("grv_matrix_3x3"),
    )


def petrel_marginals_to_dict(pm: Optional[PetrelGrvMarginals]) -> Optional[dict]:
    if pm is None:
        return None
    out = {
        "depth_grv": list(pm.depth_grv),
        "contact_grv": list(pm.contact_grv),
        "depth_weights": list(pm.depth_weights),
        "contact_weights": list(pm.contact_weights),
    }
    if pm.grv_matrix_3x3 is not None:
        out["grv_matrix_3x3"] = pm.grv_matrix_3x3
    return out


def build_grv_matrix_3x3(pm: PetrelGrvMarginals) -> List[List[float]]:
    """Build or return 3×3 GRV (acre-ft internal; caller converts units before/after)."""
    if pm.grv_matrix_3x3 is not None:
        if len(pm.grv_matrix_3x3) != 3 or any(len(r) != 3 for r in pm.grv_matrix_3x3):
            raise ValueError("grv_matrix_3x3 must be 3×3.")
        return [[float(c) for c in row] for row in pm.grv_matrix_3x3]

    d_mid = pm.depth_grv[1]
    c_mid = pm.contact_grv[1]
    if d_mid <= 0 or c_mid <= 0:
        raise ValueError("P50 depth_grv and contact_grv must be positive.")

    matrix: List[List[float]] = []
    for d_grv in pm.depth_grv:
        row: List[float] = []
        for c_grv in pm.contact_grv:
            row.append(float(d_grv * c_grv / c_mid))
        matrix.append(row)
    return matrix


def depth_marginal_grv(matrix: List[List[float]], case_index: int) -> float:
    """Mean GRV across contact cases for one depth row (tornado / reporting)."""
    return float(np.mean(matrix[case_index]))


def contact_marginal_grv(matrix: List[List[float]], case_index: int) -> float:
    """Mean GRV across depth cases for one contact column."""
    return float(np.mean([matrix[d][case_index] for d in range(3)]))


def sample_petrel_grv(
    pm: PetrelGrvMarginals,
    n: int,
    rng: np.random.Generator,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Sample GRV from Petrel marginals.

    Returns
    -------
    grv_samples, depth_case_idx, contact_case_idx, grv_matrix (flat reference)
    """
    matrix = build_grv_matrix_3x3(pm)
    d_idx = rng.choice(3, size=n, p=np.asarray(pm.depth_weights, dtype=float))
    c_idx = rng.choice(3, size=n, p=np.asarray(pm.contact_weights, dtype=float))
    grv = np.array([matrix[int(d)][int(c)] for d, c in zip(d_idx, c_idx)], dtype=float)
    return grv, d_idx.astype(int), c_idx.astype(int), np.asarray(matrix, dtype=float)


def petrel_base_grv_scalar(pm: PetrelGrvMarginals) -> float:
    """P50×P50 cell for OAT base case."""
    matrix = build_grv_matrix_3x3(pm)
    return float(matrix[1][1])


def petrel_depth_swing_scalars(pm: PetrelGrvMarginals) -> Tuple[float, float, float]:
    """Low / base / high GRV for depth driver (contact averaged per row)."""
    matrix = build_grv_matrix_3x3(pm)
    return (
        depth_marginal_grv(matrix, 0),
        float(matrix[1][1]),
        depth_marginal_grv(matrix, 2),
    )


def petrel_contact_swing_scalars(pm: PetrelGrvMarginals) -> Tuple[float, float, float]:
    """Low / base / high GRV for fluid-contact driver."""
    matrix = build_grv_matrix_3x3(pm)
    return (
        contact_marginal_grv(matrix, 0),
        float(matrix[1][1]),
        contact_marginal_grv(matrix, 2),
    )
