"""Tests for NRV × HC Yield estimating method."""

import numpy as np
import pytest

from mmra_engine.nrv_crosscheck import cross_check_warnings
from mmra_engine.serialization import simulation_input_from_dict, simulation_input_to_dict
from mmra_engine.simulation import SimulationInput, run_simulation
from mmra_engine.module_preview import run_module_preview
from mmra_engine.validation import validate_module_scope, validate_simulation_input
from mmra_engine.validation_cases import make_pm3xd_h1ss10_input
from mmra_engine.correlation import correlatable_variables_for_input, spearman_rho
from mmra_engine.volumetrics import calculate_nrv_from_grv
from mmra_engine.distributions import DistributionDef, DistributionType


def _nrv_input_from_pm3xd() -> SimulationInput:
    inp = make_pm3xd_h1ss10_input()
    inp.estimating_method = "nrv_grv_yield"
    inp.nrv_entry_mode = "grv_fill_ntg"
    inp.grv_dist = DistributionDef(
        variable_id="grv",
        display_name="GRV",
        distribution_type=DistributionType.LOGNORMAL,
        unit="acre-ft",
        canonical_unit="acre-ft",
        p90=5000.0,
        p50=10000.0,
        p10=20000.0,
    )
    inp.grv_percent_fill_dist = DistributionDef(
        variable_id="grv_pf",
        display_name="Fill",
        distribution_type=DistributionType.FIXED,
        unit="fraction",
        canonical_unit="fraction",
        fixed_value=1.0,
    )
    inp.net_to_gross_dist = DistributionDef(
        variable_id="ntg",
        display_name="NTG",
        distribution_type=DistributionType.FIXED,
        unit="fraction",
        canonical_unit="fraction",
        fixed_value=0.8,
    )
    return inp


def test_calculate_nrv_from_grv_scalar():
    assert calculate_nrv_from_grv(1000.0, 0.5, 0.8) == pytest.approx(400.0)


def test_nrv_module_preview():
    inp = _nrv_input_from_pm3xd()
    report = validate_module_scope(inp, "nrv")
    assert not report.has_errors

    out = run_module_preview(inp, "nrv")
    assert out["scope"] == "nrv"
    nrv = np.array(out["arrays"]["nrv_acft"])
    assert len(nrv) == inp.n_iterations
    assert np.all(nrv > 0)


def test_nrv_direct_multiplier_scales_nrv():
    inp = _nrv_input_from_pm3xd()
    inp.nrv_entry_mode = "direct"
    inp.nrv_direct_dist = DistributionDef(
        variable_id="nrv",
        display_name="NRV",
        distribution_type=DistributionType.FIXED,
        unit="acre-ft",
        canonical_unit="acre-ft",
        fixed_value=1000.0,
    )
    inp.nrv_direct_multiplier_dist = DistributionDef(
        variable_id="nrv_mult",
        display_name="NRV multiply factor",
        distribution_type=DistributionType.FIXED,
        unit="fraction",
        canonical_unit="fraction",
        fixed_value=1.0,
    )
    inp.seed = 99
    inp.n_iterations = 1000
    base = run_simulation(inp)
    inp.nrv_direct_multiplier_dist = DistributionDef(
        variable_id="nrv_mult",
        display_name="NRV multiply factor",
        distribution_type=DistributionType.FIXED,
        unit="fraction",
        canonical_unit="fraction",
        fixed_value=2.0,
    )
    scaled = run_simulation(inp)
    assert np.mean(scaled.arrays["nrv_acft"]) == pytest.approx(
        2.0 * np.mean(base.arrays["nrv_acft"]),
    )


def test_nrv_full_simulation():
    inp = _nrv_input_from_pm3xd()
    report = validate_simulation_input(inp)
    assert report.can_run_simulation

    result = run_simulation(inp)
    assert result.n_iterations == inp.n_iterations
    assert "nrv_acft" in result.arrays
    assert result.total_mmboe is not None


def test_cross_check_warnings_thin():
    rng = np.random.default_rng(1)
    nrv = rng.uniform(900, 1100, 1000)
    area = rng.uniform(400, 600, 1000)  # implied NP often < 5 ft at P90
    warns, _ = cross_check_warnings(nrv, area, min_flow_ft=5.0)
    assert any("too thin" in w for w in warns)


def test_nrv_serialization_roundtrip():
    inp = _nrv_input_from_pm3xd()
    data = simulation_input_to_dict(inp)
    assert data["estimating_method"] == "nrv_grv_yield"
    restored = simulation_input_from_dict(data)
    assert restored.estimating_method == "nrv_grv_yield"
    assert restored.grv_dist is not None


def test_nrv_correlation_matrix_variables():
    inp = _nrv_input_from_pm3xd()
    ids = correlatable_variables_for_input(
        inp.fluid_type,
        estimating_method=inp.estimating_method,
        nrv_entry_mode=inp.nrv_entry_mode,
    )
    assert "grv" in ids
    assert "net_to_gross" in ids
    assert "area" not in ids
    assert "net_pay" not in ids
    data = simulation_input_to_dict(inp)
    matrix_vars = data["correlation_matrix"]["variables"]
    assert "grv" in matrix_vars
    assert "area" not in matrix_vars


def test_grv_ntg_correlation_sampling():
    inp = _nrv_input_from_pm3xd()
    inp.net_to_gross_dist = DistributionDef(
        variable_id="ntg",
        display_name="NTG",
        distribution_type=DistributionType.LOGNORMAL,
        unit="fraction",
        canonical_unit="fraction",
        p90=0.55,
        p50=0.75,
        p10=0.92,
    )
    inp.grv_ntg_correlation = 0.75
    inp.seed = 99
    result = run_simulation(inp)
    grv = result.arrays["grv_acft"]
    ntg = result.arrays["net_to_gross"]
    rho = spearman_rho(grv, ntg)
    assert rho > 0.5


def test_area_method_still_pm3xd():
    inp = make_pm3xd_h1ss10_input()
    assert getattr(inp, "estimating_method", "area_net_pay_yield") in (
        "area_net_pay_yield",
        None,
    )
    result = run_simulation(inp)
    assert result.total_mmboe is not None
