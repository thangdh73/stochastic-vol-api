"""
petrel_cumulative_groups.py – Uncertainty group membership for Petrel cumulative MC/tornado.

Groups control linked percentile / correlation only; stochastic distributions are always
sampled unless fixed (constant).
"""

from __future__ import annotations

from typing import Any, Dict, List, Mapping, Optional, Sequence, Set

from .distributions import DistributionDef, DistributionType

# Prospect dependency group parameter (not a tank distribution field).
PETREL_STRUCTURE_SCALE_PARAMETER = "petrel_structure_scale"

# UncertaintyParameterId (API) -> internal variable key
UNCERTAINTY_PARAM_TO_VAR: Dict[str, str] = {
    "net_to_gross": "net_to_gross",
    "porosity": "porosity",
    "saturation": "saturation",
    "gef": "gef",
    PETREL_STRUCTURE_SCALE_PARAMETER: "structure_scale",
}

VAR_TO_DIST_ATTR: Dict[str, str] = {
    "net_to_gross": "net_to_gross_dist",
    "porosity": "porosity_dist",
    "saturation": "saturation_dist",
    "gef": "gef_dist",
}


def is_stochastic_distribution(dist: Optional[DistributionDef]) -> bool:
    if dist is None:
        return False
    return dist.distribution_type != DistributionType.FIXED


def expand_uncertainty_group_tank_keys(
    group: Any,
    segment_ids: Sequence[str],
    reservoir_ids: Sequence[str],
) -> List[str]:
    """Expand group membership to segment::reservoir tank keys (mirrors frontend expandGroupTankKeys)."""

    def _tid(seg_id: str, res_id: str) -> str:
        return f"{seg_id}::{res_id}"

    def _member_id(m: Any, field: str) -> str:
        if hasattr(m, field):
            return str(getattr(m, field) or "")
        if isinstance(m, dict):
            return str(m.get(field, "") or "")
        return ""

    all_segments = bool(getattr(group, "all_segments", False))
    all_reservoirs = bool(getattr(group, "all_reservoirs", False))
    members = list(getattr(group, "members", []) or [])

    if all_segments and all_reservoirs:
        return [_tid(s, r) for s in segment_ids for r in reservoir_ids]
    if all_segments:
        res_ids = (
            list(reservoir_ids)
            if all_reservoirs
            else sorted(
                {
                    _member_id(m, "reservoir_id")
                    for m in members
                    if _member_id(m, "reservoir_id") not in ("", "*")
                }
            )
        )
        return [_tid(s, r) for s in segment_ids for r in res_ids]
    if all_reservoirs:
        seg_ids = sorted(
            {
                _member_id(m, "segment_id")
                for m in members
                if _member_id(m, "segment_id") not in ("", "*")
            }
        )
        return [_tid(s, r) for s in seg_ids for r in reservoir_ids]

    keys: List[str] = []
    for m in members:
        sid = _member_id(m, "segment_id")
        rid = _member_id(m, "reservoir_id")
        if sid and rid and sid != "*" and rid != "*":
            keys.append(_tid(sid, rid))
    return list(dict.fromkeys(keys))


def build_per_tank_var_group_map(
    uncertainty_groups: Sequence[Any],
    tank_keys: Sequence[str],
    segment_ids: Sequence[str],
    reservoir_ids: Sequence[str],
) -> Dict[str, Dict[str, str]]:
    """
    For each tank, map internal variable -> uncertainty group id when the tank is a member.
    """
    active = set(tank_keys)
    out: Dict[str, Dict[str, str]] = {tk: {} for tk in tank_keys}
    for group in uncertainty_groups:
        param = getattr(group, "parameter", None)
        var = UNCERTAINTY_PARAM_TO_VAR.get(param or "")
        if not var:
            continue
        gname = getattr(group, "name", None) or getattr(group, "id", "")
        member_keys = [
            tk
            for tk in expand_uncertainty_group_tank_keys(
                group, segment_ids, reservoir_ids
            )
            if tk in active
        ]
        for tk in member_keys:
            out[tk][var] = group.id
    return out


def tanks_for_group(
    group: Any,
    tank_keys: Sequence[str],
    segment_ids: Sequence[str],
    reservoir_ids: Sequence[str],
) -> List[str]:
    active = set(tank_keys)
    return [
        tk
        for tk in expand_uncertainty_group_tank_keys(group, segment_ids, reservoir_ids)
        if tk in active
    ]


def structure_scale_groups(
    uncertainty_groups: Sequence[Any],
) -> List[Any]:
    return [
        g
        for g in uncertainty_groups
        if getattr(g, "parameter", None) == PETREL_STRUCTURE_SCALE_PARAMETER
    ]


def petro_groups(
    uncertainty_groups: Sequence[Any],
) -> List[Any]:
    petro_params = {"net_to_gross", "porosity", "saturation", "gef"}
    return [g for g in uncertainty_groups if getattr(g, "parameter", None) in petro_params]


def group_label(group: Any) -> str:
    return (getattr(group, "name", None) or getattr(group, "id", "") or "group").strip()


def reservoirs_for_tank_keys(tank_keys: Sequence[str]) -> Set[str]:
    out: Set[str] = set()
    for tk in tank_keys:
        if "::" in tk:
            out.add(tk.split("::", 1)[1])
    return out
