# RAG Snippets

| File | Purpose |
| --- | --- |
| `embeddings.ts` | Convert topology data into embedding chunks and upsert to vector store |
| `ragClient.ts` | Request/stream AI narratives from local gguf service |
| `zustandUpdates.ts` | Wire RAG responses back into frontend stores |

All snippets assume the existing ReactFlow + Zustand stores; replace placeholder imports with actual project paths when implementing.
