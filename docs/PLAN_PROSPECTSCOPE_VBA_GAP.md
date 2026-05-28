# Plan — ProspectScope vs Repsol MMRA v4.4 VBA

**Source workbook:** `H:\MMRA v4-4-051 CustomizedRepsol 20160923 - OFFICIAL.xls` (Rose-style MMRA, Repsol customization, Sep 2016)  
**Target app:** ProspectScope (`D:\1-Projects\8-Python code\3-MMRA Web Project`)  
**Date:** 2026-05-26  
**Status:** Planning only — no code changes in this document

---

## 1. Executive summary

The Repsol workbook is a **full probabilistic resource & commercial risk platform** (~55 VBA modules, 20+ user forms, 10+ estimating methods). ProspectScope already implements the **core pre-drill volumetric + CCOP chance** path well (engine tests, PM3X-D anchor, module previews).

This plan prioritizes **parity where Repsol users need it**, without cloning every macro. Work is split into **backend (engine + API)** and **frontend (UX + workflow)**, in four phases over ~6–9 months of focused effort.

**Naming note:** Do not use “MMRA” in user-facing branding (Rose Associates). Internal code module names (`mmra_engine`) can stay until a refactor milestone.

---

## 2. VBA inventory (what the workbook actually contains)

### 2.1 Core simulation engine

| VBA module | Key procedures | ProspectScope today |
|------------|----------------|---------------------|
| `Reserve_simulation.bas` | `Main_simulation`, `Post_reserves`, `Post_chance`, `Post_Plotting_Values`, `Calculate_thresholds`, `Calculate_limits` | **Partial** — `run_simulation()` covers ATR/NRV MC; no commercial/econ chance layers |
| `Generic_Distribution_Code.bas` | Distribution dialogs, low/high clip, admin bounds per variable | **Partial** — engine supports clip bounds; UI incomplete for all variables |
| `Copulas.bas` | Gaussian copula, Kendall τ, `Build_Copula_Array`, MVN | **Partial** — rank + Gaussian copula in engine; not all workbook ρ pairs |
| `custom_functions.bas` | `Lg_Mean`, `Lg_STD`, `Norm_Mean`, percentile helpers | **Mostly done** in `distributions.py` / `stats.py` |

### 2.2 Estimating methods (`Simulation_options.frm`)

Workbook supports **mutually exclusive** source modes:

| Mode | VBA trigger | ProspectScope |
|------|-------------|---------------|
| ATR (Area × Pay × Yield) | `Source_ATR` | **Done** (`area_net_pay_yield`) |
| NRV / GRV × N/G × Yield | `Source_NRV` | **Done** (`nrv_grv_yield`) |
| Area–Depth | `Source_AreaDepth` | **Not implemented** |
| Classic Quick Look ATY | `Source_Classic_ATY` | **Not implemented** |
| Classic Quick Look NRV | `Source_Classic_NRV` | **Not implemented** |
| Direct resource entry | `Source_DirectEntry` | **Partial** (NRV direct only) |
| Scenarios 1–4 | `Source_Scenario_Type1…4` | **Not implemented** |
| Rate × Time | `Source_RateTime` | **Not implemented** |

### 2.3 Chance & risk (`Chance Checklist`, `SimOptions_accept.bas`, `Post_Summary`)

| Feature | VBA | ProspectScope |
|---------|-----|---------------|
| 5 categories × sub-factors | Weak-link min per category | **Legacy mode** — done |
| Play / Prospect / Shared columns | Adequacy matrix + normalized factors | **Not implemented** |
| CCOP-style 4-factor risk | Not in this VBA (Repsol uses classic checklist) | **Done** (CCOP v1 — your enhancement) |
| Reference values from volumes | `Get_Chance_Reference_Values()` links P90 area, P90 net pay, P99 resources to chance rows | **Not implemented** |
| Geologic / Commercial / Economic success | `Post_chance()` — Chance1, Chance2 (Pmcfs), Chance3 (Pmefs) | **Geologic only** (Pg) |
| Scenario-specific Pg | Weighted scenario Pg in `Post_chance` | **Not implemented** |
| Risk review comments | Comments forms | **Partial** (CCOP rationale notes) |

### 2.4 Post-processing & reporting

| VBA | Purpose | ProspectScope |
|-----|---------|---------------|
| `Post_Summary.bas` | `Update_Summary_*` per method (ATY, NRV, AreaDepth, Scenario, SurfLoss…) | **Partial** — Results table only |
| `Post_reserves` | Sort iteration array; P99–P01 + extended RAPT percentiles; unit conversion factors | **Partial** — P99–P01 + trimmed mean |
| `Chart_code.bas` | Scale area/net pay/NRV/resource charts | **Partial** — Charts tab |
| `PostAudit_*` | Pre vs post-drill columns | **Not implemented** |
| `Data_Exchange_Code.bas` | Import/export data files, MMRA 3.x/4.x migration | **Not implemented** |
| `Production_rate_code.bas` | Rate–time forecast export | **Not implemented** |

### 2.5 UI / workflow (forms)

Major dialogs not in web app: `Area_Depth_Input`, `HC_Rec_Wizard`, `NetPay_Options_wizard`, `NRV_Options_wizard`, `Scenario_inputs1–4`, `PostAudit_selection`, `Import_form`, `Print_options`, `Goal_seek3`, `Quick_Input`, `RateTime_Input`, `Reserve_DirectEntry`, `SurfLoss_Input`, `OilProp_Input`.

---

## 3. Gap analysis — backend

### 3.1 Already strong (keep, test, document)

- Monte Carlo volumetrics (oil / gas / condensate)
- P10-large percentiles + trimmed mean
- CCOP chance + risk review JSON
- Module-scoped previews
- Validation framework
- Perturbation (OAT) tornado
- Complex traps (Method A/B)
- Resource units (MMBO, Bscm, etc.)

### 3.2 Backend gaps (prioritized)

| Priority | Gap | VBA reference | Backend work |
|----------|-----|---------------|--------------|
| **P0** | Play/Prospect chance columns | Chance Checklist worksheet change handlers | Extend `chance.py` or map CCOP; schema `chance_mode: workbook \| ccop` |
| **P0** | Chance reference values from MC outputs | `Get_Chance_Reference_Values` | Post-simulation hook: write P90 area, P90 NP, P99 MMBOE into chance metadata |
| **P0** | Output truncation percentiles | `Apply_TruncMean`, `OutTrunc_Lo/Hi` in `Main_simulation` | Engine: apply output clip before stats; expose in sim options API |
| **P1** | Full correlation matrix parity | `Build_Copula_Array`, 10+ named copula arrays in `Reserve_simulation` | Expand `correlation.py` variable list; document τ vs ρ |
| **P1** | Direct recoverable entry (oil/gas) | `Reserve_DirectEntry`, `Source_DirectEntry` | New estimating method bypassing volumetrics |
| **P1** | Scenario MC (5 cases) | Scenario1–5 arrays in `Reserve_simulation` | New `scenario_mode` engine module |
| **P2** | Area–Depth GRV integration | `AreaDepth_Calc`, `Post_AD_Iterations` | New engine submodule (large) |
| **P2** | Commercial / economic chance | `Post_chance` Chance2/3, `Calculate_thresholds` | Threshold engine + Pmcfs/Pmefs from volume CDF |
| **P2** | Extended percentile grid (RAPT) | `Post_reserves` P75, P66, P33, etc. | Optional extra columns in `PercentileSummary` |
| **P3** | Workbook import/export | `Import_from_MMRA4xFile`, `Export_to_DataFile` | Separate migration project; legal review |

### 3.3 API changes (cross-cutting)

| Endpoint / schema | Change |
|-------------------|--------|
| `SimulationInput` | Add `output_truncation`, `chance_mode`, `workbook_chance`, `scenario_config`, `commercial_thresholds` |
| `/api/simulate` | Return `risk_review`, `chance_reference_values`, `run_metadata` |
| `/api/simulate/preview` | Chance preview must always receive hydrated `ccop_risk` (fixed) |
| `/api/validate` | Module-scoped rules per estimating method |
| `/api/import/workbook` | **Future** — staged import from Repsol xls (read-only OLE) |
| `/health` | Report engine feature flags (already partially done) |

---

## 4. Gap analysis — frontend

### 4.1 Already strong

- Guided workflow (Prospect → Volume → HC Yield → Chance → Correlations → Simulation → Results)
- CCOP chance UI with descriptor lookups + Pg risk review table
- Method-conditional navigation (Area/Net Pay vs NRV)
- Charts + OAT tornado
- Project save/load (SQLite)

### 4.2 Frontend gaps (prioritized)

| Priority | Gap | VBA reference | Frontend work |
|----------|-----|---------------|-----------------|
| **P0** | Chance Play/Prospect grid | Chance Checklist sheet | New `WorkbookChanceForm` or extend Chance tab with 3-column matrix |
| **P0** | Auto-linked chance references | `Get_Chance_Reference_Values` | Read-only chips showing P90 area / P90 NP after Area/Net Pay preview |
| **P0** | Results = single authoritative table | `Post_Summary`, `Post_reserves` | Unified Results layout (unrisked + risked + Pg review) — **in progress** |
| **P0** | Module completion / workflow status | Implicit in workbook wizards | Sidebar badges (partially exists); block Simulation until Chance complete |
| **P1** | Simulation options dialog parity | `Simulation_options.frm` | “Run settings” drawer: truncations, product toggles, iteration count |
| **P1** | Summary sheet equivalent | `Update_Summary_General` | Printable Summary page (prospect metadata + key P50/P90 + Pg) |
| **P1** | Net Pay GCF + unit conversion UI | `NetPay_Options_wizard` | GCF on Net Pay tab; m↔ft conversion |
| **P1** | HC Yield wizard completeness | `HC_Rec_Wizard` | Condensate chain visibility; solution gas toggles aligned with engine |
| **P2** | Scenario decision tree UI | `Scenario_DecisionTree.frm` | New Scenario module |
| **P2** | Post-audit workflow | `PostAudit_*` | New Post-Audit tab |
| **P2** | Import from Repsol xls | `Import_form` | Upload wizard + mapping report |
| **P3** | Print / PowerPoint export | `Print_options`, `Powerpoint_Button_Click` | Export templates |

### 4.3 UX principles (from VBA pain points)

1. **One estimating method active** — mirror `Simulation_options` mutual exclusion (already started for CCOP vs legacy).
2. **Wizards → progressive forms** — break `HC_Rec_Wizard` / `NRV_Options_wizard` into stepped cards, not one giant page.
3. **Comments everywhere** — extend CCOP rationale pattern to legacy chance and volume inputs.
4. **Run date / audit trail** — mirror `Workbook_BeforePrint` headers on Summary export.

---

## 5. Recommended roadmap

### Phase A — Chance & results parity (4–6 weeks)

**Goal:** Repsol geologic chance users can run one case end-to-end with familiar outputs.

| # | Backend | Frontend |
|---|---------|----------|
| A1 | Workbook chance model: Play×Prospect product per category + weak-link | 3-column chance grid + comments |
| A2 | `chance_reference_values` from preview/simulation percentiles | Display linked P90 area / NP on Chance tab |
| A3 | Ensure `risk_review` always in `pg_result` and preview | Single Results + Chance Pg review table (done) |
| A4 | Validation rules for CCOP vs workbook modes | Toggle persists; API sends correct payload |
| A5 | Golden tests from Repsol PM3X-D / internal case | Regression script in CI |

**Exit criteria:** One Repsol-style prospect reproduces Pg and Pg-risked MMBOE within agreed tolerance; chance sheet shows reference values.

### Phase B — Simulation fidelity (6–8 weeks)

**Goal:** Match workbook statistical behaviour for core ATR/NRV paths.

| # | Backend | Frontend |
|---|---------|----------|
| B1 | Output truncation (Apply_TruncMean) | Sim options UI |
| B2 | Expand correlation pairs to workbook set | Correlations matrix UI improvements |
| B3 | Direct recoverable entry method | Prospect Setup option + Results |
| B4 | Extended diagnostics in validation | QA/QC grouped by module |
| B5 | Run metadata (timestamp, engine version, input hash) on Results | Results header |

### Phase C — Advanced methods (8–12 weeks)

**Goal:** Optional modules for power users.

| # | Backend | Frontend |
|---|---------|----------|
| C1 | Scenario types 1–2 (area/pay/yield scenarios) | Scenario inputs pages |
| C2 | Commercial success (Pmcfs) from volume threshold | Threshold config + Chance tab |
| C3 | Quick Look classic ATY/NRV (parametric lognormal) | Quick Look form |
| C4 | Area–Depth (scoped spike) | Area–Depth wizard |

### Phase D — Migration & reporting (ongoing)

| # | Backend | Frontend |
|---|---------|----------|
| D1 | Read-only Repsol `.xls` input extractor (no VBA execution) | Import wizard |
| D2 | Summary / printable report | Summary page + PDF |
| D3 | Post-audit column model | Post-audit tab |
| D4 | Data exchange file format | Import/export projects as JSON + optional Excel |

---

## 6. Architecture recommendations

### 6.1 Engine layering (target)

```
prospectscope_engine/
  core/           # distributions, stats, rng
  volumetrics/    # area, net pay, nrv, hcpv, products
  chance/         # legacy_workbook.py, ccop_v1.py
  commercial/     # thresholds, Pmcfs, Pmefs (phase C)
  scenarios/      # scenario MC (phase C)
  area_depth/     # optional submodule (phase C)
  simulation.py   # orchestrator only
  validation.py
  export.py
```

Rename from `mmra_engine` only when migration tests are green (avoid big-bang rename).

### 6.2 Frontend layering

```
constants/        # appBranding, chance lookups, units
features/
  chance/         # CcopChanceForm, WorkbookChanceForm, PgRiskReview
  volume/         # Area, NetPay, NRV
  results/        # ResultsTable, SummaryReport
  charts/
pages/            # thin route wrappers
```

### 6.3 Validation strategy

| Layer | Approach |
|-------|----------|
| Unit | Keep pytest coverage on each formula change |
| Workbook parity | PM3X-D + 2 Repsol cases (extract inputs manually from xls) |
| API | Contract tests on `SimulationInput` schema |
| UI | Playwright smoke: new prospect → simulate → results visible |

---

## 7. Risks & constraints

| Risk | Mitigation |
|------|------------|
| Rose IP / MMRA trademark | ProspectScope branding only; no MMRA in UI; legal review before import/export |
| VBA not fully documented | Empirical validation against frozen workbook outputs, not line-by-line port |
| Scope explosion (10+ estimating methods) | Mutual exclusion; phase gates; default = ATR + CCOP |
| `.xls` binary format | Use `oletools` / named-range map; don’t execute VBA |
| User expects 100% chart parity | Publish “reference workbook vs this build” matrix (Charts page started) |

---

## 8. Immediate next steps (if you approve Phase A)

1. **Extract named ranges** from Repsol xls into `docs/workbook_maps/repsol_v4_named_ranges.csv` (script).
2. **Define Workbook chance schema** in `SimulationInput` (Play/Prospect/Shared arrays).
3. **Implement `workbook_chance.py`** parallel to `ccop_chance.py`.
4. **Build `WorkbookChanceForm.tsx`** with reference-value panel fed by module previews.
5. **Add Repsol validation case** JSON + pytest target Pg/MMBOE.

---

## 9. Decision points for you

Before implementation, please confirm:

1. **Primary chance model:** CCOP only, Workbook (Play/Prospect) only, or both selectable?
2. **Phase A scope:** Is Play/Prospect chance required for Repsol parity, or is CCOP enough?
3. **Estimating methods:** Stay on ATR + NRV for 2026, or prioritize Area–Depth / Scenarios?
4. **Import:** Do you need one-way import from `…OFFICIAL.xls`, or greenfield only?

---

*VBA extract: `olevba` on Repsol file — 55 modules including `Reserve_simulation.bas` (Main_simulation ~4,800 lines), `Copulas.bas`, `Post_Summary.bas`, 30+ UserForms.*
