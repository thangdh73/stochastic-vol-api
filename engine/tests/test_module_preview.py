"""Tests for scoped module preview simulations."""

import pytest

from mmra_engine.module_preview import run_module_preview
from mmra_engine.validation import validate_module_scope
from mmra_engine.validation_cases import make_pm3xd_h1ss10_input


def test_area_module_preview_pm3xd():
    inp = make_pm3xd_h1ss10_input()
    report = validate_module_scope(inp, "area")
    assert not report.has_errors

    out = run_module_preview(inp, "area")
    assert out["scope"] == "area"
    assert len(out["arrays"]["productive_area"]) == inp.n_iterations
    assert "productive_area" in out["summaries"]


def test_net_pay_module_preview_pm3xd():
    inp = make_pm3xd_h1ss10_input()
    out = run_module_preview(inp, "net_pay")
    assert out["scope"] == "net_pay"
    assert len(out["arrays"]["net_pay_ft"]) == inp.n_iterations


def test_chance_module_preview_pm3xd():
    inp = make_pm3xd_h1ss10_input()
    out = run_module_preview(inp, "chance")
    assert out["scope"] == "chance"
    assert out["metadata"]["pg"] == pytest.approx(0.12636, rel=1e-3)


def test_nrv_module_preview_grv_chain():
    from mmra_engine.distributions import DistributionDef, DistributionType
    inp = make_pm3xd_h1ss10_input()
    inp.estimating_method = "nrv_grv_yield"
    inp.grv_dist = DistributionDef(
        variable_id="grv",
        display_name="GRV",
        distribution_type=DistributionType.FIXED,
        unit="acre-ft",
        canonical_unit="acre-ft",
        fixed_value=8000.0,
    )
    inp.grv_percent_fill_dist = DistributionDef(
        variable_id="pf",
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
        fixed_value=1.0,
    )
    out = run_module_preview(inp, "nrv")
    assert out["summaries"]["nrv_acft"]["p50"] == pytest.approx(8000.0)


def test_area_preview_requires_area_dist():
    inp = make_pm3xd_h1ss10_input()
    inp.area_dist = None
    report = validate_module_scope(inp, "area")
    assert report.has_errors
    with pytest.raises(ValueError, match="area_dist"):
        run_module_preview(inp, "area")
