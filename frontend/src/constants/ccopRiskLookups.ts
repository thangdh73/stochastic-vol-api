/**
 * CCOP probability principal descriptors per risk factor.
 * Each band: P range, condition (data quality), and technical criteria.
 */

export type CcopRiskFactorKey =
  | 'source'
  | 'migration'
  | 'trap_structure'
  | 'seal_top'
  | 'seal_lateral'
  | 'reservoir_presence'
  | 'reservoir_effectiveness'
  | 'retention'

export interface CcopRiskLookupRow {
  id: string
  p: number
  pRange: string
  condition: string
  criteria: string
}

export interface CcopRiskFactorLookup {
  factorKey: CcopRiskFactorKey
  title: string
  question: string
  rows: CcopRiskLookupRow[]
}

function band(
  id: string,
  p: number,
  pRange: string,
  condition: string,
  criteria: string,
): CcopRiskLookupRow {
  return { id, p, pRange, condition, criteria }
}

const CONDITION = {
  certain:
    'Condition is virtually to absolutely certain whilst data quality/control is excellent.',
  mostProbable:
    'Condition is most probable and data quality/control is good. Most likely interpretation.',
  probable:
    'Condition is probable or data quality/control is fair. Less favourable interpretations possible.',
  possible:
    'Condition is possible or data quality/control is poor. Less favourable interpretations more likely.',
  impossible:
    'Condition is virtually to absolutely impossible whilst data quality/control is excellent.',
}

export const CCOP_RISK_LOOKUPS: Record<CcopRiskFactorKey, CcopRiskFactorLookup> = {
  source: {
    factorKey: 'source',
    title: 'Source rock',
    question:
      'Probability of presence of adequate mature source rock within the fetch area.',
    rows: [
      band(
        'src_certain',
        1.0,
        '0.95 – 1.00',
        CONDITION.certain,
        'Wells in the immediate vicinity have tested hydrocarbons, and mature source rock is verified in the immediate vicinity based on unambiguous data (tested accumulations, surface seeps, outcrops).',
      ),
      band(
        'src_high',
        0.9,
        '0.65 – 0.95',
        CONDITION.mostProbable,
        'Wells in the trend have tested hydrocarbons, or well (or outcrop) samples indicate presence of mature source rock and geochemical modelling predicts mature source rock, based on convincing well / seismic / outcrop control.',
      ),
      band(
        'src_mid',
        0.6,
        '0.40 – 0.65',
        CONDITION.probable,
        'Wells in the trend have hydrocarbon shows, and/or well or outcrop samples suggest source-quality rock of uncertain to low maturity, based on limited data for geochemical modelling.',
      ),
      band(
        'src_low',
        0.3,
        '0.05 – 0.35',
        CONDITION.possible,
        'Hydrocarbon shows reported for the trend (scout, literature), or the geologic model hints at presence of source rock in the trend, or maturity of potential source rock, based on unconvincing seismic and/or well data.',
      ),
      band(
        'src_fail',
        0.05,
        '0.00 – 0.05',
        CONDITION.impossible,
        'No hydrocarbon shows known in the trend, and no source rock found in well or outcrop; unambiguous data establishes source rock to be immature or overmature.',
      ),
    ],
  },

  migration: {
    factorKey: 'migration',
    title: 'Migration & timing',
    question: 'Probability of timely migration route available to the trap.',
    rows: [
      band(
        'mig_certain',
        1.0,
        '0.95 – 1.00',
        CONDITION.certain,
        'Unambiguous seismic and well data (incl. geochem.) verify the trap existed prior to the earliest time of source rock maturation and migration.',
      ),
      band(
        'mig_high',
        0.9,
        '0.65 – 0.95',
        CONDITION.mostProbable,
        'Convincing seismic and well data (incl. geochem.) indicate the trap existed prior to the earliest time of source rock maturation and migration.',
      ),
      band(
        'mig_mid',
        0.6,
        '0.40 – 0.65',
        CONDITION.probable,
        'Limited seismic and well data (incl. geochem.) suggest the trap could have existed prior to the earliest time of source rock maturation and migration.',
      ),
      band(
        'mig_low',
        0.3,
        '0.05 – 0.35',
        CONDITION.possible,
        'Unconvincing seismic and/or well data (incl. geochem.) hint the trap could have existed prior to earliest migration — timing is uncertain.',
      ),
      band(
        'mig_fail',
        0.05,
        '0.00 – 0.05',
        CONDITION.impossible,
        'Unambiguous seismic and well data establish the trap formed after hydrocarbon generation, migration, or charge.',
      ),
    ],
  },

  trap_structure: {
    factorKey: 'trap_structure',
    title: 'Trap — structure / closure',
    question:
      'Probability of closure (structure, fault geometry, pinchout) with minimum mapped volume.',
    rows: [
      band(
        'trap_certain',
        1.0,
        '0.95 – 1.00',
        CONDITION.certain,
        'Identical trap in the immediate vicinity successfully tested and defined by unambiguous data (seismic, well control, outcrop, engineering).',
      ),
      band(
        'trap_high',
        0.9,
        '0.65 – 0.95',
        CONDITION.mostProbable,
        'Analogous trap within the trend successfully tested or defined by convincing data (well control, seismic, outcrop, engineering).',
      ),
      band(
        'trap_mid',
        0.6,
        '0.40 – 0.65',
        CONDITION.probable,
        'Similar trap in another trend successfully tested and/or limited data suggest probable closure (structure may depend on velocity uncertainty or extent of a single bounding fault).',
      ),
      band(
        'trap_low',
        0.3,
        '0.05 – 0.35',
        CONDITION.possible,
        'Trap poorly defined (ambiguous stratigraphic trap, downfaulted trap, or multi-fault complexity); based on unproved concepts only; unconvincing data hint at closure.',
      ),
      band(
        'trap_fail',
        0.05,
        '0.00 – 0.05',
        CONDITION.impossible,
        'Identical trap proven unsuccessful in the trend; unambiguous data clearly establish absence of closure.',
      ),
    ],
  },

  seal_top: {
    factorKey: 'seal_top',
    title: 'Top (vertical) seal',
    question:
      'Probability of a continuous interval with adequate top-seal capacity to retain at least a P10 hydrocarbon column over the P10 accumulation area.',
    rows: [
      band(
        'top_certain',
        1.0,
        '0.95 – 1.00',
        CONDITION.certain,
        'Presence of a suitably thick, regionally extensive and effective sealing rock unit verified by unambiguous well and seismic data.',
      ),
      band(
        'top_high',
        0.9,
        '0.65 – 0.95',
        CONDITION.mostProbable,
        'Same sealing rock unit successfully tested in the trend; sealing rock indicated as effective where identified by convincing well and seismic data.',
      ),
      band(
        'top_mid',
        0.6,
        '0.40 – 0.65',
        CONDITION.probable,
        'Similar sealing mechanism successfully tested in other trends, and/or suggested by facies mapping or geophysical modelling based on limited well and/or seismic data.',
      ),
      band(
        'top_low',
        0.3,
        '0.05 – 0.35',
        CONDITION.possible,
        'Sealing mechanism poorly defined, based on geological concepts only or demonstrated in an analogous setting; unconvincing data hint at possible seal.',
      ),
      band(
        'top_fail',
        0.05,
        '0.00 – 0.05',
        CONDITION.impossible,
        'Identical sealing mechanism proven unsuccessful in the trend as established by unambiguous well control.',
      ),
    ],
  },

  seal_lateral: {
    factorKey: 'seal_lateral',
    title: 'Lateral (fault) seal',
    question:
      'Probability of lateral seal with adequate capacity to retain at least a P10 column (use only when faults form part of the trap).',
    rows: [
      band(
        'lat_certain',
        1.0,
        '0.95 – 1.00',
        CONDITION.certain,
        'Lateral (fault) seal consistently effective in identical situations in a field or discovery in the immediate vicinity, verified by unambiguous well and/or seismic control and supported by fault-seal analysis.',
      ),
      band(
        'lat_high',
        0.9,
        '0.65 – 0.95',
        CONDITION.mostProbable,
        'Effective lateral (fault) seal mechanisms commonly encountered by wells in similar facies and depth within the trend, indicated by convincing seismic / well / outcrop control.',
      ),
      band(
        'lat_mid',
        0.6,
        '0.40 – 0.65',
        CONDITION.probable,
        'Effective lateral (fault) seal mechanisms known to operate at similar depth and facies as suggested by fault-seal analysis (juxtaposition, SGR) based on limited well and/or seismic data.',
      ),
      band(
        'lat_low',
        0.3,
        '0.05 – 0.35',
        CONDITION.possible,
        'Lateral (fault) sealing mechanism poorly defined, based on concepts only or demonstrated in an analogous setting; unconvincing data hint at possible lateral seal.',
      ),
      band(
        'lat_fail',
        0.05,
        '0.00 – 0.05',
        CONDITION.impossible,
        'Identical lateral sealing mechanism proven unsuccessful in the trend as established by unambiguous well control.',
      ),
    ],
  },

  reservoir_presence: {
    factorKey: 'reservoir_presence',
    title: 'Reservoir presence',
    question:
      'Probability of at least P10 net reservoir thickness in the mapped accumulation area.',
    rows: [
      band(
        'rp_certain',
        1.0,
        '0.95 – 1.00',
        CONDITION.certain,
        'Identical reservoir thickness found in a field or discovery in the immediate vicinity, verified by unambiguous well and/or seismic data.',
      ),
      band(
        'rp_high',
        0.9,
        '0.65 – 0.95',
        CONDITION.mostProbable,
        'Reservoir rock successfully encountered by wells in similar facies within the trend; lateral continuity probable as indicated by convincing well and seismic control.',
      ),
      band(
        'rp_mid',
        0.6,
        '0.40 – 0.65',
        CONDITION.probable,
        'Reservoir rock known to exist within the trend, and/or suggested by facies mapping or geophysical modelling based on limited well and/or seismic data.',
      ),
      band(
        'rp_low',
        0.3,
        '0.05 – 0.35',
        CONDITION.possible,
        'Reservoir rock may exist in the trend based on geologic model and facies mapping; continuity within the trend is questionable; unconvincing data only hint at presence.',
      ),
      band(
        'rp_fail',
        0.05,
        '0.00 – 0.05',
        CONDITION.impossible,
        'No reservoir rock known in the trend and facies model predicts absence of reservoir; unambiguous well control establishes absence.',
      ),
    ],
  },

  reservoir_effectiveness: {
    factorKey: 'reservoir_effectiveness',
    title: 'Reservoir effectiveness',
    question:
      'Probability of reservoir with sufficient quality (porosity, permeability, hydrocarbon saturation) for the assessed volume.',
    rows: [
      band(
        're_certain',
        1.0,
        '0.95 – 1.00',
        CONDITION.certain,
        'Identical reservoir parameters/conditions (facies, depth) mapped to a field or discovery in the immediate vicinity, verified by unambiguous well data.',
      ),
      band(
        're_high',
        0.9,
        '0.65 – 0.95',
        CONDITION.mostProbable,
        'Adequate reservoir parameters successfully tested by wells in similar facies and depth within the trend, based on convincing well and seismic control.',
      ),
      band(
        're_mid',
        0.6,
        '0.40 – 0.65',
        CONDITION.probable,
        'Adequate reservoir parameters known within the trend, and/or suggested by facies mapping or geophysical modelling based on limited well and/or seismic data.',
      ),
      band(
        're_low',
        0.3,
        '0.05 – 0.35',
        CONDITION.possible,
        'Adequate reservoir may exist based on geologic model and facies mapping; continuity within the trend is questionable; unconvincing data only hint at adequacy.',
      ),
      band(
        're_fail',
        0.05,
        '0.00 – 0.05',
        CONDITION.impossible,
        'No adequate reservoir known in the trend; facies model predicts absence of adequate reservoir rock; unambiguous well control establishes absence.',
      ),
    ],
  },

  retention: {
    factorKey: 'retention',
    title: 'Retention',
    question:
      'Probability of hydrocarbon retention after accumulation (preservation, breaching, biodegradation, etc.).',
    rows: [
      band(
        'ret_certain',
        1.0,
        '0.95 – 1.00',
        CONDITION.certain,
        'Identical setting in immediate vicinity shows long-term hydrocarbon preservation; no evidence of breach or degradation; excellent data control.',
      ),
      band(
        'ret_high',
        0.9,
        '0.65 – 0.95',
        CONDITION.mostProbable,
        'Analogous accumulations in the trend show sustained retention; convincing evidence trap has not been breached post-charge.',
      ),
      band(
        'ret_mid',
        0.6,
        '0.40 – 0.65',
        CONDITION.probable,
        'Retention probable based on limited analogue data or fair regional understanding of post-charge history.',
      ),
      band(
        'ret_low',
        0.3,
        '0.05 – 0.35',
        CONDITION.possible,
        'Retention uncertain; possible late breach, leakage, or degradation suggested by concepts or weak data.',
      ),
      band(
        'ret_fail',
        0.05,
        '0.00 – 0.05',
        CONDITION.impossible,
        'Unambiguous evidence of post-accumulation loss, breach, or failure to retain commercial hydrocarbons.',
      ),
    ],
  },
}

/** Match stored P to nearest lookup band (exact match preferred). */
export function lookupRowForP(
  factor: CcopRiskFactorKey,
  p: number,
): CcopRiskLookupRow | undefined {
  const rows = CCOP_RISK_LOOKUPS[factor].rows
  const exact = rows.find((r) => Math.abs(r.p - p) < 1e-6)
  if (exact) return exact
  let best = rows[0]
  let bestDist = Math.abs(rows[0].p - p)
  for (const row of rows) {
    const d = Math.abs(row.p - p)
    if (d < bestDist) {
      best = row
      bestDist = d
    }
  }
  return bestDist <= 0.15 ? best : undefined
}

export function lookupRowById(
  factor: CcopRiskFactorKey,
  rowId: string,
): CcopRiskLookupRow | undefined {
  return CCOP_RISK_LOOKUPS[factor].rows.find((r) => r.id === rowId)
}
