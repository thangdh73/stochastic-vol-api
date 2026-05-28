# MMRA Web MVP Technical Calculation Specification

Prepared for review before implementation.

## Document Control

| Item | Detail |
|---|---|
| Product working name | MMRA Web / Probabilistic Resource & Risk Evaluator |
| Document type | Technical Calculation Specification |
| Source documents | MMRA app review specification, MVP FRS, attached MMRA workbook inspection |
| Status | Draft for technical review |
| Implementation status | Implemented (engine + API + UI exist; this doc remains the calculation source of truth) |

## Purpose

This document finalizes the MVP calculation rules for unit handling, volumetric constants, distribution parameterization, percentile extraction, chance calculations, and workbook validation cases. It is intended to remove ambiguity before any calculation engine is implemented.

The specification uses a workbook-aligned convention where **P90 is the smaller/conservative resource estimate and P10 is the larger/upside resource estimate**. The inspected workbook has `P10_large = TRUE`, which means labels are displayed as P99, P90, P50, mean, P10, P01 from smallest to largest resource outcome.

## Calculation Design Principles

- **Reproducibility**: all stochastic runs must be reproducible from saved inputs, distribution definitions, random seed, iteration count, and software version.
- **Traceability**: all output values must be traceable to input variables, unit conversions, distribution settings, and simulation metadata.
- **Workbook alignment where practical**: MVP should match the workbook's visible conventions for P90/P10 direction, P99/P01 labels, 5,000-iteration workflow, gas-oil conversion ratio, and P99-to-P01 mean.
- **Explicit deviations**: where exact workbook VBA behavior is unknown, the MVP shall use a documented statistical method and record any expected differences during validation.
- **Canonical units**: all calculations shall use canonical internal units and convert only at input/output boundaries.

## Final MVP Unit System

## Canonical Internal Units

| Quantity | Canonical unit | Input units allowed in MVP | Output units allowed in MVP | Notes |
|---|---|---|---|---|
| Area | acres | acres, km² | acres, km² | Convert km² to acres internally |
| Thickness | feet | feet, metres | feet, metres | Workbook example uses metres for net pay but area in acres |
| Bulk/net rock volume | acre-ft | Calculated | acre-ft, thousand acre-ft | Primary volumetric rock-volume unit |
| Porosity | fraction | % | % | Store 15% as 0.15 |
| Saturation | fraction | % | % | Store 65% as 0.65 |
| Recovery efficiency | fraction | % | % | Store 35% as 0.35 |
| FVF | rb/stb | rb/stb | rb/stb | Oil formation volume factor |
| GOR / solution gas yield | scf/stb | scf/stb | scf/stb | Workbook example uses SCF/std bbl |
| Gas expansion factor | scf/reservoir ft³ | scf/reservoir ft³ | scf/reservoir ft³ | Workbook labels as standard/reservoir units |
| Condensate yield | bbl/MMscf | bbl/MMscf | bbl/MMscf | For gas-condensate |
| Oil/liquids volume | MMbbl | MMbbl | MMbbl | Workbook reports MMBO/MMBOE |
| Gas volume | Bcf | Bcf | Bcf | Workbook reports BCF |
| Oil equivalent | MMBOE | MMBOE | MMBOE | Uses configurable gas-oil conversion |

## Unit Conversion Constants

| Conversion | Constant | Formula |
|---|---:|---|
| km² to acres | 247.105381467 | acres = km² × 247.105381467 |
| metres to feet | 3.280839895 | ft = m × 3.280839895 |
| acre-ft to reservoir ft³ | 43,560 | reservoir ft³ = acre-ft × 43,560 |
| bbl per acre-ft | 7,758.36735 | bbl = acre-ft × 7,758.36735 |
| bbl to MMbbl | 1e-6 | MMbbl = bbl / 1,000,000 |
| scf to Bcf | 1e-9 | Bcf = scf / 1,000,000,000 |
| Bcf to MMscf | 1,000 | MMscf = Bcf × 1,000 |
| Workbook gas-oil conversion | 6 mcf/bbl | MMBOE = liquids MMbbl + gas Bcf / 6 |

The inspected workbook's `HC_CF_Ratio` is 6, so MVP default gas-oil conversion shall be **6 mcf/bbl**. The value shall remain configurable.

## Percent and Probability Handling

All percent inputs shall be displayed as percentages but stored as fractions internally.

Examples:

- 100% percent fill is stored as 1.0.
- 17.8% porosity is stored as 0.178.
- 0.12636 Pg may be displayed as 12.636%.

Chance values may be entered as either 0-1 decimal or 0-100%, but the UI must normalize and clearly display the interpreted value.

## Percentile Convention

## Workbook-Aligned Labels

The MVP shall use the workbook-aligned P10-large convention:

| Display label | CDF quantile | Resource meaning |
|---|---:|---|
| P99 | 0.01 | Very conservative small resource |
| P90 | 0.10 | Conservative small resource |
| P50 | 0.50 | Median resource |
| Mean P99→P01 | Trimmed mean between 0.01 and 0.99 | Workbook-style reported mean |
| P10 | 0.90 | Upside large resource |
| P01 | 0.99 | Very upside large resource |

This convention shall be shown in the UI and exports to avoid confusion with statistical percentile terminology.

## Percentile Extraction Method

For a simulated output vector `x` with `n` valid numeric values:

- Sort values in ascending order.
- Use NumPy-compatible quantile method `linear`, equivalent to Hyndman-Fan Type 7.
- Calculate:
  - P99 label = `quantile(x, 0.01)`
  - P90 label = `quantile(x, 0.10)`
  - P50 label = `quantile(x, 0.50)`
  - P10 label = `quantile(x, 0.90)`
  - P01 label = `quantile(x, 0.99)`

If the implementation language is Python, the calculation shall use:

`numpy.quantile(values, q, method="linear")`

For older NumPy versions:

`numpy.quantile(values, q, interpolation="linear")`

## Mean Definition

The workbook displays `Mean (P99->P01)` and has `Apply_TruncMean = TRUE`. The MVP shall therefore report a trimmed mean by default:

1. Calculate `q01 = quantile(x, 0.01)`.
2. Calculate `q99 = quantile(x, 0.99)`.
3. Retain values where `q01 <= x <= q99`.
4. Calculate arithmetic mean of retained values.

The app may also store the full untrimmed arithmetic mean as an internal diagnostic, but the default displayed mean shall be the P99-to-P01 trimmed mean.

## Distribution Specification

## General Distribution Object

Each uncertain variable shall be represented as:

| Field | Required | Notes |
|---|---:|---|
| variable_id | Yes | Stable internal identifier |
| display_name | Yes | User-facing label |
| unit | Yes | User-selected unit |
| canonical_unit | Yes | Internal unit |
| distribution_type | Yes | Fixed, normal, lognormal, beta, triangular, uniform |
| p90 | Conditional | Conservative/small value for positive resource variables |
| p50 | Conditional | Median value |
| p10 | Conditional | Upside/large value |
| mode | Conditional | Used by triangular/PERT-style distributions |
| min_bound | Conditional | Required for beta/uniform if not defaulted |
| max_bound | Conditional | Required for beta/uniform if not defaulted |
| low_clip | Optional | Hard lower clip after sampling |
| high_clip | Optional | Hard upper clip after sampling |
| notes | Optional | Technical rationale |

All distribution parameters shall be converted to canonical units before simulation.

## Random Number Generation

The MVP shall use NumPy's modern generator:

`numpy.random.default_rng(seed)`

Rules:

- Every simulation run must store the seed.
- Running the same input set with the same seed and engine version must reproduce the same output.
- Distribution sampling order must be deterministic and documented by variable order.
- The simulation run metadata must include iteration count and engine version.

## Fixed Distribution

Use when no uncertainty is intended.

Sampling rule:

`sample_i = fixed_value` for every iteration.

Validation:

- Fixed value must be numeric.
- Fixed value must pass physical limits.
- If clips are defined, fixed value must be inside clips.

## Uniform Distribution

Required parameters:

- lower bound
- upper bound

Sampling rule:

`X ~ Uniform(lower, upper)`

If the user enters P90 and P10 only, MVP shall interpret:

- lower = P90
- upper = P10

P50 is calculated as `(lower + upper) / 2` for preview only.

## Normal Distribution

Recommended inputs:

- P90
- P50, optional
- P10

Parameterization:

Let:

- `x10cdf = P90_display`
- `x90cdf = P10_display`
- `z90 = 1.2815515655446004`

If P50 is provided:

- `mu = P50`
- `sigma = max((P10 - P90) / (2 × z90), epsilon)`

If P50 is not provided:

- `mu = (P90 + P10) / 2`
- `sigma = max((P10 - P90) / (2 × z90), epsilon)`

Sampling rule:

`X ~ Normal(mu, sigma)`

Then apply clips and physical limits.

Validation:

- P10 must be greater than or equal to P90 for positive resource variables.
- Sigma must be positive.

## Lognormal Distribution

Recommended inputs:

- P90
- P10
- P50 optional for preview/calibration check

Parameterization:

For positive variables:

- `ln_p90 = ln(P90)`
- `ln_p10 = ln(P10)`
- `sigma_ln = (ln_p10 - ln_p90) / (2 × z90)`
- `mu_ln = (ln_p90 + ln_p10) / 2`

Sampling rule:

`ln(X) ~ Normal(mu_ln, sigma_ln)`

Then apply clips and physical limits.

Derived median:

`median = exp(mu_ln)`

If user-provided P50 differs materially from `exp(mu_ln)`, the app shall issue a warning that the P50 is inconsistent with a two-point lognormal fit. The MVP shall not force a three-point lognormal unless explicitly specified later.

Validation:

- P90 and P10 must be positive.
- P10 must be greater than or equal to P90 for positive resource variables.

## Triangular Distribution

Preferred MVP inputs:

- minimum
- mode
- maximum

Sampling rule:

`X ~ Triangular(minimum, mode, maximum)`

If only P90/P50/P10 are supplied:

- minimum shall default to low clip if present, otherwise P90.
- mode shall default to P50 if present, otherwise `(P90 + P10) / 2`.
- maximum shall default to high clip if present, otherwise P10.

This fallback is simple and transparent, but it may not match workbook VBA exactly. If triangular equivalence is important, a later version shall fit triangular parameters by solving for P90 and P10 quantiles.

## Beta Distribution

Beta distributions are important for bounded percent variables such as porosity, saturation, percent fill, and recovery efficiency.

Required parameters:

- lower bound `a`
- upper bound `b`
- target P90 display value
- target P10 display value

Default bounds:

| Variable type | Default lower bound | Default upper bound |
|---|---:|---:|
| Porosity | Admin/configured minimum, default 1% | Admin/configured maximum, default 40% |
| Hydrocarbon saturation | Admin/configured minimum, default 15% | Admin/configured maximum, default 95% |
| Recovery efficiency | 0% | 100% |
| Percent fill | 0% | 100% |
| Generic bounded fraction | 0% | 100% |

The inspected workbook shows the following admin limits:

- Porosity: 1% to 40%
- Hydrocarbon saturation: 15% to 95%
- Oil FVF: 1 to 4
- Gas expansion factor: 25 to 750

Parameterization:

1. Convert P90 and P10 to canonical units and fractions if applicable.
2. Normalize:
   - `y10 = (P90 - a) / (b - a)`
   - `y90 = (P10 - a) / (b - a)`
3. Solve for `alpha` and `beta` such that:
   - `BetaCDF(y10; alpha, beta) = 0.10`
   - `BetaCDF(y90; alpha, beta) = 0.90`
4. Use numerical root finding with positive bounds for `alpha` and `beta`.
5. Sample:
   - `Y ~ Beta(alpha, beta)`
   - `X = a + Y × (b - a)`

If the system cannot solve a stable alpha/beta pair:

- show a validation error if the range is impossible; or
- fall back to a PERT-style beta only if the user accepts the approximation.

Implementation note:

- Use SciPy's `scipy.stats.beta.cdf` and `scipy.optimize.root` or equivalent.
- Store solved `alpha`, `beta`, `a`, and `b` in simulation metadata.

## Clipping and Truncation

## Variable-Level Clips

After sampling, variable-level clips shall be applied:

- If `low_clip` is present, sample = max(sample, low_clip).
- If `high_clip` is present, sample = min(sample, high_clip).

Clipping must be recorded in simulation metadata.

## Global Input and Output Truncation

The inspected workbook stores:

- `Input_Trunc_Lo = 0`
- `Input_Trunc_Hi = 1`
- `Output_Trunc_Lo = 0`
- `Output_Trunc_Hi = 1`

These workbook values behave as truncation percentile settings rather than physical variable limits. For MVP:

- Default input truncation: none beyond explicit variable clips and physical limits.
- Default output display mean: P99-to-P01 trimmed mean as specified above.
- Output percentiles shall always include P99/P90/P50/P10/P01.

If full workbook truncation behavior is required, it shall be validated as a separate phase.

## Correlation Treatment

The workbook example indicates Area-Net Pay correlation = 0%, and HC Yield shows some zero or full correlation settings. For MVP v1:

- Default all sampled variables are independent unless a correlation is explicitly enabled.
- Correlations are P1, not required for first calculation engine.
- The simulation metadata shall record `correlation_mode = independent`.

If P1 correlation is implemented:

- Use rank correlation / Iman-Conover or Gaussian copula.
- Correlation matrix must be positive semi-definite.
- Store the final matrix in simulation metadata.

## Volumetric Calculation Specification

## Per-Iteration Inputs

For each iteration `i`, sample or compute:

- `A_i` = closed area, acres
- `PF_i` = percent fill, fraction
- `PA_i` = productive area, acres
- `NP_i` = average net pay, feet
- `GCF_i` = geometric correction factor, fraction
- `NRV_i` = net rock volume, acre-ft
- `phi_i` = porosity, fraction
- `Shc_i` = hydrocarbon saturation, fraction
- `Bo_i` = oil FVF, rb/stb
- `RE_oil_i` = oil recovery efficiency, fraction
- `GOR_i` = solution gas yield, scf/stb
- `SGRE_i` = solution gas recovery efficiency, fraction
- `GEF_i` = gas expansion factor, scf/reservoir ft³
- `RE_gas_i` = gas recovery efficiency, fraction
- `CY_i` = condensate yield, bbl/MMscf

Only variables relevant to the selected fluid type are required.

## Productive Area

`PA_i = A_i × PF_i`

where `PF_i` is a fraction.

## Net Rock Volume

Primary MVP direct net-pay route:

`NRV_i = PA_i × NP_i × GCF_i`

where:

- `PA_i` is acres
- `NP_i` is feet
- `GCF_i` defaults to 1.0
- `NRV_i` is acre-ft

Optional gross interval/NTG route:

`NP_i = GrossInterval_i × NTG_i × GCF_i`

`NRV_i = PA_i × NP_i`

## Hydrocarbon Pore Volume

`HCPV_i = NRV_i × phi_i × Shc_i`

where `HCPV_i` is hydrocarbon pore volume in acre-ft.

## Oil Initially In Place

`STOIIP_bbl_i = HCPV_i × 7758.36735 / Bo_i`

`STOIIP_MMbbl_i = STOIIP_bbl_i / 1,000,000`

## Recoverable Oil

`RecoverableOil_MMbbl_i = STOIIP_MMbbl_i × RE_oil_i`

## Solution Gas

If solution gas is included:

`SolutionGas_Bcf_i = RecoverableOil_MMbbl_i × GOR_i × SGRE_i / 1000`

Derivation:

- 1 MMbbl = 1,000,000 stb
- scf = MMbbl × 1,000,000 × GOR
- Bcf = scf / 1,000,000,000
- therefore Bcf = MMbbl × GOR / 1000

## Gas Initially In Place

For gas cases:

`GIIP_scf_i = HCPV_i × 43560 × GEF_i`

`GIIP_Bcf_i = GIIP_scf_i / 1,000,000,000`

## Recoverable Gas

`RecoverableGas_Bcf_i = GIIP_Bcf_i × RE_gas_i`

## Condensate

If condensate yield is included:

`Condensate_MMbbl_i = RecoverableGas_Bcf_i × CY_i / 1000`

Derivation:

- 1 Bcf = 1,000 MMscf
- bbl condensate = Bcf × 1,000 × CY
- MMbbl = bbl / 1,000,000
- therefore MMbbl = Bcf × CY / 1000

## Total MMBOE

`TotalMMBOE_i = Liquids_MMbbl_i + Gas_Bcf_i / GORatio`

where:

- `GORatio = 6` by default
- `Liquids_MMbbl_i = RecoverableOil_MMbbl_i + Condensate_MMbbl_i`
- `Gas_Bcf_i = RecoverableGas_Bcf_i + SolutionGas_Bcf_i`, depending on fluid type and reporting convention

The app shall clearly label whether total MMBOE includes solution gas, non-associated gas, condensate, or all products.

## Output Sorting and Component Consistency

The inspected workbook warns that resource components are sorted individually and may not sum across to hydrocarbon equivalent. MVP shall follow the same transparent rule:

- Each output product vector shall be sorted independently for percentile reporting.
- Cross-product sums at each percentile may not equal the percentile of total MMBOE.
- The app shall display a note: "Percentiles are calculated independently by product; components may not sum across a row."

For totals:

- `TotalMMBOE_i` shall be calculated per iteration first.
- Percentiles of total MMBOE shall be calculated from the total vector.

## Chance Calculation Specification

## Chance Categories

MVP chance categories:

- Source
- Timing / migration
- Reservoir
- Closure
- Containment

## Weak-Link Sub-Factor Logic

For each category:

`CategoryChance = min(populated sub-factor probabilities)`

If play and prospect columns are both used:

- category play chance = minimum populated play sub-factor value
- category prospect chance = minimum populated prospect sub-factor value
- category total chance = play chance × prospect chance

For MVP simplification:

- If only one column is implemented, category chance = minimum populated category sub-factor.
- If both play and prospect are implemented, use workbook-style product logic.

The inspected workbook validation case has:

- Source = 0.90
- Timing/migration = 0.65
- Reservoir = 0.60
- Closure = 0.60
- Containment = 0.60

## Pg

`Pg = Source × TimingMigration × Reservoir × Closure × Containment`

For the workbook validation case:

`Pg = 0.90 × 0.65 × 0.60 × 0.60 × 0.60 = 0.12636`

## Risked Reporting

MVP reporting shall include:

- Unrisked resource percentiles.
- Pg.
- Pg-risked mean.

`PgRiskedMean = UnriskedTrimmedMean × Pg`

The MVP shall not display Pg-risked P90/P50/P10 by default unless dry-hole treatment is explicitly implemented.

## Dry-Hole Probability Treatment

Dry-hole treatment is not P0. If added later:

- Create a mixed distribution with probability `1 - Pg` at zero resource.
- With probability `Pg`, draw from the success-case resource distribution.
- Calculate risked percentiles from the mixed vector.

This may produce zero-valued P90 or P50 at low Pg and must be labelled differently from deterministic Pg multiplication.

## Validation Rules

## Blocking Calculation Errors

The simulation engine shall block execution if:

- Any required numeric input is missing.
- Any required distribution cannot be parameterized.
- Any required unit is missing.
- P10 display value is less than P90 display value for a positive resource-driving variable.
- P50 is outside P90-P10 range where P50 is required.
- Porosity, saturation, recovery, or chance values are outside 0-100%.
- Oil FVF is less than or equal to zero.
- Gas expansion factor is less than or equal to zero.
- Area or net pay is less than or equal to zero.
- Low clip is greater than high clip.
- Beta bounds do not enclose P90 and P10 values.
- Simulation iteration count is below 1,000 or above configured maximum.

## Technical Warnings

The simulation engine shall warn if:

- Porosity is outside 1-40%.
- Hydrocarbon saturation is outside 15-95%.
- Oil FVF is outside 1-4.
- Gas expansion factor is outside 25-750.
- Recovery efficiency is unusually high.
- Input uncertainty range is very wide.
- Required notes/rationale are missing for critical variables.
- Correlation mode is independent.
- P50 is inconsistent with the selected two-point distribution fit.

## Workbook-Derived Default Limits

| Variable | Default lower | Default upper | Source |
|---|---:|---:|---|
| Porosity | 1% | 40% | Workbook Admin settings |
| HC saturation | 15% | 95% | Workbook Admin settings |
| Oil FVF | 1 | 4 | Workbook Admin settings |
| Gas expansion factor | 25 | 750 | Workbook Admin settings |
| Percent fill | 0% | 100% | Physical/default |
| Recovery efficiency | 0% | 100% | Physical/default |
| Chance factor | 0% | 100% | Probability/default |

## Workbook Validation Cases

## Validation Case 1: PM3X-D H1ss10 Oil Prospect

This validation case is extracted from the inspected workbook.

### Case Metadata

| Field | Value |
|---|---|
| Prospect name | PM3X-D H1ss10 (oil) |
| Country | Malaysia |
| Basin | Malay Basin |
| Formation | H1ss10 |
| Lithology | Sandstone |
| Mode | Pre-drill, single zone of multi-zone prospect |
| Estimating method | Volumetric: Area × Net Pay × HC Yield |
| Intermediate simulation | 5,000 iterations |
| Resources simulation | 5,000 iterations |
| Area-Net Pay correlation | 0% |
| Raw gas surface loss | None |
| Percentile sorting | Each product sorted individually |

### Input Summary

| Module | Variable | Distribution | P90 | P50 | P10 | Unit |
|---|---|---|---:|---:|---:|---|
| Area | Closed area | Lognormal | 824 | 824 | 824 | acres |
| Area | Percent fill | Beta | 100 | 100 | 100 | % |
| Net Pay | Individual zone net reservoir thickness | Lognormal | 2.4 | 5.8 | 14.0 | metres |
| Net Pay | Geometric correction factor | Uniform/fixed | 100 | 100 | 100 | % |
| HC Yield | Porosity | Beta | 14.06 | 17.83 | 22.05 | % |
| HC Yield | HC saturation | Beta | 44.18 | 62.51 | 79.20 | % |
| HC Yield | Oil recovery efficiency | Beta | 29.94 | 34.92 | 40.08 | % |
| HC Yield | Oil FVF | Normal/fixed | 1.4 | 1.4 | 1.4 | rb/stb |
| HC Yield | Solution gas yield | Normal | 550.02 | 630.89 | 711.01 | scf/stb |
| HC Yield | Solution gas recovery efficiency | Fixed | 100 | 100 | 100 | % |

### Workbook Output Targets

| Output | P99 | P90 | P50 | Mean P99→P01 | P10 | P01 | Unit |
|---|---:|---:|---:|---:|---:|---:|---|
| Oil initially in place | 1.59 | 3.48 | 9.33 | 11.67 | 23.40 | 50.92 | MMBO |
| Raw gas initially in place | 0 | 0 | 0 | 0 | 0 | 0 | Bcf |
| Recoverable oil | 0.54 | 1.19 | 3.23 | 4.08 | 8.25 | 18.09 | MMBO |
| Total condensate | 0 | 0 | 0 | 0 | 0 | 0 | MMBO |
| Non-associated gas | 0 | 0 | 0 | 0 | 0 | 0 | Bcf |
| Solution gas | 0.32 | 0.74 | 2.04 | 2.56 | 5.24 | 11.25 | Bcf |
| Total geologic pre-drill | 0.59 | 1.32 | 3.56 | 4.50 | 9.10 | 19.94 | MMBOE |

### Chance Targets

| Category | Value |
|---|---:|
| Source | 0.90 |
| Timing / migration | 0.65 |
| Reservoir | 0.60 |
| Closure | 0.60 |
| Containment | 0.60 |
| Pg | 0.12636 |

### Validation Acceptance

Because exact workbook VBA distribution fitting and random sampling internals are not fully reverse-engineered, validation shall be staged:

| Stage | Acceptance criterion |
|---|---|
| Deterministic formula validation | With fixed sampled values, formula outputs must match hand calculations within 0.1%. |
| Percentile convention validation | App labels must order P99 < P90 < P50 < P10 < P01 for positive resource outputs. |
| Chance validation | Pg must equal 0.12636 exactly within rounding tolerance. |
| Resource range validation | App outputs should be directionally consistent with workbook outputs. Differences must be explained by distribution parameterization, random seed, or clipping/truncation. |
| Final equivalence target after calibration | For selected output percentiles, target within ±5% of workbook values unless workbook macro behavior prevents equivalence. |

## Validation Case 2: Deterministic Unit Formula Case

This case isolates volumetric formulas from distribution effects.

### Inputs

| Variable | Value |
|---|---:|
| Closed area | 1,000 acres |
| Percent fill | 100% |
| Net pay | 10 ft |
| Geometric correction factor | 100% |
| Porosity | 20% |
| HC saturation | 70% |
| Oil FVF | 1.4 rb/stb |
| Oil recovery efficiency | 35% |
| GOR | 600 scf/stb |
| Solution gas recovery efficiency | 100% |

### Expected calculations

`Productive Area = 1,000 acres`

`NRV = 1,000 × 10 = 10,000 acre-ft`

`HCPV = 10,000 × 0.20 × 0.70 = 1,400 acre-ft`

`STOIIP = 1,400 × 7,758.36735 / 1.4 / 1,000,000 = 7.75836735 MMbbl`

`Recoverable Oil = 7.75836735 × 0.35 = 2.7154285725 MMbbl`

`Solution Gas = 2.7154285725 × 600 / 1000 = 1.6292571435 Bcf`

`Total MMBOE = 2.7154285725 + 1.6292571435 / 6 = 2.98697142975 MMBOE`

### Acceptance

The app must reproduce these values within 0.01% using fixed distributions.

## Validation Case 3: Gas Formula Case

This case isolates gas volumetric formulas.

### Inputs

| Variable | Value |
|---|---:|
| Closed area | 1,000 acres |
| Percent fill | 100% |
| Net pay | 10 ft |
| Geometric correction factor | 100% |
| Porosity | 20% |
| HC saturation | 70% |
| Gas expansion factor | 200 scf/reservoir ft³ |
| Gas recovery efficiency | 80% |

### Expected calculations

`Productive Area = 1,000 acres`

`NRV = 10,000 acre-ft`

`HCPV = 1,400 acre-ft`

`GIIP = 1,400 × 43,560 × 200 / 1,000,000,000 = 12.1968 Bcf`

`Recoverable Gas = 12.1968 × 0.80 = 9.75744 Bcf`

`Total MMBOE = 9.75744 / 6 = 1.62624 MMBOE`

### Acceptance

The app must reproduce these values within 0.01% using fixed distributions.

## Implementation Requirements

## Calculation Engine Functions

The calculation engine shall expose deterministic functions for unit testing:

- `convert_units(value, from_unit, to_unit)`
- `sample_distribution(distribution, n, rng)`
- `apply_clips(samples, low_clip, high_clip)`
- `calculate_productive_area(area, percent_fill)`
- `calculate_nrv(productive_area, net_pay_ft, geometric_correction)`
- `calculate_hcpv(nrv_acft, porosity, saturation)`
- `calculate_stoiip(hcpv_acft, bo)`
- `calculate_recoverable_oil(stoiip_mmbbl, recovery_efficiency)`
- `calculate_solution_gas(recoverable_oil_mmbbl, gor, solution_gas_recovery)`
- `calculate_giip(hcpv_acft, gas_expansion_factor)`
- `calculate_recoverable_gas(giip_bcf, gas_recovery_efficiency)`
- `calculate_condensate(recoverable_gas_bcf, condensate_yield)`
- `calculate_mmboe(liquids_mmbbl, gas_bcf, gas_oil_ratio)`
- `calculate_percentile_summary(values)`
- `calculate_pg(chance_categories)`

## Simulation Metadata

Each simulation run shall store:

- prospect ID
- input version/hash
- calculation engine version
- random seed
- iteration count
- percentile convention
- unit system version
- gas-oil conversion ratio
- distribution parameters after unit conversion
- solved beta parameters, if applicable
- clipping settings
- correlation mode and matrix, if applicable
- run timestamp
- validation warnings present at run time

## Output Data Structures

For each output product, store:

- product name
- unit
- vector statistics: P99, P90, P50, mean P99→P01, P10, P01
- optional full vector or compressed simulation array if charts require it
- chart-ready histogram bins, if arrays are not retained

## Testing Requirements

## Unit Tests

Unit tests shall cover:

- unit conversion constants
- percent-to-fraction conversion
- oil formula case
- gas formula case
- solution gas formula
- condensate formula
- MMBOE conversion
- Pg calculation
- percentile extraction on known arrays
- trimmed mean calculation
- distribution parameter validation

## Integration Tests

Integration tests shall cover:

- fixed-distribution deterministic full run
- PM3X-D validation case input loading
- simulation reproducibility with fixed seed
- output summary generation
- export consistency with displayed results

## Numerical Tolerances

| Test type | Tolerance |
|---|---:|
| Unit conversions | 1e-9 relative where practical |
| Deterministic formula tests | 0.01% |
| Pg calculation | 1e-8 absolute |
| Percentile summary on fixed arrays | exact or 1e-10 depending floating precision |
| Workbook stochastic validation | initial ±5% target after distribution calibration |

## Open Technical Items

The following items should be reviewed before coding, but the MVP can proceed with the defaults stated in this document if no changes are requested:

| ID | Item | Default decision in this spec | Blocking? |
|---|---|---|---:|
| TECH-001 | Canonical unit system | Acres, feet, acre-ft, MMbbl, Bcf | Yes |
| TECH-002 | Gas-oil conversion | 6 mcf/bbl | No |
| TECH-003 | Percentile method | NumPy Type 7 linear quantile | Yes |
| TECH-004 | Displayed mean | P99-to-P01 trimmed mean | Yes |
| TECH-005 | Beta fitting | Solve alpha/beta from P90/P10 and bounds | Yes |
| TECH-006 | Correlations | Independent for MVP v1 | No |
| TECH-007 | Risked percentiles | Not displayed by default | No |
| TECH-008 | Workbook equivalence tolerance | ±5% after calibration | No |

## Approval Checklist

Before implementation, confirm:

- Canonical units are approved.
- Unit conversion constants are approved.
- P90/P10 convention is approved.
- Percentile extraction method is approved.
- Trimmed mean rule is approved.
- Oil, gas, solution gas, condensate, and MMBOE formulas are approved.
- Distribution parameterization methods are approved.
- Beta fitting method is approved.
- Independent-correlation MVP default is approved.
- Pg and weak-link chance logic are approved.
- Validation Case 1 is accepted as the workbook calibration case.
- Deterministic Validation Cases 2 and 3 are accepted as unit-test cases.

## Recommended Next Step

After review of this technical calculation specification, the project is ready to move into implementation planning. The first implementation milestone should be the calculation engine and deterministic unit tests before any UI work, so formulas and validation behavior are proven independently from the web interface.
