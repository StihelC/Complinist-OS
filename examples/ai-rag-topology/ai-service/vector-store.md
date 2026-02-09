# Vector Store Contract

The vector store powers retrieval for control narratives. Any implementation (Pinecone, Weaviate, pgvector, LanceDB) must honor the metadata and filtering described below.

## Schema
| Field | Type | Description |
| --- | --- | --- |
| `id` | string | `device-${deviceId}` or `boundary-${boundaryId}` |
| `vector` | float[] | Embedding from chunk text |
| `metadata.controlIdHints` | string[] | Control IDs or families relevant to this chunk |
| `metadata.zone` | string | Security zone / boundary label |
| `metadata.deviceType` | string | e.g., `server`, `firewall` |
| `metadata.riskLevel` | string | `High`/`Moderate`/`Low` |
| `metadata.topologyVersion` | number | Timestamp/version |

## Required Operations
1. **Upsert**
   ```ts
   await vectorStore.upsert({ id, vector, metadata })
   ```
2. **Query**
   ```ts
   const results = await vectorStore.query({
     vector,
     topK: 8,
     filters: {
       controlIdHints: { $contains: controlId },
       topologyVersion: { $gte: latestVersion - 2 }
     }
   })
   ```
3. **Delete by Version** when topology changes drastically.
4. **Similarity Metrics**: cosine distance preferred.

## Filtering Strategy
- **Control Filter**: restrict to chunks tagged with the current control family to avoid irrelevant content.
- **Zone Filter**: when user selects DMZ devices, prioritize DMZ-tagged chunks.
- **Baseline Filter**: align retrieved context to selected baseline (LOW/MOD/HIGH).

## Reference Implementation Pseudocode
```ts
async function upsertTopologyChunks(chunks: DeviceChunk[]) {
  const payloads = await Promise.all(chunks.map(async (chunk) => ({
    id: chunk.id,
    vector: await embed(chunk.text),
    metadata: chunk.metadata,
  })))
  await vectorStore.upsert(payloads)
}

async function retrieveContext(request: RAGRequest) {
  const queryVector = await embed(`Control ${request.controlId} context for ${request.systemName}`)
  return vectorStore.query({
    vector: queryVector,
    topK: 6,
    filters: {
      controlIdHints: { $contains: request.controlId },
      topologyVersion: { $gte: request.topologyVersion - 1 },
    },
  })
}
```

## Notes
- Store raw chunk text alongside metadata so fallback narratives can still use the snippet even if vector lookup is unavailable.
- Keep chunk IDs stable so references in `RAGResponse.references` stay meaningful to the UI.
