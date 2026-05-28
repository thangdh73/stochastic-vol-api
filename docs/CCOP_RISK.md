# CCOP prospect risk model (MMRA)

Aligned with **CCOP Guidelines for Risk Assessment of Petroleum Prospects** (July 2000).

## Overall formula

\[
P_g = P_{\text{reservoir}} \times P_{\text{trap}} \times P_{\text{charge}} \times P_{\text{retention}}
\]

## Sub-factors

| Factor | CCOP | Formula |
|--------|------|---------|
| Reservoir | P1 | P1a (facies) × P1b (effectiveness) |
| Trap | P2 | P2a (structure) × P2b (seal) |
| Seal weak-link | | min(top seal, lateral fault seal) when both used |
| Charge | P3 | P_source × P_migration |
| Multiple sources | OR rule | P = 1 − (1−P_A)(1−P_B)… |
| Retention | P4 | Single probability |

## Descriptor lookup (Fig. 3.7)

| P | Range | Label |
|---|-------|-------|
| 1.0 | 0.95–1.00 | Virtually to absolutely certain |
| 0.8 | 0.65–0.95 | Most probable |
| 0.6 | 0.40–0.65 | Probable |
| 0.3 | 0.05–0.35 | Possible |
| 0.1 | 0.00–0.05 | Unlikely |
| 0.0 | 0.00 | Impossible |

## Excel template

- **Build:** `python docs/templates/build_ccop_risk_template.py`
- **Output:** `docs/templates/risk_template_CCOP.xls`
- **Deployed copy:** `PROSPECT RISKING/risk_template_CCOP.xls` (on shared project drive)

Sheets: Start Here, CCOP Lookup, Source A/B (OR), Migration, Trap, Reservoir, Retention, Risk Summary.

## MMRA usage

1. **Chance** tab → Risk model = **CCOP (2000)**
2. Pick descriptors or enter P (0–1) per sub-factor
3. Run **Chance simulation** or full **Monte Carlo** (`risk_model: ccop_v1`, `ccop_risk` in JSON)

Legacy five-category model remains available (`risk_model: legacy`).

## Engine module

`engine/mmra_engine/ccop_chance.py` — `calculate_ccop_pg()`, `combine_probabilities()`, `CCOP_DESCRIPTOR_LOOKUP`.
