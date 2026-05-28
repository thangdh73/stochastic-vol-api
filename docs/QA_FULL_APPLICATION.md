# QA: Full application test plan (Dashboard → Export)

End-to-end checklist for manual testing and **Cursor Agent as tester**. Covers every main tab, sub-tab, and key option.

**Related:** dependency / multi-tank deep tests → [`QA_DEPENDENCY_SCENARIOS.md`](./QA_DEPENDENCY_SCENARIOS.md)

---

## How to use with Cursor Agent

1. Attach: `@docs/QA_FULL_APPLICATION.md` (+ `@docs/QA_DEPENDENCY_SCENARIOS.md` for group cases).
2. Run **one track** at a time (Track A or B), then **Cross-cutting** (X1–X12).
3. For each row: **Pass / Fail / Notes**. On Fail: *"Fix scenario {ID}; minimal patch; retest {ID}."*
4. After fixes: re-run **Smoke** (bottom) + any failed IDs.

### Copy-paste: full regression

```
@docs/QA_FULL_APPLICATION.md
@docs/QA_DEPENDENCY_SCENARIOS.md
Act as QA tester for MMRA Major Update. Run Track A (Area method) sections 1–12, then Cross-cutting X1–X12, then dependency smoke S0–S5.
Report table: ID | Pass/Fail | Notes | Fix (if any).
Backend must be Major Update on port 8010. Do not change unrelated code.
```

### Copy-paste: single page deep dive

```
@docs/QA_FULL_APPLICATION.md
Fully test section 6 (HC Yield) — every toggle and distribution type on 2 tanks. Fix any bug found.
```

---

## Prerequisites

| Item | Value |
|------|--------|
| Backend | `http://127.0.0.1:8010` — verify `GET /api/debug/schema` path contains `MMRA Major Update` |
| Frontend | `http://localhost:5174`, `VITE_API_PORT=8010` |
| Browser | DevTools console open (no uncaught errors) |
| Data | At least one **multi-tank** project (2 reservoirs × 2+ segments) for tank-switch tests |
| QA dummy | Dashboard → **Load QA full dummy** (3 segments × 2 reservoirs, PM3X-D inputs, 5 groups) |

**Two volumetric tracks** (run both over time):

- **Track A:** Estimating method = **Area × Net Pay × HC Yield**
- **Track B:** Estimating method = **NRV × HC Yield** (GRV / direct NRV paths)

---

## 1. Dashboard (`/`)

| ID | Action / option | Expected |
|----|-----------------|----------|
| D1 | API status card | Shows ok / version when backend up; error if down |
| D2 | **New prospect** | Fresh input; module checklist resets; no stale simulation |
| D3 | Project name field + **Save project** (new) | Creates prospect; success message; appears in saved list |
| D4 | **Save project** (existing) | Updates metadata + input set; multi-tank note if >1 tank |
| D5 | **Open** saved project | Loads inputs + envelope (`tank_envelope_v1`); segments/reservoirs restored |
| D6 | **Delete** project | Removed from list; confirm if prompted |
| D7 | **Edit inputs →** | Navigates to Prospect Setup with loaded data |
| D8 | Module completion checklist | Status matches inputs (Todo / OK / Blocked); updates after QA or sim |
| D9 | Sidebar nav badges | Consistent with module status after D2–D8 |

---

## 2. Prospect Setup (`/prospect`)

**Sub-tabs:** Estimating Method | Units | Dependency groups | Prospect & Settings  
**Always visible:** Reservoir and segment manager

### 2a Estimating Method

| ID | Action | Expected |
|----|--------|----------|
| P1 | Select **Area × Net Pay × HC Yield** | Sidebar shows Area + Net Pay; route guard blocks `/nrv` |
| P2 | Select **NRV × HC Yield** | Sidebar shows NRV / GRV; `/area` redirects to NRV path |
| P3 | **Diagram** / **Explain** modals | Open/close; correct method content |
| P4 | **Next: Area** or **Next: NRV** | Correct next page for method |
| P5 | Banner **Change method** | Returns to estimating tab; volumetric nav updates |

### 2b Units

| ID | Action | Expected |
|----|--------|----------|
| P6 | Area input unit | Persists; reflected on Area page |
| P7 | Rock volume / GRV / NRV units | Persists on NRV page |
| P8 | Oil / gas / total BOE units | Results/charts labels match |
| P9 | GOR unit | HC Yield / results consistent |

### 2c Dependency groups

| ID | Action | Expected |
|----|--------|----------|
| P10 | Add / edit / delete group | CRUD works; matrix rows/cols update |
| P11 | **Load example** (≥3 segments) | 5 example groups; see dependency doc S1 |
| P12 | Invalid membership (same param in 2 groups) | Blocked or clear warning |

### 2d Prospect & Settings

| ID | Action | Expected |
|----|--------|----------|
| P13 | Prospect name, zone, fluid type | Persists; `gas_condensate` shows condensate fields on HC Yield |
| P14 | Country, basin, formation | Saved in project metadata |
| P15 | Iterations (≥1000), seed | Used in simulation result |
| P16 | Notes | Saved with project |

### 2e Reservoir & segment manager

| ID | Action | Expected |
|----|--------|----------|
| P17 | Add / rename / remove segment | Tank grid updates; active tank valid |
| P18 | Add / rename / remove reservoir | Same |
| P19 | Reorder segments/reservoirs | Order reflected in breakdown tables |
| P20 | Shared NTG / shared HC yield / shared correlation flags | Behavior matches labels (legacy path) |
| P21 | **ValidateBar → Run QA/QC** | Validation report; link to `/qaqc` |
| P22 | No prospect (`WorkflowGate`) | Prompt to start from Dashboard |

---

## 3. Area (`/area`) — Track A only

| ID | Action | Expected |
|----|--------|----------|
| A1 | **TankSelectorStrip** — switch tank | Per-tank area inputs isolated |
| A2 | Closed area distribution (P90/P50/P10, fixed, etc.) | Accepts values; validation sane |
| A3 | % fill, GCF | Updates; QC charts react |
| A4 | **Complex traps** panel (enable, elements, caps) | Trap scenario summary updates |
| A5 | **Run Area simulation** (module preview) | Preview completes; Area workbook charts |
| A6 | Productive Area QC charts | Render after module run |
| A7 | **ValidateBar** | QA/QC + nav to detail |
| A8 | **Next: Net Pay** | Navigation works |

---

## 4. Net Pay (`/net-pay`) — Track A only

| ID | Action | Expected |
|----|--------|----------|
| N1 | Thickness unit display (ft/m) | Toggle/display correct |
| N2 | Net pay distribution form | Per-tank values |
| N3 | Optional GCF card | Enable/disable |
| N4 | **ModuleQcSection → Run Net Pay simulation** | Histogram QC for net pay |
| N5 | **ValidateBar** | OK |
| N6 | **← Area** / **Next: HC Yield** | Nav OK |

---

## 5. NRV / GRV (`/nrv`) — Track B only

| ID | Action | Expected |
|----|--------|----------|
| R1 | Entry mode: **GRV × Fill × NTG** vs **Direct NRV** | UI switches; correct fields |
| R2 | GRV, fill, NTG distributions | Sample in module QC |
| R3 | GRV–NTG Spearman ρ | Accepted; validation |
| R4 | Direct NRV + optional multiplier | NRV results section updates |
| R5 | **NtgSharingPanel** | Shared vs per-tank NTG |
| R6 | **Show/Hide advanced** | Complex traps; area–NP cross-check |
| R7 | **TankNrvMatrix** | All tanks listed; edit one cell |
| R8 | **ModuleQcSection → Run NRV simulation** | QC histograms |
| R9 | Cross-check warnings | Shown when inconsistent |
| R10 | **ValidateBar** | OK |

---

## 6. HC Yield (`/hc-yield`) — both tracks

| ID | Action | Expected |
|----|--------|----------|
| H1 | Tank selector + scope badge | Per-tank porosity, Sw, recovery, FVF |
| H2 | **HcYieldSharingPanel** | Shared vs per-tank yield |
| H3 | Oil: **Include solution gas** | Affects oil/gas split |
| H4 | Oil: **Apply oil recovery** | Toggle behavior |
| H5 | Oil distributions (porosity, Sw, recovery, FVF, GOR, …) | All dist types usable |
| H6 | Gas distributions (+ **condensate** if `gas_condensate`) | Condensate yield field visible |
| H7 | **Run HC Yield simulation** (module) | Module QC charts |
| H8 | **ValidateBar** | OK |
| H9 | Back / **Next: Chance** | Nav from Net Pay or NRV |

---

## 7. Chance (`/chance`)

| ID | Action | Expected |
|----|--------|----------|
| C1 | **Include chance (Pg)** off | Pg not applied; preview still runs |
| C2 | **Include chance (Pg)** on | Pg preview / risk review visible |
| C3 | Risk model: **CCOP (2000)** | Descriptor dropdowns + comments |
| C4 | Risk model: **Legacy** | 5 categories; sub-factors; **+ Add sub-factor** |
| C5 | Switch CCOP ↔ Legacy | Form swaps; no crash |
| C6 | **Run Chance simulation** | Module summary updates |
| C7 | Per-tank chance if multi-tank | Tank strip works |
| C8 | **ValidateBar** | OK |

---

## 8. Correlations (`/correlations`)

| ID | Action | Expected |
|----|--------|----------|
| K1 | **Group dependencies** section when groups exist | Matrix grid; mode: independent / rank / Gaussian |
| K2 | Edit group ρ cells | Persists; symmetric |
| K3 | **Per-tank** sampling mode + matrix | When no groups or legacy path |
| K4 | **Add recommended pairs** | Pairs appear in table |
| K5 | Enable pair, edit ρ, notes | Saved on tank |
| K6 | **CorrelationSharingPanel** | Shared correlation flag |
| K7 | Change correlations after full sim | Warning / sim cleared (if implemented) |
| K8 | **Continue to Simulation** | `/simulation` loads |
| K9 | With example groups | Group matrix primary; legacy demoted note |

---

## 9. Simulation (`/simulation`)

| ID | Action | Expected |
|----|--------|----------|
| S1 | **Run QA/QC** | Validation panel populated |
| S2 | **Run simulation** with errors | Blocked; message to fix validation |
| S3 | **Run simulation** clean | Navigates to `/results`; arrays included |
| S4 | **Save project & run** | Creates/updates prospect + sim |
| S5 | Multi-tank banner | Shows tank count when envelope >1 |
| S6 | **InputSummary** | Reflects active method + tanks |
| S7 | **ValidationPanel** | Errors/warnings/advisories listed |
| S8 | Group context sent (debug) | Multi-tank + groups: breakdown in response |

---

## 10. Results (`/results`)

| ID | Action | Expected |
|----|--------|----------|
| T1 | No simulation | Prompt to run simulation |
| T2 | Prospect summary table | P90/P50/Mean/P10 for totals |
| T3 | **Breakdown by reservoir** | Rows + contribution % |
| T4 | **Breakdown by segment** | Same |
| T5 | **Breakdown by tank** | Same; sums ≈ 100% contribution |
| T6 | Link to **Charts & QC** | Nav works |
| T7 | Pg-risked columns (if chance on) | Present when applicable |

---

## 11. Charts & QC (`/charts`)

| ID | Action | Expected |
|----|--------|----------|
| G1 | No input | Link to Prospect Setup |
| G2 | Input, no sim | Info: run sim for Spearman; OAT still available |
| G3 | Sim without arrays | Warning to re-run with arrays |
| G4 | **Resource outputs** charts | Histogram, exceedance, percentiles |
| G5 | **Input QC** histograms | Marginals from arrays |
| G6 | **Scatter** charts | Presets + configurable pairs |
| G7 | Tornado: **Spearman (MC)** | Needs arrays; drivers listed |
| G8 | Tornado: **Workbook OAT** | P10/P90 swings; refresh works |
| G9 | OAT **scope**: prospect / reservoir / segment / tank | Chart + base value change |
| G10 | OAT with **groups** | Group driver names; debug `group OAT: on` |
| G11 | Target selector (e.g. total_mmboe, giip_bcf) | Chart retargets |

---

## 12. QA / QC (`/qaqc`)

| ID | Action | Expected |
|----|--------|----------|
| Q1 | No validation yet | Prompt to run QA/QC from input pages |
| Q2 | After **Run QA/QC** | **ValidationPanel** full report (errors/warnings) |
| Q3 | Link to **Charts** when sim + arrays | Nav works |
| Q4 | Read-only (no duplicate run button on page) | Consistent with ValidateBar source |

---

## 13. Export (`/export`)

| ID | Action | Expected |
|----|--------|----------|
| E1 | No input | Prompt to load inputs |
| E2 | **Download CSV (zip)** | File downloads; non-empty zip |
| E3 | **Download Excel** | `.xlsx` downloads; opens in Excel |
| E4 | Export after multi-tank + groups | All tanks / metadata in bundle |
| E5 | Export failure | Clear error (alert or message) |

---

## Cross-cutting (all tabs)

| ID | Scenario | Expected |
|----|----------|----------|
| X1 | **WorkflowGate**: open any input page without prospect | Redirect / New prospect prompt |
| X2 | **EstimatingMethodBanner** on every page | Correct workflow string |
| X3 | Sidebar order + active highlight | Matches current route |
| X4 | **ValidateBar** on Prospect, Area, Net Pay, NRV, HC, Chance, Correlations, Simulation | Same QA API; badge counts |
| X5 | Switch tank mid-workflow | Inputs don’t bleed between tanks |
| X6 | Save → Open → same values | Including envelope, groups, matrix |
| X7 | **New prospect** after heavy session | Clean state |
| X8 | Invalid API port | Dashboard health fails gracefully |
| X9 | Low iterations (if allowed <1000) | Validation warning or block |
| X10 | Oil vs gas vs gas_condensate fluid | Correct fields and result columns |
| X11 | Browser refresh mid-session | In-memory state lost unless saved — document behavior |
| X12 | 404 / unknown route | Redirect to Dashboard |

---

## Module preview matrix (tab-scoped MC)

Run on **each** module button once per track:

| Module | Page | Button |
|--------|------|--------|
| Area | `/area` | Run Area simulation |
| Net pay | `/net-pay` | Run Net Pay simulation |
| NRV | `/nrv` | Run NRV simulation |
| HC Yield | `/hc-yield` | Run HC Yield simulation |
| Chance | `/chance` | Run Chance simulation |

**Pass:** completes without API error; QC section shows charts where applicable.

---

## Smoke (after any code change)

| ID | Check |
|----|--------|
| SM1 | Dashboard health OK |
| SM2 | New prospect → Save → Open |
| SM3 | Track A: Area → Net Pay → HC → Chance → Correlations → Sim → Results → Charts |
| SM4 | Track B: NRV → HC → … (same tail) |
| SM5 | Run QA/QC + view `/qaqc` |
| SM6 | Export CSV + Excel |
| SM7 | Dependency smoke S0–S2 from `QA_DEPENDENCY_SCENARIOS.md` |

---

## Test execution log (template)

| Date | Tester | Track | Sections | Pass | Fail IDs | Notes |
|------|--------|-------|----------|------|----------|-------|
| | | A / B | 1–13 + X | | | |

---

## Agent fix protocol

When Agent finds a bug:

1. Reproduce with exact **ID** and steps.
2. Identify layer: UI / API client / backend route / engine.
3. Minimal fix + note which smoke IDs to re-run.
4. Do **not** regress other track (A vs B).
