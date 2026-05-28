"""API route handlers."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from ..schemas.simulation import (
    ExportRequest,
    HealthResponse,
    ModulePreviewRequest,
    PerturbationTornadoRequest,
    SimulateRequest,
    SimulationInputBody,
    ValidationReportResponse,
)
from ..services.engine_adapter import (
    ENGINE_VERSION,
    SCHEMA_VERSION,
    build_csv_zip,
    build_excel_bytes,
    get_pm3xd_input_body,
    module_preview,
    perturbation_tornado,
    simulate,
    validate_input,
)

router = APIRouter(prefix="/api")


API_FEATURES = [
    "validate",
    "simulate",
    "simulate_preview",
    "tornado_perturbation",
    "export",
]


@router.get("/debug/schema")
def debug_schema() -> dict:
    """
    Lightweight runtime check to ensure the running API process is importing the
    expected local schema definitions (helps detect stale/duplicate backends).
    """
    import app.schemas.simulation as sim_schemas

    oil_field = sim_schemas.SimulationInputBody.model_fields["oil_resource_unit"]
    gas_field = sim_schemas.SimulationInputBody.model_fields["gas_resource_unit"]

    return {
        "schemas_module_file": getattr(sim_schemas, "__file__", ""),
        "oil_resource_unit": {
            "annotation": str(oil_field.annotation),
        },
        "gas_resource_unit": {
            "annotation": str(gas_field.annotation),
        },
    }


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        engine_version=ENGINE_VERSION,
        schema_version=SCHEMA_VERSION,
        api_features=API_FEATURES,
    )


@router.get("/validation-cases/pm3xd")
def validation_case_pm3xd() -> dict:
    return get_pm3xd_input_body()


@router.post("/validate", response_model=ValidationReportResponse)
def validate(body: SimulationInputBody) -> ValidationReportResponse:
    try:
        _, report_dict = validate_input(body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ValidationReportResponse(**report_dict)


@router.post("/simulate/preview")
def run_module_preview_endpoint(request: ModulePreviewRequest) -> dict:
    """Scoped preview: samples only inputs for the given workflow tab."""
    _, _, payload, report_dict = module_preview(request.input, request.scope)
    if payload is None:
        raise HTTPException(
            status_code=422,
            detail={
                "message": f"Module preview blocked ({request.scope}).",
                "validation": report_dict,
            },
        )
    return payload


@router.post("/simulate/tornado-perturbation")
def run_perturbation_tornado(request: PerturbationTornadoRequest) -> dict:
    """Workbook-style OAT tornado at input P50 / P90 / P10 (no MC arrays required)."""
    try:
        _, _, payload, report_dict = perturbation_tornado(
            request.input,
            target=request.target,
            context=request.context,
            scope_type=request.scope_type,
            scope_id=request.scope_id,
        )
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not payload:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Perturbation tornado blocked by validation errors.",
                "validation": report_dict,
            },
        )
    return payload


@router.post("/simulate")
def run_simulate(request: SimulateRequest) -> dict:
    try:
        _, report_dict = validate_input(request.input)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if report_dict["has_errors"]:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Simulation blocked by validation errors.",
                "validation": report_dict,
            },
        )
    try:
        _, _, _, payload = simulate(
            request.input,
            include_arrays=request.options.include_arrays,
            context=request.context,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return payload


@router.post("/export/csv")
def export_csv(request: ExportRequest) -> Response:
    try:
        inp, report, result, _ = simulate(request.input, include_arrays=False)
    except ValueError:
        _, report_dict = validate_input(request.input)
        raise HTTPException(
            status_code=422,
            detail={"message": "Export blocked by validation errors.", "validation": report_dict},
        )

    data = build_csv_zip(
        inp,
        result,
        report,
        include_workbook_targets=request.include_workbook_targets,
    )
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="mmra_export.zip"'},
    )


@router.post("/export/excel")
def export_excel(request: ExportRequest) -> Response:
    try:
        inp, report, result, _ = simulate(request.input, include_arrays=False)
    except ValueError:
        _, report_dict = validate_input(request.input)
        raise HTTPException(
            status_code=422,
            detail={"message": "Export blocked by validation errors.", "validation": report_dict},
        )

    data = build_excel_bytes(
        inp,
        result,
        report,
        include_workbook_targets=request.include_workbook_targets,
    )
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="mmra_export.xlsx"'},
    )
