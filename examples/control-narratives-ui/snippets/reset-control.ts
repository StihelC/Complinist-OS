import { useControlNarrativesStore } from '../frontend/state/useControlNarrativesStore'

export function resetControl(controlId: string) {
  useControlNarrativesStore.getState().resetControl(controlId)
}
