"""Login and session endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..schemas.auth import AuthMeResponse, LoginRequest, LoginResponse
from .config import auth_enabled, verify_password
from .deps import require_auth
from .security import create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    if not auth_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Login is not configured on this server.",
        )
    email = body.email.strip().lower()
    if not verify_password(email, body.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    token = create_access_token(email)
    return LoginResponse(access_token=token, email=email)


@router.get("/me", response_model=AuthMeResponse)
def me(email: str | None = Depends(require_auth)) -> AuthMeResponse:
    if not auth_enabled():
        return AuthMeResponse(email="", auth_enabled=False)
    if email is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return AuthMeResponse(email=email, auth_enabled=True)


@router.get("/status")
def auth_status() -> dict:
    return {"auth_enabled": auth_enabled()}
