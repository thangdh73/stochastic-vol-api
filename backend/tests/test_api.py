"""FastAPI endpoint tests."""

import os
import sys
import unittest
import zipfile
from io import BytesIO

from fastapi.testclient import TestClient

# backend/app on path
_BACKEND_ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, _BACKEND_ROOT)

from app.main import app  # noqa: E402
from app.services.engine_adapter import get_pm3xd_input_body  # noqa: E402

client = TestClient(app)


class TestHealth(unittest.TestCase):
    def test_root_health(self):
        r = client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "ok")
        self.assertIn("engine_version", r.json())

    def test_api_health(self):
        r = client.get("/api/health")
        self.assertEqual(r.status_code, 200)


class TestPM3XDCase(unittest.TestCase):
    def test_pm3xd_case_loads(self):
        r = client.get("/api/validation-cases/pm3xd")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["prospect_name"], "PM3X-D H1ss10")
        self.assertEqual(data["schema_version"], "1")

    def test_validate_pm3xd_no_errors(self):
        body = get_pm3xd_input_body()
        r = client.post("/api/validate", json=body)
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["has_errors"])

    def test_simulate_pm3xd(self):
        body = get_pm3xd_input_body()
        r = client.post(
            "/api/simulate",
            json={"input": body, "options": {"include_arrays": False}},
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertAlmostEqual(data["result"]["pg_result"]["pg"], 0.12636, places=4)
        self.assertIn("input_hash", data)
        self.assertIn("total_mmboe", data["result"])

    def test_module_preview_area(self):
        body = get_pm3xd_input_body()
        r = client.post(
            "/api/simulate/preview",
            json={"input": body, "scope": "area"},
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["scope"], "area")
        self.assertIn("productive_area", data["arrays"])
        self.assertEqual(len(data["arrays"]["productive_area"]), body["n_iterations"])

    def test_module_preview_nrv(self):
        body = get_pm3xd_input_body()
        body["estimating_method"] = "nrv_grv_yield"
        body["grv_dist"] = {
            "variable_id": "grv",
            "display_name": "GRV",
            "distribution_type": "fixed",
            "unit": "acre-ft",
            "canonical_unit": "acre-ft",
            "fixed_value": 12000.0,
        }
        body["grv_percent_fill_dist"] = {
            "variable_id": "pf",
            "display_name": "Fill",
            "distribution_type": "fixed",
            "unit": "fraction",
            "canonical_unit": "fraction",
            "fixed_value": 1.0,
        }
        body["net_to_gross_dist"] = {
            "variable_id": "ntg",
            "display_name": "NTG",
            "distribution_type": "fixed",
            "unit": "fraction",
            "canonical_unit": "fraction",
            "fixed_value": 0.75,
        }
        r = client.post(
            "/api/simulate/preview",
            json={"input": body, "scope": "nrv"},
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["scope"], "nrv")
        self.assertEqual(len(data["arrays"]["nrv_acft"]), body["n_iterations"])

    def test_module_preview_chance(self):
        body = get_pm3xd_input_body()
        r = client.post(
            "/api/simulate/preview",
            json={"input": body, "scope": "chance"},
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertAlmostEqual(data["metadata"]["pg"], 0.12636, places=4)

    def test_module_preview_chance_ccop_risk_review(self):
        body = get_pm3xd_input_body()
        body["chance_categories"] = {}
        body["risk_model"] = "ccop_v1"
        body["include_chance"] = True
        body["ccop_risk"] = {
            "reservoir": {"facies_presence": 0.8, "effectiveness": 1.0},
            "trap": {"structure": 1.0, "seal_top": 1.0, "seal_lateral": 0.3},
            "charge": {"sources": [1.0], "source_combination": "or", "migration": 1.0},
            "retention": 1.0,
        }
        r = client.post(
            "/api/simulate/preview",
            json={"input": body, "scope": "chance"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        pg = data["summaries"]["pg"]
        self.assertAlmostEqual(pg["pg"], 0.24, places=4)
        self.assertGreater(len(pg.get("risk_review") or []), 0)

    def test_module_preview_nrv_accepts_bscm_mmscm_units(self):
        """Prospect Setup resource units MMscm / Bscm must pass API validation."""
        body = get_pm3xd_input_body()
        body["oil_resource_unit"] = "MMscm"
        body["gas_resource_unit"] = "Bscm"
        body["estimating_method"] = "nrv_grv_yield"
        body["grv_dist"] = {
            "variable_id": "grv",
            "display_name": "GRV",
            "distribution_type": "fixed",
            "unit": "acre-ft",
            "canonical_unit": "acre-ft",
            "fixed_value": 12000.0,
        }
        body["grv_percent_fill_dist"] = {
            "variable_id": "pf",
            "display_name": "Fill",
            "distribution_type": "fixed",
            "unit": "fraction",
            "canonical_unit": "fraction",
            "fixed_value": 1.0,
        }
        body["net_to_gross_dist"] = {
            "variable_id": "ntg",
            "display_name": "NTG",
            "distribution_type": "fixed",
            "unit": "fraction",
            "canonical_unit": "fraction",
            "fixed_value": 0.75,
        }
        r = client.post(
            "/api/simulate/preview",
            json={"input": body, "scope": "nrv"},
        )
        self.assertEqual(r.status_code, 200, r.text)

    def test_simulate_nrv_with_stale_area_correlations(self):
        """Switching to NRV must not 500 when old area/net_pay pairs remain saved."""
        body = get_pm3xd_input_body()
        body["estimating_method"] = "nrv_grv_yield"
        body["grv_dist"] = {
            "variable_id": "grv",
            "display_name": "GRV",
            "distribution_type": "lognormal",
            "unit": "acre-ft",
            "canonical_unit": "acre-ft",
            "p90": 5000.0,
            "p50": 10000.0,
            "p10": 20000.0,
        }
        body["grv_percent_fill_dist"] = {
            "variable_id": "pf",
            "display_name": "Fill",
            "distribution_type": "fixed",
            "unit": "fraction",
            "canonical_unit": "fraction",
            "fixed_value": 1.0,
        }
        body["net_to_gross_dist"] = {
            "variable_id": "ntg",
            "display_name": "NTG",
            "distribution_type": "fixed",
            "unit": "fraction",
            "canonical_unit": "fraction",
            "fixed_value": 0.75,
        }
        body["correlations"] = [
            {
                "variable_a": "area",
                "variable_b": "net_pay",
                "rho": 0.4,
                "enabled": True,
            }
        ]
        r = client.post(
            "/api/simulate",
            json={"input": body, "options": {"include_arrays": False}},
        )
        self.assertEqual(r.status_code, 200, r.text)

    def test_simulate_blocked_on_invalid_iterations(self):
        body = get_pm3xd_input_body()
        body["n_iterations"] = 500
        r = client.post("/api/simulate", json={"input": body})
        self.assertEqual(r.status_code, 422)

    def test_export_csv_zip(self):
        body = get_pm3xd_input_body()
        r = client.post("/api/export/csv", json={"input": body})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers["content-type"], "application/zip")
        zf = zipfile.ZipFile(BytesIO(r.content))
        self.assertIn("Results.csv", zf.namelist())

    def test_export_excel(self):
        body = get_pm3xd_input_body()
        r = client.post("/api/export/excel", json={"input": body})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.content[:2] == b"PK")

    def test_missing_toggle_booleans_default_backward_compatible(self):
        body = get_pm3xd_input_body()
        body.pop("include_solution_gas", None)
        body.pop("apply_oil_recovery", None)
        body.pop("include_chance", None)
        r = client.post("/api/validate", json=body)
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["has_errors"])
        r2 = client.post(
            "/api/simulate",
            json={"input": body, "options": {"include_arrays": False}},
        )
        self.assertEqual(r2.status_code, 200)
        self.assertIsNotNone(r2.json()["result"].get("pg_result"))

    def test_perturbation_tornado_oil(self):
        body = get_pm3xd_input_body()
        body["apply_oil_recovery"] = False
        body["oil_recovery_dist"] = None
        r = client.post(
            "/api/simulate/tornado-perturbation",
            json={"input": body, "target": "stoiip_mmbbl"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertIn("tornado", data)
        self.assertGreater(data["tornado"]["base_value"], 0)
        self.assertTrue(len(data["tornado"]["drivers"]) > 0)

    def test_hc_yield_preview_recovery_off_no_dist(self):
        body = get_pm3xd_input_body()
        body["apply_oil_recovery"] = False
        body["oil_recovery_dist"] = None
        r = client.post(
            "/api/simulate/preview",
            json={"input": body, "scope": "hc_yield"},
        )
        self.assertEqual(r.status_code, 200, r.text)

    def test_all_toggles_off_oil_validate_and_simulate(self):
        body = get_pm3xd_input_body()
        body["include_solution_gas"] = False
        body["apply_oil_recovery"] = False
        body["include_chance"] = False
        body["gor_dist"] = None
        body["solution_gas_recovery_dist"] = None
        body["oil_recovery_dist"] = None
        body["chance_categories"] = {}
        r = client.post("/api/validate", json=body)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertFalse(r.json()["has_errors"], r.json())
        r2 = client.post(
            "/api/simulate",
            json={"input": body, "options": {"include_arrays": True}},
        )
        self.assertEqual(r2.status_code, 200, r2.text)
        result = r2.json()["result"]
        self.assertIsNone(result.get("pg_result"))
        self.assertFalse(result.get("chance_applied", True))
        arrays = result.get("arrays") or {}
        self.assertNotIn("gor", arrays)
        self.assertNotIn("solution_gas_bcf", arrays)


if __name__ == "__main__":
    unittest.main()
