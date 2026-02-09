# Control Narrative Pipeline

This file explains how the AI control-narrative box turns topology data into control-specific text using RAG + gguf models.

## Pipeline Overview

1. **User Chooses Control & Scope**
   - ControlNarrativeAIBox exposes control families, baseline, and selected devices.
   - Inputs stored in `useAINarrativesStore` (requested control, status, parameters).

2. **Context Assembly**
   - `buildControlContext(controlId, selection)` produces:
     - Control objective text (from catalog).
     - Topology summary (device counts, zones, key security attributes).
     - Device-specific bullet points from embeddings.

3. **Retrieval Layer**
   - Query vector store with controlId + selection hints.
   - Retrieve top-k device/boundary chunks, optionally include historical narratives for continuity.

4. **Prompt Template**
   ```
   You are generating a NIST 800-53 Rev 5 control narrative.
   Control: {{controlId}} - {{controlTitle}}
   Objective: {{controlObjective}}
   System: {{systemName}} (Baseline: {{baseline}})
   Topology Summary:
   {{topologySummary}}
   Retrieved Context:
   {{retrievedSnippets}}
   Instructions:
   - Reference actual devices/zones by name.
   - Mention security tooling or procedures when available.
   - Output 2-3 paragraphs in present tense.
   ```

5. **gguf Generation**
   - Prompt sent to local model (e.g., `mistral-7b-instruct.Q4_K_M.gguf`).
   - Streaming tokens captured so UI can show progress.

6. **Post-Processing**
   - Trim hallucinated device names by cross-checking with selection.
   - Score narrative completeness (did it mention objective subpoints?).
   - Store metadata: tokens used, retrieval IDs, user who requested generation.

7. **User Actions**
   - Accept: narrative saved into existing control narrative store and flagged as AI-generated.
   - Edit: user tweaks text inline; changes tracked separately from AI version.
   - Regenerate: bump retrieval temperature or control-specific weights.

## File Hooks
- `frontend/components/ControlNarrativeAIBox.tsx`: renders pipeline status + actions.
- `ai-service/rag-orchestrator.ts`: contains pseudocode for Steps 2-5.
- `control-examples/`: sample prompts/responses for reference.

## Guidance for AI Agents
- Keep each narrative under ~800 tokens; prefer concise evidence-backed prose.
- When retrieval fails, fall back to topology summary + control objective (but warn the user).
- Tag outputs with `implementation_status` guess (Implemented/Planned/etc.) based on device config (e.g., encryption enabled → SC controls implemented).
