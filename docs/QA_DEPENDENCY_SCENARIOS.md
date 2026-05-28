# QA: Dependency & multi-tank scenarios

Use this doc with Cursor Agent (`@docs/QA_DEPENDENCY_SCENARIOS.md`) to regression-test grouping, correlations, simulation, results breakdown, and tornado scope.

**Full app (every tab):** see [`QA_FULL_APPLICATION.md`](./QA_FULL_APPLICATION.md) — Dashboard through Export, both estimating methods, QA/QC, Charts, Export.

## Prerequisites

- Backend: `http://127.0.0.1:8010` (Major Update codebase, not old `3-MMRA Web Project`)
- Frontend: `http://localhost:5174` with `VITE_API_PORT=8010`
- At least **3 segments** and **2 reservoirs** (for compartment / multi-tank cases)
- Save project after each scenario (Dashboard) so envelope persists

## Agent tester workflow

1. **Run one scenario** from the table below (manual steps).
2. **Record**: Pass / Fail / Notes (screenshot if UI wrong).
3. If Fail, tell Agent: *"Fix the bug for scenario X; root cause + minimal patch + retest steps."*
4. Re-run **smoke** scenarios (S0, S1) after any fix.

## Smoke (run every time)

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| S0 | No groups | No uncertainty groups; run simulation; OAT tornado | Legacy per-variable drivers OK; simulation completes |
| S1 | Example groups | Prospect Setup → Dependency groups → Load example (needs ≥3 segments) | 5 groups created; Correlations shows group matrix |
| S2 | Group OAT | Charts → Workbook OAT → Refresh | Debug: `response group OAT: on`; driver labels = **group names** (not "NRV direct" only) |
| S3 | Multi-tank MC | Simulation with ≥2 tanks | Results show prospect total; optional breakdown tables |
| S4 | Results breakdown | Results page after S3 | Tables: By reservoir, By segment, By tank; contribution % sums ~100% |
| S5 | Tornado scope | Charts → OAT → scope Reservoir / Segment / Tank | Chart updates; base value changes by scope |

## Dependency scenarios (deeper)

| ID | Setup | What to verify |
|----|--------|----------------|
| D1 | Two porosity groups on R1 (S1+2 vs S3) | Only S1,S2 move together in MC when groups correlated; S3 independent |
| D2 | GRV group all segments + all reservoirs | One GRV driver in group OAT; affects all listed tanks |
| D3 | Group matrix: Poro↔Sw −0.8 in S1+2 block only | No cross-correlation S1,2 vs S3 porosity in matrix |
| D4 | `group_correlation_mode = independent` | Groups exist but MC uses independent group latents (no cross-group ρ) |
| D5 | `group_correlation_mode = rank` | MC runs; no validation errors |
| D6 | Overlap same tank in two groups (same parameter) | Save should **block** or warn (membership conflict) |
| D7 | Single tank only | Group OAT still works (fallback); breakdown shows one tank row |
| D8 | Switch active tank | Correlations / HC / NRV per-tank values change; group matrix unchanged |
| D9 | Reload saved project | Groups + matrix restored from `tank_envelope_v1` |
| D10 | Fluid: gas condensate + NRV direct | Group drivers include GRV or NRV as applicable; tornado target GIIP works |

## API checks (optional — Agent can run)

```powershell
# Health + correct schema module
Invoke-RestMethod http://127.0.0.1:8010/api/debug/schema | Select-Object schemas_module_file
# Expect path contains: MMRA Major Update\backend
```

OpenAPI should include `context` on tornado request when backend is correct.

## Known environment pitfalls

| Symptom | Likely cause |
|---------|----------------|
| Group OAT off; server groups 0 | Wrong backend process or port (old project on 8002) |
| Legacy drivers despite groups | Frontend not sending `context` or stale API |
| Breakdown tables empty | Single-tank run (no `breakdown` in response) |
| Port bind error | Kill old uvicorn; use 8010 |

## Copy-paste prompts for Cursor Agent

### Full regression pass

```
@docs/QA_DEPENDENCY_SCENARIOS.md
Act as QA for MMRA Major Update. Run smoke S0–S5 and dependency D1–D6 in order.
For each failure: reproduce, identify root cause (frontend/backend/engine), apply minimal fix, and note retest ID.
Do not change unrelated features. Report a table: Scenario | Pass/Fail | Fix file(s).
```

### Single scenario + fix

```
@docs/QA_DEPENDENCY_SCENARIOS.md
Test scenario D2 (GRV group all segments/reservoirs). Steps in the doc.
If broken: fix and tell me what to click to verify.
```

### Stability after fix

```
After your fix, re-run smoke S1, S2, S3 and pytest/unit tests under engine/tests if scipy available.
Confirm no regression in single-tank legacy path.
```

## Pass criteria summary

- **Stable**: No console errors; simulation completes; saved project reloads.
- **Groups**: Membership rules enforced; matrix edits persist.
- **MC**: Grouped parameters share chance path; ungrouped stay per-tank.
- **Tornado**: Group names when groups active; scope selector changes OAT base.
- **Results**: Breakdown reconciles to prospect total (mean contribution ~100%).
