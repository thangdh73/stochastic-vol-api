"""SQLAlchemy ORM models."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Prospect(Base):
    __tablename__ = "prospects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")

    input_sets: Mapped[list["InputSet"]] = relationship(
        back_populates="prospect",
        cascade="all, delete-orphan",
    )
    simulation_runs: Mapped[list["SimulationRun"]] = relationship(
        back_populates="prospect",
        cascade="all, delete-orphan",
    )


class InputSet(Base):
    __tablename__ = "input_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prospect_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    input_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    prospect: Mapped["Prospect"] = relationship(back_populates="input_sets")
    simulation_runs: Mapped[list["SimulationRun"]] = relationship(
        back_populates="input_set",
    )


class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prospect_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    input_set_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("input_sets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    n_iterations: Mapped[int] = mapped_column(Integer, nullable=False)
    engine_version: Mapped[str] = mapped_column(String(32), nullable=False)
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    result_json: Mapped[str] = mapped_column(Text, nullable=False)
    validation_report_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    prospect: Mapped["Prospect"] = relationship(back_populates="simulation_runs")
    input_set: Mapped["InputSet"] = relationship(back_populates="simulation_runs")
