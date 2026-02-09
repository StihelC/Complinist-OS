import create from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ControlNarrative, ControlFamily } from './types'

interface ControlNarrativesState {
  items: Record<string, ControlNarrative>
  families: ControlFamily[]
  baseline: 'LOW' | 'MODERATE' | 'HIGH'
  searchTerm: string
  dirtyIds: Set<string>
  loading: boolean
  loadControls: (baseline: ControlNarrativesState['baseline']) => Promise<void>
  setSearchTerm: (value: string) => void
  updateNarrative: (controlId: string, text: string) => void
  updateStatus: (controlId: string, status: string) => void
  resetControl: (controlId: string) => void
  saveNarratives: () => Promise<void>
  dirtyCount: number
}

export const useControlNarrativesStore = create<ControlNarrativesState>()(
  devtools((set, get) => ({
    items: {},
    families: [],
    baseline: 'MODERATE',
    searchTerm: '',
    dirtyIds: new Set(),
    loading: false,

    async loadControls(baseline) {
      set({ loading: true })
      // pseudo fetch
      const catalog = await fetchCatalog(baseline)
      const custom = await fetchCustomNarratives(baseline)
      const merged = mergeNarratives(catalog, custom)
      set({
        baseline,
        items: merged.items,
        families: merged.families,
        dirtyIds: new Set(),
        loading: false,
      })
    },

    setSearchTerm(value) {
      set({ searchTerm: value })
    },

    updateNarrative(controlId, text) {
      set((state) => {
        const control = state.items[controlId]
        if (!control) return state
        const updated = {
          ...control,
          narrative: text,
          isCustom: true,
        }
        const dirtyIds = new Set(state.dirtyIds)
        dirtyIds.add(controlId)
        return {
          items: { ...state.items, [controlId]: updated },
          dirtyIds,
        }
      })
    },

    updateStatus(controlId, status) {
      set((state) => ({
        items: {
          ...state.items,
          [controlId]: {
            ...state.items[controlId],
            implementation_status: status,
            isCustom: true,
          },
        },
        dirtyIds: new Set(state.dirtyIds).add(controlId),
      }))
    },

    resetControl(controlId) {
      set((state) => {
        const control = state.items[controlId]
        if (!control) return state
        const updated = {
          ...control,
          narrative: control.default_narrative,
          implementation_status: undefined,
          isCustom: false,
        }
        const dirtyIds = new Set(state.dirtyIds)
        dirtyIds.delete(controlId)
        return {
          items: { ...state.items, [controlId]: updated },
          dirtyIds,
        }
      })
    },

    async saveNarratives() {
      const state = get()
      const payload = Array.from(state.dirtyIds).map((id) => state.items[id])
      if (payload.length === 0) return
      await saveNarrativesToBackend(payload)
      set({ dirtyIds: new Set() })
    },

    get dirtyCount() {
      return get().dirtyIds.size
    },
  }))
)

async function fetchCatalog(baseline: string) {
  // placeholder
  return []
}
async function fetchCustomNarratives(baseline: string) {
  return []
}
function mergeNarratives(catalog: any[], custom: any[]) {
  return { items: {}, families: [] }
}
async function saveNarrativesToBackend(payload: any[]) {
  console.log('save', payload)
}
