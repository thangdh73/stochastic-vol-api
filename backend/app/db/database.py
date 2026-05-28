"""SQLAlchemy engine and session management."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from .base import Base

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_DATA_DIR = _BACKEND_ROOT / "data"
_DEFAULT_DB_PATH = _DATA_DIR / "mmra.db"

DATABASE_URL = os.environ.get(
    "MMRA_DATABASE_URL",
    f"sqlite:///{_DEFAULT_DB_PATH.as_posix()}",
)

_is_sqlite = DATABASE_URL.startswith("sqlite")
_is_memory = ":memory:" in DATABASE_URL

if _is_sqlite and _is_memory:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False} if _is_sqlite else {},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Create tables if they do not exist."""
    from . import models  # noqa: F401 — register ORM tables

    if DATABASE_URL.startswith("sqlite") and ":memory:" not in DATABASE_URL:
        _DATA_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
