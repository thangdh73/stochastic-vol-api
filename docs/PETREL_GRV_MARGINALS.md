# Petrel GRV marginals (3 + 3)

When Petrel exports **three structural GRV** values (depth / TZ / picking at **fixed mid fluid contact**) and **three fluid-contact GRV** values (at **fixed mid structure**), MMRA uses **Petrel GRV (3+3)** mode.

## Workflow

1. **Setup** — GRV list labels: Depth, Pinchout, Fluid contact (workshop names).
2. **Input → Rock volume** — choose **Petrel GRV (3+3)**.
3. Enter six GRV numbers in **acre-ft** (or project GRV unit) and optional case weights.
4. The app builds a **3×3 matrix** (multiplicative combination from P50 anchor) and samples one cell per Monte Carlo iteration.
5. **NTG** (and HC yield) still edited in MMRA; trap fill is **1.0** (volume is in Petrel GRV).
6. **Tornado** — separate bars: **Depth / structure (Petrel)** and **Fluid contact (Petrel)**.

## Combination formula

When all nine cells are not pasted explicitly:

`GRV[d,c] = depth_grv[d] × contact_grv[c] / contact_grv[P50]`

Structural cases are run at mid contact; contact cases at mid structure. P50 structural and P50 contact should match (QC warns if >5% apart).

## Future

- Excel/CSV import template from Petrel export
- Optional full 9-cell override when Petrel provides the full matrix
- Prospect-wide shared matrix via uncertainty groups
