# Tank uncertainty groups & group correlations

**Status:** Design target (brainstorm). Replaces coarse `shared_ntg` / `shared_hc_yield` / `shared_correlation` flags over time.

**Audience:** Geologists setting up multi-segment prospects; engineers implementing MC, OAT tornado, and Spearman tornado.

---

## 1. Problem the UI solves

In a prospect with **Segment × Reservoir** tanks (e.g. R1-S1, R1-S2, R1-S3, R2-S1, …):

- **GRV** may need a **prospect-wide** or **multi-reservoir** uncertainty group (one tornado bar).
- **Porosity** may be **similar in S1+S2** but **different in S3** (diagenesis) → **two porosity groups** on the same reservoir.
- **Sw** follows the **same segment split** as porosity, and **Sw ↔ Porosity** correlation is **within** each compartment (ρ = −0.8 for S1+S2, ρ = +0.7 for S3), **not** across compartments (ρ = 0).

Boolean “link NTG across segment” cannot express:

- `Poro_R1_S1,2` vs `Poro_R1_S3`
- `GRV_all_Seg` across R1, R2, R3
- A **group correlation matrix** between named groups

---

## 2. Reference example (from workshop)

### 2.1 Parameter groups

| Group name      | Parameter | Segments      | Reservoirs              | Geology intent                          |
|-----------------|-----------|---------------|-------------------------|-----------------------------------------|
| `GRV_all_Seg`   | GRV       | All           | R1, R2, R3              | One GRV uncertainty driver at prospect scale |
| `Poro_R1_S1,2`  | PORO      | S1, S2        | R1                      | Shared sand / similar facies            |
| `Poro_R1_S3`    | PORO      | S3            | R1                      | Diagenesis — different porosity system  |
| `Sw_R1_S1,2`    | Sw        | S1, S2        | R1                      | Paired with `Poro_R1_S1,2`              |
| `Sw_R1_S3`      | Sw        | S3            | R1                      | Paired with `Poro_R1_S3`                |

Rules illustrated:

- **Same parameter, multiple groups** on one reservoir (two porosity groups).
- **Same segment pattern** for Sw as for Poro (compartment split).
- **GRV** can span **more tanks** than a single reservoir×segment pair.

### 2.2 Group correlation matrix

Correlations are between **groups**, not global “Porosity ↔ Saturation” on one tank.

|                    | GRV_all_Seg | Poro_R1_S1,2 | Poro_R1_S3 | Sw_R1_S1,2 | Sw_R1_S3 |
|--------------------|-------------|--------------|------------|------------|----------|
| GRV_all_Seg        | 1           | 0            | 0          | 0          | 0      |
| Poro_R1_S1,2       | 0           | 1            | 0          | **−0.8**   | 0      |
| Poro_R1_S3         | 0           | 0            | 1          | 0          | **0.7**|
| Sw_R1_S1,2         | 0           | −0.8         | 0          | 1          | 0      |
| Sw_R1_S3           | 0           | 0            | 0.7        | 0          | 1      |

Interpretation:

- **Within compartment S1+S2:** strong φ–Sw coupling.
- **Within compartment S3:** different φ–Sw coupling.
- **Across compartments:** φ and Sw groups do not correlate (0 in off-diagonal blocks).
- **GRV** independent of φ/Sw groups in this example (0) — GRV still has its **own** distribution per tank unless you also define a shared GRV distribution policy.

---

## 3. Proposed data model

### 3.1 `UncertaintyParameterGroup`

```typescript
type UncertaintyParameterId =
  | 'grv' | 'grv_percent_fill' | 'net_to_gross'
  | 'area' | 'percent_fill' | 'net_pay' | 'geometric_correction'
  | 'porosity' | 'saturation'
  | 'oil_recovery' | 'fvf' | 'gor' | 'solution_gas_recovery'
  | 'gas_recovery' | 'gef' | 'condensate_yield'
  | 'nrv_direct'

interface UncertaintyParameterGroup {
  id: string
  name: string                    // e.g. "Poro_R1_S1,2"
  parameter: UncertaintyParameterId
  members: Array<{
    segment_id: string
    reservoir_id: string
  }>
  /** Optional: one shared DistributionSpec for all members; else per-tank P90/P10 with linked sampling */
  shared_distribution?: DistributionSpec | null
  notes?: string
}
```

**Membership rules:**

- A tank `(segment, reservoir)` may appear in **at most one group** per `parameter` id.
- Different parameters → independent group lists (`Poro_*` vs `Sw_*` vs `GRV_*`).

### 3.2 `GroupCorrelationMatrix`

```typescript
interface GroupCorrelationMatrix {
  group_ids: string[]           // order defines matrix rows/cols
  values: number[][]            // symmetric, diagonal 1
}
```

Replaces tank-level `correlations[]` + `correlation_mode` for **group-aware** MC (or supplements them during migration).

### 3.3 Prospect envelope

Store at prospect level (with segments, reservoirs, `tank_inputs`):

```typescript
interface TankProjectEnvelope {
  // ... existing fields ...
  uncertainty_groups: UncertaintyParameterGroup[]
  group_correlation_matrix: GroupCorrelationMatrix | null
  correlation_mode: 'independent' | 'rank' | 'gaussian_copula'
}
```

Per-tank `SimulationInput` keeps **values** (distributions, means). Groups define **dependence** and **tornado driver identity**.

---

## 4. Behaviour by workflow step

### 4.1 Data entry (UI)

| Screen | Behaviour |
|--------|-----------|
| **Group manager** (new) | Table like your screenshot: Group name, Parameter, Segments, Reservoirs, Edit/Delete |
| **Tank tabs** (NRV, HC Yield) | Edit P90/P10 per tank; warn if tank not in any group for that parameter |
| **Group correlations** (new) | Matrix on **group names**; only enabled pairs with \|ρ\| > 0 |
| **Legacy checkboxes** | Deprecated → “Quick fill” creates default groups (`Res1·NTG↔Seg` → one NTG group) |

### 4.2 Monte Carlo (future)

For each iteration:

1. Draw independent normals / rank streams per **group** (dimension = number of groups with stochastic params).
2. Apply **group correlation matrix** (Cholesky / Iman–Conover on group scores).
3. Map group sample → each **member tank**’s parameter for that iteration (same rank / same factor for all members in group).
4. Per-tank **GRV, NTG, φ, …** can still use **different** P90/P10 if distributions differ; linkage is on the **sample path**, not necessarily identical values.

### 4.3 OAT tornado (workbook)

| Driver in tornado | Meaning |
|-------------------|---------|
| `GRV_all_Seg` | Swing GRV P90/P10 on **every member tank** of that group; others at P50 |
| `Poro_R1_S1,2` | Swing φ on R1-S1 and R1-S2 only; R1-S3 at P50 |
| `Poro_R1_S3` | Swing φ on R1-S3 only |
| `Sw_R1_S1,2` | Swing Sw on S1+S2 only |

**Target output:** Δ on **prospect rollup** (e.g. total MMBOE), not only active tank.

**Correlations:** OAT remains **uncorrelated sampling** (workbook standard); group matrix applies to **MC** and optionally a future “correlated OAT” mode.

### 4.4 Spearman tornado (MC)

- One Spearman ρ per **group** vs prospect total (or per group representative series identical across linked tanks).
- Bars sorted by \|ρ\|; label includes group name.

---

## 5. Mapping from current link flags (migration)

| Current flag | Default group created |
|--------------|------------------------|
| `reservoir.shared_ntg` | `NTG_{ResName}_allSeg` — all segments, that reservoir |
| `reservoir.shared_hc_yield` | Split by parameter: `Poro_{Res}_allSeg`, `Sw_{Res}_allSeg`, … (or one “HC bundle” group — prefer **per parameter**) |
| `segment.shared_*` | `NTG_{SegName}_allRes` etc. |
| No link | `Poro_R1-S3` single-member group |

**Recommendation:** migrate to explicit groups; keep flags only as shortcuts that **regenerate** group rows.

---

## 6. Parameter catalogue (extend over time)

Start with your set; same pattern for others:

| Parameter | Typical grouping |
|-----------|------------------|
| GRV | Prospect-wide, per reservoir all-seg, or per tank |
| NTG | Per reservoir all-seg (current NTG↔Seg) |
| Porosity, Sw | Per compartment (S1+2 vs S3) |
| Porosity ↔ Sw | Group matrix only within compartment |
| Recovery, FVF, GOR | Per reservoir or per play fairway |
| Area, Net pay | Usually per tank (structure) |

---

## 7. Open decisions

1. **Shared distribution vs linked sampling only** — Must S1 and S2 have identical P90/P10 for φ, or only correlated draws?
2. **GRV_all_Seg** — Same GRV distribution across R1–R3, or same correlation factor with tank-specific means?
3. **Prospect rollup** for tornado — Sum unrisked MMBOE vs Pg-risked?
4. **Overlap** — Can one tank’s GRV be in `GRV_all_Seg` and also have tank-only NTG group? (Yes, different parameters.)
5. **UI home** — New “Uncertainty groups” page vs expand Prospect Setup?

---

## 8. Implementation phases

| Phase | Deliverable |
|-------|-------------|
| **A** | Types + envelope persistence + Group manager UI (no engine change) |
| **B** | Group correlation matrix UI; validate membership |
| **C** | OAT tornado: drivers = groups → rollup prospect total |
| **D** | MC: sample by group matrix; multi-tank simulation |
| **E** | Spearman on groups; deprecate boolean `shared_*` |

---

## 9. Success criteria (your example)

- [ ] Five groups and matrix from §2 can be entered and saved.
- [ ] OAT shows separate bars for `Poro_R1_S1,2` and `Poro_R1_S3`; swinging one does not move the other.
- [ ] `Poro_R1_S1,2` and `Sw_R1_S1,2` move together only in MC when matrix says −0.8; S3 pair independent.
- [ ] `GRV_all_Seg` appears as one tornado driver affecting all listed reservoirs/segments.

---

*Related: `docs/PLAN_perturbation_tornado.md` (OAT v1 single-tank), conversation on tank envelope and NTG/HC/Corr link flags.*
