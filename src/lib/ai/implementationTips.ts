// Implementation Tips Service
// Analyzes user's implementation against NIST control reference to provide helpful tips

import { getLLMServer } from './llamaServer';

export interface ImplementationTipsRequest {
  controlId: string;
  controlTitle: string;
  nistReference: string;
  userImplementation: string;
}

export interface ImplementationTip {
  category: string;
  tip: string;
}

export interface ImplementationTipsResponse {
  tips: ImplementationTip[];
  rawText: string;
}

/**
 * Analyzes user's implementation and provides tips based on NIST control reference
 */
export async function analyzeImplementationTips(
  request: ImplementationTipsRequest
): Promise<ImplementationTipsResponse> {
  const { controlId, controlTitle, nistReference, userImplementation } = request;
  const llmServer = getLLMServer();

  const prompt = buildTipsPrompt({
    controlId,
    controlTitle,
    nistReference,
    userImplementation,
  });

  try {
    const response = await llmServer.generate({
      prompt,
      temperature: 0.3, // Lower temperature for more focused, analytical output
      maxTokens: 600,
    });

    const tips = parseTipsFromResponse(response.text);
    
    return {
      tips,
      rawText: response.text,
    };
  } catch (error) {
    throw new Error(
      `Failed to analyze implementation tips: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Builds the prompt for tips analysis
 */
function buildTipsPrompt(context: {
  controlId: string;
  controlTitle: string;
  nistReference: string;
  userImplementation: string;
}): string {
  const { controlId, controlTitle, nistReference, userImplementation } = context;

  return `You are a cybersecurity compliance advisor. Analyze the user's control implementation narrative and provide helpful, actionable tips.

Control: ${controlId} - ${controlTitle}

NIST Control Reference:
${nistReference}

User's Implementation:
${userImplementation}

Provide specific, actionable tips in these categories:
1. Missing Elements: What important aspects from the NIST control are not addressed in the user's implementation?
2. Clarity Suggestions: How can the narrative be made clearer, more specific, or more professional?
3. Compliance Alignment: Does the implementation align with the control requirements? What gaps exist?
4. Enhancement Ideas: What additional details, examples, or specifics would strengthen the narrative?

Format your response as a bulleted list with clear category headers. Be constructive, specific, and actionable. Each tip should be concise (1-2 sentences).

Example format:
**Missing Elements:**
• Tip 1
• Tip 2

**Clarity Suggestions:**
• Tip 1
• Tip 2

**Compliance Alignment:**
• Tip 1

**Enhancement Ideas:**
• Tip 1
• Tip 2

Tips:`;
}

/**
 * Parses tips from LLM response text
 */
function parseTipsFromResponse(text: string): ImplementationTip[] {
  const tips: ImplementationTip[] = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  let currentCategory = '';
  
  for (const line of lines) {
    // Check for category headers (bold or markdown headers)
    const categoryMatch = line.match(/\*\*([^*]+)\*\*:|^#+\s*(.+)$/);
    if (categoryMatch) {
      currentCategory = categoryMatch[1] || categoryMatch[2];
      continue;
    }
    
    // Check for bullet points
    const bulletMatch = line.match(/^[•\-\*]\s*(.+)$/);
    if (bulletMatch && currentCategory) {
      tips.push({
        category: currentCategory,
        tip: bulletMatch[1].trim(),
      });
    }
  }
  
  // If parsing failed, return raw text as a single tip
  if (tips.length === 0 && text.trim()) {
    return [{
      category: 'General Suggestions',
      tip: text.trim(),
    }];
  }
  
  return tips;
}

