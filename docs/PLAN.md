# PLAN — MMRA Web vs Requirements Review

**Review type:** Code review (Deep Reviewer) + requirements traceability  
**Date:** 2026-05-25  
**Sources:** `docs/mmra_mvp_frs.md`, `docs/mmra_technical_calculation_spec.md`, `docs/mmra_app_review_spec.md`, `docs/MEMORY.md`, codebase inspection  
**Code changes:** None (planning only)

---

## Code Review Summary

**Overall assessment:** **Ready with minor changes** for a **local MVP / technical evaluation** workflow. **Not ready** for production multi-user deployment or full workbook parity without further work.

The calculation engine is the strongest layer (well-tested, PM3X-D anchored). The React UI covers the main volumetric workflow for **both** Area×Net Pay and NRV/GRV methods (the latter exceeds original FRS P0 bullets but aligns with workbook direction). Gaps are concentrated in **navigation/completion UX**, **unit conversion UI**, **chance workbook parity**, **documentation drift**, and **hardening** (session loss, export from DB, portable project files).

**Positive notes:**

- Clean separation: `engine/` (pure math) → `backend/app/services/engine_adapter.py` → `frontend/`
- Schema v1 JSON round-trip with input hashing for traceability
- Validation blocks simulation; module previews scoped per tab
- Correlations and NRV method synced after recent fixes
- ~215 engine + ~18 API tests; PM3X-D Pg and MMBOE targets exercised

---

## 1. What Already Works

### P0 — Calculation engine (`engine/mmra_engine/`)

| Capability | Status | Evidence |
|------------|--------|----------|
| Distributions (fixed, uniform, normal, lognormal, triangular, beta) | Done | `distributions.py`, tests |
| P10-large percentiles P99–P01 + trimmed mean | Done | `stats.py`, PM3X-D tests |
| Area × fill → productive area; NRV = PA × NP × GCF | Done | `simulation.py`, `volumetrics.py` |
| NRV/GRV route (GRV × fill × N/G; direct NRV) | Done | `estimating_method`, `test_nrv_grv.py` |
| HC yield → HCPV → STOIIP/GIIP/recoverable/MMBOE | Done | Oil/gas/condensate branches |
| Chance weak-link + Pg product + Pg-risked mean | Done | `chance.py`, Results table |
| Monte Carlo 5k default, reproducible seed | Done | `SimulationInput.seed` |
| QA/QC ERROR/WARNING/INFO | Done | `validation.py` (~80 tests) |
| Rank + Gaussian copula correlations | Done (P1 in FRS, shipped) | `correlation.py` |
| GRV–NTG rank correlation (dedicated ρ) | Done | `grv_ntg_correlation`, simulation |
| Complex downdip traps | Done | `complex_traps.py`, Area UI |
| NRV cross-check warnings | Done | `nrv_crosscheck.py` |
| CSV + Excel export from engine | Done | `export.py`, API `/api/export/*` |
| JSON schema v1 serialization | Done | `serialization.py` |

### P0 — Backend API (`backend/`)

| Capability | Status |
|------------|--------|
| `/api/validate`, `/api/simulate`, `/api/simulate/preview`, `/api/simulate/tornado-perturbation` | Done |
| `/api/validation-cases/pm3xd` | Done |
| Export CSV zip / Excel | Done |
| SQLite persistence (prospects, input sets, simulation runs) | Done |
| Port 8001 + Vite proxy | Documented |

### P0 — Frontend (`frontend/`)

| Screen / feature | Status |
|------------------|--------|
| Dashboard — new prospect, save/open project | Done |
| Prospect Setup — fluid, method, iterations, seed, resource units | Done |
| Area — distributions, complex traps, module preview | Done |
| Net Pay — distribution, module preview | Done |
| NRV / GRV — GRV, fill, NTG, cross-check, module preview | Done (beyond original FRS P0 list) |
| HC Yield, Chance (multi sub-factor), Correlations | Done |
| Simulation — QA/QC + run + save & run | Done |
| Results — percentile table, Pg, seed, hash | Done |
| Charts — histogram, exceedance, scatter, Spearman + workbook OAT tornado | Done |
| QA/QC detail page | Done |
| Export — CSV/Excel from current session input | Done |
| Conditional nav by estimating method | Done |
| ValidateBar on workflow pages | Done |

### Tests & validation anchor

- **Engine:** `pytest tests/` — 215 passed (2026-05-25)
- **Backend:** `unittest` — 18 passed
- **PM3X-D:** Pg ≈ 0.12636; total MMBOE mean ≈ workbook 4.50
- **Regression script:** `examples/run_pm3xd_validation.py`

---

## 2. What Is Missing

### P0 gaps (FRS / technical spec)

| ID / topic | Requirement | Current state |
|------------|-------------|---------------|
| **NAV-003** | Input completion status per major module | Not implemented in sidebar/header |
| **DASH-002** | Dashboard module completion (Area, Net Pay, …) | Only coarse validation/sim flags |
| **NAV-002** | Prospect name in header | Name on Dashboard meta only; sidebar shows generic brand |
| **NPAY-002 / NPAY-003** | Net pay m/ft with conversion to canonical ft | Area has acres/km² helper; Net Pay is feet-only text + free-text unit (no conversion UI) |
| **NPAY-006** | Geometric correction on Net Pay screen | GCF exists in engine/default input; **no Net Pay UI** for GCF |
| **RES-004** | Identify simulation run used (timestamp, version) | Seed/iterations/hash shown; **no run timestamp** or DB run id in Results UI |
| **RES-006** (P1) | Input assumptions beside major outputs | `InputSummary` on Simulation, not Results |
| **VAL** routing | Errors list affected module/field | Partial — validation panel exists; dashboard doesn’t summarize by module |

### P1 gaps (acceptable post-MVP but spec-listed)

| Topic | Notes |
|-------|--------|
| **CH-005 / CH-006** | No Play Segment vs Prospect columns; no adequacy matrix |
| **CH notes** | `notes` on distributions; not dedicated per chance category in UI |
| **NAV-004 / NAV-005** | Last run time/seed in header; global QA/QC warning badge |
| **DASH-004 / DASH-005** | Latest Pg / mean on dashboard; top warnings |
| **CHT-005** | Chart PNG/SVG export |
| **SIM-006 / SIM-007** | Rerun same seed (supported by engine); no dedicated “rerun” UX |
| **Custom distributions** | Not implemented |
| **PDF export** | Not implemented |
| **Multi-run comparison** | DB stores runs; UI doesn’t compare |
| **`.mmra.json` import/export** | Documented as future on Dashboard only |
| **Export from saved DB run** | Export page uses in-memory `input` only |
| **True tornado** (P10/P90 one-at-a-time) | Spearman proxy only (FRS allows this for P1) |

### P2 / explicit non-goals (still missing — expected)

- Area-depth / GRV-depth engine  
- Scenario comparison charts  
- Post-audit workflow  
- Multi-zone aggregation  
- Commercial thresholds (MCFS, MEFS, …)  
- Workbook import/export round-trip  
- Auth / team permissions  

### Spec vs implementation drift (documentation)

| Document | Issue |
|----------|--------|
| `mmra_cursor_handoff_guide.md` | States web/charts/API/correlation “not yet implemented” — **false** |
| `PROJECT_STATUS.md` | Milestone 6–7 partial; workflow still mentions Load PM3X-D |
| `mmra_technical_calculation_spec.md` | Header “Implementation status: Not started” — **false** |
| `mmra_mvp_frs.md` § P2 | Lists “NRV direct input route” as future — **implemented** |
| `mmra_app_review_spec.md` | NRV sheet “Phase 2” — **partially implemented** in web |

---

## 3. High-Priority Bugs or Gaps

| Severity | Issue | Location / symptom | Suggested fix |
|----------|--------|-------------------|---------------|
| **High** | Session state lost on browser refresh | `WorkflowContext` in memory only until Open from DB | Auto-restore last project from `sessionStorage` + optional warn on unload |
| **High** | Saved projects with stale method/correlations | Old input sets: area pairs + NRV method | One-time migration on load: `pruneCorrelationsForMethod` server-side in `simulation_input_from_dict` (partially done on export) |
| **High** | Net pay metres not converted in UI | User enters m with unit “m” but engine may not convert unless canonical set | Net Pay unit selector like Area (`areaUnits.ts` pattern) + engine `convert_units` on ingest |
| **Medium** | Open project clears validation/simulation | `loadProject` sets validation/sim null | Expected but confusing; show banner “re-run QA/QC” |
| **Medium** | Export re-runs full simulation | `ExportPage` POST export endpoints call simulate internally | OK for consistency; slow — option to export last `simulation` in memory or DB run |
| **Medium** | No frontend tests | Regressions in correlations/tornado | Vitest for `sensitivity.ts`, `correlations.ts` |
| **Medium** | `Simulation.tsx` mount clears global error | `useEffect(() => setError(null), [])` | Hides errors from other tabs when visiting Simulation |
| **Low** | Technical spec stale | Reviewer/user trust | Update spec status banner |
| **Low** | Fixed NTG/FVF → empty tornado bars | User confusion | Addressed with warnings + copy; ensure saved projects get lognormal defaults on first open |

**Recently fixed (monitor regression):**

- Simulate 500 when NRV + stale area correlation pairs  
- Correlations matrix not method-aware  
- Internal Server Error vs 422 on validation failures  

---

## 4. Architecture Risks

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Dual source of truth for correlatable variables** | Engine `correlatable_variables_for_input` vs frontend `correlations.ts` must stay aligned | Shared contract test or generate list from OpenAPI/engine export |
| **Pydantic ↔ engine dataclass drift** | `SimulationInputBody` vs `SimulationInput` fields | Schema version bump + round-trip test on every new field |
| **WorkflowContext god-state** | All pages share one blob; easy to stale partial updates | Consider react-query per resource or immer patches |
| **SQLite single-file DB** | No migrations versioning visible; backup/lock on network drive | Alembic or documented schema version; export `.mmra.json` backup |
| **No API auth** | Any local process can read/write DB | Accept for MVP; document deployment boundary |
| **Engine path injection in adapter** | `sys.path.insert` to `engine/` | Package engine as installable `pip install -e engine` for cleaner deploy |
| **Large simulation arrays in JSON** | `include_arrays: true` bloats DB/responses | Persist compressed arrays or summary-only in DB runs |
| **Handoff/docs lag** | Agents/users follow wrong roadmap | This PLAN + refresh `PROJECT_STATUS.md` |

---

## 5. Calculation / QC Risks

| Risk | Description | Severity |
|------|-------------|----------|
| **Workbook parity incomplete** | Only PM3X-D (+ area method) heavily calibrated; NRV cases less documented | Medium |
| **Spearman tornado ≠ workbook tornado** | Users may misinterpret driver ranking | Low (documented) |
| **Fixed inputs silently zero sensitivity** | NTG, fill, FVF fixed → no tornado bar | Medium (warnings added) |
| **GRV–NTG double correlation** | Matrix pair GRV↔NTG plus `grv_ntg_correlation` field | Medium — document “use one mechanism” |
| **Chance model simplified** | One column vs workbook Play/Prospect; sub-factors uncorrelated | Medium for Pg comparison |
| **Percent vs fraction UI** | `asPercent` on some cards only; user can enter 17.8 vs 0.178 | Medium — validation catches some |
| **Unit string free-text** | `DistributionInputCard` sets `canonical_unit` = display unit | High if user types wrong unit |
| **Complex trap Method B** | Less test coverage than Method A | Medium |
| **Cross-check NRV vs area** | Optional; warnings only | Low |
| **Correlation PSD failures** | Non-PSD matrix should ERROR in validation | Low — `validate_correlation_matrix` |

**QC strengths:** Centralized `validate_simulation_input`; blocking errors; PM3X-D regression; deterministic seed.

---

## 6. Recommended Implementation Order

| Phase | Work item | Rationale |
|-------|-----------|-----------|
| **0** | Refresh `PROJECT_STATUS.md`, handoff guide, tech spec status | Stops wrong agent/user assumptions |
| **1** | Net Pay m/ft (and GCF on Net Pay or Area) with `convert_units` | P0 FRS NPAY-002/003; PM3X-D uses metres |
| **2** | Module completion + prospect name in shell (NAV-002/003, DASH-002) | P0 UX; low calc risk |
| **3** | `.mmra.json` export/import | Portable projects without DB; matches Dashboard brainstorm |
| **4** | Load/export from persisted `simulation_runs` | Closes export/results loop |
| **5** | Session restore + prune correlations on `loadLatestProjectInput` | Reduces 500/support issues |
| **6** | Results metadata (run id, timestamp) + optional assumptions panel | RES-004/006 |
| **7** | Chance Play/Prospect columns (CH-005) if workbook parity required | Larger UI + engine change |
| **8** | Chart image export (CHT-005) | Nice for reports |
| **9** | Workbook calibration report (Milestone 8) | Sign-off artifact |
| **10** | True perturbation tornado (optional) | Only if workbook requires |

**Defer:** Auth, multi-zone, scenario module, area-depth, economics.

---

## 7. Test Strategy

### Regression gates (every change touching engine/API)

```powershell
cd engine; python -m pytest tests/ -q
cd backend; python -m unittest discover -s tests -v
cd frontend; npm run build
python examples/run_pm3xd_validation.py
```

### Required tests for upcoming work

| Area | Tests |
|------|--------|
| Net pay units | Engine: metres → feet in sampling; API round-trip; UI optional e2e manual |
| Correlations prune on load | API: NRV body + area pairs → simulate 200; serialization export |
| `.mmra.json` | Round-trip file = `simulation_input_to_dict` → file → load → hash match |
| Module completion | Frontend unit: derive flags from validation issues by module |
| NRV workbook case | New validation case JSON (when workbook targets agreed) |

### Manual QA checklist (release candidate)

1. New prospect → Area method → PM3X-D load via API case → simulate → Results ≈ workbook  
2. Switch to NRV/GRV → GRV lognormal + NTG lognormal → simulate → Charts + tornado  
3. Correlations: GRV↔NTG rank → verify Spearman on arrays  
4. Save project → refresh browser → Open → inputs intact  
5. Export CSV + Excel opens in Excel  
6. Invalid P90>P10 → QA/QC blocks simulate  

### Coverage gaps today

- No Play/Prospect chance tests in UI  
- No frontend automated tests  
- Limited NRV vs workbook numeric targets (beyond engine unit tests)  

---

## 8. Rollback Plan

### Per change

- **Small PRs** — one concern per PR (units, dashboard completion, import/export).  
- **Revert** — `git revert <commit>`; redeploy API + static frontend.  
- **DB** — SQLite file `backend/data/mmra.db`; backup before schema changes; input sets are append-only versions (old sets remain).  

### Feature flags (recommended for larger items)

- `estimating_method` already acts as branch flag.  
- For chance Play/Prospect: add `chance_mode: "simple" \| "workbook"` default `"simple"` to preserve current behavior.  

### Data compatibility

- **Schema v1** — Do not break `schema_version: "1"` without migration. New fields optional with defaults.  
- **Rollback of correlation filter** — If issues arise, re-enable strict `build_correlation_matrix` raise but prune on load first.  

### Deployment rollback

1. Stop uvicorn.  
2. Restore previous `frontend/dist` and backend venv/commit.  
3. Restore `mmra.db` backup if migration ran.  
4. Verify `/health` and PM3X-D simulate.  

---

## Affected Files (anticipated — next implementation wave)

| Area | Likely files |
|------|----------------|
| Docs | `PROJECT_STATUS.md`, `mmra_cursor_handoff_guide.md`, `mmra_technical_calculation_spec.md` (status only) |
| Net pay units | `NetPay.tsx`, new `netPayUnits.ts`, `engine_adapter` or validation |
| Shell / completion | `Layout.tsx`, `Dashboard.tsx`, new `moduleStatus.ts` |
| Portable project | `api/client.ts`, `Dashboard.tsx`, backend optional `/export/mmra` |
| Persistence export | `Export.tsx`, `persistence_routes.py` |
| Tests | `test_api.py`, `test_serialization.py`, new frontend vitest |

---

## Security Risks

| Item | Level |
|------|--------|
| No authentication | High for shared server; OK for local single user |
| CORS `allow_origins=["*"]` | Medium if API exposed on LAN |
| SQLite path injection via env | Low |
| Export endpoints run full simulate | DoS via large `n_iterations` — capped at 100k in schema |

---

## Performance Risks

| Item | Notes |
|------|--------|
| 5k × 15 arrays in JSON response | ~75k floats; acceptable locally |
| Export + simulate duplicate work | User waits 2× if export after sim |
| Recharts on 5k bins | Histogram binning already aggregated |
| DB growth with `include_arrays: true` on every run | Monitor SQLite size |

---

## Approval

**Status:** Planning complete — **awaiting user `Proceed`** before implementation per `.cursor/rules/30-quality-gates.mdc`.

**Recommended first implementation batch after approval:** Phase 0 (docs) + Phase 1 (net pay units) + Phase 2 (completion UI).

---

## Traceability Matrix (summary)

| FRS area | P0 met? | Notes |
|----------|---------|-------|
| Prospect setup | Mostly | Save via DB; metadata partial |
| Area | Yes | + complex traps |
| Net Pay | Partial | Missing m/ft UI, GCF screen |
| HC Yield | Yes | |
| Chance | Partial | Engine OK; workbook columns missing |
| Simulation | Yes | |
| Results | Mostly | Missing run timestamp/id |
| Charts | Yes | Tornado P1 Spearman |
| QA/QC | Yes | |
| Export | Yes | Session-based; not DB run |
| Correlations | P1 shipped | |
| NRV/GRV | Ahead of FRS P0 | Implemented |
