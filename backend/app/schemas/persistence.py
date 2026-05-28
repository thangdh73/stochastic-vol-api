"""Pydantic schemas for persisted entities."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from .simulation import SimulateOptions, SimulationInputBody


class ProspectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ProspectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    metadata: Optional[Dict[str, Any]] = None


class ProspectResponse(BaseModel):
    id: int
    name: str
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InputSetResponse(BaseModel):
    id: int
    prospect_id: int
    input_hash: str
    input: Dict[str, Any]
    created_at: datetime


class SimulationRunResponse(BaseModel):
    id: int
    prospect_id: int
    input_set_id: int
    seed: int
    n_iterations: int
    engine_version: str
    input_hash: str
    created_at: datetime
    validation: Dict[str, Any]
    result: Dict[str, Any]


class PersistedSimulateRequest(BaseModel):
    input: SimulationInputBody
    options: SimulateOptions = Field(default_factory=SimulateOptions)


class PersistedSimulateResponse(BaseModel):
    prospect_id: int
    input_set_id: int
    simulation_run_id: int
    schema_version: str
    engine_version: str
    input_hash: str
    input_hash_engine: str
    validation: Dict[str, Any]
    result: Dict[str, Any]


class ProspectDetailResponse(ProspectResponse):
    input_set_count: int = 0
    simulation_run_count: int = 0
