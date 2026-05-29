"""CRUD routes for persisted prospects and simulation runs."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db.database import get_db
from ..schemas.persistence import (
    InputSetResponse,
    PersistedSimulateRequest,
    PersistedSimulateResponse,
    ProspectCreate,
    ProspectDetailResponse,
    ProspectResponse,
    ProspectUpdate,
    SimulationRunResponse,
)
from ..schemas.simulation import SimulationInputBody
from ..services.persistence import NotFoundError, ValidationFailedError, create_prospect
from ..services.persistence import create_simulation_run, delete_prospect as delete_prospect_svc
from ..services.persistence import get_input_set, get_prospect, get_simulation_run
from ..services.persistence import list_input_sets, list_prospects, list_simulation_runs
from ..services.persistence import save_input_set, update_prospect as update_prospect_svc

router = APIRouter(prefix="/api/prospects", tags=["prospects"])


def _not_found(exc: NotFoundError) -> HTTPException:
    return HTTPException(status_code=404, detail=str(exc))


@router.post("", response_model=ProspectResponse, status_code=201)
def create_prospect_endpoint(
    body: ProspectCreate,
    db: Session = Depends(get_db),
) -> ProspectResponse:
    return ProspectResponse(**create_prospect(db, body))


@router.get("", response_model=List[ProspectResponse])
def list_prospects_endpoint(db: Session = Depends(get_db)) -> List[ProspectResponse]:
    return [ProspectResponse(**p) for p in list_prospects(db)]


@router.get("/{prospect_id}", response_model=ProspectDetailResponse)
def get_prospect_endpoint(
    prospect_id: int,
    db: Session = Depends(get_db),
) -> ProspectDetailResponse:
    try:
        return ProspectDetailResponse(**get_prospect(db, prospect_id))
    except NotFoundError as exc:
        raise _not_found(exc) from exc


@router.patch("/{prospect_id}", response_model=ProspectResponse)
def update_prospect_endpoint(
    prospect_id: int,
    body: ProspectUpdate,
    db: Session = Depends(get_db),
) -> ProspectResponse:
    try:
        return ProspectResponse(**update_prospect_svc(db, prospect_id, body))
    except NotFoundError as exc:
        raise _not_found(exc) from exc


@router.delete("/{prospect_id}", status_code=204)
def delete_prospect_endpoint(
    prospect_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        delete_prospect_svc(db, prospect_id)
    except NotFoundError as exc:
        raise _not_found(exc) from exc


@router.post("/{prospect_id}/input-sets", response_model=InputSetResponse, status_code=201)
def create_input_set_endpoint(
    prospect_id: int,
    body: SimulationInputBody,
    db: Session = Depends(get_db),
) -> InputSetResponse:
    try:
        return InputSetResponse(**save_input_set(db, prospect_id, body))
    except NotFoundError as exc:
        raise _not_found(exc) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Save failed: {exc}",
        ) from exc


@router.get("/{prospect_id}/input-sets", response_model=List[InputSetResponse])
def list_input_sets_endpoint(
    prospect_id: int,
    db: Session = Depends(get_db),
) -> List[InputSetResponse]:
    try:
        return [InputSetResponse(**r) for r in list_input_sets(db, prospect_id)]
    except NotFoundError as exc:
        raise _not_found(exc) from exc


@router.get("/{prospect_id}/input-sets/{input_set_id}", response_model=InputSetResponse)
def get_input_set_endpoint(
    prospect_id: int,
    input_set_id: int,
    db: Session = Depends(get_db),
) -> InputSetResponse:
    try:
        return InputSetResponse(**get_input_set(db, prospect_id, input_set_id))
    except NotFoundError as exc:
        raise _not_found(exc) from exc


@router.post(
    "/{prospect_id}/simulation-runs",
    response_model=PersistedSimulateResponse,
    status_code=201,
)
def create_simulation_run_endpoint(
    prospect_id: int,
    body: PersistedSimulateRequest,
    db: Session = Depends(get_db),
) -> PersistedSimulateResponse:
    try:
        payload = create_simulation_run(
            db,
            prospect_id,
            body.input,
            include_arrays=body.options.include_arrays,
        )
        return PersistedSimulateResponse(**payload)
    except NotFoundError as exc:
        raise _not_found(exc) from exc
    except ValidationFailedError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Simulation blocked by validation errors.",
                "validation": exc.report,
            },
        ) from exc


@router.get("/{prospect_id}/simulation-runs")
def list_simulation_runs_endpoint(
    prospect_id: int,
    db: Session = Depends(get_db),
) -> list:
    try:
        return list_simulation_runs(db, prospect_id)
    except NotFoundError as exc:
        raise _not_found(exc) from exc


@router.get(
    "/{prospect_id}/simulation-runs/{run_id}",
    response_model=SimulationRunResponse,
)
def get_simulation_run_endpoint(
    prospect_id: int,
    run_id: int,
    db: Session = Depends(get_db),
) -> SimulationRunResponse:
    try:
        return SimulationRunResponse(**get_simulation_run(db, prospect_id, run_id))
    except NotFoundError as exc:
        raise _not_found(exc) from exc
