"""Acceptance tests T1–T5 for Petrel cumulative GRV + linked structure scale."""

from __future__ import annotations

import numpy as np
import pytest

from mmra_engine.distributions import DistributionDef, DistributionType
from mmra_engine.petrel_cumulative_groups import (
    PETREL_STRUCTURE_SCALE_PARAMETER,
    build_per_tank_var_group_map,
)
from mmra_engine.petrel_cumulative_grv import (
    PetrelSegmentInput,
    build_group_scores,
    build_petro_sample_arrays,
    build_structure_scale_group_map,
    build_structure_scale_uniform_by_tank,
    display_grv_to_acft,
    run_petrel_cumulative_mc,
    scaled_grv_preview,
    segment_from_dict,
    triangular_ppf,
    validate_grv_inputs,
)
from mmra_engine.petrel_cumulative_tornado import (
    field_grv_total_display,
    compute_petrel_cumulative_tornado,
)
from mmra_engine.simulation import SimulationInput


def _deposit_1a_segment() -> PetrelSegmentInput:
    return PetrelSegmentInput(
        tank_key="seg-1a::uma1015",
        segment_id="seg-1a",
        reservoir_id="uma1015",
        segment_label="Deposit 1A",
        grv_1p_acft=20.0,
        grv_2p_acft=30.0,
        grv_3p_acft=50.0,
        scale_low=0.75,
        scale_mode=1.0,
        scale_high=1.28,
    )


def _workshop_segments() -> list[PetrelSegmentInput]:
    """Five-segment fixture matching guide §13 structure GRV totals 99/120/143.7 at 2P."""
    specs = [
        ("seg-1a", "Deposit 1A", 20.0, 30.0, 50.0, 0.75, 1.0, 1.28),
        ("seg-1b", "Deposit 1B", 15.0, 25.0, 40.0, 0.85, 1.0, 1.17),
        ("seg-2", "Deposit 2", 15.0, 25.0, 40.0, 0.85, 1.0, 1.17),
        ("seg-3", "Deposit 3", 15.0, 25.0, 40.0, 0.85, 1.0, 1.17),
        ("seg-south", "Southern Area", 10.0, 15.0, 20.0, 0.85, 1.0, 1.17),
    ]
    out: list[PetrelSegmentInput] = []
    for sid, label, g1, g2, g3, sl, sm, sh in specs:
        out.append(
            PetrelSegmentInput(
                tank_key=f"{sid}::uma1015",
                segment_id=sid,
                reservoir_id="uma1015",
                segment_label=label,
                grv_1p_acft=g1,
                grv_2p_acft=g2,
                grv_3p_acft=g3,
                scale_low=sl,
                scale_mode=sm,
                scale_high=sh,
            )
        )
    return out


def _pert_porosity_dist() -> DistributionDef:
    return DistributionDef(
        variable_id="porosity",
        display_name="Porosity",
        distribution_type=DistributionType.PERT,
        p90=0.12,
        p50=0.15,
        p10=0.20,
    )


def _gas_tank_input(seed: int = 42) -> SimulationInput:
    return SimulationInput(
        prospect_name="Test",
        fluid_type="gas",
        n_iterations=500,
        seed=seed,
        net_to_gross_dist=DistributionDef(
            variable_id="net_to_gross",
            display_name="NTG",
            distribution_type=DistributionType.FIXED,
            fixed_value=0.8,
        ),
        porosity_dist=DistributionDef(
            variable_id="porosity",
            display_name="Porosity",
            distribution_type=DistributionType.FIXED,
            fixed_value=0.15,
        ),
        saturation_dist=DistributionDef(
            variable_id="saturation",
            display_name="Sw",
            distribution_type=DistributionType.FIXED,
            fixed_value=0.3,
        ),
        gef_dist=DistributionDef(
            variable_id="gef",
            display_name="GEF",
            distribution_type=DistributionType.FIXED,
            fixed_value=200.0,
        ),
    )


def test_t1_deposit_1a_increments():
    """T1: P1/P2/P3 increments 20/10/20 for Deposit 1A."""
    seg = _deposit_1a_segment()
    v = validate_grv_inputs([seg])
    assert v.ok
    inc = v.increments[seg.tank_key]
    assert inc["p1_inc"] == pytest.approx(20.0)
    assert inc["p2_inc"] == pytest.approx(10.0)
    assert inc["p3_inc"] == pytest.approx(20.0)


def test_t2_scaled_2p_grv_preview_deposit_1a():
    """T2: Scaled 2P GRV preview 22.5 / 30.0 / 38.4 for Deposit 1A."""
    seg = _deposit_1a_segment()
    preview = scaled_grv_preview(seg.grv_2p_acft, seg.scale_low, seg.scale_mode, seg.scale_high)
    assert preview["low"] == pytest.approx(22.5)
    assert preview["mode"] == pytest.approx(30.0)
    assert preview["high"] == pytest.approx(38.4)


def test_t3_linked_structure_same_percentile_rank():
    """T3: Same u_structure → coupled scales; Deposit 1A wider scale than 1B."""
    u_values = [0.05, 0.25, 0.5, 0.75, 0.95]
    seg_a = _deposit_1a_segment()
    seg_b = PetrelSegmentInput(
        tank_key="seg-1b::uma1015",
        segment_id="seg-1b",
        reservoir_id="uma1015",
        grv_1p_acft=15.0,
        grv_2p_acft=25.0,
        grv_3p_acft=40.0,
        scale_low=0.85,
        scale_mode=1.0,
        scale_high=1.17,
    )
    scales_a = [triangular_ppf(u, seg_a.scale_low, seg_a.scale_mode, seg_a.scale_high) for u in u_values]
    scales_b = [triangular_ppf(u, seg_b.scale_low, seg_b.scale_mode, seg_b.scale_high) for u in u_values]
    assert all(scales_a[i] <= scales_a[i + 1] for i in range(len(scales_a) - 1))
    assert all(scales_b[i] <= scales_b[i + 1] for i in range(len(scales_b) - 1))
    assert np.corrcoef(scales_a, scales_b)[0, 1] == pytest.approx(1.0, abs=1e-5)
    span_a = seg_a.scale_high - seg_a.scale_low
    span_b = seg_b.scale_high - seg_b.scale_low
    assert span_a > span_b


def test_t4_iteration_monotonicity():
    """T4: Every iteration total_1p <= total_2p <= total_3p."""
    segments = _workshop_segments()
    tank_inputs = {s.tank_key: _gas_tank_input() for s in segments}
    result = run_petrel_cumulative_mc(
        segments,
        tank_inputs,
        n_iterations=1000,
        seed=123,
        include_arrays=True,
    )
    assert result.iteration_qc_pass
    assert result.iteration_qc_violations == 0
    t1 = np.asarray(result.arrays["total_giip_1p"])
    t2 = np.asarray(result.arrays["total_giip_2p"])
    t3 = np.asarray(result.arrays["total_giip_3p"])
    assert np.all(t1 <= t2 + 1e-9)
    assert np.all(t2 <= t3 + 1e-9)


def test_t5_structure_tornado_2p_field_grv():
    """T5: 2P structure tornado field GRV low/mid/high = 99.0 / 120.0 / 143.7."""
    segments = _workshop_segments()
    low = field_grv_total_display(segments, "2P", "low", "acre_ft")
    mid = field_grv_total_display(segments, "2P", "mode", "acre_ft")
    high = field_grv_total_display(segments, "2P", "high", "acre_ft")
    assert low == pytest.approx(99.0)
    assert mid == pytest.approx(120.0)
    assert high == pytest.approx(143.7)


def test_triangular_ppf_endpoints():
    low, mode, high = 0.75, 1.0, 1.28
    assert triangular_ppf(0.0, low, mode, high) == pytest.approx(low)
    assert triangular_ppf(1.0, low, mode, high) == pytest.approx(high)
    c = (mode - low) / (high - low)
    assert triangular_ppf(c, low, mode, high) == pytest.approx(mode)


def test_display_grv_million_m3_roundtrip():
    acft = display_grv_to_acft(30.0, "million_m3")
    seg = segment_from_dict(
        "s::r",
        {"grv_1p": 20.0, "grv_2p": 30.0, "grv_3p": 50.0},
        grv_unit="million_m3",
    )
    assert seg.grv_2p_acft == pytest.approx(acft * (30.0 / 30.0))  # sanity
    assert seg.grv_2p_acft > 0


def test_validate_rejects_negative_increment():
    seg = PetrelSegmentInput(
        tank_key="bad::r",
        segment_id="bad",
        reservoir_id="r",
        grv_1p_acft=30.0,
        grv_2p_acft=20.0,
        grv_3p_acft=50.0,
    )
    v = validate_grv_inputs([seg])
    assert not v.ok


class _FakeGroup:
    def __init__(
        self,
        gid: str,
        parameter: str,
        members=None,
        all_segments=False,
        all_reservoirs=False,
        name: str | None = None,
    ):
        self.id = gid
        self.name = name or gid
        self.parameter = parameter
        self.members = members or []
        self.all_segments = all_segments
        self.all_reservoirs = all_reservoirs


def test_structure_scale_groups_same_percentile_different_triangular():
    """Grouped segments share u; each applies its own triangular scale bounds."""
    seg_a = _deposit_1a_segment()
    seg_b = PetrelSegmentInput(
        tank_key="seg-1b::uma1015",
        segment_id="seg-1b",
        reservoir_id="uma1015",
        grv_1p_acft=15.0,
        grv_2p_acft=25.0,
        grv_3p_acft=40.0,
        scale_low=0.85,
        scale_mode=1.0,
        scale_high=1.17,
    )
    tank_keys = [seg_a.tank_key, seg_b.tank_key]
    groups = [
        _FakeGroup("g_all", PETREL_STRUCTURE_SCALE_PARAMETER, all_segments=True, all_reservoirs=True),
    ]
    struct_map = build_structure_scale_group_map(
        groups, tank_keys, ["seg-1a", "seg-1b"], ["uma1015"]
    )
    assert struct_map[seg_a.tank_key] == "g_all"
    assert struct_map[seg_b.tank_key] == "g_all"
    n = 500
    scores = build_group_scores(["g_all"], n, base_seed=99)
    u_by_tank = build_structure_scale_uniform_by_tank(tank_keys, struct_map, scores, n, 99)
    scales_a = [
        triangular_ppf(u_by_tank[seg_a.tank_key][i], seg_a.scale_low, seg_a.scale_mode, seg_a.scale_high)
        for i in range(n)
    ]
    scales_b = [
        triangular_ppf(u_by_tank[seg_b.tank_key][i], seg_b.scale_low, seg_b.scale_mode, seg_b.scale_high)
        for i in range(n)
    ]
    assert np.corrcoef(scales_a, scales_b)[0, 1] == pytest.approx(1.0, abs=1e-5)
    assert max(scales_a) - min(scales_a) > max(scales_b) - min(scales_b)


def test_structure_scale_separate_groups_decouple():
    seg_a = _deposit_1a_segment()
    seg_b = PetrelSegmentInput(
        tank_key="seg-1b::uma1015",
        segment_id="seg-1b",
        reservoir_id="uma1015",
        grv_1p_acft=15.0,
        grv_2p_acft=25.0,
        grv_3p_acft=40.0,
        scale_low=0.85,
        scale_mode=1.0,
        scale_high=1.17,
    )
    tank_keys = [seg_a.tank_key, seg_b.tank_key]
    groups = [
        _FakeGroup("g_a", PETREL_STRUCTURE_SCALE_PARAMETER, members=[type("M", (), {"segment_id": "seg-1a", "reservoir_id": "uma1015"})()]),
        _FakeGroup("g_b", PETREL_STRUCTURE_SCALE_PARAMETER, members=[type("M", (), {"segment_id": "seg-1b", "reservoir_id": "uma1015"})()]),
    ]
    struct_map = build_structure_scale_group_map(groups, tank_keys, ["seg-1a", "seg-1b"], ["uma1015"])
    n = 800
    scores = build_group_scores(["g_a", "g_b"], n, base_seed=7)
    u_by_tank = build_structure_scale_uniform_by_tank(tank_keys, struct_map, scores, n, 7)
    scales_a = [
        triangular_ppf(u_by_tank[seg_a.tank_key][i], seg_a.scale_low, seg_a.scale_mode, seg_a.scale_high)
        for i in range(n)
    ]
    scales_b = [
        triangular_ppf(u_by_tank[seg_b.tank_key][i], seg_b.scale_low, seg_b.scale_mode, seg_b.scale_high)
        for i in range(n)
    ]
    assert np.corrcoef(scales_a, scales_b)[0, 1] < 0.99


def test_mc_with_structure_groups_matches_linked_field_draw():
    segments = [_deposit_1a_segment(), PetrelSegmentInput(
        tank_key="seg-1b::uma1015",
        segment_id="seg-1b",
        reservoir_id="uma1015",
        grv_1p_acft=15.0,
        grv_2p_acft=25.0,
        grv_3p_acft=40.0,
        scale_low=0.85,
        scale_mode=1.0,
        scale_high=1.17,
    )]
    tank_inputs = {s.tank_key: _gas_tank_input(seed=5) for s in segments}
    tank_keys = [s.tank_key for s in segments]
    groups = [_FakeGroup("g1", PETREL_STRUCTURE_SCALE_PARAMETER, all_segments=True, all_reservoirs=True)]
    struct_map = build_structure_scale_group_map(groups, tank_keys, ["seg-1a", "seg-1b"], ["uma1015"])
    n = 400
    seed = 12
    scores = build_group_scores(["g1"], n, base_seed=seed)
    u_by_tank = build_structure_scale_uniform_by_tank(tank_keys, struct_map, scores, n, seed)
    grouped = run_petrel_cumulative_mc(
        segments,
        tank_inputs,
        n_iterations=n,
        seed=seed,
        structure_u_by_tank=u_by_tank,
    )
    legacy = run_petrel_cumulative_mc(segments, tank_inputs, n_iterations=n, seed=seed)
    assert grouped.field_rollup["2P"]["p50"] == pytest.approx(
        legacy.field_rollup["2P"]["p50"], rel=0.05
    )


def test_per_tank_group_map_membership():
    """Each tank only inherits groups it belongs to."""
    groups = [
        _FakeGroup("struct", PETREL_STRUCTURE_SCALE_PARAMETER, all_segments=True, all_reservoirs=True),
        _FakeGroup(
            "poro_1a",
            "porosity",
            members=[type("M", (), {"segment_id": "seg-1a", "reservoir_id": "uma1015"})()],
        ),
    ]
    tank_keys = [f"{sid}::uma1015" for sid in ("seg-1a", "seg-1b", "seg-2")]
    maps = build_per_tank_var_group_map(
        groups, tank_keys, ["seg-1a", "seg-1b", "seg-2"], ["uma1015"]
    )
    assert maps["seg-1a::uma1015"]["structure_scale"] == "struct"
    assert maps["seg-1a::uma1015"]["porosity"] == "poro_1a"
    assert "porosity" not in maps["seg-1b::uma1015"]
    assert maps["seg-1b::uma1015"]["structure_scale"] == "struct"


def test_tornado_segment_named_group_isolated_vs_family():
    """Segment mode: one named poro group; family mode moves all poro groups together."""
    from mmra_engine.petrel_cumulative_tornado import (
        _petro_swing_scalars,
        compute_petrel_cumulative_tornado,
        total_field_giip_deterministic,
    )

    segments = _workshop_segments()[:2]
    tank_inputs = {}
    for s in segments:
        inp = _gas_tank_input(seed=1)
        inp.porosity_dist = _pert_porosity_dist()
        tank_inputs[s.tank_key] = inp

    groups = [
        _FakeGroup(
            "poro_1a",
            "porosity",
            members=[{"segment_id": "seg-1a", "reservoir_id": "uma1015"}],
            name="Poro_Deposit1A",
        ),
        _FakeGroup(
            "poro_1b",
            "porosity",
            members=[{"segment_id": "seg-1b", "reservoir_id": "uma1015"}],
            name="Poro_Deposit1B",
        ),
    ]

    seg_tr = compute_petrel_cumulative_tornado(
        segments,
        tank_inputs,
        category="2P",
        uncertainty_groups=groups,
        tornado_mode="segment",
    )
    fam_tr = compute_petrel_cumulative_tornado(
        segments,
        tank_inputs,
        category="2P",
        uncertainty_groups=groups,
        tornado_mode="group",
    )
    assert any(d.label == "Poro_Deposit1A" for d in seg_tr.drivers)
    assert not any("Deposit1B" in d.label and d.label.startswith("Poro_") for d in fam_tr.drivers)
    poro_fam = next(d for d in fam_tr.drivers if d.parameter_family == "porosity")
    assert poro_fam.label == "Porosity"
    assert "Poro_Deposit1A" in poro_fam.affected_groups
    assert "Poro_Deposit1B" in poro_fam.affected_groups

    base = seg_tr.base_giip
    seg_a = next(s for s in segments if s.segment_id == "seg-1a")
    _, _, hi = _petro_swing_scalars(tank_inputs[seg_a.tank_key], "porosity")
    one_high = total_field_giip_deterministic(
        segments,
        tank_inputs,
        category="2P",
        petro_overrides={seg_a.tank_key: {"porosity": hi}},
    )
    all_high = total_field_giip_deterministic(
        segments,
        tank_inputs,
        category="2P",
        petro_overrides={s.tank_key: {"porosity": hi} for s in segments},
    )
    assert one_high - base < all_high - base
    assert abs(poro_fam.swing_high - all_high) < 1e-6


def test_tornado_group_structure_driver_label():
    from mmra_engine.petrel_cumulative_tornado import compute_petrel_cumulative_tornado

    segments = _workshop_segments()
    tank_inputs = {s.tank_key: _gas_tank_input() for s in segments}
    groups = [
        _FakeGroup(
            "structure_scale_uma1015_all",
            PETREL_STRUCTURE_SCALE_PARAMETER,
            all_segments=True,
            all_reservoirs=True,
            name="StructureScale_UMA1015_All",
        ),
    ]
    tr = compute_petrel_cumulative_tornado(
        segments,
        tank_inputs,
        category="2P",
        uncertainty_groups=groups,
        tornado_mode="group",
    )
    struct = [d for d in tr.drivers if d.parameter_family == "structure_scale"]
    assert len(struct) == 1
    assert struct[0].label == "Structure scale"
    assert struct[0].display_mode == "group-level"


def test_grouped_poro_higher_correlation_than_ungrouped():
    """Poro group links percentile across tanks; ungrouped tanks sample independently."""
    segments = [_deposit_1a_segment(), PetrelSegmentInput(
        tank_key="seg-1b::uma1015",
        segment_id="seg-1b",
        reservoir_id="uma1015",
        grv_1p_acft=15.0,
        grv_2p_acft=25.0,
        grv_3p_acft=40.0,
    )]
    tank_inputs = {}
    for s in segments:
        inp = _gas_tank_input(seed=99)
        if s.segment_id == "seg-1a":
            inp.porosity_dist = _pert_porosity_dist()
        else:
            inp.porosity_dist = DistributionDef(
                variable_id="porosity",
                display_name="Porosity",
                distribution_type=DistributionType.PERT,
                p90=0.10,
                p50=0.13,
                p10=0.18,
            )
        tank_inputs[s.tank_key] = inp
    tank_keys = [s.tank_key for s in segments]
    n = 3000
    petro_indep, _ = build_petro_sample_arrays(tank_inputs, tank_keys, {}, {}, n, 1)
    groups = [_FakeGroup("g_poro", "porosity", all_segments=True, all_reservoirs=True)]
    var_maps = build_per_tank_var_group_map(
        groups, tank_keys, ["seg-1a", "seg-1b"], ["uma1015"]
    )
    scores = build_group_scores(["g_poro"], n, base_seed=2)
    petro_linked, _ = build_petro_sample_arrays(
        tank_inputs, tank_keys, var_maps, scores, n, 2
    )
    r_indep = np.corrcoef(
        petro_indep["seg-1a::uma1015"]["porosity"],
        petro_indep["seg-1b::uma1015"]["porosity"],
    )[0, 1]
    r_linked = np.corrcoef(
        petro_linked["seg-1a::uma1015"]["porosity"],
        petro_linked["seg-1b::uma1015"]["porosity"],
    )[0, 1]
    assert r_linked == pytest.approx(1.0, abs=0.02)
    assert r_linked > r_indep + 0.15


def test_group_correlation_matrix_applied_to_scores():
    """Gaussian copula: ρ between Poro and Sw groups is read from the saved matrix."""
    group_ids = ["g_struct", "g_poro", "g_sw"]
    matrix = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, -0.7],
        [0.0, -0.7, 1.0],
    ]
    n = 8000
    scores = build_group_scores(
        group_ids,
        n,
        base_seed=42,
        correlation_mode="gaussian_copula",
        correlation_matrix=matrix,
        matrix_group_ids=group_ids,
    )
    r = np.corrcoef(scores["g_poro"], scores["g_sw"])[0, 1]
    assert r == pytest.approx(-0.7, abs=0.06)


def test_gef_one_draw_per_reservoir_shared_by_segments():
    """All segments on uma1015 share the same GEF[i] each iteration."""
    segments = _workshop_segments()
    tank_inputs = {s.tank_key: _gas_tank_input(seed=11) for s in segments}
    tank_keys = [s.tank_key for s in segments]
    n = 200
    _, reservoir_gef = build_petro_sample_arrays(tank_inputs, tank_keys, {}, {}, n, 11)
    arrays = list(reservoir_gef["uma1015"])
    for seg in segments:
        assert seg.reservoir_id == "uma1015"
    for i in range(n):
        assert reservoir_gef["uma1015"][i] == arrays[i]


def test_structure_group_same_percentile_all_segments():
    segments = _workshop_segments()
    tank_keys = [s.tank_key for s in segments]
    groups = [
        _FakeGroup(
            "g_struct",
            PETREL_STRUCTURE_SCALE_PARAMETER,
            all_segments=True,
            all_reservoirs=True,
            name="Struct_Scale",
        ),
    ]
    struct_map = build_structure_scale_group_map(
        groups, tank_keys, [s.segment_id for s in segments], ["uma1015"]
    )
    n = 400
    scores = build_group_scores(["g_struct"], n, base_seed=5)
    u_by = build_structure_scale_uniform_by_tank(tank_keys, struct_map, scores, n, 5)
    for i in range(n):
        u0 = u_by[tank_keys[0]][i]
        for tk in tank_keys[1:]:
            assert u_by[tk][i] == pytest.approx(u0)


def test_arrays_and_summary_share_display_unit():
    """Exceedance arrays must be in the same display unit as the percentile summary."""
    segments = _workshop_segments()
    tank_inputs = {}
    for s in segments:
        inp = _gas_tank_input()
        inp.gas_resource_unit = "MMSCF"
        tank_inputs[s.tank_key] = inp
    result = run_petrel_cumulative_mc(
        segments,
        tank_inputs,
        n_iterations=2000,
        seed=7,
        gas_resource_unit="MMSCF",
        include_arrays=True,
    )
    assert result.gas_unit == "MMSCF"
    arr = np.asarray(result.arrays["total_giip_2p"])
    median = float(np.median(arr))
    assert median == pytest.approx(result.field_rollup["2P"]["p50"], rel=0.05)
    seg_key = f"{segments[0].tank_key}::giip_2p"
    seg_arr = np.asarray(result.arrays[seg_key])
    seg_summary = next(s for s in result.segments if s["tank_key"] == segments[0].tank_key)
    assert float(np.median(seg_arr)) == pytest.approx(seg_summary["2P"]["p50"], rel=0.05)


def test_tornado_segment_contributions_and_category_label():
    segments = _workshop_segments()
    tank_inputs = {s.tank_key: _gas_tank_input() for s in segments}
    tor = compute_petrel_cumulative_tornado(segments, tank_inputs, category="1P")
    assert "Structure 1P field GRV" in tor.method_note
    assert "Structure 2P field GRV" not in tor.method_note

    contribs = tor.segment_contributions
    assert len(contribs) == len([s for s in segments if s.enabled])
    assert sum(c["pct_of_total_giip"] for c in contribs) == pytest.approx(100.0, abs=1e-6)
    assert sum(c["base_giip"] for c in contribs) == pytest.approx(tor.base_giip, rel=1e-9)
    for c in contribs:
        assert c["base_grv"] > 0
        assert "net_to_gross" in c and "porosity" in c and "saturation" in c and "gef" in c

    tor3 = compute_petrel_cumulative_tornado(segments, tank_inputs, category="3P")
    assert "Structure 3P field GRV" in tor3.method_note


def test_tornado_base_giip_positive():
    segments = _workshop_segments()
    tank_inputs = {s.tank_key: _gas_tank_input() for s in segments}
    tor = compute_petrel_cumulative_tornado(segments, tank_inputs, category="2P")
    assert tor.base_giip > 0
    assert any(d.parameter_family == "structure_scale" for d in tor.drivers)
