import { useMemo, useState } from 'react'

import {

  Bar,

  BarChart,

  CartesianGrid,

  ReferenceLine,

  ResponsiveContainer,

  Tooltip,

  XAxis,

  YAxis,

} from 'recharts'

import type { PetrelCumulativeTornadoResponse } from '../../types/api'



interface PetrelCumulativeTornadoChartProps {

  tornado: PetrelCumulativeTornadoResponse

}



function formatList(items: string[] | undefined): string {

  if (!items?.length) return '—'

  return items.join(', ')

}



export function PetrelCumulativeTornadoChart({ tornado }: PetrelCumulativeTornadoChartProps) {

  const categories = tornado.tornado.categories ?? {}

  const categoryKeys = Object.keys(categories).sort()

  const [category, setCategory] = useState(

    categoryKeys.includes('2P') ? '2P' : categoryKeys[0] ?? '2P',

  )



  const active = categories[category]

  const chartRows = useMemo(() => {

    if (!active) return []

    return active.drivers

      .filter((d) => !d.is_fixed)

      .map((d) => ({

        label: d.label,

        deltaLow: d.delta_low,

        deltaHigh: d.delta_high,

      }))

  }, [active])



  const maxSwing = useMemo(

    () => Math.max(1, ...chartRows.flatMap((r) => [Math.abs(r.deltaLow), Math.abs(r.deltaHigh)])),

    [chartRows],

  )



  const modeLabel =

    active?.tornado_mode === 'segment' ? 'segment-level' : 'group-level'



  if (!categoryKeys.length) {

    return <p className="convention-inline">No tornado categories returned.</p>

  }



  if (!active) {

    return null

  }



  return (

    <div className="chart-section tornado-section">

      <label className="chart-select-row">

        Target category

        <select value={category} onChange={(e) => setCategory(e.target.value)}>

          {categoryKeys.map((c) => (

            <option key={c} value={c}>

              {c} — {categories[c]?.target_label ?? 'GIIP'}

            </option>

          ))}

        </select>

      </label>

      <p className="chart-caption">

        Deterministic OAT tornado on field {active.target_label} ({active.target_unit}). Base:{' '}

        {active.base_giip.toFixed(2)} {active.target_unit}. {active.method_note}

      </p>



      {chartRows.length === 0 ? (

        <p className="convention-inline">No varying drivers for this category.</p>

      ) : (

        <div className="chart-card tornado-chart-card">

          <h3>Driver impact (Δ GIIP)</h3>

          <ResponsiveContainer width="100%" height={Math.max(220, chartRows.length * 44)}>

            <BarChart

              data={chartRows}

              layout="vertical"

              stackOffset="sign"

              margin={{ top: 12, right: 24, left: 8, bottom: 12 }}

            >

              <CartesianGrid strokeDasharray="3 3" horizontal={false} />

              <XAxis

                type="number"

                domain={[-maxSwing * 1.1, maxSwing * 1.1]}

                tickFormatter={(v) => Number(v).toFixed(2)}

              />

              <YAxis type="category" dataKey="label" width={200} tick={{ fontSize: 11 }} />

              <Tooltip

                formatter={(v) =>

                  typeof v === 'number' ? `${v.toFixed(2)} ${active.target_unit}` : String(v ?? '')

                }

              />

              <ReferenceLine x={0} stroke="#94a3b8" />

              <Bar dataKey="deltaLow" name="Low-side impact" stackId="t" fill="#c45c5c" />

              <Bar dataKey="deltaHigh" name="High-side impact" stackId="t" fill="#2e6b9e" />

            </BarChart>

          </ResponsiveContainer>

        </div>

      )}



      {active.drivers.filter((d) => d.is_fixed).length > 0 && (

        <p className="convention-inline muted">

          Fixed drivers:{' '}

          {active.drivers

            .filter((d) => d.is_fixed)

            .map((d) => d.label)

            .join(', ')}

        </p>

      )}



      {active.segment_contributions && active.segment_contributions.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h4>Segment contribution — {category} (base, mode scale, P50 petro)</h4>
          <div className="table-scroll">
            <table className="data-table data-table-compact">
              <thead>
                <tr>
                  <th>Segment</th>
                  <th>Base GRV</th>
                  <th>Base GIIP ({active.target_unit})</th>
                  <th>% of total GIIP</th>
                  <th>NTG</th>
                  <th>Poro</th>
                  <th>Sw</th>
                  <th>GEF</th>
                </tr>
              </thead>
              <tbody>
                {active.segment_contributions.map((s) => (
                  <tr key={`${s.segment_id}-${s.reservoir_id}`}>
                    <td>{s.segment_label}</td>
                    <td>{s.base_grv.toFixed(2)}</td>
                    <td>{s.base_giip.toFixed(3)}</td>
                    <td>{s.pct_of_total_giip.toFixed(1)}%</td>
                    <td>{s.net_to_gross.toFixed(3)}</td>
                    <td>{s.porosity.toFixed(3)}</td>
                    <td>{s.saturation.toFixed(3)}</td>
                    <td>{s.gef.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '1rem' }}>

        <h4>Tornado driver debug ({modeLabel})</h4>

        <div className="table-scroll">

          <table className="data-table data-table-compact">

            <thead>

              <tr>

                <th>Display mode</th>

                <th>Driver label</th>

                <th>Parameter family</th>

                <th>Affected groups</th>

                <th>Affected segments</th>

                <th>Low result</th>

                <th>Base result</th>

                <th>High result</th>

                <th>Δ low</th>

                <th>Δ high</th>

              </tr>

            </thead>

            <tbody>

              {active.drivers.map((d) => (

                <tr key={d.driver_id}>

                  <td>{d.display_mode ?? modeLabel}</td>

                  <td>{d.label}</td>

                  <td>{d.parameter_family ?? '—'}</td>

                  <td>{formatList(d.affected_groups)}</td>

                  <td>{formatList(d.affected_segments)}</td>

                  <td>{d.swing_low.toFixed(3)}</td>

                  <td>{active.base_giip.toFixed(3)}</td>

                  <td>{d.swing_high.toFixed(3)}</td>

                  <td>{d.delta_low.toFixed(3)}</td>

                  <td>{d.delta_high.toFixed(3)}</td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

    </div>

  )

}


