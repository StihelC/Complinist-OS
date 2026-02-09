// Narrative Refiner
// Uses LLM to refine and expand user's rough implementation notes into coherent narratives

import { getLLMServer } from './llamaServer';

export interface RefineNarrativeRequest {
  controlId: string;
  controlTitle: string;
  nistReference: string;
  userNotes: string;
}

export interface RefineNarrativeResponse {
  refinedNarrative: string;
}

/**
 * Refines rough user notes into a professional control narrative
 * Uses the NIST control reference as context to ensure alignment
 */
export async function refineNarrative(
  request: RefineNarrativeRequest
): Promise<RefineNarrativeResponse> {
  const { controlId, controlTitle, nistReference, userNotes } = request;
  const llmServer = getLLMServer();

  const prompt = buildRefinementPrompt({
    controlId,
    controlTitle,
    nistReference,
    userNotes,
  });

  try {
    const response = await llmServer.generate({
      prompt,
      temperature: 0.5, // Slightly higher for more creative expansion
      maxTokens: 800, // Allow for longer refined narratives
    });

    return {
      refinedNarrative: response.text.trim(),
    };
  } catch (error) {
    throw new Error(
      `Failed to refine narrative: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Builds the prompt for narrative refinement
 */
function buildRefinementPrompt(context: {
  controlId: string;
  controlTitle: string;
  nistReference: string;
  userNotes: string;
}): string {
  const { controlId, controlTitle, nistReference, userNotes } = context;

  return `You are a cybersecurity compliance assistant. Your task is to refine rough implementation notes into a clear, professional control narrative for a System Security Plan (SSP).

Control: ${controlId} - ${controlTitle}

NIST Control Reference:
${nistReference}

User's Implementation Notes:
${userNotes}

Please expand and refine the user's notes into a clear, coherent narrative that:
1. Maintains the user's intended meaning and specific details (device names, configurations, processes, etc.)
2. Uses professional, compliance-appropriate language suitable for an SSP
3. Clearly explains how this control is implemented in their specific system
4. Is concise but complete (typically 2-4 paragraphs)
5. Aligns with the NIST control requirements referenced above
6. Preserves all technical specifics mentioned by the user
7. Expands on brief notes to create full sentences and coherent paragraphs
8. Uses present tense and active voice where appropriate

Important: Do not add information that wasn't in the user's notes. Only expand, clarify, and professionalize what they provided. If their notes are incomplete, indicate what would need to be added rather than making assumptions.

Refined Narrative:`;
}

/**
 * Streams the refinement process for real-time updates
 */
export async function* refineNarrativeStream(
  request: RefineNarrativeRequest
): AsyncGenerator<string, void, unknown> {
  const { controlId, controlTitle, nistReference, userNotes } = request;
  const llmServer = getLLMServer();

  const prompt = buildRefinementPrompt({
    controlId,
    controlTitle,
    nistReference,
    userNotes,
  });

  yield* llmServer.generateStream({
    prompt,
    temperature: 0.5,
    maxTokens: 800,
  });
}

