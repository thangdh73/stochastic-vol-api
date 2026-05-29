---
name: stochastic-volumetrics
description: Use this skill when building, reviewing, testing, or modifying stochastic petroleum volumetric calculations, Monte Carlo simulation, uncertainty distributions, GRV decomposition, tank roll-up, POS, commercial cut-off, or volumetric reporting.
---

# Stochastic Volumetrics Skill

## Purpose

Build and maintain a petroleum stochastic volumetric calculation web application.

The app must support deterministic and probabilistic estimation of in-place and recoverable hydrocarbon volumes.

This is a petroleum geoscience and resource-assessment application, not a generic calculator or generic dashboard.

The calculation engine is the core of the project. UI, charts, reporting, and exports must sit on top of tested calculation logic.

---

## Core Equations

### Oil

STOIIP = GRV × NTG × Porosity × (1 - Sw) / Bo

Recoverable Oil = STOIIP × Recovery Factor

### Gas

GIIP = GRV × NTG × Porosity × (1 - Sw) / Bg

Recoverable Gas = GIIP × Recovery Factor

### Generic

Volume = Area × Thickness × NTG × Porosity × Hydrocarbon Saturation × 1/FVF × Recovery Factor

### Notes

- Shc = 1 - Sw
- NTG, porosity, Sw, Shc and recovery factor are internally treated as fractions.
- Formation volume factors must be positive.
- Volumes must never be negative.
- Do not mix oil, gas, and BOE/MMBOE calculations without clear conversion rules.

---

## Percentile Convention

Use petroleum exceedance convention:

- P90 = low case volume, 90% chance of exceeding
- P50 = median case volume
- P10 = high case volume, 10% chance of exceeding

Do not confuse petroleum exceedance percentiles with increasing CDF percentiles.

For a positive skewed volume distribution, expected ordering is usually:

P90 < P50 < P10

---

## Required Workflow

Use this workflow:

1. Validate inputs
2. Convert units
3. Generate input samples
4. Apply dependency/correlation model
5. Run Monte Carlo calculation
6. Calculate summary statistics
7. Generate QC warnings
8. Generate charts
9. Generate report-ready summary
10. Preserve audit trail

---

## Required Inputs

Support:

- Project name
- Scenario name
- Tank name
- Fluid type
- GRV or Area × Thickness
- NTG
- Porosity
- Sw or Shc
- Bo or Bg
- Recovery factor
- GOR, CGR, BOE/MMBOE conversion factors where relevant
- POS
- Commercial cut-off
- Scenario weight
- Tank on/off flag
- Number of simulations
- Random seed
- Unit system
- Dependency model
- Distribution type for each uncertain variable

---

## Unit Rules

The app must keep units explicit for every input and output.

Minimum supported units:

- GRV: m3, km2.m, acre-ft
- Area: km2, m2, acres
- Thickness: m, ft
- Oil volume: stb, bbl, MMstb, MMbbl
- Gas volume: scf, Mscf, MMscf, Bscf
- Porosity, NTG, Sw, Shc, RF: fraction or percent, but internally stored as fraction
- Bo: rb/stb or equivalent
- Bg: rb/scf, res m3/std m3, or equivalent

Rules:

- Convert all values to internal calculation units before simulation.
- Report output units clearly.
- Do not mix metric and field units silently.
- If units are missing, block calculation or generate a critical QC warning.
- Add unit tests for every supported conversion.
- Do not hard-code hidden unit assumptions.

---

## Distribution Types

Support at minimum:

- fixed
- triangular
- normal
- lognormal
- uniform
- P90/P50/P10-defined distribution
- custom sampled distribution if implemented later

Rules:

- Fixed values are deterministic and must be labelled as such.
- Lognormal is preferred for positive multiplicative variables such as GRV or volume-like parameters.
- Normal distributions must not generate non-physical values without handling and QC warning.
- Triangular distributions are acceptable for expert low/mode/high estimates.
- P90/P50/P10 inputs must follow petroleum exceedance convention unless clearly labelled otherwise.
- Distribution assumptions must be included in the output report.

---

## Dependency Handling

Support:

- independent sampling
- Gaussian copula
- Iman-Conover rank correlation

Common dependency examples:

- Porosity vs Sw: usually negative
- NTG vs porosity: often positive
- GRV vs NTG: project-specific
- Recovery factor vs reservoir quality proxy: usually positive if quality proxy exists
- Fluid contact vs GRV: usually strongly linked
- Depth uncertainty vs GRV: usually strongly linked

If no dependency model is supplied, report:

"Inputs sampled independently."

Rules:

- Do not silently assume independence.
- Correlation matrix must be validated.
- Correlation matrix must be positive semi-definite.
- If a dependency model fails, block calculation or generate a critical QC warning.
- Preserve dependency assumptions in the report.

---

## Scenario and Tank Roll-up Rules

The app must support:

- tank-level calculations
- scenario-level calculations
- field/container-level roll-up

Rules:

- Disabled tanks must be excluded from roll-up.
- Scenario weights must sum to 1.0.
- Tank dependencies must be explicit.
- Shared risks must not be double-counted.
- Scenario weights and POS must not be confused.
- Do not merge geologically incompatible scenarios into one hidden distribution.
- Preserve per-tank and per-scenario results before roll-up.
- Report both individual tank results and rolled-up results.

For multi-tank calculations, report:

- tank contribution to in-place volume
- tank contribution to recoverable volume
- tank contribution to uncertainty
- tank on/off status
- dependency assumptions
- scenario weight
- POS
- commercial cut-off status

---

## Toggle Rules

The app must support explicit toggles.

### Tank toggle

If tank is OFF:

- Exclude tank from roll-up.
- Preserve tank input data.
- Clearly mark tank as excluded.
- Do not include disabled tank in sensitivity or total volume.

### Recovery factor toggle

If recovery factor is OFF:

- Still calculate in-place volume.
- Do not silently calculate recoverable volume.
- Recoverable volume should be hidden, set to NA, or calculated only if user explicitly chooses RF = 1.0.
- Generate a note in the report.

### GOR toggle

If GOR is OFF:

- Do not calculate solution gas.
- Hide GOR inputs.
- Store GOR as null.
- MMBOE should use oil only unless another conversion is explicitly enabled.

### Commercial cut-off toggle

If commercial cut-off is OFF:

- Report zero-cut-off technical success volumes only.
- Do not calculate commercial POS.

---

## Commercial Cut-off Rules

If commercial cut-off is enabled:

- Calculate zero-cut-off success statistics first.
- Calculate the probability that volume exceeds the commercial cut-off.
- Report commercial POS separately from technical POS.
- Report cut-off volume clearly.
- Do not take P90/P50/P10 from the risked display.
- Do not hide zero-cut-off results.
- If cut-off exceeds most simulated outcomes, generate a QC warning.

Definitions:

- Technical POS = probability of technical success at zero cut-off.
- Commercial POS = probability of exceeding the commercial cut-off.
- Mean Success Volume = mean of success outcomes.
- Risked Expectation = POS × Mean Success Volume.
- Commercial Mean Success Volume = mean of volumes above commercial cut-off, if required for economics.

---

## Advanced GRV Uncertainty Modelling

GRV must not only be treated as a direct input distribution.

The app should support two GRV modes:

---

### 1. Direct GRV Mode

User enters GRV as:

- fixed value
- P90/P50/P10
- triangular
- lognormal
- normal
- uniform
- custom distribution

Use this mode for quick screening or when GRV has already been externally calculated.

---

### 2. Component-Based GRV Mode

User derives GRV from uncertainty components:

- area-depth curve
- area-thickness relationship
- top reservoir depth uncertainty
- base reservoir uncertainty
- gross thickness uncertainty
- time-depth conversion uncertainty
- seismic picking uncertainty
- processing / velocity uncertainty
- spill point / leak point uncertainty
- fluid contact uncertainty
- geometry correction factor

The workflow is:

1. Sample structural/depth uncertainty.
2. Sample fluid contact or spill/leak point uncertainty.
3. Apply area-depth or area-thickness relationship.
4. Calculate GRV for each Monte Carlo iteration.
5. Store the derived GRV samples.
6. Use derived GRV samples in STOIIP/GIIP calculation.

The app must preserve the sampled component values so their contribution can be analysed.

---

## GRV Component Rules

In component-based GRV mode:

- Do not ask the user for a final GRV distribution and also derive GRV unless the user explicitly wants comparison mode.
- Derived GRV samples must be used directly in STOIIP/GIIP calculation.
- Preserve sampled depth shift, contact depth, area, thickness, geometry factor and derived GRV for each iteration.
- Allow GRV uncertainty decomposition using rank correlation or variance-based sensitivity.
- Show whether GRV is controlled mainly by depth uncertainty, contact uncertainty, thickness uncertainty, or geometry correction.
- If fluid contact is structurally linked to spill/leak point, do not sample it independently unless specified.
- If contact uncertainty is scenario-based, treat each contact model as a scenario rather than a simple continuous distribution.
- If spill/leak point controls contact, preserve the geological scenario logic.
- If contact is pressure-derived, keep contact uncertainty separate from seismic depth uncertainty unless explicitly linked.
- If gross thickness is much smaller than column height, area × thickness may be suitable.
- If gross thickness is comparable to or larger than column height, geometry correction may be required.

---

## GRV Tornado Analysis

The app should support tornado analysis at two levels:

### 1. GRV Decomposition Tornado

Show impact on derived GRV from:

- depth uncertainty
- fluid contact uncertainty
- spill/leak point uncertainty
- gross thickness uncertainty
- area uncertainty
- geometry correction factor
- top/base reservoir uncertainty

### 2. Full Volumetric Tornado

Show impact on STOIIP/GIIP/recoverable volume from:

- GRV
- NTG
- porosity
- Sw/Shc
- FVF
- recovery factor
- GOR/CGR if relevant
- POS if reporting risked expectation

Rules:

- Do not only show "GRV" as a tornado bar when component-based GRV mode is used.
- Show both composite GRV impact and internal GRV drivers.
- Sensitivity should be calculated separately for in-place and recoverable volume.
- Use Spearman rank correlation as preferred first-pass tornado method.
- Pearson correlation may be included as optional diagnostic.
- Regression or variance-based sensitivity may be added later.

---

## QC Rules

Generate warnings for:

- missing units
- invalid fractions
- non-positive FVF
- negative or zero GRV
- invalid distribution order
- unrealistic P90/P50/P10 order
- sampled non-physical values
- clipped or rejected samples
- correlation matrix not positive semi-definite
- commercial cut-off above most of the distribution
- scenario weights not summing to 1
- tank disabled but still included in roll-up
- hidden default assumptions
- recovery factor applied when recovery toggle is off
- GOR used when GOR toggle is off
- solution gas hidden when GOR is enabled
- direct GRV and component-derived GRV both active without comparison mode
- contact uncertainty sampled independently when it should be scenario-linked
- P90/P50/P10 calculated using wrong percentile convention

QC severity levels:

- Critical: calculation should be blocked
- High: calculation can run but result is technically unsafe
- Medium: result is usable but needs review
- Low: advisory note

---

## Required Outputs

Report:

- P90
- P50
- P10
- mean
- mode where available
- min
- max
- standard deviation
- coefficient of variation
- mean success volume
- POS
- risked expectation = POS × mean success volume
- commercial POS if cut-off enabled
- commercial mean success volume if cut-off enabled
- simulation count
- random seed
- units
- QC warnings
- dependency assumptions
- distribution assumptions
- tank inclusion/exclusion status
- scenario weights
- app version or calculation version

---

## Required Charts

Include:

- histogram/frequency plot
- expectation/exceedance curve
- input distribution plots
- tornado chart
- GRV decomposition tornado
- correlation heatmap where dependency model is used
- tank contribution chart for multi-tank cases
- scenario comparison chart where scenarios exist
- cut-off visual marker on expectation curve where commercial cut-off is enabled

Rules:

- Always include both histogram and expectation curve.
- Histogram helps identify mode, skewness, and multimodality.
- Expectation curve supports P90/P50/P10 and cut-off interpretation.
- Charts must clearly show units.

---

## Reporting Rules

A technical report must include:

1. Project summary
2. Scenario/tank summary
3. Input assumptions
4. Input distributions
5. Unit assumptions
6. Dependency assumptions
7. Monte Carlo settings
8. GRV method: direct or component-based
9. GRV component uncertainty summary if applicable
10. In-place volume summary
11. Recoverable volume summary
12. Risked volume summary
13. Cut-off volume summary
14. Sensitivity/tornado results
15. GRV decomposition tornado if applicable
16. QC warnings
17. Scenario/tank roll-up
18. Export timestamp
19. App/calculation version

Reports must be suitable for technical review, not only dashboard viewing.

---

## Implementation Rules

- Keep calculation logic separate from UI.
- Backend calculation functions must be pure and testable.
- Add unit tests for every equation.
- Add regression tests for percentile convention.
- Use random seed for reproducibility.
- Do not silently change user inputs.
- Do not silently assume independence.
- Do not silently apply recovery factor if recovery is disabled.
- Do not hide solution gas if GOR is enabled.
- Do not include disabled tanks in roll-up.
- Do not hide unit conversion.
- Do not calculate final volumes directly in frontend components.
- Preserve raw samples for audit/debug mode where practical.
- Preserve calculation settings in output.
- Any assumption used in the calculation must be visible in report output.

---

## Suggested Backend Modules

Use modular calculation design:

```text
distribution_sampler.py
unit_conversion.py
dependency_model.py
grv_direct.py
grv_component_based.py
volumetric_equations.py
simulation_engine.py
statistics_summary.py
cutoff_analysis.py
sensitivity_tornado.py
qc_checks.py
rollup_engine.py
reporting.py

## Petrel GRV Matrix Mode

The app must support a Petrel-exported GRV matrix mode.

This mode is used when Petrel has already calculated GRV in cubic units for combinations of structural/depth uncertainty and fluid contact uncertainty.

The app should not re-calculate structural geometry in this mode.

Required inputs:

- GRV unit
- Depth uncertainty cases: Low, Mid, High
- Fluid contact uncertainty cases: Low, Mid, High
- 3 × 3 GRV matrix:
  - Depth Low / Contact Low
  - Depth Low / Contact Mid
  - Depth Low / Contact High
  - Depth Mid / Contact Low
  - Depth Mid / Contact Mid
  - Depth Mid / Contact High
  - Depth High / Contact Low
  - Depth High / Contact Mid
  - Depth High / Contact High
- Probability weights for depth cases
- Probability weights for contact cases

Simulation workflow:

1. Sample a depth case.
2. Sample a fluid contact case.
3. Select GRV from the Petrel matrix.
4. Convert GRV to internal units.
5. Use selected GRV in STOIIP/GIIP calculation.
6. Preserve selected depth case, contact case and GRV for each iteration.

Sensitivity workflow:

- Calculate depth uncertainty impact by averaging GRV across contact cases for each depth level.
- Calculate fluid contact uncertainty impact by averaging GRV across depth cases for each contact level.
- Calculate optional depth × contact interaction effect.
- Show these in the GRV decomposition tornado.

Rules:

- Do not treat Petrel matrix mode as a simple triangular GRV unless the user explicitly chooses simplification.
- Do not lose the link between GRV and its depth/contact driver.
- Always report that GRV came from Petrel cubic-volume outputs.
- Always show GRV unit.