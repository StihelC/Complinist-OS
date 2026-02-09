// Prompt Templates
// Structured prompts for different AI tasks
// Enhanced with evidence scoping to prevent cross-contamination between related controls
// Supports base control vs optional enhancement distinction

import type { TopologyContext } from './types';
import { buildTopologySummary, buildDeviceDetails, buildBoundaryDetails } from './contextBuilder';
import { buildEvidenceContext, getControlCategory } from '@/lib/controls/evidenceService';
import { parseControlId } from '@/lib/controls/parser';

export interface ControlNarrativePromptContext {
  controlId: string;
  controlTitle: string;
  controlObjective: string;
  baseline: 'LOW' | 'MODERATE' | 'HIGH';
  systemName: string;
  topologyContext: TopologyContext;
  retrievedSnippets: string[];
  additionalContext?: string;
  /** Include evidence scoping to prevent cross-contamination */
  includeEvidenceScoping?: boolean;
}

export function buildControlNarrativePrompt(context: ControlNarrativePromptContext): string {
  const {
    controlId,
    controlTitle,
    controlObjective,
    baseline,
    systemName,
    topologyContext,
    retrievedSnippets,
    additionalContext,
    includeEvidenceScoping = true,
  } = context;

  const topologySummary = buildTopologySummary(topologyContext);
  const deviceDetails = buildDeviceDetails(topologyContext);
  const boundaryDetails = buildBoundaryDetails(topologyContext);

  // Build evidence scoping guidance if enabled
  let evidenceGuidance = '';
  if (includeEvidenceScoping) {
    const evidenceCtx = buildEvidenceContext(controlId);
    const category = getControlCategory(controlId);

    evidenceGuidance = `
EVIDENCE SCOPING (Control Category: ${category.toUpperCase()}):
Control Intent: ${evidenceCtx.intent}

When mentioning evidence, ONLY reference evidence appropriate for THIS control:
${evidenceCtx.appropriateEvidence.slice(0, 5).map(e => `- ${e}`).join('\n')}
${evidenceCtx.inappropriateEvidence.length > 0 ? `
DO NOT mention these evidence types (they belong to related controls ${evidenceCtx.relatedControls.join(', ')}):
${evidenceCtx.inappropriateEvidence.map(e => `- ${e}`).join('\n')}` : ''}
${category === 'policy' ? `
NOTE: This is a POLICY control. Focus on policy documents, procedures, and approval records.
Do NOT reference technical configurations, system logs, or ACLs - those belong to enforcement controls.` : ''}
`;
  }

  const prompt = `You are writing a NIST 800-53 Rev 5 control narrative for a System Security Plan (SSP).

Control: ${controlId} - ${controlTitle}
Objective: ${controlObjective}
System: ${systemName}
Baseline: ${baseline}
${evidenceGuidance}
Topology Summary:
${topologySummary}

${deviceDetails}

${boundaryDetails ? `${boundaryDetails}\n` : ''}Retrieved Context:
${retrievedSnippets.length > 0 ? retrievedSnippets.map((snippet, i) => `${i + 1}. ${snippet}`).join('\n\n') : 'No additional context retrieved.'}

${additionalContext ? `Additional Guidance:\n${additionalContext}\n` : ''}Write a compliance narrative (2-3 paragraphs) that:
- Describes how the system satisfies this control
- References specific devices, zones, and configurations from the topology
- Uses present tense and complete sentences
- Provides evidence-based statements demonstrating compliance
- ONLY mentions evidence types appropriate for THIS specific control
- Indicates what needs to be implemented if information is missing

Generate the control narrative:`;

  return prompt;
}

export interface ChatPromptContext {
  userMessage: string;
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  retrievedContext?: string[];
  controlId?: string;
  controlTitle?: string;
}

export function buildChatPrompt(context: ChatPromptContext): string {
  const { userMessage, chatHistory, retrievedContext, controlId, controlTitle } = context;

  let prompt = `You are an AI assistant helping users understand and implement NIST 800-53 controls for their system security plans.

${controlId && controlTitle ? `Current Control: ${controlId} - ${controlTitle}\n` : ''}${retrievedContext && retrievedContext.length > 0 ? `Relevant Context:\n${retrievedContext.map((ctx, i) => `${i + 1}. ${ctx}`).join('\n\n')}\n\n` : ''}Conversation History:
${chatHistory.slice(-5).map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n\n')}

User: ${userMessage}
Assistant:`;

  return prompt;
}

export function buildSystemPrompt(controlFamily?: string): string {
  const basePrompt = `You are an expert cybersecurity consultant specializing in NIST 800-53 Rev 5 controls and System Security Plans (SSPs).

Your role is to:
- Help users understand control requirements and implementation
- Generate accurate, evidence-based control narratives
- Reference specific devices, boundaries, and security configurations from the system topology
- Provide clear, actionable guidance for compliance

Guidelines:
- Always reference actual system components by name when available
- Be specific about security implementations (encryption, MFA, monitoring, etc.)
- Use professional, technical language appropriate for SSP documentation
- If information is missing, clearly indicate what needs to be implemented
- Focus on demonstrating compliance with control objectives`;

  if (controlFamily) {
    return `${basePrompt}\n\nCurrent focus: ${controlFamily} control family (Access Control, System Communications Protection, Configuration Management, etc.)`;
  }

  return basePrompt;
}

/**
 * Section types for structured control responses
 * Matches assessor workflow: intent → requirement → implementation → evidence
 */
export type ControlSectionType = 'purpose' | 'control_requirements' | 'common_implementations' | 'typical_evidence';

/**
 * Evidence context for control-specific evidence scoping
 * Prevents cross-contamination between related controls
 */
export interface EvidenceContext {
  category: 'policy' | 'technical' | 'operational' | 'management';
  intent: string;
  appropriateEvidence: string[];
  inappropriateEvidence: string[];
  relatedControls: string[];
}

/**
 * Context for structured control query prompts
 * Supports the four-section response format for NIST controls
 */
export interface StructuredControlQueryContext {
  query: string;
  controlId?: string;
  controlName?: string;
  retrievedContext: Array<{
    text: string;
    sectionType?: ControlSectionType;
    documentType?: string;
    score?: number;
  }>;
  /** Evidence scoping context to ensure control-specific evidence suggestions */
  evidenceContext?: EvidenceContext;
  /** Real-world implementation examples for the control (environment-specific) */
  implementationExamples?: string;
}

/**
 * Section headers for structured control responses
 * Used consistently across all AI responses for clear delineation
 */
export const CONTROL_SECTION_HEADERS = {
  purpose: '## Purpose',
  control_requirements: '## Control Requirements',
  common_implementations: '## Common Implementations',
  typical_evidence: '## Typical Evidence',
} as const;

/**
 * Section descriptions for prompt guidance
 * Helps the LLM understand what each section should contain
 */
export const CONTROL_SECTION_DESCRIPTIONS = {
  purpose: 'What security objective this control achieves and why it matters',
  control_requirements: 'NIST-defined mandates - what the organization MUST do to satisfy this control',
  common_implementations: 'Practical technical solutions - how organizations typically implement this control',
  typical_evidence: 'Assessment artifacts - what documentation proves compliance with this control',
} as const;

/**
 * Build a structured prompt for NIST control queries
 * Produces responses with four clearly delineated sections:
 * 1. Purpose - Security objective
 * 2. Control Requirements - NIST mandates
 * 3. Common Implementations - Technical solutions
 * 4. Typical Evidence - Assessment artifacts
 *
 * @param context - Query context with retrieved RAG chunks
 * @returns Formatted prompt string
 */
export function buildStructuredControlPrompt(context: StructuredControlQueryContext): string {
  const { query, controlId, controlName, retrievedContext, evidenceContext, implementationExamples } = context;

  // Group retrieved context by section type if available
  const groupedContext = groupContextBySectionType(retrievedContext);

  // Build context sections with section headers for better LLM understanding
  const contextSections = buildContextSections(groupedContext);

  // Detect if this is an enhancement and build appropriate header
  const enhancementInfo = controlId ? buildEnhancementHeader(controlId, controlName) : { header: '', instructions: '' };

  const controlHeader = controlId
    ? `Control: ${controlId}${controlName ? ` - ${controlName}` : ''}`
    : '';

  // Build evidence scoping instructions if available
  const evidenceScopingInstructions = buildEvidenceScopingInstructions(evidenceContext, controlId);

  // Build implementation examples section if available
  const implementationExamplesSection = implementationExamples
    ? buildImplementationExamplesSection(implementationExamples)
    : '';

  return `You are an expert cybersecurity consultant helping users understand NIST 800-53 Rev 5 controls.

${controlHeader}
${enhancementInfo.header}

RESPONSE FORMAT REQUIREMENTS:
Structure your response using EXACTLY these four sections in this order:

${CONTROL_SECTION_HEADERS.purpose}
${CONTROL_SECTION_DESCRIPTIONS.purpose}

${CONTROL_SECTION_HEADERS.control_requirements}
${CONTROL_SECTION_DESCRIPTIONS.control_requirements}

${CONTROL_SECTION_HEADERS.common_implementations}
${CONTROL_SECTION_DESCRIPTIONS.common_implementations}

${CONTROL_SECTION_HEADERS.typical_evidence}
${CONTROL_SECTION_DESCRIPTIONS.typical_evidence}
${evidenceScopingInstructions}
${implementationExamplesSection}

CRITICAL INSTRUCTIONS:
- Use the EXACT section headers shown above (## Purpose, ## Control Requirements, etc.)
- Separate control requirements from implementation guidance clearly
- Focus on CONTROL TEXT requirements, not assessment objectives
- Each section should be 2-4 sentences, concise and actionable
- Base your response on the provided reference documents
- If information is missing for a section, indicate what's typically expected
- IMPORTANT: Only suggest evidence that directly proves THIS control, not related controls
- DO NOT include relevance percentages, match scores, or similarity metrics in your response
- Use qualitative language like "This control is related to..." instead of percentage claims
- Reference specific control families by name (e.g., "AC - Access Control") rather than numeric scores
- When providing implementation examples, reference the real-world examples provided below

Reference Documents:
${contextSections}

User Question: ${query}

Structured Response:`;
}

/**
 * Build enhancement-specific header information
 * Indicates whether a control is a base control or optional enhancement
 *
 * @param controlId - Control identifier (e.g., "SI-4" or "SI-4(1)")
 * @param controlName - Optional control name
 * @returns Header and instructions for enhancement context
 */
function buildEnhancementHeader(
  controlId: string,
  _controlName?: string
): { header: string; instructions: string } {
  const parsed = parseControlId(controlId);

  if (!parsed) {
    return { header: '', instructions: '' };
  }

  if (parsed.isEnhancement && parsed.enhancementNumber !== null) {
    // This is an enhancement
    const header = `
CONTROL TYPE: OPTIONAL ENHANCEMENT
Parent Base Control: ${parsed.baseControlId}
Enhancement Number: (${parsed.enhancementNumber})

NOTE: This is an OPTIONAL enhancement to the base control ${parsed.baseControlId}.
Enhancements provide additional security capabilities beyond the base control requirements.
Organizations implement enhancements based on their risk assessment and selected baseline (LOW/MODERATE/HIGH).`;

    const instructions = `
- Clearly indicate this is an OPTIONAL enhancement, not a mandatory base control
- Explain how this enhancement builds upon the base control ${parsed.baseControlId}
- Mention which baselines (LOW/MODERATE/HIGH) typically require this enhancement
- Describe the additional security benefit this enhancement provides`;

    return { header, instructions };
  }

  // This is a base control
  const header = `
CONTROL TYPE: BASE CONTROL

NOTE: This is a mandatory BASE CONTROL. Any enhancements (e.g., ${controlId}(1), ${controlId}(2)) are optional additions.`;

  const instructions = `
- Focus on the core requirements of this base control
- If the control has enhancements, mention they are optional additions
- Explain that enhancements build upon this base control's requirements`;

  return { header, instructions };
}

/**
 * Build evidence scoping instructions to prevent cross-contamination
 * Ensures evidence suggestions are specific to the control being queried
 *
 * @param evidenceContext - Evidence context with appropriate/inappropriate evidence
 * @param controlId - Control identifier
 * @returns Formatted evidence scoping instructions
 */
function buildEvidenceScopingInstructions(
  evidenceContext?: EvidenceContext,
  controlId?: string
): string {
  if (!evidenceContext || !controlId) {
    return '';
  }

  const categoryLabel = evidenceContext.category.toUpperCase();
  const appropriateList = evidenceContext.appropriateEvidence
    .slice(0, 5)
    .map(e => `  - ${e}`)
    .join('\n');

  let instructions = `

EVIDENCE SCOPING FOR ${controlId} (${categoryLabel} CONTROL):
Control Intent: ${evidenceContext.intent}

APPROPRIATE evidence for this control:
${appropriateList}`;

  if (evidenceContext.inappropriateEvidence.length > 0) {
    const inappropriateList = evidenceContext.inappropriateEvidence
      .map(e => `  - ${e}`)
      .join('\n');

    instructions += `

DO NOT suggest these evidence types (they belong to related controls like ${evidenceContext.relatedControls.join(', ')}):
${inappropriateList}`;
  }

  // Add category-specific guidance
  if (evidenceContext.category === 'policy') {
    instructions += `

NOTE: This is a POLICY control. Evidence should be policy/procedure documents, approval records, and review documentation.
DO NOT suggest technical artifacts (ACLs, system logs, configurations) - those belong to the enforcement controls.`;
  }

  return instructions;
}

/**
 * Build implementation examples section for prompt
 * Provides real-world examples of how controls are commonly implemented
 *
 * @param implementationExamples - Pre-formatted implementation examples string
 * @returns Formatted section for prompt injection
 */
function buildImplementationExamplesSection(implementationExamples: string): string {
  if (!implementationExamples || implementationExamples.trim().length === 0) {
    return '';
  }

  return `

REAL-WORLD IMPLEMENTATION EXAMPLES:
Use these practical examples to enhance your "Common Implementations" section.
These represent how organizations typically implement this control in production environments.

${implementationExamples}

IMPORTANT: When writing the "Common Implementations" section, incorporate relevant examples from above.
- Reference specific tools and services mentioned in the examples
- Tailor examples to the user's environment if context is available
- Keep examples practical and actionable (3-5 bullet points)`;
}

/**
 * Group retrieved context by section type for structured prompts
 * @param retrievedContext - Array of retrieved context with optional section types
 * @returns Grouped context object
 */
function groupContextBySectionType(
  retrievedContext: StructuredControlQueryContext['retrievedContext']
): Record<ControlSectionType | 'general', typeof retrievedContext> {
  const grouped: Record<ControlSectionType | 'general', typeof retrievedContext> = {
    purpose: [],
    control_requirements: [],
    common_implementations: [],
    typical_evidence: [],
    general: [],
  };

  for (const ctx of retrievedContext) {
    const sectionType = ctx.sectionType || inferSectionType(ctx.text, ctx.documentType);
    if (sectionType && sectionType in grouped) {
      grouped[sectionType].push(ctx);
    } else {
      grouped.general.push(ctx);
    }
  }

  return grouped;
}

/**
 * Infer section type from document content and metadata
 * Used when explicit section type is not available in metadata
 *
 * @param text - Document text content
 * @param documentType - Optional document type metadata
 * @returns Inferred section type or undefined
 */
function inferSectionType(text: string, documentType?: string): ControlSectionType | undefined {
  const textLower = text.toLowerCase();
  const docTypeLower = (documentType || '').toLowerCase();

  // Evidence indicators
  if (
    textLower.includes('evidence') ||
    textLower.includes('artifact') ||
    textLower.includes('documentation') ||
    textLower.includes('audit log') ||
    textLower.includes('record of') ||
    docTypeLower.includes('evidence')
  ) {
    return 'typical_evidence';
  }

  // Implementation indicators
  if (
    textLower.includes('implement') ||
    textLower.includes('configure') ||
    textLower.includes('deploy') ||
    textLower.includes('technical solution') ||
    textLower.includes('using') ||
    docTypeLower.includes('implementation')
  ) {
    return 'common_implementations';
  }

  // Control requirements indicators (from NIST control text)
  if (
    textLower.includes('the organization') ||
    textLower.includes('shall') ||
    textLower.includes('must') ||
    textLower.includes('require') ||
    textLower.includes('control text') ||
    docTypeLower.includes('control') ||
    docTypeLower.includes('800-53')
  ) {
    return 'control_requirements';
  }

  // Purpose/objective indicators
  if (
    textLower.includes('purpose') ||
    textLower.includes('objective') ||
    textLower.includes('intent') ||
    textLower.includes('goal') ||
    textLower.includes('protect') ||
    textLower.includes('ensure')
  ) {
    return 'purpose';
  }

  return undefined;
}

/**
 * Build formatted context sections for the prompt
 * Organizes context by section type with clear headers
 *
 * @param groupedContext - Context grouped by section type
 * @returns Formatted context string
 */
function buildContextSections(
  groupedContext: Record<ControlSectionType | 'general', StructuredControlQueryContext['retrievedContext']>
): string {
  const sections: string[] = [];

  // Add section-specific context with clear headers
  const sectionOrder: (ControlSectionType | 'general')[] = [
    'control_requirements',
    'purpose',
    'common_implementations',
    'typical_evidence',
    'general',
  ];

  for (const sectionType of sectionOrder) {
    const contextItems = groupedContext[sectionType];
    if (contextItems.length === 0) continue;

    const sectionLabel = sectionType === 'general'
      ? '[General Reference]'
      : `[${CONTROL_SECTION_HEADERS[sectionType].replace('## ', '')} Reference]`;

    for (const item of contextItems) {
      // Note: Relevance percentages removed to prevent false precision claims
      // Scores are still used internally for ranking but not exposed in prompts
      sections.push(`${sectionLabel}\n${item.text}`);
    }
  }

  return sections.join('\n\n---\n\n');
}

/**
 * Build a prompt for quick control overview
 * Simplified version for brief responses without full four-section structure
 *
 * @param query - User query
 * @param controlId - Control identifier
 * @param controlName - Control name
 * @param context - Retrieved context snippets
 * @returns Formatted prompt string
 */
export function buildQuickControlPrompt(
  query: string,
  controlId?: string,
  controlName?: string,
  context?: string[]
): string {
  const controlHeader = controlId
    ? `Control: ${controlId}${controlName ? ` - ${controlName}` : ''}\n\n`
    : '';

  const contextSection = context && context.length > 0
    ? `Reference:\n${context.map((c, i) => `${i + 1}. ${c}`).join('\n\n')}\n\n`
    : '';

  return `${controlHeader}${contextSection}Question: ${query}

Provide a concise answer (2-4 sentences) focusing on:
1. What the control requires
2. How it's typically implemented

Answer:`
}

