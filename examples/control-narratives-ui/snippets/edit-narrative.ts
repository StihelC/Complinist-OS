import { useControlNarrativesStore } from '../frontend/state/useControlNarrativesStore'

export function editNarrative(controlId: string, text: string) {
  useControlNarrativesStore.getState().updateNarrative(controlId, text)
}
