// Implementation Assistant
// Provides two AI-powered functions for control implementations:
// 1. Polish - Grammar/formatting improvements only (no content changes)
// 2. Recommend - Topology-aware implementation suggestions

import { getLLMServer } from './llamaServer';
import {
  buildTopologyContext,
  formatTopologyContextForPrompt,
  type TopologyContext,
} from './topologyContextBuilder';
// import { useFlowStore } from '@/core/stores/useFlowStore'; // Unused - kept for potential future use

// ============================================================================
// Types
// ============================================================================

export interface PolishRequest {
  controlId: string;
  controlTitle: string;
  existingImplementation: string;
}

export interface PolishResponse {
  polishedText: string;
}

export interface RecommendRequest {
  controlId: string;
  controlTitle: string;
  nistReference: string;
  existingImplementation?: string;
  projectId?: number | null;
}

export interface RecommendResponse {
  recommendedImplementation: string;
  usedTopology: boolean;
}

// ============================================================================
// Polish Implementation
// ============================================================================

/**
 * Polish existing implementation text - grammar and formatting only.
 * Does NOT change content, add information, or remove details.
 */
export async function polishImplementation(
  request: PolishRequest
): Promise<PolishResponse> {
  const { controlId, controlTitle, existingImplementation } = request;
  const llmServer = getLLMServer();

  if (!existingImplementation.trim()) {
    throw new Error('No implementation text provided to polish');
  }

  const prompt = buildPolishPrompt({
    controlId,
    controlTitle,
    existingImplementation,
  });

  try {
    const response = await llmServer.generate({
      prompt,
      temperature: 0.2, // Low temperature for consistent, conservative edits
      maxTokens: 800,
    });

    return {
      polishedText: response.text.trim(),
    };
  } catch (error) {
    throw new Error(
      `Failed to polish implementation: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Build prompt for grammar/formatting polish.
 * Strict instructions to preserve all content.
 */
function buildPolishPrompt(context: {
  controlId: string;
  controlTitle: string;
  existingImplementation: string;
}): string {
  const { controlId, controlTitle, existingImplementation } = context;

  return `You are a technical editor. Your ONLY task is to improve the grammar, punctuation, and formatting of the following system implementation text.

Control: ${controlId} - ${controlTitle}

STRICT RULES - YOU MUST FOLLOW:
1. DO NOT add any new information or details
2. DO NOT remove any information or details
3. DO NOT change the meaning of any sentence
4. DO NOT add compliance language or recommendations
5. DO NOT expand abbreviations unless they are grammatically incorrect
6. PRESERVE all specific names, numbers, dates, device names, and technical terms exactly

ALLOWED CHANGES:
- Fix grammar and punctuation errors
- Improve sentence structure for clarity
- Fix capitalization issues
- Improve paragraph breaks and formatting
- Fix spelling errors
- Make tense consistent (prefer present tense)

Original Implementation Text:
${existingImplementation}

Polished Implementation Text (same content, improved grammar/formatting):`;
}

// ============================================================================
// Recommend Implementation
// ============================================================================

/**
 * Generate a recommended implementation based on control requirements and topology.
 * Can work with blank implementations (generate fresh) or existing ones (rewrite/improve).
 */
export async function recommendImplementation(
  request: RecommendRequest
): Promise<RecommendResponse> {
  const { controlId, controlTitle, nistReference, existingImplementation, projectId } = request;
  const llmServer = getLLMServer();

  // Build topology context
  let topologyContext: TopologyContext | null = null;
  let topologyText = '';
  let usedTopology = false;

  try {
    topologyContext = await buildTopologyContext(projectId ?? null);
    if (topologyContext.devices.length > 0 || topologyContext.connections.length > 0) {
      topologyText = formatTopologyContextForPrompt(topologyContext);
      usedTopology = true;
    }
  } catch (error) {
    console.warn('[Implementation Assistant] Failed to build topology context:', error);
  }

  const prompt = buildRecommendPrompt({
    controlId,
    controlTitle,
    nistReference,
    existingImplementation,
    topologyText,
    hasTopology: usedTopology,
  });

  try {
    const response = await llmServer.generate({
      prompt,
      temperature: 0.4, // Moderate temperature for creative but focused output
      maxTokens: 1000,
    });

    return {
      recommendedImplementation: response.text.trim(),
      usedTopology,
    };
  } catch (error) {
    throw new Error(
      `Failed to generate recommendation: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Build prompt for topology-aware implementation recommendation.
 * Control-specific and context-aware.
 */
function buildRecommendPrompt(context: {
  controlId: string;
  controlTitle: string;
  nistReference: string;
  existingImplementation?: string;
  topologyText: string;
  hasTopology: boolean;
}): string {
  const {
    controlId,
    controlTitle,
    nistReference,
    existingImplementation,
    topologyText,
    hasTopology,
  } = context;

  const hasExisting = existingImplementation && existingImplementation.trim().length > 0;

  // Control family-specific guidance
  const familyGuidance = getControlFamilyGuidance(controlId);

  let prompt = `You are a NIST 800-53 compliance expert writing a System Security Plan (SSP) implementation narrative.

Control: ${controlId} - ${controlTitle}

NIST Control Requirements:
${nistReference}

${familyGuidance}
`;

  // Add topology context if available
  if (hasTopology && topologyText) {
    prompt += `
System Topology:
${topologyText}

Use the topology information above to make the implementation specific to this system's actual devices, connections, and security configurations.
`;
  } else {
    prompt += `
Note: No topology information available. Write a general implementation that can be customized later with specific device and system details.
`;
  }

  // Different instructions based on whether there's existing content
  if (hasExisting) {
    prompt += `
Current Implementation (needs improvement):
${existingImplementation}

TASK: Rewrite and improve this implementation to:
1. Better align with the NIST control requirements above
2. Reference specific devices and configurations from the topology (if available)
3. Use professional SSP compliance language
4. Be specific and evidence-based
5. Maintain any accurate details from the original

Write an improved implementation narrative (2-4 paragraphs):`;
  } else {
    prompt += `
TASK: Write a new implementation narrative that:
1. Describes how this control would be implemented in the system
2. References specific devices and configurations from the topology (if available)
3. Uses professional SSP compliance language
4. Is specific and evidence-based
5. Uses present tense ("The system implements..." not "The system will implement...")

Write the implementation narrative (2-4 paragraphs):`;
  }

  return prompt;
}

/**
 * Get control family-specific guidance for better recommendations.
 */
function getControlFamilyGuidance(controlId: string): string {
  const family = controlId.split('-')[0].toUpperCase();

  const familyGuidance: Record<string, string> = {
    AC: `Access Control Focus:
- Describe account management, authentication, and authorization mechanisms
- Reference user roles, permissions, and access approval processes
- Mention MFA, session controls, and remote access restrictions`,

    AT: `Awareness and Training Focus:
- Describe security training programs and frequency
- Reference role-based training requirements
- Mention training records and completion tracking`,

    AU: `Audit and Accountability Focus:
- Describe logging mechanisms and audit record content
- Reference log retention, protection, and review processes
- Mention SIEM or centralized log management`,

    CA: `Security Assessment Focus:
- Describe assessment procedures and frequency
- Reference POA&M processes and vulnerability management
- Mention continuous monitoring capabilities`,

    CM: `Configuration Management Focus:
- Describe baseline configurations and change control
- Reference configuration monitoring and deviation alerting
- Mention approved software and hardware inventories`,

    CP: `Contingency Planning Focus:
- Describe backup procedures and recovery capabilities
- Reference business continuity and disaster recovery plans
- Mention testing frequency and alternate processing sites`,

    IA: `Identification and Authentication Focus:
- Describe authenticator management and password policies
- Reference PKI, tokens, or biometric mechanisms
- Mention device and service authentication`,

    IR: `Incident Response Focus:
- Describe incident detection, reporting, and response procedures
- Reference incident response team and escalation paths
- Mention forensic and evidence handling capabilities`,

    MA: `Maintenance Focus:
- Describe maintenance procedures and authorization
- Reference remote maintenance controls
- Mention maintenance tools and personnel requirements`,

    MP: `Media Protection Focus:
- Describe media access controls and sanitization procedures
- Reference encryption requirements for portable media
- Mention media transport and storage protections`,

    PE: `Physical and Environmental Focus:
- Describe physical access controls and monitoring
- Reference environmental protections (power, fire, water)
- Mention visitor management and emergency procedures`,

    PL: `Planning Focus:
- Describe security planning processes
- Reference rules of behavior and acceptable use
- Mention privacy considerations`,

    PM: `Program Management Focus:
- Describe information security program elements
- Reference risk management strategy
- Mention enterprise architecture considerations`,

    PS: `Personnel Security Focus:
- Describe personnel screening and termination procedures
- Reference position risk designations
- Mention access agreements and third-party personnel`,

    RA: `Risk Assessment Focus:
- Describe risk assessment methodology and frequency
- Reference vulnerability scanning and penetration testing
- Mention threat intelligence and risk categorization`,

    SA: `System and Services Acquisition Focus:
- Describe acquisition processes and security requirements
- Reference developer security testing requirements
- Mention supply chain risk management`,

    SC: `System and Communications Protection Focus:
- Describe boundary protection and network segmentation
- Reference encryption (at rest and in transit)
- Mention denial of service protection and trusted paths`,

    SI: `System and Information Integrity Focus:
- Describe malware protection and software updates
- Reference security alerting and monitoring
- Mention error handling and input validation`,

    SR: `Supply Chain Risk Management Focus:
- Describe supply chain security requirements
- Reference supplier assessments and monitoring
- Mention component authenticity verification`,
  };

  return familyGuidance[family] || `General Guidance:
- Describe specific technical and procedural controls
- Reference system components and responsible parties
- Provide evidence-based implementation details`;
}

// ============================================================================
// Streaming variants (for future use)
// ============================================================================

/**
 * Stream polish implementation for real-time updates
 */
export async function* polishImplementationStream(
  request: PolishRequest
): AsyncGenerator<string, void, unknown> {
  const { controlId, controlTitle, existingImplementation } = request;
  const llmServer = getLLMServer();

  if (!existingImplementation.trim()) {
    throw new Error('No implementation text provided to polish');
  }

  const prompt = buildPolishPrompt({
    controlId,
    controlTitle,
    existingImplementation,
  });

  yield* llmServer.generateStream({
    prompt,
    temperature: 0.2,
    maxTokens: 800,
  });
}

/**
 * Stream recommend implementation for real-time updates
 */
export async function* recommendImplementationStream(
  request: RecommendRequest
): AsyncGenerator<string, void, unknown> {
  const { controlId, controlTitle, nistReference, existingImplementation, projectId } = request;
  const llmServer = getLLMServer();

  // Build topology context
  let topologyContext: TopologyContext | null = null;
  let topologyText = '';
  let usedTopology = false;

  try {
    topologyContext = await buildTopologyContext(projectId ?? null);
    if (topologyContext.devices.length > 0 || topologyContext.connections.length > 0) {
      topologyText = formatTopologyContextForPrompt(topologyContext);
      usedTopology = true;
    }
  } catch (error) {
    console.warn('[Implementation Assistant] Failed to build topology context:', error);
  }

  const prompt = buildRecommendPrompt({
    controlId,
    controlTitle,
    nistReference,
    existingImplementation,
    topologyText,
    hasTopology: usedTopology,
  });

  yield* llmServer.generateStream({
    prompt,
    temperature: 0.4,
    maxTokens: 1000,
  });
}

