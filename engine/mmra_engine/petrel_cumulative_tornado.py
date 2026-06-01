"""

petrel_cumulative_tornado.py – Deterministic OAT tornado for Petrel cumulative GRV mode.



Group mode (parameter-family): ~5 bars — Structure scale, Porosity, Net/Gross, Sw, GEF/Bg.

Each family OAT moves all uncertainty groups of that parameter together.



Segment mode (named groups): one bar per uncertainty group (e.g. Poro_Deposit1A).



OAT uses distribution_repr_values low/high (not MC P90/P10 labels).

"""



from __future__ import annotations



from dataclasses import dataclass, field

from typing import Any, Dict, List, Mapping, Optional, Sequence, Set, Tuple



from .distributions import DistributionDef, distribution_repr_values

from .petrel_cumulative_grv import (

    PetrelSegmentInput,

    acft_to_display_grv,

    compute_segment_giip_triple,

)

from .petrel_cumulative_groups import (

    UNCERTAINTY_PARAM_TO_VAR,

    VAR_TO_DIST_ATTR,

    group_label,

    is_stochastic_distribution,

    petro_groups,

    structure_scale_groups,

    tanks_for_group,

)

from .simulation import SimulationInput



CATEGORY_KEYS = ("1P", "2P", "3P")

CATEGORY_ATTR = {"1P": "grv_1p_acft", "2P": "grv_2p_acft", "3P": "grv_3p_acft"}



_PETRO_VARS = ("net_to_gross", "porosity", "saturation")



_PARAM_TO_FAMILY: Dict[str, str] = {

    "petrel_structure_scale": "structure_scale",

    "porosity": "porosity",

    "net_to_gross": "net_to_gross",

    "saturation": "saturation",

    "gef": "gef",

}



_FAMILY_LABELS: Dict[str, str] = {

    "structure_scale": "Structure scale",

    "porosity": "Porosity",

    "net_to_gross": "Net/Gross",

    "saturation": "Water saturation (Sw)",

    "gef": "GEF/Bg",

}



_FAMILY_ORDER = (

    "structure_scale",

    "porosity",

    "net_to_gross",

    "saturation",

    "gef",

)





@dataclass

class TornadoDriverRow:

    driver_id: str

    label: str

    swing_low: float

    swing_high: float

    delta_low: float

    delta_high: float

    is_fixed: bool = False

    parameter_family: str = ""

    affected_groups: List[str] = field(default_factory=list)

    affected_segments: List[str] = field(default_factory=list)

    display_mode: str = ""





@dataclass

class CategoryTornadoResult:

    category: str

    target_label: str

    target_unit: str

    base_giip: float

    base_field_grv: float

    drivers: List[TornadoDriverRow] = field(default_factory=list)

    tornado_mode: str = "group"

    segment_contributions: List[Dict[str, Any]] = field(default_factory=list)

    method_note: str = (

        "Deterministic one-at-a-time (OAT); low/high case swings use distribution "

        "representative low and high values."

    )





def _category_grv(seg: PetrelSegmentInput, category: str) -> float:

    return float(getattr(seg, CATEGORY_ATTR[category]))





def field_grv_total(

    segments: Sequence[PetrelSegmentInput],

    category: str,

    scale_key: str,

) -> float:

    total = 0.0

    for seg in segments:

        if not seg.enabled:

            continue

        grv = _category_grv(seg, category)

        scale = getattr(seg, f"scale_{scale_key}")

        total += grv * scale

    return total





def field_grv_total_display(

    segments: Sequence[PetrelSegmentInput],

    category: str,

    scale_key: str,

    display_unit: str,

) -> float:

    return acft_to_display_grv(field_grv_total(segments, category, scale_key), display_unit)





def _petro_mode_scalars(inp: SimulationInput) -> Dict[str, float]:

    out: Dict[str, float] = {}

    for var, attr in VAR_TO_DIST_ATTR.items():

        if var == "gef":

            continue

        dist: Optional[DistributionDef] = getattr(inp, attr, None)

        if dist is None:

            continue

        repr_vals = distribution_repr_values(dist)

        out[var] = float(repr_vals["p50"])

    return out





def _petro_swing_scalars(inp: SimulationInput, var: str) -> Tuple[float, float, float]:

    attr = VAR_TO_DIST_ATTR[var]

    dist = getattr(inp, attr, None)

    if dist is None:

        raise ValueError(f"Missing {var} distribution.")

    repr_vals = distribution_repr_values(dist)

    return float(repr_vals["p50"]), float(repr_vals["p90"]), float(repr_vals["p10"])





def _structure_scale_for_segments(

    segments: Sequence[PetrelSegmentInput],

    scale_key: str,

    member_keys: Optional[Set[str]] = None,

) -> Dict[str, float]:

    """Per-tank structure scale for OAT (mode/low/high); non-members stay at mode."""

    scales: Dict[str, float] = {}

    for seg in segments:

        if not seg.enabled:

            continue

        key = scale_key if member_keys is None or seg.tank_key in member_keys else "mode"

        scales[seg.tank_key] = float(getattr(seg, f"scale_{key}"))

    return scales





def _segment_ids_from_tank_keys(tank_keys: Sequence[str]) -> List[str]:

    return sorted({tk.split("::", 1)[0] for tk in tank_keys if "::" in tk})





def total_field_giip_deterministic(

    segments: Sequence[PetrelSegmentInput],

    tank_inputs: Mapping[str, SimulationInput],

    *,

    category: str,

    structure_scales: Optional[Mapping[str, float]] = None,

    petro_overrides: Optional[Mapping[str, Mapping[str, float]]] = None,

    reservoir_gef: Optional[Mapping[str, float]] = None,

) -> float:

    total = 0.0

    for seg in segments:

        if not seg.enabled:

            continue

        inp = tank_inputs[seg.tank_key]

        petro = dict(_petro_mode_scalars(inp))

        if petro_overrides and seg.tank_key in petro_overrides:

            petro.update(petro_overrides[seg.tank_key])

        sw = petro.get("saturation", 0.0)

        if reservoir_gef and seg.reservoir_id in reservoir_gef:

            gef = float(reservoir_gef[seg.reservoir_id])

        else:

            gdist = getattr(inp, "gef_dist", None)

            gef = float(distribution_repr_values(gdist)["p50"]) if gdist else 0.0

        scale = (structure_scales or {}).get(seg.tank_key, seg.scale_mode)

        g1, g2, g3 = compute_segment_giip_triple(

            seg.grv_1p_acft,

            seg.grv_2p_acft,

            seg.grv_3p_acft,

            scale,

            petro.get("net_to_gross", 0.0),

            petro.get("porosity", 0.0),

            sw,

            gef,

        )

        giip_map = {"1P": g1, "2P": g2, "3P": g3}

        total += giip_map[category]

    return total


def segment_contributions(
    segments: Sequence[PetrelSegmentInput],
    tank_inputs: Mapping[str, SimulationInput],
    *,
    category: str,
    grv_display_unit: str,
) -> List[Dict[str, Any]]:
    """Per-segment base GRV / GIIP (at mode scale and P50 petro) plus % of total GIIP."""
    rows: List[Dict[str, Any]] = []
    active = [s for s in segments if s.enabled]
    total_giip = total_field_giip_deterministic(active, tank_inputs, category=category)
    for seg in active:
        inp = tank_inputs[seg.tank_key]
        petro = dict(_petro_mode_scalars(inp))
        gdist = getattr(inp, "gef_dist", None)
        gef = float(distribution_repr_values(gdist)["p50"]) if gdist else 0.0
        base_grv_acft = _category_grv(seg, category) * float(seg.scale_mode)
        base_grv_display = acft_to_display_grv(base_grv_acft, grv_display_unit)
        g1, g2, g3 = compute_segment_giip_triple(
            seg.grv_1p_acft,
            seg.grv_2p_acft,
            seg.grv_3p_acft,
            float(seg.scale_mode),
            petro.get("net_to_gross", 0.0),
            petro.get("porosity", 0.0),
            petro.get("saturation", 0.0),
            gef,
        )
        seg_giip = {"1P": g1, "2P": g2, "3P": g3}[category]
        rows.append(
            {
                "segment_id": seg.segment_id,
                "segment_label": seg.segment_label or seg.segment_id,
                "reservoir_id": seg.reservoir_id,
                "base_grv": base_grv_display,
                "base_giip": seg_giip,
                "pct_of_total_giip": (seg_giip / total_giip * 100.0) if total_giip else 0.0,
                "net_to_gross": petro.get("net_to_gross", 0.0),
                "porosity": petro.get("porosity", 0.0),
                "saturation": petro.get("saturation", 0.0),
                "gef": gef,
            }
        )
    rows.sort(key=lambda r: r["base_giip"], reverse=True)
    return rows





def _petro_overrides_for_tanks_swing(

    tank_inputs: Mapping[str, SimulationInput],

    tank_keys: Sequence[str],

    var: str,

    side: str,

) -> Dict[str, Dict[str, float]]:

    """Per-tank low or high representative value for one petro variable."""

    out: Dict[str, Dict[str, float]] = {}

    for tk in tank_keys:

        if tk not in tank_inputs:

            continue

        dist = getattr(tank_inputs[tk], VAR_TO_DIST_ATTR[var], None)

        if not is_stochastic_distribution(dist):

            continue

        _, lo, hi = _petro_swing_scalars(tank_inputs[tk], var)

        out[tk] = {var: lo if side == "low" else hi}

    return out





def _any_stochastic_in_family(

    tank_inputs: Mapping[str, SimulationInput],

    tank_keys: Sequence[str],

    var: str,

) -> bool:

    attr = VAR_TO_DIST_ATTR[var]

    for tk in tank_keys:

        dist = getattr(tank_inputs.get(tk), attr, None)

        if is_stochastic_distribution(dist):

            return True

    return False





def _make_driver_row(

    *,

    driver_id: str,

    label: str,

    low_giip: float,

    high_giip: float,

    base_giip: float,

    parameter_family: str,

    affected_groups: List[str],

    affected_segments: List[str],

    display_mode: str,

    is_fixed: bool = False,

) -> TornadoDriverRow:

    return TornadoDriverRow(

        driver_id=driver_id,

        label=label,

        swing_low=low_giip,

        swing_high=high_giip,

        delta_low=low_giip - base_giip,

        delta_high=high_giip - base_giip,

        is_fixed=is_fixed,

        parameter_family=parameter_family,

        affected_groups=affected_groups,

        affected_segments=affected_segments,

        display_mode=display_mode,

    )





def _driver_family_structure(

    active: Sequence[PetrelSegmentInput],

    tank_inputs: Mapping[str, SimulationInput],

    category: str,

    base_giip: float,

    uncertainty_groups: Sequence[Any],

    tank_keys: Sequence[str],

    segment_ids: Sequence[str],

    reservoir_ids: Sequence[str],

    display_mode: str,

) -> Optional[TornadoDriverRow]:

    struct_groups = structure_scale_groups(uncertainty_groups)

    all_members: Set[str] = set()

    group_names: List[str] = []

    for group in struct_groups:

        members = tanks_for_group(group, tank_keys, segment_ids, reservoir_ids)

        if not members:

            continue

        all_members.update(members)

        group_names.append(group_label(group))



    if not all_members:

        member_keys = {s.tank_key for s in active}

        low_giip = total_field_giip_deterministic(

            active,

            tank_inputs,

            category=category,

            structure_scales=_structure_scale_for_segments(active, "low", member_keys),

        )

        high_giip = total_field_giip_deterministic(

            active,

            tank_inputs,

            category=category,

            structure_scales=_structure_scale_for_segments(active, "high", member_keys),

        )

        group_names = ["(all enabled segments)"]

        seg_ids = _segment_ids_from_tank_keys(list(member_keys))

    else:

        member_set = all_members

        low_giip = total_field_giip_deterministic(

            active,

            tank_inputs,

            category=category,

            structure_scales=_structure_scale_for_segments(active, "low", member_set),

        )

        high_giip = total_field_giip_deterministic(

            active,

            tank_inputs,

            category=category,

            structure_scales=_structure_scale_for_segments(active, "high", member_set),

        )

        seg_ids = _segment_ids_from_tank_keys(list(all_members))



    return _make_driver_row(

        driver_id="family::structure_scale",

        label=_FAMILY_LABELS["structure_scale"],

        low_giip=low_giip,

        high_giip=high_giip,

        base_giip=base_giip,

        parameter_family="structure_scale",

        affected_groups=group_names,

        affected_segments=seg_ids,

        display_mode=display_mode,

    )





def _driver_family_petro(

    var: str,

    active: Sequence[PetrelSegmentInput],

    tank_inputs: Mapping[str, SimulationInput],

    category: str,

    base_giip: float,

    uncertainty_groups: Sequence[Any],

    tank_keys: Sequence[str],

    segment_ids: Sequence[str],

    reservoir_ids: Sequence[str],

    display_mode: str,

) -> Optional[TornadoDriverRow]:

    family = _PARAM_TO_FAMILY.get(

        next(

            (p for p, v in UNCERTAINTY_PARAM_TO_VAR.items() if v == var),

            var,

        ),

        var,

    )

    if family not in _FAMILY_LABELS:

        family = var



    param_key = next((p for p, v in UNCERTAINTY_PARAM_TO_VAR.items() if v == var), var)

    group_names: List[str] = []

    all_members: List[str] = []

    for group in petro_groups(uncertainty_groups):

        if getattr(group, "parameter", "") != param_key:

            continue

        members = tanks_for_group(group, tank_keys, segment_ids, reservoir_ids)

        if not members:

            continue

        group_names.append(group_label(group))

        for tk in members:

            if tk not in all_members:

                all_members.append(tk)



    if not all_members:

        return None

    if not _any_stochastic_in_family(tank_inputs, all_members, var):

        return None



    low_ov = _petro_overrides_for_tanks_swing(tank_inputs, all_members, var, "low")

    high_ov = _petro_overrides_for_tanks_swing(tank_inputs, all_members, var, "high")

    if not low_ov:

        return None



    low_giip = total_field_giip_deterministic(

        active, tank_inputs, category=category, petro_overrides=low_ov

    )

    high_giip = total_field_giip_deterministic(

        active, tank_inputs, category=category, petro_overrides=high_ov

    )

    lo_vals = [v[var] for v in low_ov.values()]

    hi_vals = [v[var] for v in high_ov.values()]

    is_fixed = all(abs(a - b) < 1e-12 for a, b in zip(lo_vals, hi_vals))



    return _make_driver_row(

        driver_id=f"family::{var}",

        label=_FAMILY_LABELS.get(family, family),

        low_giip=low_giip,

        high_giip=high_giip,

        base_giip=base_giip,

        parameter_family=family,

        affected_groups=group_names,

        affected_segments=_segment_ids_from_tank_keys(all_members),

        display_mode=display_mode,

        is_fixed=is_fixed,

    )





def _driver_family_gef(

    active: Sequence[PetrelSegmentInput],

    tank_inputs: Mapping[str, SimulationInput],

    category: str,

    base_giip: float,

    uncertainty_groups: Sequence[Any],

    tank_keys: Sequence[str],

    segment_ids: Sequence[str],

    reservoir_ids: Sequence[str],

    display_mode: str,

) -> Optional[TornadoDriverRow]:

    group_names: List[str] = []

    low_gef: Dict[str, float] = {}

    high_gef: Dict[str, float] = {}

    res_touched: List[str] = []



    for group in petro_groups(uncertainty_groups):

        if getattr(group, "parameter", "") != "gef":

            continue

        members = tanks_for_group(group, tank_keys, segment_ids, reservoir_ids)

        if not members:

            continue

        group_names.append(group_label(group))

        for tk in members:

            res_id = tk.split("::", 1)[1]

            dist = getattr(tank_inputs[tk], "gef_dist", None)

            if not is_stochastic_distribution(dist):

                continue

            _, lo, hi = _petro_swing_scalars(tank_inputs[tk], "gef")

            low_gef[res_id] = lo

            high_gef[res_id] = hi

            if res_id not in res_touched:

                res_touched.append(res_id)



    if not low_gef:

        return None



    low_giip = total_field_giip_deterministic(

        active, tank_inputs, category=category, reservoir_gef=low_gef

    )

    high_giip = total_field_giip_deterministic(

        active, tank_inputs, category=category, reservoir_gef=high_gef

    )

    is_fixed = all(abs(low_gef[r] - high_gef[r]) < 1e-12 for r in res_touched)



    return _make_driver_row(

        driver_id="family::gef",

        label=_FAMILY_LABELS["gef"],

        low_giip=low_giip,

        high_giip=high_giip,

        base_giip=base_giip,

        parameter_family="gef",

        affected_groups=group_names,

        affected_segments=sorted(

            {

                seg.segment_label or seg.segment_id

                for seg in active

                if seg.reservoir_id in res_touched

            }

        ),

        display_mode=display_mode,

        is_fixed=is_fixed,

    )





def _drivers_family_mode(

    active: Sequence[PetrelSegmentInput],

    tank_inputs: Mapping[str, SimulationInput],

    category: str,

    base_giip: float,

    uncertainty_groups: Sequence[Any],

    tank_keys: Sequence[str],

    segment_ids: Sequence[str],

    reservoir_ids: Sequence[str],

) -> List[TornadoDriverRow]:

    """Parameter-family OAT: one bar per family (Structure, Poro, NTG, Sw, GEF)."""

    display_mode = "group-level"

    drivers: List[TornadoDriverRow] = []



    struct_row = _driver_family_structure(

        active,

        tank_inputs,

        category,

        base_giip,

        uncertainty_groups,

        tank_keys,

        segment_ids,

        reservoir_ids,

        display_mode,

    )

    if struct_row:

        drivers.append(struct_row)



    for var in _PETRO_VARS:

        row = _driver_family_petro(

            var,

            active,

            tank_inputs,

            category,

            base_giip,

            uncertainty_groups,

            tank_keys,

            segment_ids,

            reservoir_ids,

            display_mode,

        )

        if row:

            drivers.append(row)



    gef_row = _driver_family_gef(

        active,

        tank_inputs,

        category,

        base_giip,

        uncertainty_groups,

        tank_keys,

        segment_ids,

        reservoir_ids,

        display_mode,

    )

    if gef_row:

        drivers.append(gef_row)



    order = {f: i for i, f in enumerate(_FAMILY_ORDER)}

    drivers.sort(

        key=lambda d: (

            order.get(d.parameter_family, 99),

            -max(abs(d.delta_low), abs(d.delta_high)),

        ),

    )

    return drivers





def _driver_for_named_group(

    group: Any,

    active: Sequence[PetrelSegmentInput],

    tank_inputs: Mapping[str, SimulationInput],

    category: str,

    base_giip: float,

    tank_keys: Sequence[str],

    segment_ids: Sequence[str],

    reservoir_ids: Sequence[str],

    display_mode: str,

) -> Optional[TornadoDriverRow]:

    param = getattr(group, "parameter", "")

    var = UNCERTAINTY_PARAM_TO_VAR.get(param)

    if not var:

        return None



    members = tanks_for_group(group, tank_keys, segment_ids, reservoir_ids)

    if not members:

        return None



    family = _PARAM_TO_FAMILY.get(param, var)

    gname = group_label(group)

    seg_ids = _segment_ids_from_tank_keys(members)



    if var == "structure_scale":

        member_set = set(members)

        low_giip = total_field_giip_deterministic(

            active,

            tank_inputs,

            category=category,

            structure_scales=_structure_scale_for_segments(active, "low", member_set),

        )

        high_giip = total_field_giip_deterministic(

            active,

            tank_inputs,

            category=category,

            structure_scales=_structure_scale_for_segments(active, "high", member_set),

        )

        is_fixed = abs(low_giip - high_giip) < 1e-12

    elif var == "gef":

        res_ids = sorted({tk.split("::", 1)[1] for tk in members})

        ref_key = members[0]

        dist = getattr(tank_inputs[ref_key], "gef_dist", None)

        if not is_stochastic_distribution(dist):

            return None

        _, lo, hi = _petro_swing_scalars(tank_inputs[ref_key], "gef")

        low_gef = {rid: lo for rid in res_ids}

        high_gef = {rid: hi for rid in res_ids}

        low_giip = total_field_giip_deterministic(

            active, tank_inputs, category=category, reservoir_gef=low_gef

        )

        high_giip = total_field_giip_deterministic(

            active, tank_inputs, category=category, reservoir_gef=high_gef

        )

        is_fixed = abs(lo - hi) < 1e-12

    else:

        if not _any_stochastic_in_family(tank_inputs, members, var):

            return None

        low_ov = _petro_overrides_for_tanks_swing(tank_inputs, members, var, "low")

        high_ov = _petro_overrides_for_tanks_swing(tank_inputs, members, var, "high")

        if not low_ov:

            return None

        low_giip = total_field_giip_deterministic(

            active, tank_inputs, category=category, petro_overrides=low_ov

        )

        high_giip = total_field_giip_deterministic(

            active, tank_inputs, category=category, petro_overrides=high_ov

        )

        lo_vals = [v[var] for v in low_ov.values()]

        hi_vals = [v[var] for v in high_ov.values()]

        is_fixed = all(abs(a - b) < 1e-12 for a, b in zip(lo_vals, hi_vals))



    return _make_driver_row(

        driver_id=f"{var}::{group.id}",

        label=gname,

        low_giip=low_giip,

        high_giip=high_giip,

        base_giip=base_giip,

        parameter_family=family,

        affected_groups=[gname],

        affected_segments=seg_ids,

        display_mode=display_mode,

        is_fixed=is_fixed,

    )





def _drivers_named_group_mode(

    active: Sequence[PetrelSegmentInput],

    tank_inputs: Mapping[str, SimulationInput],

    category: str,

    base_giip: float,

    uncertainty_groups: Sequence[Any],

    tank_keys: Sequence[str],

    segment_ids: Sequence[str],

    reservoir_ids: Sequence[str],

) -> List[TornadoDriverRow]:

    """One OAT bar per named uncertainty group (e.g. Poro_Deposit1A)."""

    display_mode = "segment-level"

    drivers: List[TornadoDriverRow] = []



    for group in structure_scale_groups(uncertainty_groups):

        row = _driver_for_named_group(

            group,

            active,

            tank_inputs,

            category,

            base_giip,

            tank_keys,

            segment_ids,

            reservoir_ids,

            display_mode,

        )

        if row:

            drivers.append(row)



    if not structure_scale_groups(uncertainty_groups):

        member_keys = {s.tank_key for s in active}

        low_giip = total_field_giip_deterministic(

            active,

            tank_inputs,

            category=category,

            structure_scales=_structure_scale_for_segments(active, "low", member_keys),

        )

        high_giip = total_field_giip_deterministic(

            active,

            tank_inputs,

            category=category,

            structure_scales=_structure_scale_for_segments(active, "high", member_keys),

        )

        drivers.append(

            _make_driver_row(

                driver_id="structure::field",

                label="Structure scale (field)",

                low_giip=low_giip,

                high_giip=high_giip,

                base_giip=base_giip,

                parameter_family="structure_scale",

                affected_groups=["(all enabled segments)"],

                affected_segments=_segment_ids_from_tank_keys(list(member_keys)),

                display_mode=display_mode,

            )

        )



    for group in petro_groups(uncertainty_groups):

        row = _driver_for_named_group(

            group,

            active,

            tank_inputs,

            category,

            base_giip,

            tank_keys,

            segment_ids,

            reservoir_ids,

            display_mode,

        )

        if row:

            drivers.append(row)



    drivers.sort(key=lambda d: max(abs(d.delta_low), abs(d.delta_high)), reverse=True)

    return drivers





def compute_petrel_cumulative_tornado(

    segments: Sequence[PetrelSegmentInput],

    tank_inputs: Mapping[str, SimulationInput],

    *,

    category: str = "2P",

    grv_display_unit: str = "acre_ft",

    gas_unit: str = "BCF",

    uncertainty_groups: Optional[Sequence[Any]] = None,

    segment_ids: Optional[Sequence[str]] = None,

    reservoir_ids: Optional[Sequence[str]] = None,

    tornado_mode: str = "group",

) -> CategoryTornadoResult:

    if category not in CATEGORY_KEYS:

        raise ValueError(f"category must be one of {CATEGORY_KEYS}")



    active = [s for s in segments if s.enabled]

    if not active:

        raise ValueError("No enabled segments.")



    tank_keys = [s.tank_key for s in active]

    segment_ids = segment_ids or sorted({s.segment_id for s in active})

    reservoir_ids = reservoir_ids or sorted({s.reservoir_id for s in active})

    groups = list(uncertainty_groups or [])



    ref_inp = tank_inputs[active[0].tank_key]

    base_giip = total_field_giip_deterministic(active, tank_inputs, category=category)

    base_grv = field_grv_total_display(active, category, "mode", grv_display_unit)



    mode = (tornado_mode or "group").lower()

    if mode == "segment":

        drivers = _drivers_named_group_mode(

            active,

            tank_inputs,

            category,

            base_giip,

            groups,

            tank_keys,

            segment_ids,

            reservoir_ids,

        )

        mode_note = (

            "Segment-level: one bar per named uncertainty group; OAT affects group members only."

        )

    else:

        drivers = _drivers_family_mode(

            active,

            tank_inputs,

            category,

            base_giip,

            groups,

            tank_keys,

            segment_ids,

            reservoir_ids,

        )

        mode_note = (

            "Group-level: one bar per parameter family; OAT moves all groups of that family together."

        )



    drivers.sort(key=lambda d: max(abs(d.delta_low), abs(d.delta_high)), reverse=True)



    low_grv = field_grv_total_display(active, category, "low", grv_display_unit)

    high_grv = field_grv_total_display(active, category, "high", grv_display_unit)



    return CategoryTornadoResult(

        category=category,

        target_label=f"Field GIIP {category}",

        target_unit=gas_unit or getattr(ref_inp, "gas_resource_unit", "BCF") or "BCF",

        base_giip=base_giip,

        base_field_grv=base_grv,

        drivers=drivers,

        tornado_mode=mode,

        segment_contributions=segment_contributions(
            active, tank_inputs, category=category, grv_display_unit=grv_display_unit
        ),

        method_note=(

            f"{mode_note} Structure {category} field GRV (display): low={low_grv:.1f}, "

            f"mode={base_grv:.1f}, high={high_grv:.1f} [{grv_display_unit}]. "

            + CategoryTornadoResult.method_note

        ),

    )





def compute_all_category_tornados(

    segments: Sequence[PetrelSegmentInput],

    tank_inputs: Mapping[str, SimulationInput],

    **kwargs: Any,

) -> Dict[str, Any]:

    categories = kwargs.pop("categories", CATEGORY_KEYS)

    out: Dict[str, Any] = {}

    structure_grv: Dict[str, Dict[str, float]] = {}

    for cat in categories:

        tr = compute_petrel_cumulative_tornado(segments, tank_inputs, category=cat, **kwargs)

        structure_grv[cat] = {

            "low": field_grv_total_display(

                segments, cat, "low", kwargs.get("grv_display_unit", "acre_ft")

            ),

            "mode": field_grv_total_display(

                segments, cat, "mode", kwargs.get("grv_display_unit", "acre_ft")

            ),

            "high": field_grv_total_display(

                segments, cat, "high", kwargs.get("grv_display_unit", "acre_ft")

            ),

        }

        out[cat] = tornado_result_to_dict(tr)

    return {

        "categories": out,

        "structure_field_grv": structure_grv,

        "tornado_mode": kwargs.get("tornado_mode", "group"),

    }





def tornado_result_to_dict(result: CategoryTornadoResult) -> Dict[str, Any]:

    return {

        "category": result.category,

        "target_label": result.target_label,

        "target_unit": result.target_unit,

        "base_giip": result.base_giip,

        "base_field_grv": result.base_field_grv,

        "tornado_mode": result.tornado_mode,

        "segment_contributions": result.segment_contributions,

        "method_note": result.method_note,

        "drivers": [

            {

                "driver_id": d.driver_id,

                "label": d.label,

                "swing_low": d.swing_low,

                "swing_high": d.swing_high,

                "delta_low": d.delta_low,

                "delta_high": d.delta_high,

                "is_fixed": d.is_fixed,

                "parameter_family": d.parameter_family,

                "affected_groups": d.affected_groups,

                "affected_segments": d.affected_segments,

                "display_mode": d.display_mode,

            }

            for d in result.drivers

        ],

    }


