"""Authentication helpers (optional; enabled when MMRA_AUTH_USERS is set)."""

from .config import auth_enabled
from .deps import require_auth

__all__ = ["auth_enabled", "require_auth"]
