# AI Data Flow (Topology → RAG)

```
ReactFlow Canvas
    ↕ (selection, drag, metadata)
Zustand Stores (devices, boundaries, selection)
    ↓
Topology Snapshot Builder
    ↓
Embedding Chunker
    ↓
Vector Store (control-tagged)
    ↔
RAG Orchestrator
    ↓
gguf LLM
    ↓
AINarratives Store → ControlNarrativeAIBox
```

## Steps in Detail

1. **Topology Snapshot**
   - Pull `devices`, `connections`, and `boundaries` from their Zustand stores.
   - Normalize `device.config` into serializable key/value pairs.
   - Include selection metadata (which controls/features the user cares about).

2. **Embedding Chunker**
   - Convert each device/boundary into a chunk that emphasizes control-relevant facts.
   - Example fields: `operatingSystem`, `riskLevel`, `encryptionStatus`, `securityZone`, `owner`, `interfaces`.
   - Append derived summaries (device counts per zone, remote access flags, MFA coverage).

3. **Vector Store Upsert**
   - Embed chunk text, store vector alongside metadata: `{ controlFamilies: ['AC','SC'], deviceId, zone, topologyVersion }`.
   - Updating topology? Version the vectors so retrieval can filter to the newest snapshot.

4. **RAG Retrieval**
   - Query by `controlId` + optionally `zone` or `deviceType`.
   - Pull top-K chunks, optionally re-rank based on similarity and control weightings.

5. **Prompt Assembly**
   - Compose: `control objective + retrieved device snippets + topology summary + user-added notes`.
   - Keep prompt under gguf context window by prioritizing the most relevant fields (see `models/context-window.md`).

6. **LLM Generation**
   - Send prompt to on-device gguf (via llama.cpp, vLLM, etc.).
   - Stream tokens back to frontend.

7. **Narrative Persistence**
   - Write AI output + references into `useAINarrativesStore`.
   - Provide functions to commit the AI text into the existing control narrative store (same as manual editor uses).

## Data Contracts
- **DeviceChunk**
  ```ts
  interface DeviceChunk {
    id: string
    controlHints: string[]
    text: string // multiline summary built from config
    metadata: {
      deviceId: string
      zone?: string
      riskLevel?: string
      controlFamilies: string[]
      topologyVersion: number
    }
  }
  ```
- **RAGRequest**
  ```ts
  interface RAGRequest {
    controlId: string
    baseline: 'LOW' | 'MODERATE' | 'HIGH'
    systemName: string
    selectedDeviceIds: string[]
    additionalContext?: string
  }
  ```

- **RAGResponse**
  ```ts
  interface RAGResponse {
    controlId: string
    narrative: string
    references: Array<{ chunkId: string; reason: string }>
    tokensUsed: number
  }
  ```

## Notes for AI Agents
- Always honor the existing device schema; do not invent new stores.
- Prefer derived summaries (counts, percentages) over raw dumps to stay within context limits.
- Control families map nicely to device metadata: e.g., AC→identity, SC→network/boundary, CM→config history.
