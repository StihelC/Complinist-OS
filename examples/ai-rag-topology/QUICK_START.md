# Quick Start: AI + RAG for Topology Narratives

Follow these steps to wire the existing ReactFlow + Zustand topology into an AI-powered RAG workflow.

## 1. Capture Topology Context (Frontend)
```ts
const devices = useDevicesStore.getState().items
const boundaries = useBoundariesStore.getState().items
const selection = useSelectionStore.getState().selectedNodeIds

const selectedDevices = devices.filter(d => selection.includes(d.id))
```
- Normalize device config fields (manufacturer, OS, riskLevel, encryption, references).
- Include boundary labels (e.g., DMZ, Prod LAN) so AI models understand zones.

## 2. Build Embedding Payloads
```ts
const embeddingChunks = selectedDevices.map(device => ({
  id: `device-${device.id}`,
  controlHints: device.config?.controlHints || ['AC-2','SC-7'],
  text: [
    `Name: ${device.name}`,
    `Type: ${device.type}`,
    `OS: ${device.config?.operatingSystem || 'unknown'}`,
    `Risk: ${device.config?.riskLevel || 'Moderate'}`,
    `Location: ${device.config?.location || 'Unassigned'}`,
    `Security Notes: ${device.config?.securityNotes || 'N/A'}`
  ].join('\n')
}))
```
Feed these chunks to your embedding model (local or remote) and push vectors to the store.

## 3. Upsert into Vector Store
```ts
await vectorStore.upsert(
  embeddingChunks.map(chunk => ({
    id: chunk.id,
    vector: await embed(chunk.text),
    metadata: {
      controls: chunk.controlHints,
      deviceId: chunk.id,
      topologyVersion: Date.now()
    }
  }))
)
```
Tag with control families so retrieval can filter by e.g., AC, SC, CM.

## 4. Orchestrate a RAG Query
```ts
const ragRequest = {
  controlId: 'AC-2',
  systemName: 'Production Network',
  selectedDeviceIds: selection,
  additionalContext: controlLibrary['AC-2']
}
```
Workflow:
1. Retrieve top-k vectors filtered by `controlId`.
2. Summarize topology (counts, zones, security posture).
3. Build prompt: control objective + retrieved snippets + topology summary.
4. Send prompt to gguf model (local) or remote LLM.

## 5. Update Zustand with AI Output
```ts
useAINarrativesStore.getState().setNarrative({
  controlId: 'AC-2',
  status: 'Generated',
  text: ragResponse.text,
  evidence: ragResponse.references
})
```
Expose this narrative in `ControlNarrativeAIBox` so users can accept/edit before saving.

## 6. Reuse with Control Narratives Box
- ControlNarrativeAIBox subscribes to `useAINarrativesStore`.
- It surfaces: retrieved context, prompt preview, streaming AI output, and a "commit to control" action that writes into the existing narrative store.

## 7. Keep gguf Models Happy
- Keep per-control prompts under the models context window (see `models/context-window.md`).
- Batch embeddings where possible; reuse cached vectors unless topology changed.

You now have the minimum wiring: topology → embeddings → vector store → RAG prompt → Zustand narrative store. Dive into the folders listed in `README.md` for deeper details.
