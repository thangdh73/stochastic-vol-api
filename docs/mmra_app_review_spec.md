# MMRA-style Subsurface Risk and Resource App: Review Specification

Prepared for review before any implementation work.

## Purpose

This document converts the attached MMRA workbook into a review-ready plan for a modern web application. The intent is not to begin coding immediately, but to define the functional scope, calculation logic, user workflow, technical architecture, validation approach, and decision gates so the app can be built in a controlled and auditable way.

The workbook is a mature Excel/VBA probabilistic resource and risk-analysis system. It contains many hidden calculation and storage layers, macro-driven workflows, distribution controls, chance-factor logic, charts, and summary outputs. Therefore, the correct approach is to treat it as a legacy application requiring staged functional decomposition, not as a simple spreadsheet conversion.

## Executive Summary

The recommended path is to build the app in two review-first stages:

- **Stage A: Discovery and specification only**: complete functional mapping, MVP definition, calculation specification, UX workflow, architecture, and validation plan. No app code is written during this stage.
- **Stage B: Controlled MVP implementation**: only after approval, build a limited working app that handles prospect setup, key volumetric inputs, Monte Carlo simulation, chance assessment, resources summary, visualizations, and exports.

The proposed MVP should focus on a single-zone pre-drill exploration prospect workflow first. The full workbook includes broader features such as area-depth methods, scenario charts, post-audit, imports, direct-entry variants, commercial/economic threshold logic, and advanced admin configuration. Those should be treated as later phases unless explicitly required.

## Workbook Discovery Summary

### Workbook technical footprint

The workbook is a macro-enabled Excel application with the following observed characteristics:

- **Worksheets**: 21 logical workbook sheets, including visible, hidden, and very hidden sheets.
- **Formulas**: approximately 6,200+ formula cells across the workbook.
- **Defined names**: approximately 1,190+ defined names.
- **VBA**: a VBA project is present.
- **ActiveX controls**: approximately 87 ActiveX XML/bin pairs are present.
- **Charts and drawings**: approximately 31 chart XML objects and 19 drawing objects are present.
- **Hidden state layer**: several sheets are hidden or very hidden and appear to act as calculation, storage, import, export, and audit engines.

This is important because a direct visual rebuild would miss much of the calculation behavior. The app needs a functional rewrite of the model logic.

### Worksheet/module inventory

| Workbook area | Visibility | Primary role | Notes for app design |
|---|---:|---|---|
| Start & Input | Visible | Prospect setup and metadata | Project/prospect form in app |
| Admin | Visible | Standards, corporate settings, percentile convention, chance factors, locking options | Admin/configuration module |
| Admin 2 | Visible | Distribution type and clipping enable/disable matrix | Distribution configuration module |
| Notes & Comments | Visible | Rationale, geologic comments, analog notes | Assumption notes and audit trail |
| Area Depth Input | Hidden | Area-depth or GRV-depth input | Phase 2 or specialist module |
| Area Depth Results | Hidden | Area-depth simulation and charts | Phase 2 validation-heavy module |
| Area | Visible | Productive area input and output | MVP input module |
| Net Pay | Visible | Net pay, gross interval, NTG, geometric correction | MVP input module |
| NRV | Hidden | Net rock volume route | Phase 2 or alternate input method |
| HC Yield | Visible | Porosity, saturation, recovery, FVF, GOR, gas/condensate parameters | MVP input module |
| Sorting Worksheet | Very hidden | Internal sorting/helper area | Internal simulation service concern |
| Resources | Visible | In-place and recoverable resource outputs | MVP output module |
| Scatter Chart | Visible | Simulation relationship plots | MVP/phase 2 chart module |
| Scenario Charts | Hidden | Scenario comparison charts | Phase 2 |
| Chance Checklist | Visible | Play/prospect chance factors and adequacy matrix | MVP chance module |
| Summary | Visible | Input and output summary | MVP report page/export |
| Imports | Hidden | Imported data tables | Phase 2/3 import function |
| PDF Thumbnail Data | Hidden | Export/report support | Replace with modern report generation |
| Post Audit | Hidden | Post-drill/post-audit logic | Later phase |
| Data Storage | Hidden | Named range storage, settings, scenario data, correlations, truncation, simulation state | Backend data model and calculation state |
| Data Exchange | Hidden | Exchange tables for transfer/import/export | API/import/export service |

### Important workbook functions inferred from defined names and sheet structure

The workbook supports the following functional families:

- **Prospect metadata**: prospect name, business unit, country, basin, formation, lithology, operator, lease/block, lead/prospect classification.
- **Percentile conventions**: P10/P90 high-side or low-side convention appears configurable.
- **Distribution control**: lognormal, normal, beta, custom/imported, triangular, uniform, PERT-like options are indicated.
- **Clipping and truncation**: input and output truncation ranges exist; variable-level low/high clips exist.
- **Correlation controls**: area-pay, gross interval-NTG, GRV-NTG, porosity-saturation, porosity-recovery, FVF-GOR, and other correlations appear in named ranges.
- **Monte Carlo iterations**: 5,000 iteration settings are visible in resources summaries and simulation outputs.
- **Chance logic**: source, timing/migration, reservoir, closure, and containment chance categories are present with play/prospect splits and weak-link-style minimum factor logic.
- **Scenario logic**: at least five scenario slots exist, with area, net pay, yield, oil/gas resources, chance, Pg override, and scenario text/file-name fields.
- **Post-audit logic**: failure chance categories, post-audit funds/days-to-drill, and audit-related fields exist.

## Proposed Product Definition

### Working product name

For planning purposes, call the application **MMRA Web** or **Probabilistic Resource & Risk Evaluator**. A final product name can be chosen later.

### Target users

- Exploration geoscientists
- Reservoir engineers
- Petrophysicists
- Resource evaluators
- New ventures / business development teams
- Technical assurance reviewers

### Primary use case

The first version should allow a user to evaluate a single pre-drill exploration prospect using probabilistic volumetric inputs, Monte Carlo simulation, geologic chance assessment, and resource-summary outputs.

### Product principles

- **Auditability**: every result should trace back to inputs, distributions, truncation, chance factors, and assumptions.
- **Subsurface correctness**: calculations must use industry-standard volumetric and chance logic.
- **Workflow clarity**: users should move from prospect setup to assumptions, uncertainty, simulation, chance, results, and export.
- **Validation against legacy MMRA**: results should be compared against workbook examples before the app is considered reliable.
- **Modular expansion**: complex workbook features should be added as modules, not all at once.

## Scope Definition

### Recommended MVP scope

The MVP should include:

- Prospect/project setup
- Single-zone exploration prospect mode
- Area input module
- Net pay input module
- HC yield input module
- Basic chance checklist
- Monte Carlo simulation engine
- Resource summary output
- Probability/distribution charts
- Scatter plot for selected variables
- Input summary and assumptions page
- Export to CSV and Excel; PDF can be phase 2 if needed
- Basic QA/QC validation warnings

### Recommended phase 2 scope

Phase 2 should include:

- Area-depth / GRV-depth method
- NRV direct input route
- Scenario comparison module
- Post-audit module
- Import existing workbook cases
- Export formatted PDF summary
- Commercial/economic threshold logic
- More advanced correlation controls
- Saved templates and corporate standards

### Recommended phase 3 scope

Phase 3 should include:

- Multi-zone prospects
- Portfolio roll-up
- Shared project/team database
- Versioning and approval workflows
- Analogue database integration
- Advanced fiscal/economic screening
- Full workbook import/export compatibility
- API integration with subsurface databases or Petrel-derived exports

### Explicitly out of MVP unless requested

The following should be excluded from MVP to avoid uncontrolled scope growth:

- Full reproduction of every workbook sheet
- Full VBA macro equivalence
- ActiveX-style modal dialog replication
- Post-drill audit
- Full scenario chart engine
- Multi-zone aggregation
- Complete commercial/economic threshold engine
- Corporate locking/permission system
- Full legacy import/export compatibility

## Step-by-step Review and Build Plan

## Phase 1: Workbook Discovery and Functional Map

### Objective

Produce a clear map of what the workbook does and how its modules relate to each other.

### Tasks

- Map all visible, hidden, and very hidden sheets.
- Categorize each sheet as input, calculation, storage, output, chart, admin, import/export, or audit.
- Identify all user-facing workflows.
- Identify all internal engine workflows.
- Identify macro-dependent functions.
- Identify key named ranges and formula groups.
- Identify major outputs and charts.

### Deliverables

- Workbook architecture map
- Module inventory
- Legacy feature list
- Hidden logic and risk register

### Review questions

- Should the target app be a partial replacement or a full MMRA replacement?
- Should the MVP focus only on the most used workflow?
- Are there any workbook sheets that must be preserved exactly?

### Approval gate

Proceed only when the workbook functional map is accepted.

## Phase 2: Target App Scope and MVP Boundary

### Objective

Define exactly what the first app will and will not do.

### Tasks

- Define user personas and use cases.
- Select MVP workflow.
- Define required modules.
- Define out-of-scope features.
- Define future phases.
- Define target validation tolerance against Excel.

### Recommended MVP workflow

1. Create/select prospect.
2. Enter project metadata.
3. Enter area uncertainty.
4. Enter net pay uncertainty.
5. Enter HC yield uncertainty.
6. Enter chance factors.
7. Run Monte Carlo simulation.
8. Review volumetric/resource outputs.
9. Review chance-adjusted outputs.
10. Export summary.

### Deliverables

- MVP feature list
- Non-MVP feature list
- User workflow
- Development milestone list

### Review questions

- Is single-zone pre-drill exploration enough for MVP?
- Should the app include oil, gas, condensate, or all product types from day one?
- Should the app support imported/custom distributions in MVP?
- Should output match workbook percentiles exactly, or is technically equivalent logic acceptable?

### Approval gate

Proceed only when the MVP boundary is approved.

## Phase 3: Calculation and Data Model Specification

### Objective

Define the calculation model independent of Excel formulas and VBA.

### Core input groups

| Group | Example variables | MVP priority |
|---|---|---:|
| Prospect metadata | name, basin, formation, country, operator, lithology, fluid type | High |
| Area | closed area, percent fill, productive area | High |
| Net pay | net pay, gross interval, NTG, geometric correction | High |
| HC yield | porosity, HC saturation, recovery efficiency, FVF, GOR, GEF, condensate yield | High |
| NRV | net rock volume direct input | Medium |
| Area-depth | area/depth or GRV/depth pairs | Medium |
| Chance | source, timing/migration, reservoir, closure, containment | High |
| Commercial/economic thresholds | MCFS, MEFS, Pc, Pe | Medium |
| Scenario | scenario labels, overrides, resource snapshots | Medium |

### Distribution model

The app should support a distribution object for each uncertain input:

- Distribution type
- P90 value
- P50 value, if used
- P10 value
- Mode, if relevant
- Low clip
- High clip
- Units
- Percentile convention
- Truncation flag
- Correlation settings
- Notes/analog rationale

### Distribution types

MVP should support:

- Lognormal
- Normal
- Beta
- Triangular
- Uniform

Phase 2 should add:

- Custom/imported distribution
- PERT, if required
- Empirical histogram import

### Percentile convention

The workbook allows percentile convention control. The app must explicitly define whether:

- P90 means low-side/conservative value and P10 means high-side/upside value; or
- P90 means high-side value and P10 means low-side value.

Recommendation: use a clear label in the UI, for example:

- **P90 low / P10 high** for conventional resource uncertainty display, or
- **P10 large / P90 small** where legacy workbook naming requires it.

### Core volumetric formulas to specify

The final formula set should be reviewed before coding. At minimum, the app needs formulas for:

- Bulk rock volume or gross rock volume
- Net rock volume
- Pore volume
- Hydrocarbon pore volume
- Oil initially in place
- Gas initially in place
- Recoverable oil
- Recoverable gas
- Solution gas
- Condensate
- MMBOE conversion
- Chance-adjusted expected resources

### Chance model

The workbook indicates five main geologic chance categories:

- Source
- Timing / migration
- Reservoir
- Closure
- Containment

The app should support:

- Play segment chance
- Prospect/local chance
- Total chance
- Weak-link method within each category
- Overall Pg calculation
- Optional Pc and Pe for commercial/economic thresholds
- Comments and adequacy-rationale capture

### Correlation model

The app should support correlations, but the MVP can begin with a limited matrix. Candidate correlations include:

- Area to net pay
- Gross interval to NTG
- GRV to NTG
- Porosity to saturation
- Porosity to recovery efficiency
- FVF to GOR
- Oil yield to solution gas recovery

For MVP, recommend:

- Start with independent sampling by default.
- Add simple rank correlation where required.
- Defer full workbook-equivalent correlation locking to phase 2.

### Data model entities

Recommended entities:

- UserProject
- Prospect
- ReservoirZone
- InputVariable
- DistributionDefinition
- CorrelationDefinition
- ChanceAssessment
- SimulationRun
- SimulationResult
- ResourceSummary
- Scenario
- AssumptionNote
- AuditEvent
- ExportRecord

### Deliverables

- Calculation specification
- Data dictionary
- Formula table
- Distribution behavior rules
- Correlation rules
- Chance model specification

### Review questions

- Which volumetric formula variant should be authoritative for oil and gas?
- Which units must be supported first: metric, field units, or both?
- Should the app use deterministic P90/P50/P10 formulas or always use Monte Carlo sampling?
- Should resource components be sorted individually or jointly?
- Should the Monte Carlo random seed be fixed by default for reproducibility?

### Approval gate

Proceed only when calculation logic and data model are accepted.

## Phase 4: UX and Workflow Design

### Objective

Design a workflow that is easier to use than the workbook while retaining technical rigor.

### Recommended navigation

The app should use a left sidebar with the following sections:

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
11. Summary / Export
12. Admin Settings

### Screen-level specification

### Dashboard

Purpose:

- Show recent prospects.
- Show status of input completeness.
- Show last simulation date.
- Show major warnings.

Key features:

- New prospect button
- Open prospect list
- Recent simulation cards
- QA/QC warning count

### Prospect Setup

Purpose:

- Capture metadata equivalent to Start & Input.

Key fields:

- Prospect name
- Operator
- Business unit
- Country
- Basin
- Block/concession
- Formation
- Reservoir age
- Lithology
- Depositional environment
- Lead/prospect status
- Fluid type
- Pre-drill/post-drill
- Single-zone/multi-zone flag

### Area Module

Purpose:

- Capture closed area, percent fill, and productive area uncertainty.

Key features:

- P90/P50/P10 input grid
- Distribution selector
- Clip settings
- Unit selector
- Notes and analog rationale
- Output preview

### Net Pay Module

Purpose:

- Capture net reservoir thickness or average net pay logic.

Key features:

- Number of pay zones
- Zone net thickness
- Gross interval
- NTG
- Geometric correction factor
- Distribution settings
- Correlation settings

### HC Yield Module

Purpose:

- Capture petrophysical and recovery assumptions.

Key features:

- Porosity
- HC saturation
- Primary recovery efficiency
- Oil FVF
- Solution gas yield
- Solution gas recovery efficiency
- Gas expansion factor
- Condensate yield
- Correlations between selected variables

### Chance Module

Purpose:

- Capture geologic chance factors and rationale.

Key features:

- Source
- Timing/migration
- Reservoir
- Closure
- Containment
- Play vs prospect split
- Weak-link display
- Adequacy matrix
- Comments per factor
- Pg output

### Simulation Module

Purpose:

- Run and manage Monte Carlo simulation.

Key features:

- Iteration count
- Random seed
- Run simulation
- Last run metadata
- Simulation status
- Input completeness check

### Results Module

Purpose:

- Display resource outputs.

Key outputs:

- P99/P90/P50/mean/P10/P01
- Oil in place
- Gas in place
- Recoverable oil
- Recoverable gas
- Condensate
- MMBOE
- Pg-adjusted resources
- Optional Pc/Pe-adjusted outputs

### Charts Module

Purpose:

- Visualize uncertainty and relationships.

Key charts:

- Distribution histogram
- Cumulative probability curve
- Tornado chart, phase 2 if not MVP
- Scatter plot
- Scenario comparison, phase 2

### QA/QC Module

Purpose:

- Highlight missing, inconsistent, or technically questionable inputs.

Example checks:

- P90/P50/P10 ordering is invalid.
- Porosity is outside configured limits.
- Saturation is outside configured limits.
- FVF or GEF outside configured limits.
- Recovery efficiency exceeds 100%.
- Chance factor is missing.
- Units are inconsistent.
- Product type conflicts with fluid assumptions.
- Correlation value is outside -1 to +1.
- Notes/rationale missing for key high-impact inputs.

### Summary / Export

Purpose:

- Provide a management-ready summary equivalent to workbook Summary.

Key outputs:

- Prospect metadata
- Input assumptions
- Chance summary
- Resource summary
- Charts
- QA/QC warnings
- Export to CSV/Excel/PDF

### Deliverables

- Screen-by-screen workflow specification
- UI wireframe description
- Required fields and validation behavior
- Chart list
- Export/report definition

### Review questions

- Should the UI feel like the workbook, or should it be redesigned around a guided workflow?
- Which charts are mandatory for first review?
- Should chance assessment be required before running resources, or allowed as a separate step?
- Should QA/QC warnings block simulation or only warn the user?

### Approval gate

Proceed only when workflow and screens are accepted.

## Phase 5: Technical Architecture Design

### Objective

Choose an architecture that supports numerical correctness, future extensibility, and easy validation.

### Recommended architecture

| Layer | Recommendation | Rationale |
|---|---|---|
| Frontend | React web app | Flexible UI, good chart support, reusable modules |
| Backend API | Python FastAPI preferred | Best fit for scientific/statistical computation |
| Simulation engine | Python NumPy/SciPy | Reliable distributions, fast Monte Carlo, reproducible random seeds |
| Database | SQLite for prototype; PostgreSQL for team deployment | SQLite is simple for MVP; PostgreSQL scales later |
| Charts | Plotly or Recharts | Plotly is strong for scientific plots; Recharts is clean for dashboards |
| Export | Excel/CSV first, PDF later | Excel export is useful for technical review |
| Authentication | Optional for prototype | Can be added if multi-user deployment is needed |

### Backend service modules

- Project service
- Input service
- Distribution service
- Simulation service
- Chance service
- Resource calculation service
- QA/QC service
- Export service
- Audit/versioning service

### API endpoints

Candidate API endpoints:

- `POST /projects`
- `GET /projects`
- `GET /projects/{project_id}`
- `POST /prospects`
- `PUT /prospects/{prospect_id}`
- `GET /prospects/{prospect_id}/inputs`
- `PUT /prospects/{prospect_id}/inputs/{module}`
- `POST /prospects/{prospect_id}/simulate`
- `GET /simulation-runs/{run_id}`
- `GET /simulation-runs/{run_id}/results`
- `GET /simulation-runs/{run_id}/charts`
- `GET /prospects/{prospect_id}/qaqc`
- `POST /prospects/{prospect_id}/export`

### Simulation engine behavior

The simulation engine should:

- Validate all required inputs.
- Convert units consistently.
- Generate random samples from specified distributions.
- Apply clips and truncation.
- Apply correlations if enabled.
- Compute volumetric outcomes per iteration.
- Sort outputs according to selected resource convention.
- Calculate percentiles and mean values.
- Store simulation metadata and summary results.
- Preserve random seed for reproducibility.

### Data persistence

For MVP:

- Store projects, prospects, inputs, distributions, chance factors, notes, and simulation summaries.
- Store full simulation arrays only if needed for charts and audit.
- If storage size is a concern, store arrays as compressed JSON or regenerated from seed.

For later deployment:

- Store each simulation run as immutable.
- Enable comparison between runs.
- Add versioning of input assumptions.

### Security and deployment

For prototype:

- Private web app deployment.
- Local or single-user database.
- No sensitive corporate data unless hosted securely.

For team deployment:

- Authentication and role-based access.
- Project-level permissions.
- Audit logs.
- Secure storage.
- Backup and restore.

### Deliverables

- Architecture diagram description
- Data model
- API specification
- Simulation service specification
- Export strategy
- Deployment plan

### Review questions

- Do you prefer Python backend for statistical transparency?
- Should this run locally, privately in the cloud, or as a shared team app?
- Is Excel export more important than PDF export for the first version?
- Should full simulation arrays be stored, or only summary statistics and seeds?

### Approval gate

Proceed only when architecture is approved.

## Phase 6: MVP Implementation Plan

This phase should begin only after review and approval of phases 1 to 5.

### Milestone 1: App shell

Tasks:

- Create app project.
- Add sidebar navigation.
- Add project/prospect routing.
- Add theme and layout.
- Add placeholder pages.

Acceptance criteria:

- User can navigate all planned MVP sections.
- App loads cleanly in preview.
- No calculation logic yet.

### Milestone 2: Data model and backend

Tasks:

- Define database schema.
- Implement project/prospect CRUD.
- Implement input storage.
- Implement distribution storage.
- Implement chance-factor storage.

Acceptance criteria:

- User can create and save a prospect.
- Inputs persist across page refreshes.

### Milestone 3: Input modules

Tasks:

- Build Prospect Setup page.
- Build Area page.
- Build Net Pay page.
- Build HC Yield page.
- Build Chance page.
- Add validation warnings.

Acceptance criteria:

- User can enter all MVP inputs.
- Invalid values trigger warnings.
- Notes/rationale can be captured.

### Milestone 4: Simulation engine

Tasks:

- Implement distribution sampling.
- Implement clipping/truncation.
- Implement Monte Carlo engine.
- Implement initial volumetric calculations.
- Implement chance logic.

Acceptance criteria:

- User can run a reproducible simulation.
- Resource outputs are generated.
- Results are stable for a fixed seed.

### Milestone 5: Results and charts

Tasks:

- Build resource summary page.
- Build histogram chart.
- Build cumulative probability chart.
- Build scatter plot.
- Add chance-adjusted outputs.

Acceptance criteria:

- P99/P90/P50/mean/P10/P01 outputs display correctly.
- Charts update after simulation.

### Milestone 6: Export and report

Tasks:

- Export results to CSV.
- Export summary to Excel.
- Add printable summary view.
- Optional PDF export.

Acceptance criteria:

- Export contains metadata, assumptions, results, and QA/QC warnings.

### Milestone 7: Validation against workbook

Tasks:

- Select one to three workbook cases.
- Recreate inputs in the app.
- Run simulations with fixed seed.
- Compare P90/P50/mean/P10/P01 outputs.
- Document differences.

Acceptance criteria:

- Differences are understood and accepted, or corrections are made.

## Validation Strategy

### Validation principles

- Validate in small modules before validating full resources.
- Use deterministic seeds where possible.
- Compare distribution samples first, then volumetric products.
- Separate differences caused by random sampling from differences caused by formulas.
- Document every intentional deviation from the workbook.

### Suggested validation sequence

1. **Distribution validation**
   - Confirm that each distribution type generates expected P90/P50/P10 behavior.
   - Confirm clipping and truncation behavior.

2. **Single-variable module validation**
   - Validate area module.
   - Validate net pay module.
   - Validate HC yield module.

3. **Volumetric validation**
   - Validate oil in place.
   - Validate gas in place.
   - Validate recoverable resources.
   - Validate MMBOE conversion.

4. **Chance validation**
   - Validate weak-link chance category results.
   - Validate Pg.
   - Validate chance-adjusted outputs.

5. **Full-case validation**
   - Compare complete workbook case versus app output.
   - Prepare difference table.

### Validation output table

| Test case | Variable/output | Workbook result | App result | Difference | Status | Explanation |
|---|---:|---:|---:|---:|---|---|
| Case 1 | Area P90 | TBD | TBD | TBD | TBD | TBD |
| Case 1 | Net Pay P50 | TBD | TBD | TBD | TBD | TBD |
| Case 1 | Recoverable Oil Mean | TBD | TBD | TBD | TBD | TBD |
| Case 1 | Pg | TBD | TBD | TBD | TBD | TBD |

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Hidden VBA logic not fully understood | High | Extract macro behavior or validate empirically against workbook cases |
| Distribution fitting differs from workbook | High | Define distribution math explicitly and compare sample percentiles |
| Percentile convention mismatch | High | Make convention explicit and visible in UI |
| Correlation implementation differs | Medium/High | Start with simple correlations; validate separately |
| Unit conversion errors | High | Centralize unit service and show units on every input/output |
| Scope creep into full MMRA replacement | High | Approve MVP boundary before coding |
| Overly complex UI | Medium | Use guided workflow instead of sheet replication |
| Results not trusted by technical users | High | Include QA/QC, assumption notes, validation tables, and reproducible seeds |
| Export requirements grow late | Medium | Define export content before build |
| Corporate data sensitivity | Medium/High | Use private deployment and avoid storing sensitive data until security model is agreed |

## Open Decisions for Review

Please review and decide the following before any app build:

1. **MVP scope**: confirm whether the MVP should be single-zone, pre-drill exploration only.
2. **Fluid products**: confirm whether MVP must support oil, gas, condensate, and MMBOE, or oil-only first.
3. **Backend choice**: confirm whether Python FastAPI is preferred for statistical calculation transparency.
4. **Unit system**: confirm whether MVP should use field units, metric units, or both.
5. **Percentile convention**: confirm preferred display convention for P90/P50/P10.
6. **Distribution types**: confirm which distributions are mandatory in MVP.
7. **Correlation**: confirm whether correlations are required in MVP or can be phase 2.
8. **Area-depth**: confirm whether area-depth/GRV-depth is mandatory in MVP or phase 2.
9. **Scenario charts**: confirm whether scenario comparison is mandatory in MVP or phase 2.
10. **Export**: confirm whether Excel export is sufficient first, or PDF is mandatory.
11. **Validation tolerance**: confirm acceptable difference versus workbook outputs.
12. **Deployment target**: confirm local/private prototype versus shared web deployment.

## Recommended Next Step

The recommended next step is a review meeting or written review against this document. After review, the next deliverable should be a more formal **MVP Functional Requirements Specification**, including final formulas, field definitions, unit conventions, screen list, and acceptance criteria.

No implementation should begin until the open decisions above are resolved.
