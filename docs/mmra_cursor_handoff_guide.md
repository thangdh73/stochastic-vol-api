# MMRA Web Project: Cursor Handoff Guide

This note is prepared so the project can be moved into Cursor and continued as a proper application build. It summarizes the approved direction, current engine status, project files, high-level roadmap, and detailed next implementation steps.

## Project Objective

Build **MMRA Web**, a modern web-based probabilistic subsurface resource and risk evaluation app inspired by the MMRA Excel/VBA workbook. The MVP focuses on a **single-zone, pre-drill exploration prospect** workflow with probabilistic volumetric inputs, Monte Carlo simulation, chance assessment, QA/QC validation, resource summaries, charts, and exportable review outputs.

The project should not be treated as a direct spreadsheet clone. The workbook is a mature Excel/VBA application with hidden calculation layers, macros, ActiveX controls, named ranges, and charts. The correct approach is a controlled functional rewrite with auditable calculations and validation against workbook cases.

## Approved Documents

The following documents have been prepared and approved:

| Document | Purpose |
|---|---|
| `mmra_app_review_spec.md` | Initial review specification, workbook discovery, scope, roadmap, and risks |
| `mmra_mvp_frs.md` | MVP Functional Requirements Specification: screens, data dictionary, validation checks, acceptance criteria |
| `mmra_technical_calculation_spec.md` | Technical calculation specification: units, constants, distributions, percentiles, volumetrics, chance logic, workbook validation cases |

These documents should be copied into the Cursor project under a `docs/` folder and treated as the source of truth.

## Current Built Asset

A standalone Python calculation engine has already been built and tested.

Package archive:

- `mmra_engine_package.zip`

Package contents:

| Path | Purpose |
|---|---|
| `mmra_engine/constants.py` | Unit conversion constants, limits, percentile quantiles |
| `mmra_engine/units.py` | Unit conversion and percent/fraction utilities |
| `mmra_engine/distributions.py` | Distribution definitions, sampling, beta fitting, clipping |
| `mmra_engine/stats.py` | P99/P90/P50/mean/P10/P01 summary and trimmed mean |
| `mmra_engine/volumetrics.py` | Deterministic volumetric formulas |
| `mmra_engine/chance.py` | Weak-link chance and Pg calculation |
| `mmra_engine/simulation.py` | Monte Carlo simulation orchestration |
| `mmra_engine/validation.py` | QA/QC validation module |
| `mmra_engine/validation_cases.py` | Deterministic and workbook validation case scaffolds |
| `tests/` | Python unittest suite |

Current test status:

- **172 unittest checks passing**
- PM3X-D validation scaffold has **0 blocking validation errors**
- Pg for PM3X-D case = **0.12636**
- PM3X-D total MMBOE mean from the engine is close to workbook target: approximately **4.5051** versus workbook **4.50**

Run tests after extracting the package:

```bash
python -m unittest discover -s tests
```

## Key Technical Decisions Already Approved

## Calculation Conventions

- P10-large convention is used.
- P90 is the conservative/smaller resource estimate.
- P10 is the upside/larger resource estimate.
- Displayed labels are P99, P90, P50, mean, P10, P01.
- Percentile extraction uses NumPy linear quantile method.
- Displayed mean is a P99-to-P01 trimmed mean.
- Default iteration count is 5,000.
- Default gas-oil conversion ratio is 6 mcf/bbl.

## Canonical Units

| Quantity | Internal unit |
|---|---|
| Area | acres |
| Thickness | feet |
| Rock volume | acre-ft |
| Oil/liquids | MMbbl |
| Gas | Bcf |
| Equivalent volume | MMBOE |
| Percent values | decimal fraction |

## MVP Calculation Engine Status

Already implemented:

- Unit conversions
- Fixed, uniform, normal, lognormal, triangular, and beta distributions
- Beta fitting from P90/P10 and bounds
- Variable clips
- Percentile summaries
- Trimmed mean
- Oil formulas
- Gas formulas
- Solution gas
- Condensate
- MMBOE
- Weak-link category chance
- Pg
- Pg-risked mean
- Single-zone simulation orchestration
- QA/QC validation report with `ERROR`, `WARNING`, and `INFO`

Status note (this repository)

This handoff guide was originally written before the web stack was implemented. In the current repo, the following are already implemented:

- CSV/Excel export from simulation results (engine export + API endpoints)
- JSON serialization layer for persistence/API (schema v1 + input hashing)
- FastAPI backend API (validate, simulate, module previews, export)
- Database schema + persistence (SQLite prospects, input sets, simulation runs)
- Frontend UI (React workflow + Results + Charts)
- Correlation engine (rank Iman–Conover + Gaussian copula)

Still not implemented / intentionally deferred unless reprioritized:

- Authentication or project permissions
- Full workbook import/export compatibility
- Area-depth / GRV-depth workflow
- Scenario comparison module
- Post-audit workflow

## Recommended Project Structure in Cursor

Create a new repository with this structure:

```text
mmra-web/
  README.md
  docs/
    mmra_app_review_spec.md
    mmra_mvp_frs.md
    mmra_technical_calculation_spec.md
    mmra_cursor_handoff_guide.md
  engine/
    mmra_engine/
      __init__.py
      constants.py
      units.py
      distributions.py
      stats.py
      volumetrics.py
      chance.py
      simulation.py
      validation.py
      validation_cases.py
    tests/
      test_mmra_engine.py
      test_validation.py
  backend/
    app/
      main.py
      api/
      schemas/
      services/
      storage/
    tests/
  frontend/
    package.json
    src/
  exports/
  examples/
```

Recommended implementation stack:

- **Calculation engine**: existing Python package
- **Backend**: Python FastAPI
- **Database**: SQLite initially, PostgreSQL later if needed
- **Frontend**: React + TypeScript
- **Charts**: Plotly or Recharts
- **Exports**: CSV and Excel first, PDF later

## High-Level Roadmap

## Milestone 1: Stabilize Engine Package

Goal:

- Make the current calculation engine cleanly reusable by the backend.

Tasks:

- Extract `mmra_engine_package.zip`.
- Move engine into `engine/mmra_engine`.
- Run all tests.
- Add packaging metadata if needed.
- Add JSON/dict serialization for input and output dataclasses.
- Add export helpers for CSV and Excel.

Acceptance:

- Engine tests pass.
- A JSON input can be converted into `SimulationInput`.
- A `SimulationResult` can be converted into JSON and exported.

## Milestone 2: Backend API

Goal:

- Expose the engine through a clean API.

Tasks:

- Create FastAPI backend.
- Define Pydantic request/response schemas.
- Add endpoints:
  - `POST /api/validate`
  - `POST /api/simulate`
  - `GET /api/validation-cases/pm3xd`
  - `POST /api/export/csv`
  - `POST /api/export/excel`
- Connect API to the engine.
- Add backend tests.

Acceptance:

- API can validate a prospect payload.
- API can run the PM3X-D validation case.
- API returns resource summaries, Pg, QA/QC report, and metadata.

## Milestone 3: Data Persistence

Goal:

- Save prospects, inputs, validation reports, and simulation runs.

Tasks:

- Add SQLite database.
- Define tables:
  - projects
  - prospects
  - input_sets
  - simulation_runs
  - validation_reports
  - exports
- Store simulation inputs and outputs as JSON initially.
- Add CRUD endpoints for prospects.

Acceptance:

- User can save and reload a prospect.
- Simulation runs are immutable and tied to input version/hash.
- Previous simulation results can be retrieved.

## Milestone 4: Frontend App Shell

Goal:

- Build the React app skeleton and workflow navigation.

Screens:

- Dashboard
- Prospect Setup
- Area
- Net Pay
- HC Yield
- Chance
- Simulation
- Results
- Charts
- QA/QC
- Export

Acceptance:

- User can navigate all screens.
- App can load the PM3-XD validation case from the backend.
- App can show validation status and run simulation.

## Milestone 5: MVP Input Screens

Goal:

- Build forms for the approved MVP data model.

Tasks:

- Prospect setup form
- Area distribution form
- Net pay distribution form
- HC Yield distribution form
- Chance checklist form
- Notes/rationale fields
- Validation status display

Acceptance:

- User can enter all required inputs.
- User can run pre-flight QA/QC.
- Errors block simulation and warnings remain visible.

## Milestone 6: Results and Charts

Goal:

- Present simulation outputs in a technical-review format.

Tasks:

- Results table for P99/P90/P50/mean/P10/P01.
- Unrisked and Pg-risked mean display.
- Histogram chart.
- Cumulative probability chart.
- Scatter plot for selected variables.
- Metadata panel for seed, iterations, engine version, input hash.

Acceptance:

- PM3-XD validation results display correctly.
- Result units are visible.
- Percentile convention is clearly labeled.
- Charts render after simulation.

## Milestone 7: Export

Goal:

- Produce review-ready files.

Tasks:

- CSV export.
- Excel-compatible workbook export.
- Include:
  - metadata
  - inputs
  - distributions
  - chance factors
  - QA/QC report
  - result tables
  - simulation metadata

Acceptance:

- Exported results match displayed results.
- QA/QC warnings and notes are included.

## Milestone 8: Validation and Calibration

Goal:

- Compare app output against the workbook and document differences.

Tasks:

- Run deterministic oil test case.
- Run deterministic gas test case.
- Run PM3-XD workbook validation case.
- Compare workbook target table versus engine output.
- Document differences caused by RNG, beta fitting, correlation, or workbook internals.

Acceptance:

- Deterministic tests match exactly within tolerance.
- PM3-XD outputs are within agreed tolerance or deviations are explained.

## Detailed Next Steps for Cursor

## Step 1: Create the Repository

In Cursor, create or open a folder:

```bash
mkdir mmra-web
cd mmra-web
git init
```

Copy the approved documents into:

```text
docs/
```

Extract `mmra_engine_package.zip` and move:

```text
mmra_engine/ -> engine/mmra_engine/
tests/ -> engine/tests/
```

From the repository root, run:

```bash
cd engine
python -m unittest discover -s tests
```

Commit the initial engine:

```bash
git add .
git commit -m "Add standalone MMRA calculation engine"
```

## Step 2: Add Engine Serialization

Add a new file:

```text
engine/mmra_engine/serialization.py
```

Implement:

- `distribution_to_dict()`
- `distribution_from_dict()`
- `simulation_input_to_dict()`
- `simulation_input_from_dict()`
- `percentile_summary_to_dict()`
- `simulation_result_to_dict()`
- `validation_report_to_dict()`

Design rule:

- Keep engine dataclasses independent from web framework types.
- Do not import FastAPI or Pydantic inside `mmra_engine`.
- The engine should remain pure Python.

Tests:

- Round-trip PM3-XD `SimulationInput` to dict and back.
- Run simulation before and after serialization and confirm same output for same seed.

## Step 3: Add Export Module

Add:

```text
engine/mmra_engine/export.py
```

Implement:

- `simulation_result_to_csv_tables()`
- `write_simulation_result_csv()`
- `write_simulation_result_excel()`

Recommended Excel workbook tabs:

- Metadata
- Inputs
- Chance
- QAQC
- Results
- Validation Targets, optional

Start simple:

- CSV export can be a dictionary of table names to CSV strings.
- Excel export can use `openpyxl` or `pandas.ExcelWriter`.

Tests:

- Export PM3-XD result.
- Read exported file and confirm expected sheets/tables.
- Confirm displayed result values match exported values.

## Step 4: Create FastAPI Backend

Suggested setup:

```bash
mkdir backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn pydantic numpy scipy
```

Create:

```text
backend/app/main.py
backend/app/schemas/
backend/app/services/
backend/app/api/
```

Start endpoints:

```text
GET  /health
GET  /api/validation-cases/pm3xd
POST /api/validate
POST /api/simulate
```

Backend design:

- Pydantic schemas validate HTTP payload shape.
- Convert payload to engine dataclasses.
- Run `validate_simulation_input()`.
- If errors, return validation report and do not simulate unless endpoint explicitly allows force-run.
- If valid, run simulation and return serialized result.

## Step 5: Add SQLite Persistence

Use simple JSON storage first.

Tables:

```text
prospects
  id
  name
  created_at
  updated_at
  metadata_json

input_sets
  id
  prospect_id
  input_hash
  input_json
  created_at

simulation_runs
  id
  prospect_id
  input_set_id
  seed
  n_iterations
  engine_version
  result_json
  validation_report_json
  created_at
```

Implementation options:

- SQLAlchemy for structured DB access; or
- sqlite3 for lightweight MVP.

Recommendation:

- Start with SQLAlchemy if the app will grow.
- Use JSON fields/text columns initially to avoid over-normalizing too early.

## Step 6: Build Frontend Shell

Create frontend:

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

Recommended packages:

```bash
npm install @tanstack/react-query react-router-dom recharts zod react-hook-form @hookform/resolvers
```

Frontend screen order:

1. Dashboard
2. Prospect Setup
3. Area
4. Net Pay
5. HC Yield
6. Chance
7. Simulation
8. Results
9. Charts
10. QA/QC
11. Export

First frontend target:

- Load PM3-XD validation case.
- Display input summary.
- Run validation.
- Run simulation.
- Display result table.

## Step 7: Build Input Forms

Use a shared distribution form component:

```text
DistributionInputCard
  variable name
  unit
  distribution type
  P90
  P50
  P10
  fixed value
  low clip
  high clip
  notes
```

Use this same component for:

- Area
- Percent fill
- Net pay
- Porosity
- Saturation
- Recovery efficiency
- FVF
- GOR
- GEF
- Condensate yield

Important UI rule:

- Always label P90 as conservative/small case.
- Always label P10 as upside/large case.
- Show the percentile convention near every distribution form.

## Step 8: QA/QC Integration

The frontend should treat validation issues as first-class workflow objects.

Display:

- Errors in red/error state
- Warnings in amber/warning state
- Info in neutral/blue state

Rules:

- If `report.has_errors = true`, disable simulation button.
- Warnings do not block simulation.
- Info does not block simulation.
- Each issue should link or point to module and field.

## Step 9: Results and Charts

Results table columns:

```text
Product | Unit | P99 | P90 | P50 | Mean P99-P01 | P10 | P01
```

Products:

- STOIIP
- GIIP
- Recoverable oil
- Recoverable gas
- Solution gas
- Condensate
- Total MMBOE

Always include:

- Seed
- Iterations
- Input hash
- Engine version
- Percentile convention
- Correlation mode

Charts:

- Histogram for total MMBOE
- Cumulative probability / exceedance curve
- Scatter plot, later if arrays are exposed

## Step 10: Keep a Validation Notebook or Script

Add:

```text
examples/run_pm3xd_validation.py
```

Purpose:

- Load PM3-XD validation case.
- Run validation.
- Run simulation.
- Print workbook target comparison.

This script is important because it gives you a quick command-line regression check during UI development.

## Cursor Prompt to Continue Development

You can paste this into Cursor as the starting instruction:

```text
We are building MMRA Web, a probabilistic subsurface resource and risk evaluation app. The approved docs are in /docs. The existing Python calculation engine is in /engine/mmra_engine and has 172 passing unittest checks. Do not change calculation conventions unless tests and docs are updated.

First task: stabilize the engine for backend use. Add serialization.py to convert DistributionDef, SimulationInput, PercentileSummary, ValidationReport, and SimulationResult to/from JSON-compatible dictionaries. Add unittest coverage for round-tripping the PM3-XD validation case and confirm identical simulation results with the same seed. Then add export.py to generate CSV and Excel-compatible outputs from SimulationResult. Keep the engine pure Python and independent of FastAPI/Pydantic.
```

## Development Rules

- Do not start with UI until the engine serialization and export are done.
- Do not change P90/P10 convention without updating all docs and tests.
- Do not present Pg-risked P90/P50/P10 unless dry-hole probability treatment is explicitly implemented.
- Do not hide QA/QC warnings.
- Always run tests before committing.
- Keep calculation engine pure Python.
- Keep backend schemas separate from engine dataclasses.
- Store simulation seed, input hash, engine version, and percentile convention for every run.

## Immediate Next Implementation Task

The best next task in Cursor is:

**Add engine serialization and export.**

Detailed sub-tasks:

1. Add `serialization.py`.
2. Add tests for JSON-compatible conversion.
3. Add `export.py`.
4. Add CSV export tests.
5. Add Excel export tests.
6. Run full unittest suite.
7. Commit.

Suggested commit:

```bash
git add .
git commit -m "Add engine serialization and export helpers"
```

After that, proceed to the FastAPI backend.

