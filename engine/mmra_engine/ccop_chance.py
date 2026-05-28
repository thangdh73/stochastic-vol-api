"""
ccop_chance.py – CCOP (2000) geologic chance model.

Pg = P_reservoir × P_trap × P_charge × P_retention

Within each factor (presence × effectiveness where applicable):
    P_reservoir = P_facies × P_effectiveness
    P_trap      = P_structure × P_seal  (seal = weak-link min(top, lateral) if both set)
    P_charge    = P_source_combined × P_migration
    P_retention = single or weak-link sub-factors

Combination rule (OR – at least one source / path):
    P = 1 - (1 - P_a) × (1 - P_b) × ...

Descriptor lookup follows CCOP Fig. 3.7 general probability scale.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Sequence

from .chance import PgRiskedResult, calculate_pg_risked_mean

# CCOP Fig. 3.7 – general qualitative probability scale (proven geological models column)
CCOP_DESCRIPTOR_LOOKUP: List[Dict[str, Any]] = [
    {
        "id": "certain",
        "label": "Virtually to absolutely certain (excellent data)",
        "p": 1.0,
        "p_range": "0.95–1.00",
    },
    {
        "id": "most_probable",
        "label": "Most probable (good data, likely interpretation)",
        "p": 0.8,
        "p_range": "0.65–0.95",
    },
    {
        "id": "probable",
        "label": "Probable (fair data control)",
        "p": 0.6,
        "p_range": "0.40–0.65",
    },
    {
        "id": "possible",
        "label": "Possible (poor–fair data, less favourable interpretation)",
        "p": 0.3,
        "p_range": "0.05–0.35",
    },
    {
        "id": "unlikely",
        "label": "Unlikely (unfavourable models likely)",
        "p": 0.1,
        "p_range": "0.00–0.05",
    },
    {
        "id": "impossible",
        "label": "Virtually to absolutely impossible",
        "p": 0.0,
        "p_range": "0.00",
    },
]

CombinationMode = Literal["or", "and"]


def descriptor_by_id(descriptor_id: str) -> Optional[Dict[str, Any]]:
    for row in CCOP_DESCRIPTOR_LOOKUP:
        if row["id"] == descriptor_id:
            return row
    return None


def probability_from_descriptor(descriptor_id: str) -> float:
    row = descriptor_by_id(descriptor_id)
    if row is None:
        raise ValueError(f"Unknown CCOP descriptor id: {descriptor_id!r}")
    return float(row["p"])


def combine_probabilities(
    probabilities: Sequence[float],
    mode: CombinationMode = "or",
) -> float:
    """
    Combine independent probabilities.

    or  : at least one succeeds  →  P = 1 - ∏(1 - Pi)
    and : all must succeed      →  P = ∏ Pi
    """
    vals = [float(p) for p in probabilities if p is not None]
    if not vals:
        raise ValueError("At least one probability is required for combination.")
    for p in vals:
        if not (0.0 <= p <= 1.0):
            raise ValueError(f"Probability {p} is outside [0, 1].")
    if mode == "and":
        out = 1.0
        for p in vals:
            out *= p
        return out
    out = 1.0
    for p in vals:
        out *= 1.0 - p
    return 1.0 - out


def weak_link(probabilities: Sequence[float]) -> float:
    """Minimum of populated probabilities (CCOP weak-link within a factor)."""
    vals = [float(p) for p in probabilities if p is not None]
    if not vals:
        raise ValueError("At least one probability required for weak-link.")
    return min(vals)


def product_probabilities(probabilities: Sequence[float]) -> float:
    vals = [float(p) for p in probabilities if p is not None]
    if not vals:
        raise ValueError("At least one probability required.")
    out = 1.0
    for p in vals:
        out *= p
    return out


@dataclass
class CcopChargeInput:
    """Petroleum charge: mature source(s) + migration."""

    source_probabilities: List[float] = field(default_factory=list)
    source_combination: CombinationMode = "or"
    migration: float = 1.0

    def charge_probability(self) -> float:
        if not self.source_probabilities:
            raise ValueError("At least one source probability is required.")
        p_source = combine_probabilities(
            self.source_probabilities, self.source_combination
        )
        return p_source * float(self.migration)


@dataclass
class CcopTrapInput:
    """Trap: structure × seal (seal weak-link if top + lateral both set)."""

    structure: float
    seal_top: Optional[float] = None
    seal_lateral: Optional[float] = None

    def trap_probability(self) -> float:
        seal_vals = [v for v in (self.seal_top, self.seal_lateral) if v is not None]
        if not seal_vals:
            raise ValueError("At least one seal probability (top or lateral) is required.")
        p_seal = weak_link(seal_vals) if len(seal_vals) > 1 else seal_vals[0]
        return float(self.structure) * p_seal


@dataclass
class CcopReservoirInput:
    """Reservoir: facies presence × effectiveness (porosity/permeability/saturation)."""

    facies_presence: float
    effectiveness: float

    def reservoir_probability(self) -> float:
        return float(self.facies_presence) * float(self.effectiveness)


@dataclass
class CcopRiskInput:
    """Full CCOP geochronological risk input."""

    reservoir: CcopReservoirInput
    trap: CcopTrapInput
    charge: CcopChargeInput
    retention: float = 1.0

    def factor_probabilities(self) -> Dict[str, float]:
        return {
            "reservoir": self.reservoir.reservoir_probability(),
            "trap": self.trap.trap_probability(),
            "charge": self.charge.charge_probability(),
            "retention": float(self.retention),
        }

    def pg(self) -> float:
        fp = self.factor_probabilities()
        return product_probabilities(
            [fp["reservoir"], fp["trap"], fp["charge"], fp["retention"]]
        )


@dataclass
class CcopRiskResult:
    pg: float
    factor_probabilities: Dict[str, float]
    sub_factors: Dict[str, Any]


def ccop_risk_from_dict(data: Dict[str, Any]) -> CcopRiskInput:
    """Build CcopRiskInput from JSON-friendly dict (API / template import)."""
    res = data.get("reservoir", {})
    trap = data.get("trap", {})
    chg = data.get("charge", {})

    def _p(section: Dict[str, Any], key: str) -> float:
        if key not in section or section[key] is None:
            return float(section.get(key, 0))
        val = section[key]
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, dict):
            if "descriptor_id" in val:
                return probability_from_descriptor(val["descriptor_id"])
            return float(val.get("p", 0))
        return float(val)

    sources_raw = chg.get("sources", [])
    source_ps: List[float] = []
    for s in sources_raw:
        if isinstance(s, (int, float)):
            source_ps.append(float(s))
        elif "descriptor_id" in s:
            source_ps.append(probability_from_descriptor(s["descriptor_id"]))
        else:
            source_ps.append(float(s.get("p", 0)))

    seal_top = trap.get("seal_top")
    seal_lat = trap.get("seal_lateral")
    st = trap.get("seal_top")
    sl = trap.get("seal_lateral")

    def _optional_p(val: Any) -> Optional[float]:
        if val is None:
            return None
        if isinstance(val, dict) and "descriptor_id" in val:
            return probability_from_descriptor(val["descriptor_id"])
        if isinstance(val, dict):
            return float(val.get("p", val))
        return float(val)

    retention = data.get("retention", 1.0)
    if isinstance(retention, dict) and "descriptor_id" in retention:
        retention_p = probability_from_descriptor(retention["descriptor_id"])
    elif isinstance(retention, dict):
        retention_p = float(retention.get("p", 1.0))
    else:
        retention_p = float(retention)

    return CcopRiskInput(
        reservoir=CcopReservoirInput(
            facies_presence=_p(res, "facies_presence") if "facies_presence" in res else _p(res, "presence"),
            effectiveness=_p(res, "effectiveness"),
        ),
        trap=CcopTrapInput(
            structure=_p(trap, "structure"),
            seal_top=_optional_p(st),
            seal_lateral=_optional_p(sl),
        ),
        charge=CcopChargeInput(
            source_probabilities=source_ps or [_p(chg, "mature_source")],
            source_combination=chg.get("source_combination", "or"),
            migration=_p(chg, "migration") if "migration" in chg else float(chg.get("migration", 1.0)),
        ),
        retention=retention_p,
    )


def calculate_ccop_pg(ccop_data: Dict[str, Any]) -> CcopRiskResult:
    inp = ccop_risk_from_dict(ccop_data)
    fp = inp.factor_probabilities()
    return CcopRiskResult(
        pg=inp.pg(),
        factor_probabilities=fp,
        sub_factors={
            "reservoir": {
                "facies_presence": inp.reservoir.facies_presence,
                "effectiveness": inp.reservoir.effectiveness,
            },
            "trap": {
                "structure": inp.trap.structure,
                "seal_top": inp.trap.seal_top,
                "seal_lateral": inp.trap.seal_lateral,
            },
            "charge": {
                "sources": inp.charge.source_probabilities,
                "source_combination": inp.charge.source_combination,
                "migration": inp.charge.migration,
            },
            "retention": inp.retention,
        },
    )


def build_ccop_risk_review(ccop_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Build per-element risk review rows for Pg summary (prospect comments + computed P).
    """
    inp = ccop_risk_from_dict(ccop_data)
    comments_raw = ccop_data.get("comments") or {}
    comments: Dict[str, str] = (
        {str(k): str(v).strip() for k, v in comments_raw.items() if v}
        if isinstance(comments_raw, dict)
        else {}
    )

    def _comment(key: str) -> str:
        return comments.get(key, "")

    def _row(
        group: str,
        element: str,
        label: str,
        p: float,
        comment_key: str,
        note: str = "",
    ) -> Dict[str, Any]:
        return {
            "group": group,
            "element": element,
            "label": label,
            "p": float(p),
            "comment": _comment(comment_key),
            "note": note,
        }

    rows: List[Dict[str, Any]] = []

    rows.append(
        _row(
            "Reservoir (P1)",
            "P1a",
            "Facies presence",
            inp.reservoir.facies_presence,
            "reservoir_presence",
        )
    )
    rows.append(
        _row(
            "Reservoir (P1)",
            "P1b",
            "Reservoir effectiveness",
            inp.reservoir.effectiveness,
            "reservoir_effectiveness",
        )
    )
    p_res = inp.reservoir.reservoir_probability()
    rows.append(
        {
            "group": "Reservoir (P1)",
            "element": "P1",
            "label": "Combined reservoir",
            "p": p_res,
            "comment": "",
            "note": "P1a × P1b",
        }
    )

    rows.append(
        _row(
            "Trap (P2)",
            "P2a",
            "Structure / closure",
            inp.trap.structure,
            "trap_structure",
        )
    )
    if inp.trap.seal_top is not None:
        rows.append(
            _row(
                "Trap (P2)",
                "P2b",
                "Top seal",
                inp.trap.seal_top,
                "seal_top",
            )
        )
    if inp.trap.seal_lateral is not None:
        rows.append(
            _row(
                "Trap (P2)",
                "P2b",
                "Lateral (fault) seal",
                inp.trap.seal_lateral,
                "seal_lateral",
            )
        )
    p_trap = inp.trap.trap_probability()
    seal_note = "P2a × P2b (seal = min top, lateral)" if len(
        [v for v in (inp.trap.seal_top, inp.trap.seal_lateral) if v is not None]
    ) > 1 else "P2a × P2b"
    rows.append(
        {
            "group": "Trap (P2)",
            "element": "P2",
            "label": "Combined trap",
            "p": p_trap,
            "comment": "",
            "note": seal_note,
        }
    )

    src_ps = inp.charge.source_probabilities
    if len(src_ps) > 1:
        rows.append(
            _row("Charge (P3)", "P3a", "Source A", src_ps[0], "source_a")
        )
        rows.append(
            _row("Charge (P3)", "P3a", "Source B", src_ps[1], "source_b")
        )
        p_src = combine_probabilities(src_ps, inp.charge.source_combination)
        rows.append(
            {
                "group": "Charge (P3)",
                "element": "P3a",
                "label": "Combined source",
                "p": p_src,
                "comment": _comment("source_combined"),
                "note": f"OR combination ({inp.charge.source_combination})",
            }
        )
    elif src_ps:
        rows.append(
            _row("Charge (P3)", "P3a", "Mature source", src_ps[0], "source_a")
        )
        p_src = src_ps[0]
    else:
        p_src = 0.0

    rows.append(
        _row(
            "Charge (P3)",
            "P3b",
            "Migration & timing",
            inp.charge.migration,
            "migration",
        )
    )
    p_charge = p_src * inp.charge.migration
    rows.append(
        {
            "group": "Charge (P3)",
            "element": "P3",
            "label": "Combined charge",
            "p": p_charge,
            "comment": "",
            "note": "P3a × P3b",
        }
    )

    rows.append(
        _row(
            "Retention (P4)",
            "P4",
            "Retention after accumulation",
            inp.retention,
            "retention",
        )
    )

    return rows


def legacy_chance_to_ccop(
    chance_categories: Dict[str, List[float]],
) -> Dict[str, Any]:
    """
    Map legacy MMRA 5-category chance to CCOP structure for migration/import.
    """
    def _cat(name: str, default: float = 0.7) -> float:
        vals = chance_categories.get(name) or []
        populated = [v for v in vals if v is not None]
        return min(populated) if populated else default

    res_vals = chance_categories.get("reservoir") or [0.7]
    seal_vals = chance_categories.get("containment") or [0.7]

    return {
        "reservoir": {
            "facies_presence": res_vals[0] if len(res_vals) > 0 else 0.7,
            "effectiveness": res_vals[1] if len(res_vals) > 1 else res_vals[0],
        },
        "trap": {
            "structure": _cat("closure"),
            "seal_top": seal_vals[0] if len(seal_vals) > 0 else _cat("containment"),
            "seal_lateral": seal_vals[1] if len(seal_vals) > 1 else None,
        },
        "charge": {
            "sources": [_cat("source")],
            "source_combination": "or",
            "migration": _cat("timing_migration"),
        },
        "retention": 1.0,
    }


def calculate_pg_ccop_or_legacy(
    chance_categories: Dict[str, List[float]],
    ccop_risk: Optional[Dict[str, Any]],
    unrisked_trimmed_mean: float,
    resource_unit: str = "MMBOE",
) -> PgRiskedResult:
    """Use CCOP block when present; otherwise legacy category product."""
    if ccop_risk:
        result = calculate_ccop_pg(ccop_risk)
        pg = result.pg
        category_chances = result.factor_probabilities
    else:
        from .chance import calculate_pg_risked_mean as _legacy

        return _legacy(chance_categories, unrisked_trimmed_mean, resource_unit)

    pg_risked_mean = unrisked_trimmed_mean * pg
    risk_review = build_ccop_risk_review(ccop_risk) if ccop_risk else None
    return PgRiskedResult(
        pg=pg,
        category_chances=category_chances,
        unrisked_trimmed_mean=unrisked_trimmed_mean,
        pg_risked_mean=pg_risked_mean,
        resource_unit=resource_unit,
        risk_review=risk_review,
    )
