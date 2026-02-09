import create from 'zustand'
import { devtools } from 'zustand/middleware'

/**
 * AI Narratives Store
 * Keeps track of control requests, streaming status, and generated text.
 * This layer is frontend-only for the example, but mirrors how the backend API would respond.
 */

export interface AINarrative {
  controlId: string
  status: 'idle' | 'queued' | 'retrieving' | 'generating' | 'completed' | 'error'
  narrative?: string
  references?: Array<{ chunkId: string; reason: string }>
  error?: string
  requestedAt: number
  updatedAt: number
}

interface AINarrativesState {
  items: Record<string, AINarrative>
  requestNarrative: (payload: { controlId: string; selectedDeviceIds: string[] }) => void
  updateStatus: (controlId: string, patch: Partial<AINarrative>) => void
  clearNarrative: (controlId: string) => void
}

export const useAINarrativesStore = create<AINarrativesState>()(
  devtools((set) => ({
    items: {},

    requestNarrative: ({ controlId, selectedDeviceIds }) => {
      const now = Date.now()
      set((state) => ({
        items: {
          ...state.items,
          [controlId]: {
            controlId,
            status: 'queued',
            requestedAt: now,
            updatedAt: now,
            narrative: undefined,
            references: [],
          },
        },
      }))

      // Real implementation would call AI service here.
      // For docs, we just note where to trigger `ragClient.generate()`.
    },

    updateStatus: (controlId, patch) => {
      set((state) => {
        const current = state.items[controlId]
        if (!current) return state
        return {
          items: {
            ...state.items,
            [controlId]: {
              ...current,
              ...patch,
              updatedAt: Date.now(),
            },
          },
        }
      })
    },

    clearNarrative: (controlId) => {
      set((state) => {
        const next = { ...state.items }
        delete next[controlId]
        return { items: next }
      })
    },
  }))
)
