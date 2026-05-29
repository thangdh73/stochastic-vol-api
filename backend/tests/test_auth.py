"""Authentication endpoint tests."""

import os
import sys
import unittest

from fastapi.testclient import TestClient

_BACKEND_ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, _BACKEND_ROOT)

from app.auth.config import reset_auth_cache  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


class TestAuth(unittest.TestCase):
    def setUp(self):
        self._env = os.environ.copy()
        os.environ["MMRA_AUTH_USERS"] = "demo@example.com:secret123"
        os.environ["MMRA_JWT_SECRET"] = "test-secret-key-for-jwt-signing"
        reset_auth_cache()

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self._env)
        reset_auth_cache()

    def test_login_success(self):
        r = client.post(
            "/api/auth/login",
            json={"email": "demo@example.com", "password": "secret123"},
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["email"], "demo@example.com")

    def test_login_bad_password(self):
        r = client.post(
            "/api/auth/login",
            json={"email": "demo@example.com", "password": "wrong"},
        )
        self.assertEqual(r.status_code, 401)

    def test_protected_route_requires_token(self):
        r = client.get("/api/validation-cases/pm3xd")
        self.assertEqual(r.status_code, 401)

    def test_protected_route_with_token(self):
        login = client.post(
            "/api/auth/login",
            json={"email": "demo@example.com", "password": "secret123"},
        )
        token = login.json()["access_token"]
        r = client.get(
            "/api/validation-cases/pm3xd",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(r.status_code, 200)

    def test_health_stays_public(self):
        r = client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json().get("auth_enabled"))


if __name__ == "__main__":
    unittest.main()
