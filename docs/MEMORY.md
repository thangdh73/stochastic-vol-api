# Project Memory

Working memory for **MMRA Web** — probabilistic subsurface resource & risk evaluation (MMRA.xlsm-inspired, not a spreadsheet clone).

**Repo:** `D:\1-Projects\8-Python code\3-MMRA Web Project`  
**Last onboarded:** 2026-05-25 (Cursor agent + legacy-integration skill)

---

## Project Summary

| Item | Detail |
|------|--------|
| **Goal** | Web MVP for single-zone pre-drill prospect: probabilistic volumetrics, Monte Carlo, chance (Pg), QA/QC, charts, export |
| **Main users** | Subsurface / exploration geoscientists evaluating prospects |
| **Current status** | Engine + FastAPI + React UI functional; two estimating methods; optional calculation toggles; Spearman + workbook OAT tornado on Charts; persistence via SQLite |

**Source of truth (read before changing calc/UI):**

- `docs/mmra_mvp_frs.md` — screens, acceptance criteria
- `docs/mmra_technical_calculation_spec.md` — units, formulas, percentiles, validation
- `docs/mmra_app_review_spec.md` — workbook discovery, scope, risks
- `docs/mmra_cursor_handoff_guide.md` — roadmap (partially outdated; prefer this file + `PROJECT_STATUS.md`)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite 8, React Router 7, Recharts 3, TanStack Query 5 |
| **Backend** | FastAPI, Pydantic v2, Uvicorn |
| **Engine** | Pure Python 3 (`engine/mmra_engine/`), NumPy, no FastAPI dependency |
| **Database** | SQLite (`backend/data/mmra.db`), SQLAlchemy models |
| **Authentication** | None (local MVP) |
| **Deployment** | Dev: `start-dev.bat` or manual API :8001 + UI :5173; Vite proxies `/api` → backend |

---

## Folder Structure

```text
3-MMRA Web Project/
├── engine/                 # Calculation engine (source of truth for math)
│   ├── mmra_engine/        # Core modules
│   └── tests/              # pytest (~215 tests)
├── backend/                # FastAPI adapter + persistence
│   ├── app/
│   │   ├── api/            # routes.py, persistence_routes.py
│   │   ├── db/             # SQLAlchemy models
│   │   ├── schemas/        # Pydantic API bodies (schema v1)
│   │   └── services/       # engine_adapter.py, persistence.py
│   └── tests/              # unittest (~18 tests)
├── frontend/               # React SPA
│   └── src/
│       ├── pages/          # Workflow screens
│       ├── components/     # Forms, charts, ValidateBar
│       ├── context/        # WorkflowContext (in-memory session state)
│       ├── api/            # fetch client
│       └── utils/          # correlations, sensitivity, estimatingMethod
├── docs/                   # Specs + MEMORY, PLAN, DECISIONS
├── .cursor/                # rules/, skills/ (agent workflow)
├── examples/               # PM3X-D validation script
└── scripts/                # xlsm inspection utilities
```

---

## Responsibilities

### Engine (`engine/mmra_engine/`)

| Module | Role |
|--------|------|
| `distributions.py` | Sample lognormal, triangular, beta, fixed, etc. |
| `volumetrics.py` | Area, NRV, HCPV, STOIIP, GIIP, MMBOE formulas |
| `simulation.py` | Monte Carlo orchestration; branches on `estimating_method` |
| `chance.py` | Weak-link Pg, Pg-risked mean |
| `correlation.py` | Rank (Iman–Conover), Gaussian copula; method-aware variable lists |
| `validation.py` | Pre-flight QA/QC (`ERROR` / `WARNING` / `INFO`) |
| `serialization.py` | JSON schema v1 round-trip, input hash |
| `module_preview.py` | Tab-scoped previews (area, net_pay, nrv, hc_yield, chance) |
| `complex_traps.py` | Downdip trap extension of productive area |
| `nrv_crosscheck.py` | NRV vs implied net pay warnings |
| `export.py` | CSV tables, Excel export |
| `calculation_toggles.py` | Optional solution gas, oil recovery, chance (`include_*` / `apply_*`) |
| `perturbation_tornado.py` | Workbook OAT tornado at input P50 / P90 / P10 (no MC) |

**Conventions:** P10-large; canonical units (acres, ft, acre-ft, MMbbl/Bcf/MMBOE as fractions); default 5,000 iterations.

### Backend (`backend/app/`)

- **`engine_adapter.py`** — Pydantic body → `SimulationInput`; calls validate/simulate/export
- **`routes.py`** — `/api/validate`, `/api/simulate`, `/api/simulate/preview`, export endpoints
- **`persistence_routes.py`** — prospects, input sets (hash dedup), simulation runs
- **Port 8001** (8000 often occupied on Windows)

### Frontend (`frontend/src/`)

- **`WorkflowContext`** — Holds `input`, `validation`, `simulation`, `modulePreviews`, `activeProjectId`; sessionStorage for active project name/id
- **Conditional nav** (`Layout.tsx`) — Area/Net Pay vs NRV/GRV based on `estimating_method`
- **Pages** — Dashboard (save/open project), Prospect Setup, volumetric inputs, HC Yield, Chance, Correlations, Simulation, Results, Charts, QA/QC, Export
- **Charts** — Histograms/exceedance, scatter; **Spearman tornado** (needs MC arrays) or **Workbook OAT** (`POST /api/simulate/tornado-perturbation`, input only)

---

## Main Data Flow

```text
User edits SimulationInput in React (WorkflowContext)
    → POST /api/validate (optional, any page via ValidateBar)
    → POST /api/simulate/preview (per-tab module MC)
    → POST /api/simulate { input, options: { include_arrays } }
        → engine_adapter.body_to_engine_input()
        → validate_simulation_input() → run_simulation()
    → Results / Charts consume result + arrays

Persist path:
    Dashboard Save → POST /api/prospects + POST .../input-sets
    Open → GET input-sets (latest)
    Save & run → POST .../simulation-runs (stores result in SQLite)
```

**Estimating methods:**

| Method ID | Volumetric chain | UI route |
|-----------|------------------|----------|
| `area_net_pay_yield` | Area × fill → net pay → NRV → HCPV → resources | `/area`, `/net-pay` |
| `nrv_grv_yield` | GRV × fill × N/G (or direct NRV) → HCPV → resources | `/nrv` |

Shared: HC Yield, Chance, Correlations, Simulation.

---

## Auth Flow

None. Single-user local app. No login or RBAC.

---

## Test Setup

| Suite | Command | Location |
|-------|---------|----------|
| Engine | `cd engine; python -m pytest tests/ -q` | ~215 tests |
| Backend | `cd backend; python -m unittest discover -s tests -v` | ~18 tests |
| PM3X-D regression | `python examples/run_pm3xd_validation.py` | End-to-end engine check |

**Validation anchor:** PM3X-D case — Pg ≈ 0.12636, total MMBOE mean ≈ 4.50.

Frontend: `npm run build` (tsc + vite); no automated UI tests yet.

---

## Known Risks

| Risk | Mitigation |
|------|------------|
| **Handoff guide outdated** | Claims web/charts not built; trust codebase + this file |
| **Stale correlation pairs after method switch** | Engine now filters on export; frontend prunes on Correlations mount; was causing 500 on simulate |
| **Fixed inputs (NTG, FVF)** | No tornado/Spearman bar; QA warns `NRV_INPUT_FIXED`; user must use probabilistic distributions |
| **Backend restart** | Use `start-dev.bat` / `start-api.ps1` with `--reload-dir ..\engine`; kill duplicate listeners on 8001 (`netstat -ano \| findstr :8001`) |
| **PowerShell** | Use `;` not `&&` between commands |
| **Saved projects** | Old input sets may still have `area_net_pay` correlations or fixed NTG until re-saved |
| **Two tornado modes** | Spearman = rank ρ on MC arrays; OAT = scalar P50 base + P90/P10 swings (Charts radio) |
| **Chance vs workbook** | Web uses one factor per category (prospect mins); no Play Segment columns / adequacy matrix |
| **No auth / SQLite file** | Not suitable for multi-user production without hardening |

---

## Recommended Next Steps

1. **Refresh `PROJECT_STATUS.md` and handoff guide** — Mark charts/tornado/NRV/correlations as done; update workflow (no Load PM3X-D on dashboard).
2. **`.mmra.json` import/export** — Portable project file alongside DB persistence.
3. **Chance parity** — Play vs prospect columns, sub-factors (lower priority per FRS).
4. **Export UI** — Wire Export page to saved simulation runs in DB.
6. **Milestone 8** — Workbook calibration report document.
7. **Frontend tests** — Vitest for `sensitivity.ts`, correlation matrix sync.

---

## Important Decisions

| Date | Decision | Reason | Impact |
|------|----------|--------|--------|
| 2026 | P10-large percentiles | Workbook convention | All summaries/charts |
| 2026 | Engine separate from API | Testable, auditable math | `engine_adapter` bridge |
| 2026 | Schema v1 JSON for I/O | Stable API contract | `serialization.py` + Pydantic mirror |
| 2026 | Two estimating methods | Workbook Prospect Settings | Conditional nav + correlation variable sets |
| 2026 | Tornado = Spearman ρ | FRS P1 “correlation-based driver” | Default on Charts when MC exists |
| 2026 | OAT perturbation tornado | Workbook P50/P90/P10 swings | `perturbation_tornado.py`, no MC required |
| 2026 | Calculation toggles | Explicit skip solution gas / recovery / chance | Tri-state `null` = infer from distributions |
| 2026 | API port 8001 | Local port conflict | Document in README |

---

## Error Log and Lessons Learned

| Date | Issue | Root Cause | Fix | Prevention |
|------|-------|------------|-----|------------|
| 2026-05 | Simulation 500 Internal Server Error | Stale area correlations when `estimating_method=nrv_grv_yield`; `matrix_from_pairs` raised in `compute_input_hash` | Filter pairs to active method; skip unknown vars in `build_correlation_matrix` | Method-aware export + API 422 on ValueError |
| 2026-05 | Correlations showed Area/Net Pay on NRV | Frontend `correlatableVariables` not method-aware | `correlations.ts` + engine `correlatable_variables_for_input` | Prune on Correlations page load |
| 2026-05 | No NTG on tornado | NTG distribution **fixed** (constant MC samples) | Default NTG lognormal; UI note for fixed inputs | `_warn_if_fixed_nrv_input` in validation |
| 2026-05 | All positive tornado bars for STOIIP | GRV, NTG, φ, Sw multiply into HCPV; FVF in denominator but fixed | Document FVF → negative ρ when stochastic | Caption on TornadoChart |

---

## User Preferences

- Prefer TypeScript on frontend.
- Clean modular architecture; small safe diffs.
- Plan before large edits (`docs/PLAN.md`).
- **PowerShell** on Windows for terminal commands.
- Explain in English unless user writes in Vietnamese.

---

## Recent Activity

| Date | Activity | Notes |
|------|----------|-------|
| 2026-05-25 | Cursor agent onboard | MEMORY.md populated; legacy-integration skill |
| 2026-05 | NRV/GRV method + correlations sync | Method-aware matrix |
| 2026-05 | Tornado chart (Spearman) | Charts page; fixed-input handling |
| 2026-05 | Dashboard save/load | SQLite prospects + input sets |
| 2026-05 | Simulate 500 fix | Stale correlation pairs |
| 2026-05-26 | HC Yield validation with recovery off | API defaulted toggles true; stale uvicorn | Optional Pydantic toggles; `prepareInputForApi`; reload engine dir |
| 2026-05-26 | Workbook OAT tornado shipped | `perturbation_tornado.py` + Charts mode | See `docs/PLAN_perturbation_tornado.md` |

---

## Agent Workflow (`.cursor/`)

- **Rules:** `00-project-context`, `10-coding-standards`, `20-agent-routing`, `30-quality-gates`
- **Skills:** `legacy-integration`, `new-feature`, `testing`, `code-review`, `optimisation`, `release`
- **Before code changes:** Read this file + relevant spec; use `legacy-integration` for impact assessment; update PLAN/MEMORY after meaningful work.
