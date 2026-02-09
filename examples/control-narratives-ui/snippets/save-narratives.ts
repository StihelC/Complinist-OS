import { useControlNarrativesStore } from '../frontend/state/useControlNarrativesStore'

export async function saveNarratives() {
  await useControlNarrativesStore.getState().saveNarratives()
}
