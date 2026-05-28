"""Tests for SQLite persistence API."""

import os
import sys
import unittest

# In-memory DB must be set before database module binds engine
os.environ["MMRA_DATABASE_URL"] = "sqlite:///:memory:"

_BACKEND_ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, _BACKEND_ROOT)

from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402

import app.db.database as db_module  # noqa: E402
from app.db.base import Base  # noqa: E402

_test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
db_module.engine = _test_engine
db_module.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)
from app.db import models  # noqa: E402, F401

db_module.init_db()

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.services.engine_adapter import get_pm3xd_input_body  # noqa: E402

client = TestClient(app)


class TestProspectCRUD(unittest.TestCase):
    def test_create_list_get_delete_prospect(self):
        r = client.post("/api/prospects", json={"name": "Test Prospect", "metadata": {"basin": "Test"}})
        self.assertEqual(r.status_code, 201)
        prospect_id = r.json()["id"]

        r = client.get("/api/prospects")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.json()), 1)

        r = client.get(f"/api/prospects/{prospect_id}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["name"], "Test Prospect")

        r = client.patch(
            f"/api/prospects/{prospect_id}",
            json={"name": "Renamed Prospect"},
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["name"], "Renamed Prospect")

        r = client.delete(f"/api/prospects/{prospect_id}")
        self.assertEqual(r.status_code, 204)

        r = client.get(f"/api/prospects/{prospect_id}")
        self.assertEqual(r.status_code, 404)


class TestPersistedSimulation(unittest.TestCase):
    def setUp(self):
        r = client.post("/api/prospects", json={"name": "PM3X-D Stored"})
        self.prospect_id = r.json()["id"]
        self.pm3xd = get_pm3xd_input_body()

    def test_save_input_set(self):
        r = client.post(
            f"/api/prospects/{self.prospect_id}/input-sets",
            json=self.pm3xd,
        )
        self.assertEqual(r.status_code, 201)
        self.assertIn("input_hash", r.json())

    def test_save_input_set_nrv_method_and_units(self):
        body = dict(self.pm3xd)
        body["estimating_method"] = "nrv_grv_yield"
        body["oil_resource_unit"] = "MMSTB"
        body["gas_resource_unit"] = "MMSCF"
        body["grv_dist"] = {
            "variable_id": "grv",
            "display_name": "GRV",
            "distribution_type": "fixed",
            "unit": "acre-ft",
            "canonical_unit": "acre-ft",
            "fixed_value": 10000.0,
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
            "fixed_value": 0.8,
        }
        r = client.post(f"/api/prospects/{self.prospect_id}/input-sets", json=body)
        self.assertEqual(r.status_code, 201)
        stored = r.json()["input"]
        self.assertEqual(stored["estimating_method"], "nrv_grv_yield")
        self.assertEqual(stored["oil_resource_unit"], "MMSTB")
        self.assertEqual(stored["gas_resource_unit"], "MMSCF")

    def test_simulation_run_persisted(self):
        r = client.post(
            f"/api/prospects/{self.prospect_id}/simulation-runs",
            json={"input": self.pm3xd, "options": {"include_arrays": False}},
        )
        self.assertEqual(r.status_code, 201)
        data = r.json()
        self.assertIn("simulation_run_id", data)
        self.assertAlmostEqual(data["result"]["pg_result"]["pg"], 0.12636, places=4)

        run_id = data["simulation_run_id"]
        r2 = client.get(
            f"/api/prospects/{self.prospect_id}/simulation-runs/{run_id}"
        )
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json()["id"], run_id)
        self.assertIn("total_mmboe", r2.json()["result"])

    def test_list_runs(self):
        client.post(
            f"/api/prospects/{self.prospect_id}/simulation-runs",
            json={"input": self.pm3xd},
        )
        r = client.get(f"/api/prospects/{self.prospect_id}/simulation-runs")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.json()), 1)

    def test_input_set_dedup_by_hash(self):
        r1 = client.post(
            f"/api/prospects/{self.prospect_id}/input-sets",
            json=self.pm3xd,
        )
        r2 = client.post(
            f"/api/prospects/{self.prospect_id}/input-sets",
            json=self.pm3xd,
        )
        self.assertEqual(r1.json()["input_hash"], r2.json()["input_hash"])
        self.assertEqual(r1.json()["id"], r2.json()["id"])


if __name__ == "__main__":
    unittest.main()
