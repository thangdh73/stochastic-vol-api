#!/usr/bin/env python3
"""PM3X-D workbook validation regression script."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))

from mmra_engine.simulation import run_simulation
from mmra_engine.validation import validate_simulation_input
from mmra_engine.validation_cases import (
    PM3XD_PG_EXPECTED,
    PM3XD_WORKBOOK_TARGETS,
    make_pm3xd_h1ss10_input,
)

PG_ABS_TOL = 1e-8
WORKBOOK_REL_TOL = 0.05
WORKBOOK_TAIL_REL_TOL = 0.10  # P99/P01 more sensitive to RNG


def _rel_close(actual: float, expected: float, rel_tol: float) -> bool:
    if expected == 0:
        return abs(actual - expected) <= rel_tol
    return abs(actual - expected) <= abs(expected) * rel_tol


def _compare(label: str, actual: float, expected: float, rel_tol: float) -> bool:
    ok = _rel_close(actual, expected, rel_tol)
    status = "PASS" if ok else "FAIL"
    print(f"  {label:12}  actual={actual:10.4f}  target={expected:10.4f}  [{status}]")
    return ok


def main() -> int:
    print("PM3X-D H1ss10 validation (seed=42, n_iterations=5000)")
    print("=" * 60)

    inp = make_pm3xd_h1ss10_input(seed=42, n_iterations=5000)
    report = validate_simulation_input(inp)

    if report.has_errors:
        print("VALIDATION FAILED — blocking errors:")
        for issue in report.errors:
            print(f"  [{issue.severity.value}] {issue.field}: {issue.message}")
        return 1

    if report.warnings:
        print(f"Warnings: {len(report.warnings)} (simulation may proceed)")

    result = run_simulation(inp)
    all_ok = True
    primary_ok = True

    print("\nPg [primary]")
    primary_ok &= _compare("Pg", result.pg_result.pg, PM3XD_PG_EXPECTED, PG_ABS_TOL)

    mapping = {
        "stoiip_mmbbl": result.stoiip,
        "recoverable_oil_mmbbl": result.recoverable_oil,
        "solution_gas_bcf": result.solution_gas,
        "total_mmboe": result.total_mmboe,
    }

    for key, summary in mapping.items():
        targets = PM3XD_WORKBOOK_TARGETS[key]
        is_primary = key == "total_mmboe"
        print(f"\n{key}" + (" [primary product]" if is_primary else ""))
        for label, attr, tol in (
            ("P99", "p99", WORKBOOK_TAIL_REL_TOL),
            ("P90", "p90", WORKBOOK_REL_TOL),
            ("P50", "p50", WORKBOOK_REL_TOL),
            ("mean", "mean_trimmed", WORKBOOK_REL_TOL),
            ("P10", "p10", WORKBOOK_REL_TOL),
            ("P01", "p01", WORKBOOK_TAIL_REL_TOL),
        ):
            ok = _compare(label, getattr(summary, attr), targets[label if label != "mean" else "mean"], tol)
            all_ok &= ok
            if is_primary and label in ("mean", "P90", "P50", "P10"):
                primary_ok &= ok

    print("\n" + "=" * 60)
    if primary_ok:
        print("PRIMARY (Pg + total MMBOE mean/P90/P50/P10): PASS")
    else:
        print("PRIMARY: FAIL")
    if not all_ok:
        print("Extended workbook table: some cells outside tolerance (tails often differ from Excel RNG).")
    if primary_ok:
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
