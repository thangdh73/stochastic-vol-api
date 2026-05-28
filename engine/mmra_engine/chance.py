"""
chance.py – Geologic chance of success calculations.

Chance categories:
    Source, Timing/Migration, Reservoir, Closure, Containment

Weak-link logic:
    CategoryChance = min(populated sub-factor probabilities)

Overall Pg:
    Pg = Source × Timing_Migration × Reservoir × Closure × Containment

Risked reporting:
    PgRiskedMean = UnriskedTrimmedMean × Pg

All chance values are fractions (0–1) internally.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ChanceCategory:
    """
    A single geologic chance category.

    sub_factors : list of float
        Individual sub-factor probabilities as fractions (0–1).
        Empty populated entries are ignored; the minimum of populated values
        is the weak-link category chance.
    name : str
        Human-readable category name.
    notes : str
        Rationale / supporting text.
    """
    name: str
    sub_factors: List[float] = field(default_factory=list)
    notes: str = ""

    def category_chance(self) -> float:
        """
        Weak-link category chance = min of all populated sub-factor values.

        Raises
        ------
        ValueError
            If no sub-factors are populated.
        """
        populated = [v for v in self.sub_factors if v is not None]
        if not populated:
            raise ValueError(
                f"Chance category '{self.name}' has no populated sub-factors."
            )
        return min(populated)


@dataclass
class PgRiskedResult:
    """
    Container for Pg and Pg-risked mean resource output.
    """
    pg: float
    category_chances: Dict[str, float]  # {category_name: chance}
    unrisked_trimmed_mean: float
    pg_risked_mean: float
    resource_unit: str = "MMBOE"
    risk_review: Optional[List[Dict[str, Any]]] = None


def calculate_category_chance(sub_factors: List[float]) -> float:
    """
    Compute the weak-link category chance from a list of sub-factor values.

    Parameters
    ----------
    sub_factors : list of float
        Sub-factor probabilities as fractions (0–1). Must be non-empty.

    Returns
    -------
    float
        Minimum value (weak link).

    Raises
    ------
    ValueError
        If sub_factors is empty.
    """
    populated = [v for v in sub_factors if v is not None]
    if not populated:
        raise ValueError("At least one sub-factor must be provided.")
    for v in populated:
        if not (0.0 <= v <= 1.0):
            raise ValueError(
                f"Sub-factor value {v} is outside [0, 1]. "
                "Convert percentages to fractions before calling."
            )
    return min(populated)


def calculate_pg(chance_categories: Dict[str, List[float]]) -> float:
    """
    Calculate Pg as the product of category chances.

    Parameters
    ----------
    chance_categories : dict
        Mapping from category name to list of sub-factor fractions.
        Expected keys (order does not matter):
            "source", "timing_migration", "reservoir", "closure", "containment"
        Any non-empty key is multiplied in.

    Returns
    -------
    float
        Pg as a fraction (0–1).

    Raises
    ------
    ValueError
        If any category has no sub-factors.
    """
    pg = 1.0
    for category_name, sub_factors in chance_categories.items():
        cat_chance = calculate_category_chance(sub_factors)
        pg *= cat_chance
    return pg


def calculate_pg_risked_mean(
    chance_categories: Dict[str, List[float]],
    unrisked_trimmed_mean: float,
    resource_unit: str = "MMBOE",
) -> PgRiskedResult:
    """
    Calculate Pg and the Pg-risked mean resource.

    Parameters
    ----------
    chance_categories : dict
        Mapping from category name to list of sub-factor fractions.
    unrisked_trimmed_mean : float
        The trimmed-mean (P99→P01) of the unrisked resource distribution.
    resource_unit : str
        Unit string for display.

    Returns
    -------
    PgRiskedResult
    """
    category_chances: Dict[str, float] = {}
    pg = 1.0
    for name, sub_factors in chance_categories.items():
        cat_chance = calculate_category_chance(sub_factors)
        category_chances[name] = cat_chance
        pg *= cat_chance

    pg_risked_mean = unrisked_trimmed_mean * pg

    return PgRiskedResult(
        pg=pg,
        category_chances=category_chances,
        unrisked_trimmed_mean=unrisked_trimmed_mean,
        pg_risked_mean=pg_risked_mean,
        resource_unit=resource_unit,
    )
