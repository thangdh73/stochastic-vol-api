# MMRA Web MVP Functional Requirements Specification

Prepared for review before implementation.

## Document Control

| Item | Detail |
|---|---|
| Product working name | MMRA Web / Probabilistic Resource & Risk Evaluator |
| Document type | MVP Functional Requirements Specification |
| Primary source | Review-approved MMRA app plan and workbook discovery |
| Intended audience | Product owner, subsurface technical reviewer, developer, QA reviewer |
| Implementation status | Not started |
| Review status | Draft for review |

## Problem Statement

The existing MMRA workbook is a powerful probabilistic risk and resource evaluation tool, but it is implemented as a complex Excel/VBA application with hidden sheets, macro logic, ActiveX controls, and extensive defined-name dependencies. This makes it difficult to maintain, validate, extend, deploy to modern environments, or integrate with other digital subsurface workflows.

The MVP will provide a modern web-based workflow for single-zone pre-drill prospect evaluation. It will preserve the core technical intent of the workbook: uncertain volumetric inputs, Monte Carlo simulation, chance assessment, resource summary, charts, QA/QC checks, and exportable outputs. The MVP will not attempt to reproduce every workbook feature in the first release.

## Goals

- **Create a usable single-zone prospect evaluation workflow**: allow a user to enter prospect metadata, area, net pay, HC yield, chance factors, run simulation, and view results.
- **Provide auditable probabilistic calculations**: every resource result should be traceable to inputs, distribution settings, seed, iteration count, and chance factors.
- **Reduce spreadsheet dependency**: replace the main workbook user workflow with a web interface and calculation engine suitable for later expansion.
- **Support technical review**: provide QA/QC warnings, assumption notes, and exportable summaries.
- **Enable validation against the legacy workbook**: preserve enough calculation detail to compare selected workbook cases with app outputs.

## Non-Goals

- **No full workbook clone in MVP**: the MVP will not reproduce every worksheet, chart, macro, ActiveX dialog, hidden data table, or admin option.
- **No multi-zone aggregation in MVP**: the first release is limited to a single-zone prospect.
- **No full area-depth / GRV-depth engine in MVP**: this is deferred to phase 2 unless explicitly reprioritized.
- **No post-audit workflow in MVP**: post-drill audit and failure-category workflows are deferred.
- **No full scenario comparison module in MVP**: scenario charts and scenario slots are deferred to phase 2.
- **No commercial/economic threshold engine in MVP**: MCFS, MEFS, Pc, and Pe are deferred unless needed for the first build.
- **No corporate permission/locking system in MVP**: locking options and corporate standards can be added later.
- **No guaranteed numerical equivalence to every workbook case at first release**: MVP validation will target agreed test cases and document differences.

## Final MVP Scope

### In Scope

The MVP shall include the following P0 capabilities:

- Create and edit a single prospect.
- Capture prospect metadata.
- Capture single-zone volumetric inputs for area, net pay, and HC yield.
- Support probabilistic distributions for key uncertain inputs.
- Run a Monte Carlo simulation using a reproducible random seed.
- Calculate deterministic summary statistics from simulation outputs.
- Capture geologic chance factors using source, timing/migration, reservoir, closure, and containment categories.
- Calculate Pg using weak-link category logic and category multiplication.
- Display resource outputs as P99/P90/P50/mean/P10/P01.
- Display charts for resource uncertainty and selected variable relationships.
- Display QA/QC warnings.
- Export MVP results to CSV and Excel-compatible format.

### P1 Fast-Follow Scope

The following should be designed for but may ship after the first MVP:

- Custom/imported empirical distributions.
- Rank correlation between selected inputs.
- PDF export.
- Editable corporate limits for input validation.
- Saved assumption templates.
- Comparison of multiple simulation runs for the same prospect.

### P2 / Future Scope

The following are not required for MVP:

- Area-depth / GRV-depth workflow.
- NRV direct input route.
- Scenario comparison charts.
- Post-audit workflow.
- Multi-zone resource aggregation.
- Commercial/economic threshold logic.
- Full workbook import/export compatibility.
- Portfolio roll-up.
- Team collaboration and permissions.

## Product Assumptions

- The MVP is a private technical tool for a subsurface expert user, not a public SaaS product.
- Initial workflow is single-user or small-team review.
- Initial reservoir evaluation mode is single-zone, pre-drill, exploration prospect.
- Results should be technically transparent rather than visually decorative.
- Calculation engine should prioritize reproducibility and auditability over speed optimization.
- Default iteration count should be 5,000 to align with the workbook-style workflow, with a configurable option.
- Field units and metric units should be supported where practical, but the MVP can initially standardize internal calculations to one canonical unit system.

## User Personas

### Exploration Geoscientist

As an exploration geoscientist, I want to enter prospect-level geological and volumetric uncertainty assumptions so that I can quickly estimate resource ranges and chance of geologic success.

### Reservoir Engineer

As a reservoir engineer, I want to review recovery, FVF, GEF, GOR, and product-yield assumptions so that I can verify the recoverable-resource calculation is technically defensible.

### Petrophysicist

As a petrophysicist, I want to enter and review porosity, saturation, NTG, and net pay distributions so that uncertainty reflects the available well and analog evidence.

### Technical Reviewer

As a technical reviewer, I want to inspect inputs, assumptions, warnings, and calculation outputs so that I can approve or challenge the evaluation before it is used for decisions.

## User Stories

### P0 User Stories

- As a geoscientist, I want to create a prospect and enter metadata so that the evaluation is clearly identified and auditable.
- As a geoscientist, I want to enter area uncertainty as P90/P50/P10 and distribution type so that productive-area uncertainty can be simulated.
- As a petrophysicist, I want to enter net pay and related uncertainty so that thickness uncertainty is captured.
- As a reservoir engineer, I want to enter porosity, saturation, recovery, FVF, GOR, and gas-expansion assumptions so that resources can be calculated by product type.
- As a technical reviewer, I want the app to warn me when input values are missing, out of range, or internally inconsistent so that I can correct assumptions before relying on results.
- As an evaluator, I want to run a Monte Carlo simulation with a fixed seed so that results can be reproduced.
- As an evaluator, I want to view P99/P90/P50/mean/P10/P01 resource outputs so that I can communicate uncertainty ranges.
- As an evaluator, I want to enter chance factors and see Pg so that I can risk the resource outcome.
- As a reviewer, I want to export results and assumptions so that they can be included in technical documentation.

### P1 User Stories

- As a reviewer, I want to compare a current simulation to a prior simulation so that changes in assumptions are transparent.
- As an evaluator, I want to import a custom distribution so that non-parametric analog data can be represented.
- As a reviewer, I want to export a PDF summary so that management can review a static report.
- As a technical lead, I want configurable corporate limits so that QA/QC reflects company standards.

## Screen-by-Screen Requirements

## App Shell and Navigation

### Purpose

Provide a consistent layout for moving through the prospect evaluation workflow.

### Required navigation sections

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

### Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| NAV-001 | P0 | The app shall display a sidebar or equivalent navigation menu with all MVP workflow sections. |
| NAV-002 | P0 | The app shall show the current prospect name in the header once a prospect is created. |
| NAV-003 | P0 | The app shall show input completion status for each major module. |
| NAV-004 | P1 | The app should show the last simulation timestamp and seed in the header or dashboard. |
| NAV-005 | P1 | The app should show an always-visible QA/QC warning count. |

### Acceptance criteria

- Given a user opens the app, when no prospect exists, then the app shows a clear action to create a new prospect.
- Given a prospect exists, when the user navigates between sections, then prospect context is retained.
- Given required inputs are incomplete, when the user views navigation, then incomplete modules are visibly indicated.

## Dashboard

### Purpose

Summarize the current evaluation state and guide the user to the next required action.

### Display requirements

- Prospect name
- Evaluation mode
- Input completion status
- Last simulation status
- Top QA/QC warnings
- Quick links to key modules

### Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| DASH-001 | P0 | The dashboard shall show whether a prospect has been created. |
| DASH-002 | P0 | The dashboard shall show module completion status for Prospect Setup, Area, Net Pay, HC Yield, Chance, and Simulation. |
| DASH-003 | P0 | The dashboard shall show whether results are available. |
| DASH-004 | P1 | The dashboard should show the latest Pg and unrisked mean resource after simulation. |
| DASH-005 | P1 | The dashboard should show the highest-severity QA/QC warnings. |

### Acceptance criteria

- Given no simulation has been run, when the user views the dashboard, then the Results status shows "Not run".
- Given required inputs are missing, when the user views the dashboard, then the missing modules are identified.
- Given simulation results exist, when the user views the dashboard, then key result statistics are shown.

## Prospect Setup Screen

### Purpose

Capture core prospect metadata equivalent to the workbook's Start & Input sheet.

### Required fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| Prospect name | Text | Yes | Primary identifier |
| Evaluation mode | Select | Yes | MVP default: Pre-drill exploration |
| Zone mode | Select | Yes | MVP default: Single zone |
| Fluid type | Select | Yes | Oil, gas, gas-condensate, mixed |
| Operator | Text | No | Optional |
| Business unit | Text | No | Optional |
| Country | Text/select | No | Optional but recommended |
| Basin | Text | No | Optional but recommended |
| Block/concession | Text | No | Optional |
| Formation | Text | No | Optional but recommended |
| Reservoir age | Text | No | Optional |
| Lithology | Select/text | No | Optional |
| Depositional environment | Text | No | Optional |
| Lead/prospect status | Select | No | Lead, prospect |
| Working interest | Number | No | Percentage |
| Net revenue interest | Number | No | Percentage |
| Evaluation date | Date/time | Auto | Defaults to current date/time |

### Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| PROS-001 | P0 | The user shall be able to create a prospect with a prospect name, evaluation mode, zone mode, and fluid type. |
| PROS-002 | P0 | The app shall save prospect metadata. |
| PROS-003 | P0 | The app shall prevent simulation if no prospect name is provided. |
| PROS-004 | P1 | The app should allow optional basin, formation, lithology, operator, and block metadata. |
| PROS-005 | P1 | The app should allow comments or notes on prospect definition. |

### Acceptance criteria

- Given a blank prospect setup form, when the user saves without a prospect name, then the app shows a validation error.
- Given valid required fields, when the user saves, then the prospect appears in the app header and dashboard.
- Given optional metadata is entered, when the user exports results, then the optional metadata appears in the export.

## Area Screen

### Purpose

Capture productive area uncertainty.

### Required input variables

| Variable | Unit options | Required | Distribution support | Notes |
|---|---|---:|---|---|
| Closed area | acres, km² | Yes | Yes | Main mapped closure uncertainty |
| Percent fill | % | Yes | Yes | Defaults may be 100% if fully filled |
| Productive area | acres, km² | Calculated or direct | Output or direct | Productive area = closed area × percent fill |

### Required controls

- Distribution type
- P90
- P50, optional depending on distribution
- P10
- Low clip
- High clip
- Unit selector
- Notes/rationale field

### Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| AREA-001 | P0 | The user shall be able to enter closed area P90/P50/P10 values. |
| AREA-002 | P0 | The user shall be able to enter percent fill P90/P50/P10 values or set percent fill to fixed 100%. |
| AREA-003 | P0 | The app shall calculate productive area as closed area multiplied by percent fill per simulation iteration. |
| AREA-004 | P0 | The app shall validate percentile ordering based on the selected percentile convention. |
| AREA-005 | P1 | The app should support low and high clipping for area and percent fill. |
| AREA-006 | P1 | The app should display a preview of interpreted distribution statistics before simulation. |

### Acceptance criteria

- Given valid area inputs, when the user saves the Area screen, then the module status becomes complete.
- Given P90/P50/P10 are in invalid order, when the user saves, then the app shows a validation warning or error.
- Given percent fill exceeds 100%, when the user saves, then the app warns that percent fill must be between 0 and 100%.
- Given closed area and percent fill are entered, when simulation runs, then productive area is calculated per iteration rather than as a single hardcoded value.

## Net Pay Screen

### Purpose

Capture net pay, gross interval, NTG, and geometric correction assumptions.

### Required input variables

| Variable | Unit options | Required | Distribution support | Notes |
|---|---|---:|---|---|
| Average net pay | m, ft | Yes | Yes | MVP primary thickness input |
| Gross interval | m, ft | No | Yes | Optional in MVP |
| Net-to-gross | % | No | Yes | Optional in MVP unless deriving net pay |
| Geometric correction factor | % | No | Yes/fixed | Defaults to 100% if not used |
| Number of pay zones | count | No | No | MVP default: 1 |

### Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| NPAY-001 | P0 | The user shall be able to enter average net pay P90/P50/P10 values. |
| NPAY-002 | P0 | The app shall support meters and feet for thickness inputs. |
| NPAY-003 | P0 | The app shall convert thickness inputs to a canonical internal unit before calculation. |
| NPAY-004 | P0 | The app shall validate that net pay is greater than zero. |
| NPAY-005 | P1 | The app should allow optional gross interval and NTG inputs. |
| NPAY-006 | P1 | The app should allow a geometric correction factor, defaulting to 100%. |

### Acceptance criteria

- Given valid net pay inputs, when the user saves the Net Pay screen, then the module status becomes complete.
- Given a negative or zero net pay value, when the user saves, then the app shows a validation error.
- Given thickness is entered in meters, when results are calculated in field units, then conversion is applied consistently.
- Given geometric correction is blank, when simulation runs, then the app uses 100% as the default.

## HC Yield Screen

### Purpose

Capture petrophysical, recovery, and product-yield assumptions.

### Required input variables

| Variable | Unit | Required | Distribution support | Applies to |
|---|---|---:|---|---|
| Porosity | % | Yes | Yes | Oil/gas |
| Hydrocarbon saturation | % | Yes | Yes | Oil/gas |
| Oil recovery efficiency | % | Conditional | Yes | Oil / condensate-rich cases |
| Oil formation volume factor | reservoir bbl / stb | Conditional | Yes/fixed | Oil |
| Solution gas yield / GOR | scf/stb | Conditional | Yes | Oil |
| Solution gas recovery efficiency | % | Conditional | Fixed or distribution | Oil |
| Gas recovery efficiency | % | Conditional | Yes/fixed | Gas |
| Gas expansion factor | scf/reservoir volume unit | Conditional | Yes/fixed | Gas |
| Condensate yield | bbl/MMscf | Conditional | Yes/fixed | Gas-condensate |

### Fluid-type dependency

| Fluid type | Required HC Yield fields |
|---|---|
| Oil | Porosity, HC saturation, oil recovery efficiency, oil FVF, optional GOR |
| Gas | Porosity, HC saturation, gas recovery efficiency, gas expansion factor |
| Gas-condensate | Porosity, HC saturation, gas recovery efficiency, gas expansion factor, condensate yield |
| Mixed | Oil and gas parameter groups as applicable |

### Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| HCY-001 | P0 | The user shall be able to enter porosity P90/P50/P10 values. |
| HCY-002 | P0 | The user shall be able to enter hydrocarbon saturation P90/P50/P10 values. |
| HCY-003 | P0 | The app shall require fluid-type-specific recovery and volume factor fields. |
| HCY-004 | P0 | The app shall validate porosity and saturation against allowable limits. |
| HCY-005 | P0 | The app shall validate that percentage fields are between 0 and 100 unless a configured exception exists. |
| HCY-006 | P1 | The app should support GOR and solution gas calculations for oil cases. |
| HCY-007 | P1 | The app should support condensate yield for gas-condensate cases. |

### Acceptance criteria

- Given fluid type is oil, when the user opens HC Yield, then oil-specific fields are required and gas-only fields are optional or hidden.
- Given porosity exceeds configured maximum, when the user saves, then the app shows a QA/QC warning.
- Given saturation is below 0% or above 100%, when the user saves, then the app shows a blocking error.
- Given required HC Yield fields are missing, when simulation is requested, then simulation is blocked.

## Chance Screen

### Purpose

Capture geologic chance of success using a workbook-inspired chance checklist.

### Required chance categories

| Category | Sub-factors for MVP | Required |
|---|---|---:|
| Source | Quantity/volume, quality/richness, maturation | Yes |
| Timing / migration | Timing of closure/trap, timing of expulsion, migration pathway | Yes |
| Reservoir | Presence, quality, deliverability/continuity | Yes |
| Closure | Trap definition, mapped closure, structural/stratigraphic confidence | Yes |
| Containment | Seal, fault seal, retention, breach risk | Yes |

### Chance logic

- Each sub-factor shall accept a probability from 0 to 1 or 0% to 100%.
- Each category shall use a weak-link method: category chance equals the minimum populated sub-factor value within that category.
- Overall Pg shall equal the product of the five category chance values.
- The app shall display both category chance and overall Pg.
- The app shall store notes/rationale per category or sub-factor.

### Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| CH-001 | P0 | The user shall be able to enter sub-factor chance values for all five chance categories. |
| CH-002 | P0 | The app shall calculate each category chance using the weak-link method. |
| CH-003 | P0 | The app shall calculate Pg as Source × Timing/Migration × Reservoir × Closure × Containment. |
| CH-004 | P0 | The app shall validate that chance values are between 0 and 1, or 0% and 100%. |
| CH-005 | P1 | The app should allow play segment and prospect/local chance values separately. |
| CH-006 | P1 | The app should include an adequacy matrix or guidance labels. |

### Acceptance criteria

- Given a category has sub-factor values of 0.9, 0.8, and 0.7, when chance is calculated, then category chance equals 0.7.
- Given all five category values are populated, when the user views the Chance screen, then Pg is shown.
- Given any chance value exceeds 100%, when the user saves, then the app shows a validation error.
- Given chance notes are entered, when the user exports the summary, then notes are included.

## Simulation Screen

### Purpose

Run, manage, and reproduce Monte Carlo simulations.

### Required controls

| Control | Default | Required |
|---|---:|---:|
| Iteration count | 5,000 | Yes |
| Random seed | Auto-generated but visible | Yes |
| Run simulation button | N/A | Yes |
| Simulation status | N/A | Yes |
| Last run timestamp | N/A | Yes |

### Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| SIM-001 | P0 | The app shall run a Monte Carlo simulation using saved input distributions. |
| SIM-002 | P0 | The app shall use a visible random seed for reproducibility. |
| SIM-003 | P0 | The app shall block simulation if required P0 inputs are missing or invalid. |
| SIM-004 | P0 | The app shall store simulation metadata, including run time, iteration count, seed, and input version. |
| SIM-005 | P0 | The app shall calculate summary statistics for each output variable. |
| SIM-006 | P1 | The app should allow the user to rerun with the same seed. |
| SIM-007 | P1 | The app should allow a user-entered seed. |

### Acceptance criteria

- Given all required inputs are valid, when the user runs simulation, then results are generated.
- Given the same inputs and seed, when the user reruns simulation, then the same results are reproduced within numerical precision.
- Given required inputs are missing, when the user clicks run simulation, then the app blocks the run and lists missing inputs.
- Given a simulation completes, when the user opens Results, then the latest run is available.

## Results Screen

### Purpose

Display resource results in a technically reviewable format.

### Required output statistics

- Minimum, optional
- P99
- P90
- P50
- Mean
- P10
- P01
- Maximum, optional

### Required output products

At minimum, the app shall support applicable products based on fluid type:

- Oil initially in place
- Gas initially in place
- Recoverable oil
- Recoverable gas
- Solution gas, if oil case uses GOR
- Condensate, if gas-condensate case
- Total MMBOE
- Pg-adjusted resource summary

### Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| RES-001 | P0 | The app shall display P99/P90/P50/mean/P10/P01 for each applicable output product. |
| RES-002 | P0 | The app shall distinguish unrisked and Pg-risked outputs. |
| RES-003 | P0 | The app shall display units for every result. |
| RES-004 | P0 | The app shall identify the simulation run used for displayed results. |
| RES-005 | P1 | The app should allow result tables to be copied or exported. |
| RES-006 | P1 | The app should display input assumptions next to major outputs for review. |

### Acceptance criteria

- Given a successful simulation, when the user opens Results, then a result table is shown.
- Given fluid type is oil, when results are shown, then oil-related outputs are displayed and non-applicable gas-only outputs are hidden or marked N/A.
- Given Pg has been calculated, when results are shown, then Pg-risked values are displayed separately from unrisked values.
- Given a result is displayed, then its unit is visible in the table header or row label.

## Charts Screen

### Purpose

Visualize uncertainty and variable relationships.

### Required charts

| Chart | Priority | Description |
|---|---|---|
| Resource distribution histogram | P0 | Histogram of primary recoverable resource output |
| Cumulative probability curve | P0 | Exceedance or cumulative view with P90/P50/P10 markers |
| Scatter plot | P0 | Selectable X/Y variables from simulation arrays |
| Tornado chart | P1 | Sensitivity proxy or correlation-based driver chart |
| Scenario comparison chart | P2 | Deferred to scenario module |

### Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| CHT-001 | P0 | The app shall display a histogram for the primary resource output. |
| CHT-002 | P0 | The app shall display a cumulative probability curve with key percentile markers. |
| CHT-003 | P0 | The app shall provide a scatter plot with selectable X and Y variables. |
| CHT-004 | P0 | Charts shall display units and clear axis labels. |
| CHT-005 | P1 | The app should allow chart image export. |

### Acceptance criteria

- Given simulation results exist, when the user opens Charts, then the histogram and cumulative probability curve render.
- Given no simulation exists, when the user opens Charts, then the app explains that simulation must be run first.
- Given the user changes scatter plot variables, when the chart updates, then axes and data points reflect the selected variables.

## QA/QC Screen

### Purpose

Provide a technical validation layer before and after simulation.

### Warning severity

| Severity | Meaning | Blocks simulation |
|---|---|---:|
| Error | Missing or invalid value that prevents calculation | Yes |
| Warning | Technically questionable but calculable value | No |
| Info | Review note or assumption reminder | No |

### Required validation checks

| ID | Severity | Check |
|---|---|---|
| VAL-001 | Error | Required prospect name missing |
| VAL-002 | Error | Required fluid type missing |
| VAL-003 | Error | Required Area, Net Pay, or HC Yield input missing |
| VAL-004 | Error | P90/P50/P10 ordering invalid for selected convention |
| VAL-005 | Error | Negative area, thickness, porosity, saturation, recovery, FVF, GEF, or yield where physically impossible |
| VAL-006 | Error | Percent value outside 0% to 100% where applicable |
| VAL-007 | Warning | Porosity outside configured recommended range |
| VAL-008 | Warning | Saturation outside configured recommended range |
| VAL-009 | Warning | FVF, GEF, or GOR outside configured recommended range |
| VAL-010 | Warning | Chance category incomplete |
| VAL-011 | Warning | Important notes/rationale missing |
| VAL-012 | Warning | Very wide uncertainty range requiring review |
| VAL-013 | Info | Optional metadata missing |
| VAL-014 | Info | Correlations disabled |

### Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| QA-001 | P0 | The app shall run validation checks before simulation. |
| QA-002 | P0 | The app shall block simulation when error-level validations are present. |
| QA-003 | P0 | The app shall display all QA/QC findings in one screen. |
| QA-004 | P0 | Each QA/QC finding shall identify the affected module and field. |
| QA-005 | P1 | Each QA/QC finding should include recommended corrective action. |

### Acceptance criteria

- Given required inputs are missing, when the user opens QA/QC, then the missing fields are listed as errors.
- Given only warnings exist, when the user runs simulation, then the app allows the run but retains warnings.
- Given a QA/QC item is selected, when possible, then the app navigates to the affected input screen or identifies the field clearly.

## Export Screen

### Purpose

Export technical summary data for review and documentation.

### Required export formats

| Format | Priority | Content |
|---|---|---|
| CSV | P0 | Result tables and key input summary |
| Excel-compatible workbook | P0 | Metadata, inputs, chance, results, QA/QC |
| PDF | P1 | Formatted management/technical summary |

### Export content

Exports shall include:

- Prospect metadata
- Simulation metadata
- Input assumptions
- Distribution settings
- Chance factors
- Pg
- Resource outputs
- QA/QC warnings
- Notes/rationale

### Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| EXP-001 | P0 | The user shall be able to export current results to CSV. |
| EXP-002 | P0 | The user shall be able to export a structured Excel-compatible summary. |
| EXP-003 | P0 | The export shall include simulation seed and iteration count. |
| EXP-004 | P0 | The export shall include QA/QC findings. |
| EXP-005 | P1 | The user should be able to export a formatted PDF summary. |

### Acceptance criteria

- Given simulation results exist, when the user exports Excel-compatible summary, then the file includes metadata, inputs, chance, results, and QA/QC sheets or sections.
- Given no simulation has been run, when the user attempts result export, then the app explains that no results are available.
- Given QA/QC warnings exist, when export is generated, then warnings are included.

## Input Data Dictionary

## Metadata Fields

| Field ID | Field name | Type | Required | Valid values / units | Default | Notes |
|---|---|---|---:|---|---|---|
| META-001 | Prospect name | Text | Yes | Free text | None | Primary identifier |
| META-002 | Evaluation mode | Select | Yes | Pre-drill exploration | Pre-drill exploration | MVP fixed/default |
| META-003 | Zone mode | Select | Yes | Single zone | Single zone | MVP fixed/default |
| META-004 | Fluid type | Select | Yes | Oil, Gas, Gas-condensate, Mixed | Oil | Drives required HC fields |
| META-005 | Operator | Text | No | Free text | Blank | Optional |
| META-006 | Business unit | Text | No | Free text | Blank | Optional |
| META-007 | Country | Text/select | No | Free text | Blank | Optional |
| META-008 | Basin | Text | No | Free text | Blank | Optional |
| META-009 | Block/concession | Text | No | Free text | Blank | Optional |
| META-010 | Formation | Text | No | Free text | Blank | Optional |
| META-011 | Lithology | Select/text | No | Sandstone, carbonate, other | Blank | Optional |
| META-012 | Depositional environment | Text | No | Free text | Blank | Optional |
| META-013 | Working interest | Number | No | 0-100% | Blank | Optional |
| META-014 | Net revenue interest | Number | No | 0-100% | Blank | Optional |

## Distribution Fields

Each uncertain variable shall use a common distribution definition.

| Field ID | Field name | Type | Required | Valid values | Notes |
|---|---|---|---:|---|---|
| DIST-001 | Variable name | Text | Yes | Defined by module | e.g., Porosity |
| DIST-002 | Unit | Select | Yes | Depends on variable | e.g., %, m, ft, acres |
| DIST-003 | Distribution type | Select | Yes | Fixed, Normal, Lognormal, Beta, Triangular, Uniform | Custom is P1 |
| DIST-004 | P90 | Number | Yes for uncertain variables | Variable-specific range | Low or high depending convention |
| DIST-005 | P50 | Number | Conditional | Variable-specific range | Required for some distributions |
| DIST-006 | P10 | Number | Yes for uncertain variables | Variable-specific range | Low or high depending convention |
| DIST-007 | Mode | Number | Conditional | Variable-specific range | Required for triangular/beta if used |
| DIST-008 | Low clip | Number | No | Variable-specific range | Optional |
| DIST-009 | High clip | Number | No | Variable-specific range | Optional |
| DIST-010 | Fixed value | Number | Conditional | Variable-specific range | Used when distribution type is Fixed |
| DIST-011 | Notes | Long text | No | Free text | Rationale/analog basis |

## Area Fields

| Field ID | Field name | Type | Required | Units | Notes |
|---|---|---|---:|---|---|
| AREA-F001 | Closed area distribution | Distribution | Yes | acres, km² | P90/P50/P10 |
| AREA-F002 | Percent fill distribution | Distribution | Yes | % | May be fixed 100% |
| AREA-F003 | Productive area | Calculated | Yes | acres, km² | Closed area × percent fill |

## Net Pay Fields

| Field ID | Field name | Type | Required | Units | Notes |
|---|---|---|---:|---|---|
| NPAY-F001 | Average net pay distribution | Distribution | Yes | m, ft | Primary MVP thickness |
| NPAY-F002 | Gross interval distribution | Distribution | No | m, ft | P1/optional |
| NPAY-F003 | Net-to-gross distribution | Distribution | No | % | P1/optional |
| NPAY-F004 | Geometric correction factor | Distribution/fixed | No | % | Default 100% |
| NPAY-F005 | Number of pay zones | Integer | No | count | Default 1 |

## HC Yield Fields

| Field ID | Field name | Type | Required | Units | Notes |
|---|---|---|---:|---|---|
| HCY-F001 | Porosity distribution | Distribution | Yes | % | All fluid types |
| HCY-F002 | Hydrocarbon saturation distribution | Distribution | Yes | % | All fluid types |
| HCY-F003 | Oil recovery efficiency | Distribution | Conditional | % | Oil/mixed |
| HCY-F004 | Oil FVF | Distribution/fixed | Conditional | rb/stb | Oil/mixed |
| HCY-F005 | Solution gas yield / GOR | Distribution/fixed | Conditional | scf/stb | Oil/mixed |
| HCY-F006 | Solution gas recovery efficiency | Distribution/fixed | Conditional | % | Oil/mixed |
| HCY-F007 | Gas recovery efficiency | Distribution/fixed | Conditional | % | Gas/gas-condensate/mixed |
| HCY-F008 | Gas expansion factor | Distribution/fixed | Conditional | scf/reservoir volume unit | Gas/gas-condensate/mixed |
| HCY-F009 | Condensate yield | Distribution/fixed | Conditional | bbl/MMscf | Gas-condensate/mixed |

## Chance Fields

| Field ID | Field name | Type | Required | Valid values | Notes |
|---|---|---|---:|---|---|
| CH-F001 | Source sub-factors | Number list | Yes | 0-1 or 0-100% | Weak-link minimum |
| CH-F002 | Timing/migration sub-factors | Number list | Yes | 0-1 or 0-100% | Weak-link minimum |
| CH-F003 | Reservoir sub-factors | Number list | Yes | 0-1 or 0-100% | Weak-link minimum |
| CH-F004 | Closure sub-factors | Number list | Yes | 0-1 or 0-100% | Weak-link minimum |
| CH-F005 | Containment sub-factors | Number list | Yes | 0-1 or 0-100% | Weak-link minimum |
| CH-F006 | Pg | Calculated | Yes | 0-1 or 0-100% | Product of category chances |
| CH-F007 | Chance rationale notes | Long text | No | Free text | Recommended |

## Simulation Fields

| Field ID | Field name | Type | Required | Valid values | Default |
|---|---|---|---:|---|---|
| SIM-F001 | Iteration count | Integer | Yes | 1,000-100,000 | 5,000 |
| SIM-F002 | Random seed | Integer/text | Yes | Any valid seed | Auto |
| SIM-F003 | Run timestamp | Date/time | Auto | System time | Auto |
| SIM-F004 | Input version | Text/hash | Auto | System generated | Auto |
| SIM-F005 | Simulation status | Select | Auto | Not run, running, complete, failed | Not run |

## Calculation Requirements

## Percentile Convention

The app shall explicitly state and store the selected percentile convention. The recommended MVP convention is:

- P90 = conservative/smaller resource-side input value
- P50 = median input value
- P10 = upside/larger resource-side input value

For variables where a higher value is unfavorable, the app shall still validate order according to the variable's resource-impact direction or clearly label the convention.

## Unit Handling

The app shall:

- Store the user's displayed unit.
- Convert all inputs to canonical calculation units.
- Display outputs in selected reporting units.
- Include units in every table, chart, and export.

Recommended canonical internal units:

- Area: acres or square metres, to be finalized before build.
- Thickness: feet or metres, to be finalized before build.
- Percent values: decimal fractions internally.
- Volumes: consistent oil/gas reservoir and surface units.

## Distribution Sampling

The app shall:

- Generate random samples for each uncertain variable using its distribution definition.
- Apply low/high clips where defined.
- Apply global truncation rules if implemented.
- Use the stored random seed for reproducibility.
- Generate one sampled value per variable per iteration.

P0 distribution types:

- Fixed
- Normal
- Lognormal
- Beta
- Triangular
- Uniform

P1 distribution types:

- Custom/imported empirical distribution
- PERT if required

## Volumetric Calculations

Final formula constants and unit conversions must be confirmed before implementation. MVP shall implement the following conceptual calculations.

### Productive Area

Productive area per iteration:

`Productive Area = Closed Area × Percent Fill`

Percent fill shall be used as a decimal internally.

### Net Rock Volume

If using average net pay directly:

`NRV = Productive Area × Average Net Pay × Geometric Correction Factor`

If gross interval and NTG are implemented:

`Net Pay = Gross Interval × NTG × Geometric Correction Factor`

then:

`NRV = Productive Area × Net Pay`

### Hydrocarbon Pore Volume

`HCPV = NRV × Porosity × Hydrocarbon Saturation`

Porosity and saturation shall be decimals internally.

### Oil Initially in Place

Conceptual oil in place:

`STOIIP = HCPV / Oil FVF × unit conversion factor`

Exact unit conversion factor shall be finalized based on canonical units.

### Recoverable Oil

`Recoverable Oil = STOIIP × Oil Recovery Efficiency`

### Gas Initially in Place

Conceptual gas in place:

`GIIP = HCPV × Gas Expansion Factor × unit conversion factor`

Exact unit conversion factor shall be finalized based on canonical units.

### Recoverable Gas

`Recoverable Gas = GIIP × Gas Recovery Efficiency`

### Solution Gas

If oil case includes solution gas:

`Solution Gas = Recoverable Oil × Solution Gas Yield × Solution Gas Recovery Efficiency`

### Condensate

If gas-condensate case includes condensate:

`Condensate = Recoverable Gas × Condensate Yield × unit conversion factor`

### MMBOE

Recommended conversion:

`MMBOE = Liquids MMbbl + Gas Bcf / 6`

The gas-oil conversion ratio shall be configurable. Workbook-style default appears to use 6 mcf/bbl, but final value must be confirmed.

## Chance Calculations

### Category chance

For each category:

`Category Chance = MIN(populated sub-factor chances)`

If no sub-factor is populated, the category is incomplete and simulation risked output cannot be finalized.

### Pg

`Pg = Source Chance × Timing/Migration Chance × Reservoir Chance × Closure Chance × Containment Chance`

### Risked resource

For reporting purposes:

`Pg-risked Mean Resource = Unrisked Mean Resource × Pg`

For percentile risked outputs, the MVP shall clearly distinguish between:

- deterministic multiplication of percentile values by Pg; and
- full probabilistic risk treatment with dry-hole mass.

Recommendation for MVP:

- Display unrisked percentiles.
- Display Pg and Pg-risked mean.
- Avoid presenting Pg-risked P90/P50/P10 unless risk treatment is explicitly defined.

## Result Statistics

For every simulated output vector, the app shall calculate:

- P99
- P90
- P50
- Mean
- P10
- P01

Optional:

- Minimum
- Maximum
- Standard deviation

Percentile extraction method must be specified before implementation, including interpolation behavior.

## Validation Checks

## Blocking Errors

The app shall block simulation if any of the following occur:

- Prospect name missing.
- Fluid type missing.
- Required area input missing.
- Required net pay input missing.
- Required HC Yield input missing.
- Required chance category missing if risked outputs are requested.
- Any required numeric value is non-numeric.
- Any physically positive quantity is zero or negative.
- Percent values are outside 0-100% where applicable.
- P90/P50/P10 ordering violates selected convention.
- Low clip is greater than high clip.
- Fixed value is outside low/high clip.
- Required unit is missing.

## Non-blocking Warnings

The app shall warn but not block simulation for:

- Optional metadata missing.
- Notes/rationale missing for major input variables.
- Very wide P90-P10 range.
- Porosity outside recommended range but still physically possible.
- Saturation outside recommended range but still physically possible.
- FVF/GEF/GOR outside recommended range.
- Recovery factor unusually high.
- Chance value unusually optimistic or pessimistic.
- Correlations disabled.
- Iteration count below recommended value.

## Recommended Default Technical Limits

These limits are placeholders and should be reviewed before implementation.

| Variable | Error range | Warning range |
|---|---|---|
| Porosity | <0% or >100% | <1% or >40% |
| HC saturation | <0% or >100% | <15% or >95% |
| Recovery efficiency | <0% or >100% | Oil >60%, gas >95% |
| Percent fill | <0% or >100% | <10% or =100% with no note |
| Net pay | <=0 | Very wide P90-P10 spread |
| Closed area | <=0 | Very wide P90-P10 spread |
| Oil FVF | <=0 | <1 or >4 |
| Gas expansion factor | <=0 | <25 or >750 |
| GOR | <0 | Field-specific review required |
| Chance factor | <0% or >100% | <5% or >95% |

## Acceptance Criteria

## MVP Release Acceptance Criteria

The MVP shall be considered functionally acceptable only when all P0 acceptance criteria below are met.

### Prospect setup

- Given a new user starts the app, when they create a prospect with required metadata, then the prospect is saved and visible in the app header.
- Given a required metadata field is missing, when the user attempts to proceed to simulation, then the app identifies the missing field.

### Input modules

- Given valid area, net pay, and HC yield inputs, when the user saves each module, then module completion status updates.
- Given invalid numeric inputs, when the user saves, then the app displays field-specific validation messages.
- Given optional notes are entered, when export is generated, then notes are included.

### Simulation

- Given all required inputs are complete and valid, when the user runs simulation, then the app completes a Monte Carlo simulation and stores the run metadata.
- Given the same input set and seed, when simulation is rerun, then the result statistics reproduce within agreed numerical tolerance.
- Given an error-level validation issue exists, when the user attempts simulation, then the app blocks the run and lists errors.

### Chance

- Given all chance sub-factors are entered, when the user views the Chance screen, then category chance and Pg are calculated.
- Given a category has multiple sub-factors, when category chance is calculated, then the minimum populated value is used.
- Given Pg is calculated, when results are shown, then Pg and Pg-risked mean are displayed.

### Results

- Given simulation completes, when the user opens Results, then P99/P90/P50/mean/P10/P01 are displayed for applicable outputs.
- Given units are shown, when the user reviews results, then every output has a clear unit.
- Given a fluid type is selected, when results render, then non-applicable output products are hidden or marked N/A.

### Charts

- Given simulation results exist, when the user opens Charts, then histogram and cumulative probability chart render.
- Given the user selects scatter plot variables, when the plot updates, then the selected variables appear on the axes.
- Given no simulation exists, when the user opens Charts, then the app shows a clear "run simulation first" message.

### QA/QC

- Given required inputs are missing, when the user opens QA/QC, then errors identify the affected module and field.
- Given non-blocking technical issues exist, when the user runs simulation, then warnings remain visible but do not block the run.
- Given validation errors are corrected, when QA/QC refreshes, then corrected errors disappear.

### Export

- Given simulation results exist, when the user exports CSV, then result tables are exported.
- Given simulation results exist, when the user exports Excel-compatible summary, then the export contains metadata, inputs, distributions, chance, results, and QA/QC findings.
- Given no simulation has been run, when the user attempts result export, then the app explains no results are available.

## Success Metrics

### MVP technical success metrics

- User can complete a single-zone evaluation workflow without external spreadsheet editing.
- Required inputs can be entered and validated.
- Simulation results can be reproduced using saved seed.
- Export contains enough information for independent technical review.
- At least one selected workbook case can be recreated and compared.

### MVP usability success metrics

- A technical user can identify all missing required inputs from the dashboard or QA/QC screen.
- A technical user can understand which assumptions control the result.
- A technical user can export a review package without manual copying.

## Validation Against Workbook

Before accepting the MVP as technically reliable, use at least one reference case from the workbook.

### Validation workflow

1. Select a workbook case.
2. Extract prospect metadata.
3. Extract Area P90/P50/P10 and distribution settings.
4. Extract Net Pay P90/P50/P10 and distribution settings.
5. Extract HC Yield P90/P50/P10 and distribution settings.
6. Extract chance factors and Pg.
7. Enter same values into the app.
8. Run simulation with agreed seed and iteration count.
9. Compare key outputs.
10. Document differences.

### Validation comparison table

| Output | Workbook result | App result | Difference | Status | Explanation |
|---|---:|---:|---:|---|---|
| Productive area P90 | TBD | TBD | TBD | TBD | TBD |
| Net pay P50 | TBD | TBD | TBD | TBD | TBD |
| Recoverable oil P90 | TBD | TBD | TBD | TBD | TBD |
| Recoverable oil mean | TBD | TBD | TBD | TBD | TBD |
| Pg | TBD | TBD | TBD | TBD | TBD |
| Pg-risked mean | TBD | TBD | TBD | TBD | TBD |

## Open Questions Before Build

| ID | Question | Owner | Blocking? | Notes |
|---|---|---|---:|---|
| OQ-001 | Should MVP support oil only first, or oil/gas/gas-condensate from day one? | Product owner / technical reviewer | Yes | Affects HC Yield and result outputs |
| OQ-002 | What canonical unit system should the calculation engine use? | Technical reviewer | Yes | Affects formula constants |
| OQ-003 | What exact volumetric constants should be used for acre-ft, bbl, scf, Bcf, and MMBOE conversion? | Technical reviewer | Yes | Must be finalized before calculation coding |
| OQ-004 | Which percentile interpolation method should be used? | Technical reviewer / developer | Yes | Affects validation against workbook |
| OQ-005 | Should Pg-risked P90/P50/P10 be displayed in MVP, or only Pg-risked mean? | Technical reviewer | Yes | Avoids misleading risked percentile reporting |
| OQ-006 | Are correlations required in MVP? | Product owner | No | Can be P1 if not mandatory |
| OQ-007 | Is PDF export required for first release? | Product owner | No | Excel export is proposed as P0 |
| OQ-008 | What workbook case should be used as the first validation case? | Technical reviewer | Yes | Needed for validation |

## Implementation Readiness Checklist

Before development starts, confirm:

- MVP scope is approved.
- Product types required in MVP are approved.
- Unit system is approved.
- Formula constants are approved.
- Percentile convention is approved.
- Distribution list is approved.
- Chance logic is approved.
- Export requirements are approved.
- Validation workbook case is selected.
- Acceptance criteria are approved.

## Recommended Next Step

After this FRS is reviewed, the next deliverable should be a technical calculation specification that finalizes unit conversions, volumetric constants, distribution fitting methods, percentile extraction rules, and workbook validation test cases. Once that is approved, implementation can begin in controlled milestones.
