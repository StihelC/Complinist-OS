/**
 * RAG Orchestrator Pseudocode
 * Glue layer between topology snapshot, vector store, and gguf LLM.
 */

import type { DeviceChunk, RAGRequest, RAGResponse } from '../types' // describe in README or inline

export async function generateControlNarrative(request: RAGRequest): Promise<RAGResponse> {
  // 1. Build retrieval query
  const queryEmbedding = await embedText(
    `Control ${request.controlId} narrative for ${request.systemName} baseline ${request.baseline}`
  )

  // 2. Retrieve relevant topology chunks
  const retrieved = await vectorStore.query({
    vector: queryEmbedding,
    topK: 6,
    filters: {
      controlIdHints: { $contains: request.controlId },
    },
  })

  // 3. Summarize topology snapshot
  const topologySummary = summarizeTopology(request.selectedDeviceIds)

  // 4. Build prompt
  const prompt = buildPrompt({
    controlId: request.controlId,
    baseline: request.baseline,
    systemName: request.systemName,
    controlObjective: controlCatalog[request.controlId].objective,
    topologySummary,
    retrievedSnippets: retrieved.map((chunk) => chunk.text),
    additionalContext: request.additionalContext,
  })

  // 5. Call gguf model (via llama.cpp / server)
  const completion = await llm.generate({
    model: 'mistral-7b-instruct.Q4_K_M.gguf',
    prompt,
    maxTokens: 600,
    temperature: 0.4,
  })

  // 6. Map references for UI
  const references = retrieved.map((chunk) => ({
    chunkId: chunk.id,
    reason: `Similarity ${chunk.score.toFixed(2)} with device ${chunk.metadata.deviceId}`,
  }))

  return {
    controlId: request.controlId,
    narrative: completion.text.trim(),
    references,
    tokensUsed: completion.tokens,
  }
}

function summarizeTopology(selectedDeviceIds: string[]) {
  // Example placeholder: pull from Zustand or cached snapshot
  const devices = getDevicesByIds(selectedDeviceIds)
  const countsByType = countBy(devices, (d) => d.type)
  const zones = new Set(devices.map((d) => d.config?.securityZone))

  return [
    `Devices selected: ${devices.length}`,
    `Types: ${Object.entries(countsByType).map(([type,count]) => `${type} x${count}`).join(', ')}`,
    `Zones: ${Array.from(zones).join(', ')}`,
    `Encryption coverage: ${pct(devices.filter((d) => d.config?.encryptionStatus === 'Enabled').length, devices.length)}%`
  ].join('\n')
}

function buildPrompt(ctx: {
  controlId: string
  baseline: string
  systemName: string
  controlObjective: string
  topologySummary: string
  retrievedSnippets: string[]
  additionalContext?: string
}) {
  return `You are writing a control narrative for ${ctx.controlId} (${ctx.controlObjective}).\n` +
    `System: ${ctx.systemName} (Baseline: ${ctx.baseline}).\n` +
    `Topology summary:\n${ctx.topologySummary}\n` +
    `Retrieved context:\n${ctx.retrievedSnippets.join('\n---\n')}\n` +
    `${ctx.additionalContext ? `Additional guidance: ${ctx.additionalContext}\n` : ''}` +
    `Write 2 paragraphs describing how the system satisfies the control. Reference concrete devices/zones.`
}
