import { useAINarrativesStore } from '../frontend/state/useAINarrativesStore.example'
import { useControlNarrativesStore } from '../../frontend/src/store/stores/controlNarrativesStore' // real path once integrated

/**
 * Commits AI narrative into the persistent control narrative store.
 */
export function commitAINarrative(controlId: string) {
  const aiStore = useAINarrativesStore.getState()
  const narrative = aiStore.items[controlId]
  if (!narrative?.narrative) return

  useControlNarrativesStore.getState().saveNarrative({
    controlId,
    narrative: narrative.narrative,
    implementation_status: 'Implemented',
    source: 'ai-rag',
    references: narrative.references,
  })

  aiStore.clearNarrative(controlId)
}
