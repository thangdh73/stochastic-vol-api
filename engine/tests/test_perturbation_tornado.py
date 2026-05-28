"""Tests for workbook-style perturbation tornado (OAT P10/P90)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mmra_engine.distributions import DistributionDef, DistributionType
from mmra_engine.perturbation_tornado import (
    compute_perturbation_tornado,
    distribution_repr_values,
    evaluate_volumetrics_scalar,
)
from mmra_engine.validation import validate_simulation_input
from mmra_engine.validation_cases import (
    OIL_FORMULA_EXPECTED,
    make_oil_formula_case,
    make_pm3xd_h1ss10_input,
)


def _fixed(vid: str, name: str, value: float, unit: str = "") -> DistributionDef:
    return DistributionDef(
        variable_id=vid,
        display_name=name,
        distribution_type=DistributionType.FIXED,
        fixed_value=value,
        unit=unit,
        canonical_unit=unit,
    )


class TestPerturbationTornado(unittest.TestCase):
    def test_repr_values_fixed(self):
        d = _fixed("a", "Area", 1000.0, "acres")
        r = distribution_repr_values(d)
        self.assertEqual(r["p50"], r["p90"])
        self.assertEqual(r["p50"], 1000.0)

    def test_oil_formula_base_stoiip(self):
        inp = make_oil_formula_case()
        result = compute_perturbation_tornado(inp, target_key="stoiip_mmbbl")
        self.assertAlmostEqual(
            result.base_value,
            OIL_FORMULA_EXPECTED.stoiip_mmbbl,
            delta=OIL_FORMULA_EXPECTED.stoiip_mmbbl * 1e-4,
        )
        for d in result.drivers:
            self.assertTrue(d.is_fixed)
            self.assertAlmostEqual(d.delta_low, 0.0, places=9)
            self.assertAlmostEqual(d.delta_high, 0.0, places=9)

    def test_area_perturbation_changes_stoiip(self):
        inp = make_oil_formula_case()
        inp.area_dist = DistributionDef(
            variable_id="area",
            display_name="Area",
            distribution_type=DistributionType.LOGNORMAL,
            unit="acres",
            canonical_unit="acres",
            p90=800.0,
            p50=1000.0,
            p10=1200.0,
        )
        result = compute_perturbation_tornado(inp, target_key="stoiip_mmbbl")
        area_drv = next(d for d in result.drivers if d.driver_id == "area")
        self.assertFalse(area_drv.is_fixed)
        self.assertLess(area_drv.delta_low, 0.0)
        self.assertGreater(area_drv.delta_high, 0.0)

    def test_recovery_off_no_oil_recovery_driver(self):
        inp = make_oil_formula_case()
        inp.apply_oil_recovery = False
        inp.oil_recovery_dist = None
        result = compute_perturbation_tornado(inp, target_key="stoiip_mmbbl")
        ids = {d.driver_id for d in result.drivers}
        self.assertNotIn("oil_recovery", ids)

    def test_apply_oil_recovery_false_proxy_matches_stoiip(self):
        inp = make_oil_formula_case()
        inp.apply_oil_recovery = False
        inp.oil_recovery_dist = None
        stoiip = evaluate_volumetrics_scalar(
            inp,
            {
                "area": 1000.0,
                "percent_fill": 1.0,
                "net_pay": 10.0,
                "geometric_correction": 1.0,
                "porosity": 0.2,
                "saturation": 0.7,
                "fvf": 1.4,
                "oil_recovery": 1.0,
                "gor": 600.0,
                "solution_gas_recovery": 1.0,
            },
        )["stoiip_mmbbl"]
        rec = evaluate_volumetrics_scalar(
            inp,
            {
                "area": 1000.0,
                "percent_fill": 1.0,
                "net_pay": 10.0,
                "geometric_correction": 1.0,
                "porosity": 0.2,
                "saturation": 0.7,
                "fvf": 1.4,
                "oil_recovery": 1.0,
                "gor": 600.0,
                "solution_gas_recovery": 1.0,
            },
        )
        rec_oil = rec["recoverable_oil_mmbbl"]
        self.assertAlmostEqual(stoiip, rec_oil, places=9)

    def test_nrv_grv_includes_porosity_and_saturation(self):
        """NRV method omits φ/Sw from correlatable list but volumetrics still need them."""
        inp = make_pm3xd_h1ss10_input()
        inp.estimating_method = "nrv_grv_yield"
        inp.nrv_entry_mode = "grv_fill_ntg"
        inp.grv_dist = DistributionDef(
            variable_id="grv",
            display_name="GRV",
            distribution_type=DistributionType.LOGNORMAL,
            unit="acre-ft",
            canonical_unit="acre-ft",
            p90=5_000.0,
            p50=10_000.0,
            p10=20_000.0,
        )
        inp.grv_percent_fill_dist = _fixed("grv_pf", "Percent fill", 1.0, "fraction")
        inp.net_to_gross_dist = DistributionDef(
            variable_id="ntg",
            display_name="Net/Gross",
            distribution_type=DistributionType.LOGNORMAL,
            unit="fraction",
            canonical_unit="fraction",
            p90=0.55,
            p50=0.75,
            p10=0.92,
            min_bound=0.0,
            max_bound=1.0,
        )
        report = validate_simulation_input(inp)
        self.assertFalse(report.has_errors)
        result = compute_perturbation_tornado(inp, target_key="stoiip_mmbbl")
        ids = {d.driver_id for d in result.drivers}
        self.assertIn("porosity", ids)
        self.assertIn("saturation", ids)
        self.assertGreater(result.base_value, 0.0)

    def test_validation_passes_with_toggles_off(self):
        inp = make_oil_formula_case()
        inp.apply_oil_recovery = False
        inp.include_solution_gas = False
        inp.oil_recovery_dist = None
        inp.gor_dist = None
        inp.solution_gas_recovery_dist = None
        report = validate_simulation_input(inp)
        self.assertFalse(report.has_errors)
        result = compute_perturbation_tornado(inp, target_key="total_mmboe")
        self.assertGreater(result.base_value, 0.0)


if __name__ == "__main__":
    unittest.main()
