"""Auth configuration from environment variables."""

from __future__ import annotations

import os
import secrets
from functools import lru_cache


def auth_enabled() -> bool:
    """True when login is required (MMRA_AUTH_USERS is non-empty)."""
    return bool(os.getenv("MMRA_AUTH_USERS", "").strip())


@lru_cache(maxsize=1)
def jwt_secret() -> str:
    secret = os.getenv("MMRA_JWT_SECRET", "").strip()
    if secret:
        return secret
    if auth_enabled():
        raise RuntimeError(
            "MMRA_JWT_SECRET must be set when MMRA_AUTH_USERS is configured."
        )
    return "dev-insecure-local-only"


def jwt_expire_hours() -> int:
    raw = os.getenv("MMRA_JWT_EXPIRE_HOURS", "24").strip()
    try:
        return max(1, int(raw))
    except ValueError:
        return 24


@lru_cache(maxsize=1)
def load_user_passwords() -> dict[str, str]:
    """
    Parse MMRA_AUTH_USERS: email:password pairs, comma-separated.
    Example: thang@example.com:MySecretPass,demo@example.com:OtherPass
    """
    raw = os.getenv("MMRA_AUTH_USERS", "").strip()
    users: dict[str, str] = {}
    if not raw:
        return users
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk or ":" not in chunk:
            continue
        email, password = chunk.split(":", 1)
        email = email.strip().lower()
        password = password.strip()
        if email and password:
            users[email] = password
    return users


def reset_auth_cache() -> None:
    """Clear cached auth config (for tests)."""
    jwt_secret.cache_clear()
    load_user_passwords.cache_clear()


def verify_password(email: str, password: str) -> bool:
    expected = load_user_passwords().get(email.strip().lower())
    if expected is None:
        return False
    return secrets.compare_digest(expected, password)
