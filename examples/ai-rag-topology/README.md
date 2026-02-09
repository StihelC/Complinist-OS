# AI + RAG Topology Example

This example shows how to plug an AI retrieval-augmented generation (RAG) pipeline into the existing ReactFlow + Zustand topology stack. It keeps the same device/config data model, highlights the metadata that matters most for control narratives, and documents the contracts an AI assistant or service must follow when coding against this topology.

## Goals
- Reuse the current topology DSL (ReactFlow canvas + Zustand stores) without rewriting state.
- Teach an AI agent how to extract the right device/boundary/context data for control narratives.
- Document how topology snapshots become embeddings, vector chunks, and prompts for a gguf-backed LLM.
- Provide copyable structures (files, interfaces, pseudocode) that the AI can extend when writing code.

## Whats Inside
| Folder | Purpose |
| --- | --- |
| `architecture/` | Data flow diagrams and control narrative pipeline details |
| `frontend/` | Zustand slice guidance + ControlNarrativeAIBox component outline |
| `ai-service/` | Embedding payload structure, vector store contracts, RAG orchestrator pseudocode |
| `control-examples/` | Prompt templates, retrieved snippets, and final narratives per control family |
| `models/` | gguf integration notes, context window tips |
| `snippets/` | Copy/paste code for embeddings, vector upserts, RAG queries, and Zustand updates |
| `integration/` | End-to-end walkthrough that ties topology selection to AI-enhanced narratives |

## Topology Compatibility
- Devices live in `useDevicesStore`, with descriptive metadata stored under `device.config` (same as SSP example).
- Boundaries, projects, and selections reuse the existing Zustand slices; no backend dependency is required for this example.
- The AI narrative box consumes the same selection context used by the SSP Control Editor, so it can co-exist in the Export modal or side panel.

## How AI Fits In
1. **Selection Context**: Users highlight devices/boundaries in ReactFlow. Zustand stores hold the current selection and topology snapshot.
2. **Embedding Prep**: Frontend or backend flattens device config + boundary metadata into embedding-ready chunks.
3. **Vector Store**: Chunks are stored with control-family tags (AC, SC, etc.) so retrieval can target relevant context.
4. **Prompt Assembly**: RAG orchestrator pulls retrieved snippets + control metadata + topology summary into a gguf-friendly prompt.
5. **Narrative Delivery**: Results stream back into Zustand, where ControlNarrativeAIBox updates the UI and optionally writes to the persistent narrative store.

## When to Use This Example
- Bootstrapping a new AI agent so it understands your topology vocabulary.
- Handing instructions to another dev/AI to build AI-powered control narratives without touching the backend yet.
- Testing gguf or other on-device/inference-friendly models against real topology data.

Read `QUICK_START.md` next for actionable steps.
