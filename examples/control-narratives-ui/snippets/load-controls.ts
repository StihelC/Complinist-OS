import { useControlNarrativesStore } from '../frontend/state/useControlNarrativesStore'

export async function initControlEditor(baseline: 'LOW' | 'MODERATE' | 'HIGH') {
  await useControlNarrativesStore.getState().loadControls(baseline)
}
