# End-to-End RAG Flow

1. **User selects control + devices**
   - ControlNarrativeAIBox sets `useAINarrativesStore.requestNarrative({ controlId, selectedDeviceIds })`.

2. **Embedding Sync**
   - `syncSelectedDevicesToVectorStore(selectedDeviceIds)` generates/updates vectors for the newly selected devices.

3. **RAG Request**
   - Build `RAGRequest` with system name, baseline, control objective, selection snapshot.
   - Pass request to `generateControlNarrative` in the orchestrator.

4. **Retrieval + Prompt**
   - Vector store returns top-k chunks tagged with the control.
   - Orchestrator summarizes topology, builds prompt, calls gguf model.

5. **Streaming UI**
   - `useAINarrativesStore.updateStatus(controlId, { status: 'generating', narrative: partialText })` as tokens arrive.

6. **User Decision**
   - Accept → `commitAINarrative(controlId)` writes into control narrative store.
   - Edit → user tweaks text; final text still saved through existing SSP workflow.

7. **Audit Trail**
   - Log controlId, selected devices, references, model used, timestamp.

This sequence keeps the AI workflow compatible with the topology app and documents each step for future automation.
