"""
export.py – CSV and Excel export helpers for SimulationResult.
"""

from __future__ import annotations

import csv
import io
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from openpyxl import Workbook

from .simulation import SimulationInput, SimulationResult
from .stats import PercentileSummary
from .validation import ValidationReport

PathLike = Union[str, Path]


def _fmt(value: Optional[float]) -> str:
    if value is None:
        return ""
    return f"{value:.6g}"


def _summary_rows(result: SimulationResult) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []

    def add_row(summary: Optional[PercentileSummary]) -> None:
        if summary is None:
            return
        rows.append(
            {
                "Product": summary.product_name,
                "Unit": summary.unit,
                "P99": _fmt(summary.p99),
                "P90": _fmt(summary.p90),
                "P50": _fmt(summary.p50),
                "Mean_P99_P01": _fmt(summary.mean_trimmed),
                "P10": _fmt(summary.p10),
                "P01": _fmt(summary.p01),
            }
        )

    add_row(result.stoiip)
    add_row(result.recoverable_oil)
    add_row(result.solution_gas)
    add_row(result.giip)
    add_row(result.recoverable_gas)
    add_row(result.condensate)
    add_row(result.total_mmboe)

    if result.pg_result is not None:
        rows.append(
            {
                "Product": "Pg-risked mean (total MMBOE)",
                "Unit": result.pg_result.resource_unit,
                "P99": "",
                "P90": "",
                "P50": "",
                "Mean_P99_P01": _fmt(result.pg_result.pg_risked_mean),
                "P10": "",
                "P01": "",
            }
        )
    return rows


def _dicts_to_csv(rows: List[Dict[str, str]]) -> str:
    if not rows:
        return ""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def _metadata_rows(result: SimulationResult) -> List[Dict[str, str]]:
    return [
        {"Field": "prospect_name", "Value": result.prospect_name},
        {"Field": "fluid_type", "Value": result.fluid_type},
        {"Field": "zone_name", "Value": result.zone_name},
        {"Field": "seed", "Value": str(result.seed)},
        {"Field": "n_iterations", "Value": str(result.n_iterations)},
        {"Field": "gas_oil_ratio", "Value": _fmt(result.gas_oil_ratio)},
        {"Field": "engine_version", "Value": result.engine_version},
        {"Field": "input_hash", "Value": result.input_hash},
        {"Field": "percentile_convention", "Value": result.percentile_convention},
        {"Field": "correlation_mode", "Value": result.correlation_mode},
        {"Field": "run_timestamp", "Value": result.run_timestamp},
        {"Field": "unit_system_version", "Value": result.unit_system_version},
        {"Field": "clipping_applied", "Value": str(result.clipping_applied)},
    ]


def _input_rows(inp: SimulationInput) -> List[Dict[str, str]]:
    from .serialization import _DIST_FIELDS, distribution_to_dict

    empty = {
        "field_name": "",
        "variable_id": "",
        "display_name": "",
        "distribution_type": "",
        "unit": "",
        "p90": "",
        "p50": "",
        "p10": "",
        "fixed_value": "",
        "min_bound": "",
        "max_bound": "",
        "low_clip": "",
        "high_clip": "",
        "value": "",
    }
    rows: List[Dict[str, str]] = []
    for meta_field, meta_value in (
        ("prospect_name", inp.prospect_name),
        ("fluid_type", inp.fluid_type),
        ("zone_name", inp.zone_name),
        ("n_iterations", str(inp.n_iterations)),
        ("seed", str(inp.seed)),
        ("gas_oil_ratio", _fmt(inp.gas_oil_ratio)),
        ("notes", inp.notes),
    ):
        row = dict(empty)
        row["field_name"] = meta_field
        row["value"] = meta_value
        rows.append(row)

    for name in _DIST_FIELDS:
        dist = getattr(inp, name)
        if dist is None:
            continue
        d = distribution_to_dict(dist)
        rows.append(
            {
                "field_name": name,
                "variable_id": d["variable_id"],
                "display_name": d["display_name"],
                "distribution_type": d["distribution_type"],
                "unit": d.get("unit", ""),
                "p90": _fmt(d.get("p90")),
                "p50": _fmt(d.get("p50")),
                "p10": _fmt(d.get("p10")),
                "fixed_value": _fmt(d.get("fixed_value")),
                "min_bound": _fmt(d.get("min_bound")),
                "max_bound": _fmt(d.get("max_bound")),
                "low_clip": _fmt(d.get("low_clip")),
                "high_clip": _fmt(d.get("high_clip")),
                "value": "",
            }
        )
    return rows


def _chance_rows(inp: SimulationInput, result: SimulationResult) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    pg_result = result.pg_result
    for category, factors in inp.chance_categories.items():
        cat_chance = ""
        if pg_result is not None:
            cat_chance = _fmt(pg_result.category_chances.get(category))
        rows.append(
            {
                "Category": category,
                "Sub_factors": ";".join(_fmt(f) for f in factors),
                "Category_chance": cat_chance,
            }
        )
    if pg_result is not None:
        rows.append({"Category": "Pg", "Sub_factors": "", "Category_chance": _fmt(pg_result.pg)})
    return rows


def _qaqc_rows(report: Optional[ValidationReport]) -> List[Dict[str, str]]:
    if report is None:
        return []
    return [
        {
            "code": issue.code,
            "severity": issue.severity.value,
            "module": issue.module,
            "field": issue.field,
            "message": issue.message,
            "recommended_action": issue.recommended_action or "",
        }
        for issue in report.issues
    ]


def _workbook_target_rows(targets: Dict[str, Any]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for product, stats in targets.items():
        if product == "pg":
            rows.append({"Product": "Pg", "Unit": "fraction", "Mean_P99_P01": _fmt(stats)})
            continue
        if not isinstance(stats, dict):
            continue
        rows.append(
            {
                "Product": product,
                "Unit": "",
                "P99": _fmt(stats.get("P99")),
                "P90": _fmt(stats.get("P90")),
                "P50": _fmt(stats.get("P50")),
                "Mean_P99_P01": _fmt(stats.get("mean")),
                "P10": _fmt(stats.get("P10")),
                "P01": _fmt(stats.get("P01")),
            }
        )
    return rows


def simulation_result_to_csv_tables(
    result: SimulationResult,
    input: Optional[SimulationInput] = None,
    validation_report: Optional[ValidationReport] = None,
    workbook_targets: Optional[Dict[str, Any]] = None,
) -> Dict[str, str]:
    tables: Dict[str, str] = {
        "Metadata": _dicts_to_csv(_metadata_rows(result)),
        "Results": _dicts_to_csv(_summary_rows(result)),
    }
    if input is not None:
        tables["Inputs"] = _dicts_to_csv(_input_rows(input))
        tables["Chance"] = _dicts_to_csv(_chance_rows(input, result))
    if validation_report is not None:
        tables["QAQC"] = _dicts_to_csv(_qaqc_rows(validation_report))
    if workbook_targets is not None:
        tables["Validation_Targets"] = _dicts_to_csv(_workbook_target_rows(workbook_targets))
    return tables


def write_simulation_result_csv(
    output_path: PathLike,
    result: SimulationResult,
    input: Optional[SimulationInput] = None,
    validation_report: Optional[ValidationReport] = None,
    workbook_targets: Optional[Dict[str, Any]] = None,
) -> Path:
    path = Path(output_path)
    tables = simulation_result_to_csv_tables(
        result, input=input, validation_report=validation_report, workbook_targets=workbook_targets
    )

    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for name, content in tables.items():
                zf.writestr(f"{name}.csv", content)
        return path

    path.mkdir(parents=True, exist_ok=True)
    for name, content in tables.items():
        (path / f"{name}.csv").write_text(content, encoding="utf-8")
    return path


def write_simulation_result_excel(
    path: PathLike,
    result: SimulationResult,
    input: Optional[SimulationInput] = None,
    validation_report: Optional[ValidationReport] = None,
    workbook_targets: Optional[Dict[str, Any]] = None,
) -> Path:
    out = Path(path)
    wb = Workbook()
    wb.remove(wb.active)

    sheet_data = [
        ("Metadata", _metadata_rows(result)),
        ("Results", _summary_rows(result)),
    ]
    if input is not None:
        sheet_data.insert(1, ("Inputs", _input_rows(input)))
        sheet_data.insert(2, ("Chance", _chance_rows(input, result)))
    if validation_report is not None:
        sheet_data.append(("QAQC", _qaqc_rows(validation_report)))
    if workbook_targets is not None:
        sheet_data.append(("Validation_Targets", _workbook_target_rows(workbook_targets)))

    for title, rows in sheet_data:
        ws = wb.create_sheet(title)
        if not rows:
            continue
        headers = list(rows[0].keys())
        ws.append(headers)
        for row in rows:
            ws.append([row.get(h, "") for h in headers])

    wb.save(out)
    return out
