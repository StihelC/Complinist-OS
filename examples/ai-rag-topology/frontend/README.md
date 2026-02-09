# Frontend Guidance

This folder describes how to integrate the AI narrative workflow into the existing ReactFlow + Zustand topology app.

## State Slices
- `state/useAINarrativesStore.example.ts`: Tracks AI requests, streaming state, and generated text. Mirrors what the backend would send, but remains frontend-friendly so the AI assistant can reason about state transitions.
- Extend this store to include:
  - `selectionSnapshot`: cached device/boundary info included with each request.
  - `retrievalPreview`: top-k chunks shown before the user commits to generation.

## Components
- `components/ControlNarrativeAIBox.tsx`: Example component that:
  1. Reads control selections and AI status from Zustand.
  2. Displays retrieved context + prompt preview.
  3. Streams gguf output with a progress bar.
  4. Lets the user accept/edit/commit the AI narrative.

## Integration Tips
- Reuse the same stores/hooks as the SSP Control Editor (projects, devices, boundaries). Only the AI-specific state lives in `useAINarrativesStore`.
- Keep component props minimal: `controlId`, `baseline`, `systemName`. Everything else comes from stores so AI agents can fetch data without prop drilling.
- When AI generation finishes, call the existing narrative persistence action (`useControlNarrativesStore` or API) so reports remain unified.
