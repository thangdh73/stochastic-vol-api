import type { NrvEntryMode, SimulationInput } from '../types/api'
import { ensurePetrelGrvMarginals } from '../utils/petrelGrv'

export function rockVolumeModeLabel(mode: NrvEntryMode): string {
  switch (mode) {
    case 'petrel_marginals':
      return 'Petrel GRV (3+3)'
    case 'direct':
      return 'Direct NRV'
    default:
      return 'GRV × fill × NTG'
  }
}

type Props = {
  input: SimulationInput
  ntgConstantOnSetup: boolean
  onPatch: (next: SimulationInput) => void
  compact?: boolean
}

/** Switch rock-volume entry mode (visible even when editor panel is collapsed). */
export function RockVolumeEntryModePicker({
  input,
  ntgConstantOnSetup,
  onPatch,
  compact = false,
}: Props) {
  const entryMode: NrvEntryMode = input.nrv_entry_mode ?? 'grv_fill_ntg'

  const setMode = (mode: NrvEntryMode) => {
    if (mode === 'petrel_marginals') {
      onPatch(ensurePetrelGrvMarginals({ ...input, nrv_entry_mode: 'petrel_marginals' }))
      return
    }
    onPatch({ ...input, nrv_entry_mode: mode })
  }

  return (
    <div
      className={compact ? 'input-entry-mode-inline input-entry-mode-compact' : 'input-entry-mode-inline'}
      role="radiogroup"
      aria-label="Rock volume entry mode"
    >
      {!ntgConstantOnSetup && (
        <label className="input-entry-pill">
          <input
            type="radio"
            name="nrv-entry"
            checked={entryMode === 'grv_fill_ntg'}
            onChange={() => setMode('grv_fill_ntg')}
          />
          GRV × fill × NTG
        </label>
      )}
      <label className="input-entry-pill">
        <input
          type="radio"
          name="nrv-entry"
          checked={entryMode === 'petrel_marginals'}
          onChange={() => setMode('petrel_marginals')}
        />
        Petrel GRV (3+3)
      </label>
      <label className="input-entry-pill">
        <input
          type="radio"
          name="nrv-entry"
          checked={entryMode === 'direct'}
          onChange={() => setMode('direct')}
        />
        Direct NRV
      </label>
    </div>
  )
}
