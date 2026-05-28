# Changelog

## 2026-05-26

- **Calculation toggles:** optional `include_solution_gas`, `apply_oil_recovery`, `include_chance` (tri-state; sync from distributions when omitted).
- **Workbook OAT tornado:** `perturbation_tornado.py`, `POST /api/simulate/tornado-perturbation`, Charts mode “Workbook OAT”.
- **Dev:** `start-dev.bat` / `start-api.ps1` watch `engine/` via `--reload-dir ..\engine`.
- Tests: engine 215 + backend 16 passing; frontend `npm run build` after TS fix.

## 2026-05-25

- Repository bootstrap; engine v0.1.0 under `engine/mmra_engine/`.
- Added `serialization.py` (schema v1, JSON round-trip, `compute_input_hash`).
- Added `export.py` (CSV tables, zip CSV export, Excel workbook).
- Added `examples/run_pm3xd_validation.py`.
- 186 engine tests passing.
- FastAPI backend (`backend/app/`): health, validate, simulate, PM3X-D case, CSV/Excel export.
- 8 API tests passing.
- SQLite persistence (SQLAlchemy): prospects, input_sets, simulation_runs.
- 13 backend tests passing (including persistence CRUD).
- React frontend shell (Vite + TypeScript): PM3X-D load, validate, simulate, results, QA/QC, export, charts preview.
- Milestone 5: DistributionInputCard, editable Prospect/Area/Net Pay/HC Yield/Chance forms, ValidateBar.
