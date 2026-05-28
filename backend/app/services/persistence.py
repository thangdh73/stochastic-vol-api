"""CRUD operations for prospects, input sets, and simulation runs."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ..db.models import InputSet, Prospect, SimulationRun
from ..schemas.persistence import ProspectCreate, ProspectUpdate
from ..schemas.simulation import SimulationInputBody
from .engine_adapter import (
    ENGINE_VERSION,
    SCHEMA_VERSION,
    body_to_engine_input,
    simulate,
    validate_input,
)

from mmra_engine.serialization import (  # noqa: E402
    compute_input_hash,
    simulation_input_to_dict,
    validation_report_to_dict,
)


class NotFoundError(Exception):
    """Raised when a persisted entity is not found."""


class ValidationFailedError(Exception):
    """Raised when simulation cannot run due to validation errors."""

    def __init__(self, report: Dict[str, Any]) -> None:
        self.report = report
        super().__init__("Validation failed")


def _prospect_to_dict(prospect: Prospect) -> Dict[str, Any]:
    return {
        "id": prospect.id,
        "name": prospect.name,
        "metadata": json.loads(prospect.metadata_json or "{}"),
        "created_at": prospect.created_at,
        "updated_at": prospect.updated_at,
    }


def create_prospect(db: Session, data: ProspectCreate) -> Dict[str, Any]:
    prospect = Prospect(
        name=data.name,
        metadata_json=json.dumps(data.metadata, sort_keys=True),
    )
    db.add(prospect)
    db.commit()
    db.refresh(prospect)
    return _prospect_to_dict(prospect)


def list_prospects(db: Session) -> List[Dict[str, Any]]:
    rows = db.query(Prospect).order_by(Prospect.updated_at.desc()).all()
    return [_prospect_to_dict(p) for p in rows]


def get_prospect(db: Session, prospect_id: int) -> Dict[str, Any]:
    prospect = db.get(Prospect, prospect_id)
    if prospect is None:
        raise NotFoundError(f"Prospect {prospect_id} not found")
    out = _prospect_to_dict(prospect)
    out["input_set_count"] = len(prospect.input_sets)
    out["simulation_run_count"] = len(prospect.simulation_runs)
    return out


def update_prospect(db: Session, prospect_id: int, data: ProspectUpdate) -> Dict[str, Any]:
    prospect = db.get(Prospect, prospect_id)
    if prospect is None:
        raise NotFoundError(f"Prospect {prospect_id} not found")
    if data.name is not None:
        prospect.name = data.name
    if data.metadata is not None:
        prospect.metadata_json = json.dumps(data.metadata, sort_keys=True)
    db.commit()
    db.refresh(prospect)
    return _prospect_to_dict(prospect)


def delete_prospect(db: Session, prospect_id: int) -> None:
    prospect = db.get(Prospect, prospect_id)
    if prospect is None:
        raise NotFoundError(f"Prospect {prospect_id} not found")
    db.delete(prospect)
    db.commit()


def _get_or_create_input_set(
    db: Session,
    prospect_id: int,
    body: SimulationInputBody,
    inp_hash: str,
    input_dict: Dict[str, Any],
) -> InputSet:
    existing = (
        db.query(InputSet)
        .filter(InputSet.prospect_id == prospect_id, InputSet.input_hash == inp_hash)
        .first()
    )
    if existing is not None:
        return existing

    row = InputSet(
        prospect_id=prospect_id,
        input_hash=inp_hash,
        input_json=json.dumps(input_dict, sort_keys=True),
    )
    db.add(row)
    db.flush()
    return row


def save_input_set(db: Session, prospect_id: int, body: SimulationInputBody) -> Dict[str, Any]:
    if db.get(Prospect, prospect_id) is None:
        raise NotFoundError(f"Prospect {prospect_id} not found")
    inp = body_to_engine_input(body)
    inp_hash = compute_input_hash(inp)
    input_dict = simulation_input_to_dict(inp)
    row = _get_or_create_input_set(db, prospect_id, body, inp_hash, input_dict)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "prospect_id": row.prospect_id,
        "input_hash": row.input_hash,
        "input": json.loads(row.input_json),
        "created_at": row.created_at,
    }


def list_input_sets(db: Session, prospect_id: int) -> List[Dict[str, Any]]:
    if db.get(Prospect, prospect_id) is None:
        raise NotFoundError(f"Prospect {prospect_id} not found")
    rows = (
        db.query(InputSet)
        .filter(InputSet.prospect_id == prospect_id)
        .order_by(InputSet.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "prospect_id": r.prospect_id,
            "input_hash": r.input_hash,
            "input": json.loads(r.input_json),
            "created_at": r.created_at,
        }
        for r in rows
    ]


def get_input_set(db: Session, prospect_id: int, input_set_id: int) -> Dict[str, Any]:
    row = db.get(InputSet, input_set_id)
    if row is None or row.prospect_id != prospect_id:
        raise NotFoundError(f"Input set {input_set_id} not found for prospect {prospect_id}")
    return {
        "id": row.id,
        "prospect_id": row.prospect_id,
        "input_hash": row.input_hash,
        "input": json.loads(row.input_json),
        "created_at": row.created_at,
    }


def create_simulation_run(
    db: Session,
    prospect_id: int,
    body: SimulationInputBody,
    include_arrays: bool = False,
) -> Dict[str, Any]:
    if db.get(Prospect, prospect_id) is None:
        raise NotFoundError(f"Prospect {prospect_id} not found")

    _, report_dict = validate_input(body)
    if report_dict["has_errors"]:
        raise ValidationFailedError(report_dict)

    inp, report, result, payload = simulate(body, include_arrays=include_arrays)
    inp_hash = payload["input_hash"]
    input_dict = simulation_input_to_dict(inp)
    input_set = _get_or_create_input_set(db, prospect_id, body, inp_hash, input_dict)

    run = SimulationRun(
        prospect_id=prospect_id,
        input_set_id=input_set.id,
        seed=result.seed,
        n_iterations=result.n_iterations,
        engine_version=result.engine_version,
        input_hash=inp_hash,
        result_json=json.dumps(payload["result"], sort_keys=True),
        validation_report_json=json.dumps(
            validation_report_to_dict(report), sort_keys=True
        ),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    return {
        "prospect_id": prospect_id,
        "input_set_id": input_set.id,
        "simulation_run_id": run.id,
        "schema_version": SCHEMA_VERSION,
        "engine_version": ENGINE_VERSION,
        "input_hash": inp_hash,
        "input_hash_engine": payload["input_hash_engine"],
        "validation": report_dict,
        "result": payload["result"],
        "created_at": run.created_at,
    }


def list_simulation_runs(db: Session, prospect_id: int) -> List[Dict[str, Any]]:
    if db.get(Prospect, prospect_id) is None:
        raise NotFoundError(f"Prospect {prospect_id} not found")
    rows = (
        db.query(SimulationRun)
        .filter(SimulationRun.prospect_id == prospect_id)
        .order_by(SimulationRun.created_at.desc())
        .all()
    )
    return [_run_summary(r) for r in rows]


def get_simulation_run(db: Session, prospect_id: int, run_id: int) -> Dict[str, Any]:
    run = db.get(SimulationRun, run_id)
    if run is None or run.prospect_id != prospect_id:
        raise NotFoundError(f"Simulation run {run_id} not found for prospect {prospect_id}")
    return _run_detail(run)


def _run_summary(run: SimulationRun) -> Dict[str, Any]:
    result = json.loads(run.result_json)
    total = result.get("total_mmboe") or {}
    return {
        "id": run.id,
        "prospect_id": run.prospect_id,
        "input_set_id": run.input_set_id,
        "seed": run.seed,
        "n_iterations": run.n_iterations,
        "engine_version": run.engine_version,
        "input_hash": run.input_hash,
        "created_at": run.created_at,
        "total_mmboe_mean": total.get("mean_trimmed"),
        "pg": (result.get("pg_result") or {}).get("pg"),
    }


def _run_detail(run: SimulationRun) -> Dict[str, Any]:
    validation = json.loads(run.validation_report_json)
    validation["has_errors"] = any(
        i.get("severity") == "ERROR" for i in validation.get("issues", [])
    )
    validation["can_run_simulation"] = not validation["has_errors"]
    return {
        "id": run.id,
        "prospect_id": run.prospect_id,
        "input_set_id": run.input_set_id,
        "seed": run.seed,
        "n_iterations": run.n_iterations,
        "engine_version": run.engine_version,
        "input_hash": run.input_hash,
        "created_at": run.created_at,
        "validation": validation,
        "result": json.loads(run.result_json),
    }
