# MMRA Engine

Standalone Python calculation engine for the MMRA Web MVP (Probabilistic Resource & Risk Evaluator).

No UI. No web code. Pure Python.

---

## Module overview

| Module | Purpose |
|---|---|
| `constants.py` | Unit conversion constants and physical defaults |
| `units.py` | `convert_units()` helper and percent/fraction utilities |
| `distributions.py` | Distribution dataclasses, sampling, Beta fitting |
| `stats.py` | Percentile summary (P99/P90/P50/mean/P10/P01) and trimmed mean |
| `volumetrics.py` | Deterministic volumetric formula functions |
| `chance.py` | Weak-link category chance and Pg calculation |
| `simulation.py` | Monte Carlo simulation orchestration |
| `validation_cases.py` | Workbook-derived validation scaffolds |
| `validation.py` | QA/QC validation module: pre-flight checks for distributions, simulation inputs, and chance categories |

---

## Requirements

- Python 3.9+
- numpy
- scipy

No installation step required beyond having numpy and scipy available.

---

## Running the tests

Tests use the Python standard-library `unittest` module. **pytest is not required.**

```bash
# From the workspace root:
python -m unittest discover -s tests

# Or run the test file directly:
python tests/test_mmra_engine.py

# Verbose output:
python -m unittest discover -s tests -v
```

---

## Quick usage example

```python
import sys
sys.path.insert(0, "/home/user/workspace")  # adjust if needed

from mmra_engine.validation_cases import make_oil_formula_case, make_pm3xd_h1ss10_input
from mmra_engine.simulation import run_simulation

# --- Deterministic formula validation (Case 2) ---
inp = make_oil_formula_case(seed=42)
result = run_simulation(inp)

print(f"STOIIP P50:          {result.stoiip.p50:.6f} MMbbl")
print(f"Recoverable oil P50: {result.recoverable_oil.p50:.6f} MMbbl")
print(f"Solution gas P50:    {result.solution_gas.p50:.6f} Bcf")
print(f"Total MMBOE P50:     {result.total_mmboe.p50:.6f} MMBOE")

# --- PM3X-D H1ss10 probabilistic case (Case 1) ---
inp2 = make_pm3xd_h1ss10_input(seed=42, n_iterations=5000)
r2 = run_simulation(inp2)

print(f"\nPM3X-D Pg: {r2.pg_result.pg:.5f}")
print(f"Recoverable oil P50: {r2.recoverable_oil.p50:.2f} MMbbl")
print(f"Total MMBOE mean:    {r2.total_mmboe.mean_trimmed:.2f} MMBOE")
```

---

## Percentile convention (P10-large)

| Display label | NumPy quantile q | Meaning |
|---|---:|---|
| P99 | 0.01 | Very conservative / small resource |
| P90 | 0.10 | Conservative / small resource |
| P50 | 0.50 | Median |
| Mean | trimmed P99→P01 | Workbook-aligned displayed mean |
| P10 | 0.90 | Upside / large resource |
| P01 | 0.99 | Very upside / large resource |

---

## Canonical units (internal)

| Quantity | Canonical unit |
|---|---|
| Area | acres |
| Thickness | feet |
| NRV | acre-ft |
| Porosity / saturation / recovery | fraction (0–1) |
| FVF | rb/stb |
| GOR | scf/stb |
| GEF | scf/reservoir ft³ |
| Oil volume | MMbbl |
| Gas volume | Bcf |
| BOE | MMBOE |

---

## Validation targets

### Case 2: Deterministic oil formula

| Output | Expected |
|---|---|
| STOIIP | 7.75836735 MMbbl |
| Recoverable oil | 2.7154285725 MMbbl |
| Solution gas | 1.6292571435 Bcf |
| Total MMBOE | 2.98697142975 MMBOE |

### Case 3: Deterministic gas formula

| Output | Expected |
|---|---|
| GIIP | 12.1968 Bcf |
| Recoverable gas | 9.75744 Bcf |
| Total MMBOE | 1.62624 MMBOE |

### Case 1: PM3X-D H1ss10 chance targets

| Category | Value |
|---|---|
| Source | 0.90 |
| Timing/migration | 0.65 |
| Reservoir | 0.60 |
| Closure | 0.60 |
| Containment | 0.60 |
| **Pg** | **0.12636** |

---


---

## QA/QC Validation

The `validation.py` module provides structured pre-flight checks that run
**before** simulation, without modifying any inputs.

### Quick usage

```python
from mmra_engine.validation import validate_simulation_input
from mmra_engine.validation_cases import make_pm3xd_h1ss10_input

inp = make_pm3xd_h1ss10_input()
report = validate_simulation_input(inp)

if report.has_errors:
    for issue in report.errors:
        print(f"[ERROR {issue.code}] {issue.field}: {issue.message}")
else:
    # Safe to run
    from mmra_engine.simulation import run_simulation
    result = run_simulation(inp)
```

### Key classes

| Class / Function | Purpose |
|---|---|
| `ValidationSeverity` | Enum: `ERROR`, `WARNING`, `INFO` |
| `ValidationIssue` | Single finding: code, severity, module, field, message |
| `ValidationReport` | Collection of issues with helpers |
| `validate_distribution_def()` | Validate a single `DistributionDef` |
| `validate_simulation_input()` | Validate a full `SimulationInput` |
| `validate_chance_categories()` | Validate chance category sub-factors |

### Blocking errors (ERROR)

| Check | Code |
|---|---|
| Fixed value missing | `FIXED_VALUE_MISSING` |
| Fixed value outside clips | `FIXED_BELOW_LOW_CLIP`, `FIXED_ABOVE_HIGH_CLIP` |
| P10 < P90 (positive resource) | `P10_LT_P90` |
| P50 outside [P90, P10] | `P50_OUTSIDE_RANGE` |
| low_clip > high_clip | `CLIP_ORDER_INVALID` |
| Beta P90 outside bounds | `P90_OUTSIDE_BETA_BOUNDS` |
| Beta P10 outside bounds | `P10_OUTSIDE_BETA_BOUNDS` |
| Beta bounds inverted | `BETA_BOUNDS_INVALID` |
| Saturation > 100% | `ABOVE_PHYSICAL_MAX` |
| Any required distribution missing | `REQUIRED_DISTRIBUTION_MISSING` |
| n_iterations < 1,000 | `ITERATION_COUNT_TOO_LOW` |
| n_iterations > 100,000 | `ITERATION_COUNT_TOO_HIGH` |
| Chance sub-factor outside [0, 1] | `CHANCE_OUT_OF_RANGE` |

### Warnings (WARNING)

| Check | Code |
|---|---|
| Porosity outside recommended 1–40% | `BELOW_RECOMMENDED_MIN`, `ABOVE_RECOMMENDED_MAX` |
| Saturation outside recommended 15–95% | `BELOW_RECOMMENDED_MIN`, `ABOVE_RECOMMENDED_MAX` |
| Oil FVF outside recommended 1–4 rb/stb | `BELOW_RECOMMENDED_MIN`, `ABOVE_RECOMMENDED_MAX` |
| GEF outside recommended 25–750 scf/res ft³ | `BELOW_RECOMMENDED_MIN`, `ABOVE_RECOMMENDED_MAX` |
| P10/P90 ratio > 10 | `WIDE_UNCERTAINTY_RANGE` |
| Lognormal P50 inconsistent with P90/P10 fit | `P50_INCONSISTENT_LOGNORMAL` |
| Notes field empty | `NOTES_MISSING` |
| Chance categories incomplete | `CHANCE_CATEGORY_INCOMPLETE` |

## Known deviations from workbook

1. **Random number generator**: Engine uses `numpy.random.default_rng(seed)` (PCG64). The workbook uses Excel/VBA's internal RNG, which is not reproducible across platforms. Stochastic outputs will differ by seed and distribution parameterization even with matched inputs.
2. **Beta fitting**: Engine uses `scipy.optimize.root` to solve for alpha/beta from P90/P10 and bounds. Workbook VBA beta internals are not reverse-engineered; minor differences in shape parameters are expected.
3. **Trimmed mean**: Engine trims between q0.01 and q0.99 inclusive. Workbook `Apply_TruncMean = TRUE` with `Input_Trunc_Lo = 0` and `Output_Trunc_Hi = 1` uses a slightly different mechanism (not fully reverse-engineered).
4. **Triangular fallback**: If only P90/P10 are provided for triangular, min defaults to P90 and max to P10. Exact workbook triangular fitting is not replicated.
5. **Correlations**: All variables are sampled independently (MVP default). Workbook allows correlation matrix; this is a P1 feature.
