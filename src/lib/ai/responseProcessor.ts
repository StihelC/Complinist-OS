// Response Processor
// Validates and processes LLM responses
// Supports four-section structured control responses

import type { AppNode } from '@/lib/utils/types';
import type { ControlSectionType } from './types';
import { CONTROL_SECTION_HEADERS } from './promptTemplates';

export interface ProcessedNarrative {
  text: string;
  isValid: boolean;
  warnings: string[];
  deviceReferences: string[];
  boundaryReferences: string[];
}

/**
 * Structured control response format for RMF-friendly output
 * @deprecated Use FourSectionControlResponse for new implementations
 */
export interface StructuredControlResponse {
  shortDefinition: string;
  controlRequirements: string[];
  commonImplementations: string[];
  typicalEvidence: string[];
  rawText: string;
}

/**
 * Four-section structured control response format
 * Matches assessor workflow: intent → requirement → implementation → evidence
 */
export interface FourSectionControlResponse {
  purpose: string;
  controlRequirements: string[];
  commonImplementations: string[];
  typicalEvidence: string[];
  rawText: string;
  isValid: boolean;
  missingSections: ControlSectionType[];
}

/**
 * Token limits per section to prevent over-verbose generations
 */
const SECTION_TOKEN_LIMITS = {
  shortDefinition: 50,      // ~25 words
  controlRequirements: 200, // ~100 words (5-6 bullets)
  commonImplementations: 150, // ~75 words (4-5 bullets)
  typicalEvidence: 100,     // ~50 words (3-4 bullets)
};

/**
 * Strip percentage-based relevance/match claims from AI-generated text
 * These claims often appear to be precise but are not backed by real computation
 * Examples removed: "89.6% relevant", "match 92%", "similarity: 85%"
 */
export function stripPercentageClaims(text: string): string {
  if (!text) return text;

  let processed = text;

  // Pattern 1: "X% relevant" or "X% match" or "X% similarity"
  processed = processed.replace(/\b\d+(\.\d+)?%\s*(relevant|match|similarity|matching|related|accurate|confidence)\b/gi, '');

  // Pattern 2: "(relevance: X%)" or "(similarity: X%)" or "(match: X%)"
  processed = processed.replace(/\(\s*(relevance|similarity|match|score|confidence)\s*:\s*\d+(\.\d+)?%\s*\)/gi, '');

  // Pattern 3: "relevance of X%" or "similarity of X%" or "similarity: X%"
  processed = processed.replace(/\b(relevance|similarity|match|score)\s*(of|:)\s*\d+(\.\d+)?%/gi, '');

  // Pattern 4: Standalone percentage claims in context like "at 85%", "with 92%"
  processed = processed.replace(/\b(at|with|shows?|has|scored?)\s+\d+(\.\d+)?%\s*(relevance|match|similarity)?/gi, '');

  // Clean up any double spaces left behind
  processed = processed.replace(/\s{2,}/g, ' ');

  // Clean up any orphaned punctuation
  processed = processed.replace(/,\s*,/g, ',');
  processed = processed.replace(/\.\s*\./g, '.');

  return processed.trim();
}

/**
 * Post-process AI-generated control response to remove duplicate control text
 * and ensure consistent, scannable format
 */
export function postProcessControlResponse(rawText: string, controlId?: string): string {
  if (!rawText || rawText.trim().length === 0) {
    return rawText;
  }

  let processed = rawText.trim();

  // First, strip any percentage-based claims that may have been hallucinated
  processed = stripPercentageClaims(processed);

  // Remove common duplicate patterns
  // Pattern 1: Control ID repeated multiple times in text (e.g., "AC-2 Account Management... AC-2 Account Management")
  if (controlId) {
    const controlIdPattern = new RegExp(`(${escapeRegExp(controlId)}[^.]*?\\.)(\\s*${escapeRegExp(controlId)}[^.]*?\\.)+`, 'gi');
    processed = processed.replace(controlIdPattern, '$1');
  }

  // Pattern 2: Repeated section headers
  processed = processed.replace(/(\*\*[^*]+\*\*:?\s*\n?)(\1)+/gi, '$1');

  // Pattern 3: Duplicate bullet points (exact matches)
  const lines = processed.split('\n');
  const seenBullets = new Set<string>();
  const deduplicatedLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    // Check if this is a bullet point
    if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*')) {
      const normalizedBullet = trimmedLine.toLowerCase().replace(/^[-•*]\s*/, '').trim();
      if (!seenBullets.has(normalizedBullet)) {
        seenBullets.add(normalizedBullet);
        deduplicatedLines.push(line);
      }
    } else {
      deduplicatedLines.push(line);
    }
  }
  processed = deduplicatedLines.join('\n');

  // Pattern 4: Remove excessive whitespace
  processed = processed.replace(/\n{3,}/g, '\n\n');

  // Pattern 5: Remove repetitive introductory phrases
  const repetitivePatterns = [
    /^(The\s+)?control\s+requires\s+(that\s+)?(the\s+)?organization(s)?\s+to\s+/gi,
    /^This\s+control\s+focuses\s+on\s+/gi,
    /^The\s+purpose\s+of\s+this\s+control\s+is\s+to\s+/gi,
  ];

  for (const pattern of repetitivePatterns) {
    // Only remove from the beginning of sections, not everywhere
    const sections = processed.split(/\*\*/);
    processed = sections.map((section, idx) => {
      if (idx === 0) return section;
      return section.replace(pattern, '');
    }).join('**');
  }

  return processed.trim();
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse structured control response from raw text
 * Extracts sections based on expected format
 */
export function parseStructuredControlResponse(rawText: string): StructuredControlResponse {
  const result: StructuredControlResponse = {
    shortDefinition: '',
    controlRequirements: [],
    commonImplementations: [],
    typicalEvidence: [],
    rawText: rawText,
  };

  if (!rawText || rawText.trim().length === 0) {
    return result;
  }

  // Extract Short Definition
  const definitionMatch = rawText.match(/\*\*Short Definition\*\*:?\s*([^\n*]+)/i);
  if (definitionMatch) {
    result.shortDefinition = definitionMatch[1].trim();
  }

  // Extract Control Requirements
  result.controlRequirements = extractBulletSection(rawText, 'Control Requirements');

  // Extract Common Implementations
  result.commonImplementations = extractBulletSection(rawText, 'Common Implementations');

  // Extract Typical Evidence
  result.typicalEvidence = extractBulletSection(rawText, 'Typical Evidence');

  return result;
}

/**
 * Extract bullet points from a named section
 */
function extractBulletSection(text: string, sectionName: string): string[] {
  const bullets: string[] = [];

  // Find the section
  const sectionPattern = new RegExp(`\\*\\*${escapeRegExp(sectionName)}\\*\\*:?\\s*\\n([\\s\\S]*?)(?=\\*\\*|$)`, 'i');
  const sectionMatch = text.match(sectionPattern);

  if (sectionMatch) {
    const sectionContent = sectionMatch[1];
    const lines = sectionContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*')) {
        const bulletContent = trimmedLine.replace(/^[-•*]\s*/, '').trim();
        if (bulletContent.length > 0) {
          bullets.push(bulletContent);
        }
      }
    }
  }

  return bullets;
}

/**
 * Validate and truncate sections to token limits
 * Returns processed text with sections trimmed to appropriate lengths
 */
export function enforceTokenLimits(parsedResponse: StructuredControlResponse): StructuredControlResponse {
  const result = { ...parsedResponse };

  // Truncate short definition if too long (~4 chars per token approximation)
  const maxDefChars = SECTION_TOKEN_LIMITS.shortDefinition * 4;
  if (result.shortDefinition.length > maxDefChars) {
    result.shortDefinition = truncateToSentence(result.shortDefinition, maxDefChars);
  }

  // Limit number of bullets per section
  result.controlRequirements = limitBullets(result.controlRequirements, 6, SECTION_TOKEN_LIMITS.controlRequirements);
  result.commonImplementations = limitBullets(result.commonImplementations, 5, SECTION_TOKEN_LIMITS.commonImplementations);
  result.typicalEvidence = limitBullets(result.typicalEvidence, 4, SECTION_TOKEN_LIMITS.typicalEvidence);

  return result;
}

/**
 * Truncate text to a complete sentence within character limit
 */
function truncateToSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  // Find the last sentence-ending punctuation before the limit
  const truncated = text.substring(0, maxChars);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?')
  );

  if (lastSentenceEnd > maxChars * 0.5) {
    return truncated.substring(0, lastSentenceEnd + 1);
  }

  // If no good sentence break, just truncate with ellipsis
  return truncated.trim() + '...';
}

/**
 * Limit number of bullets and total characters in a section
 */
function limitBullets(bullets: string[], maxCount: number, maxTokens: number): string[] {
  const maxChars = maxTokens * 4;
  const result: string[] = [];
  let totalChars = 0;

  for (const bullet of bullets.slice(0, maxCount)) {
    if (totalChars + bullet.length <= maxChars) {
      result.push(bullet);
      totalChars += bullet.length;
    } else if (result.length === 0) {
      // At least include one truncated bullet
      result.push(truncateToSentence(bullet, maxChars));
      break;
    }
  }

  return result;
}

/**
 * Reconstruct formatted text from parsed structured response
 */
export function formatStructuredResponse(parsed: StructuredControlResponse): string {
  let formatted = '';

  if (parsed.shortDefinition) {
    formatted += `**Short Definition**: ${parsed.shortDefinition}\n\n`;
  }

  if (parsed.controlRequirements.length > 0) {
    formatted += `**Control Requirements**:\n`;
    formatted += parsed.controlRequirements.map(r => `- ${r}`).join('\n');
    formatted += '\n\n';
  }

  if (parsed.commonImplementations.length > 0) {
    formatted += `**Common Implementations**:\n`;
    formatted += parsed.commonImplementations.map(i => `- ${i}`).join('\n');
    formatted += '\n\n';
  }

  if (parsed.typicalEvidence.length > 0) {
    formatted += `**Typical Evidence**:\n`;
    formatted += parsed.typicalEvidence.map(e => `- ${e}`).join('\n');
  }

  return formatted.trim();
}

export function processNarrativeResponse(
  rawText: string,
  nodes: AppNode[],
  controlId: string
): ProcessedNarrative {
  const warnings: string[] = [];
  const deviceReferences: string[] = [];
  const boundaryReferences: string[] = [];

  // Extract device references
  const deviceNames = nodes
    .filter((node) => node.type === 'device' || !node.type)
    .map((node) => {
      const name = (node.data as any)?.name || (node.data as any)?.hostname;
      return name ? name.toLowerCase() : null;
    })
    .filter(Boolean) as string[];

  // Extract boundary references
  const boundaryNames = nodes
    .filter((node) => node.type === 'boundary')
    .map((node) => {
      const label = (node.data as any)?.label;
      return label ? label.toLowerCase() : null;
    })
    .filter(Boolean) as string[];

  // Check for device references in narrative
  const textLower = rawText.toLowerCase();
  deviceNames.forEach((name) => {
    if (textLower.includes(name)) {
      deviceReferences.push(name);
    }
  });

  // Check for boundary references in narrative
  boundaryNames.forEach((name) => {
    if (textLower.includes(name)) {
      boundaryReferences.push(name);
    }
  });

  // Validate narrative completeness
  const wordCount = rawText.split(/\s+/).length;
  if (wordCount < 50) {
    warnings.push('Narrative is very short and may lack detail');
  }
  if (wordCount > 800) {
    warnings.push('Narrative is very long and may exceed typical SSP requirements');
  }

  // Check for control ID mention
  if (!textLower.includes(controlId.toLowerCase())) {
    warnings.push('Narrative does not explicitly mention the control ID');
  }

  // Check for evidence indicators
  const evidenceKeywords = ['implements', 'enforces', 'configures', 'monitors', 'requires', 'ensures'];
  const hasEvidence = evidenceKeywords.some((keyword) => textLower.includes(keyword));
  if (!hasEvidence) {
    warnings.push('Narrative may lack specific implementation evidence');
  }

  // Check for hallucinated device names (devices mentioned but not in topology)
  const mentionedDevices = extractDeviceNames(rawText);
  const hallucinatedDevices = mentionedDevices.filter(
    (name) => !deviceNames.some((dn) => dn.includes(name.toLowerCase()) || name.toLowerCase().includes(dn))
  );
  if (hallucinatedDevices.length > 0) {
    warnings.push(`Potential hallucinated device names: ${hallucinatedDevices.join(', ')}`);
  }

  // Clean up the text
  let cleanedText = rawText.trim();
  
  // Remove common LLM artifacts
  cleanedText = cleanedText.replace(/^Here's.*?:/i, '');
  cleanedText = cleanedText.replace(/^The following.*?:/i, '');
  cleanedText = cleanedText.replace(/^Narrative:/i, '');
  cleanedText = cleanedText.trim();

  // Ensure it ends with proper punctuation
  if (cleanedText && !cleanedText.match(/[.!?]$/)) {
    cleanedText += '.';
  }

  return {
    text: cleanedText,
    isValid: warnings.length === 0 || warnings.filter((w) => !w.includes('hallucinated')).length === 0,
    warnings,
    deviceReferences,
    boundaryReferences,
  };
}

function extractDeviceNames(text: string): string[] {
  // Simple heuristic: look for capitalized words that might be device names
  // This is a basic implementation - could be improved with NLP
  // const words = text.split(/\s+/); // Unused - kept for potential future use
  const potentialNames: string[] = [];

  // Look for patterns like "FW-1", "Server-01", "AD-01", etc.
  const devicePattern = /\b[A-Z][A-Z0-9-]+\b/g;
  const matches = text.match(devicePattern);
  if (matches) {
    potentialNames.push(...matches);
  }

  return [...new Set(potentialNames)];
}

export function scoreNarrativeCompleteness(narrative: string, controlId: string): number {
  let score = 0;
  const text = narrative.toLowerCase();

  // Check for control ID mention (10 points)
  if (text.includes(controlId.toLowerCase())) {
    score += 10;
  }

  // Check for implementation verbs (20 points)
  const implementationVerbs = ['implements', 'enforces', 'configures', 'monitors', 'requires', 'ensures', 'provides', 'maintains'];
  const verbCount = implementationVerbs.filter((verb) => text.includes(verb)).length;
  score += Math.min(verbCount * 5, 20);

  // Check for device/boundary references (20 points)
  const hasDeviceRefs = /\b(firewall|server|router|switch|device|system)\b/i.test(text);
  if (hasDeviceRefs) {
    score += 20;
  }

  // Check for security terms (20 points)
  const securityTerms = ['encryption', 'authentication', 'access', 'monitoring', 'logging', 'audit', 'compliance'];
  const termCount = securityTerms.filter((term) => text.includes(term)).length;
  score += Math.min(termCount * 5, 20);

  // Check for appropriate length (30 points)
  const wordCount = narrative.split(/\s+/).length;
  if (wordCount >= 100 && wordCount <= 500) {
    score += 30;
  } else if (wordCount >= 50 && wordCount < 100) {
    score += 20;
  } else if (wordCount >= 500 && wordCount <= 800) {
    score += 15;
  }

  return Math.min(score, 100);
}

/**
 * Parse four-section structured control response from raw text
 * Extracts sections based on the ## header format
 *
 * Expected format:
 * ## Purpose
 * ...content...
 *
 * ## Control Requirements
 * - bullet points
 *
 * ## Common Implementations
 * - bullet points
 *
 * ## Typical Evidence
 * - bullet points
 */
export function parseFourSectionControlResponse(rawText: string): FourSectionControlResponse {
  const result: FourSectionControlResponse = {
    purpose: '',
    controlRequirements: [],
    commonImplementations: [],
    typicalEvidence: [],
    rawText: rawText,
    isValid: false,
    missingSections: [],
  };

  if (!rawText || rawText.trim().length === 0) {
    result.missingSections = ['purpose', 'control_requirements', 'common_implementations', 'typical_evidence'];
    return result;
  }

  // Extract Purpose section
  result.purpose = extractSectionContent(rawText, CONTROL_SECTION_HEADERS.purpose);
  if (!result.purpose) {
    result.missingSections.push('purpose');
  }

  // Extract Control Requirements section
  result.controlRequirements = extractBulletSectionByHeader(rawText, CONTROL_SECTION_HEADERS.control_requirements);
  if (result.controlRequirements.length === 0) {
    result.missingSections.push('control_requirements');
  }

  // Extract Common Implementations section
  result.commonImplementations = extractBulletSectionByHeader(rawText, CONTROL_SECTION_HEADERS.common_implementations);
  if (result.commonImplementations.length === 0) {
    result.missingSections.push('common_implementations');
  }

  // Extract Typical Evidence section
  result.typicalEvidence = extractBulletSectionByHeader(rawText, CONTROL_SECTION_HEADERS.typical_evidence);
  if (result.typicalEvidence.length === 0) {
    result.missingSections.push('typical_evidence');
  }

  // Response is valid if it has at least 2 sections populated
  result.isValid = result.missingSections.length <= 2;

  return result;
}

/**
 * Extract content from a section with ## header format
 * Returns the text content between the header and the next ## header
 */
function extractSectionContent(text: string, header: string): string {
  // Escape special regex characters in the header
  const escapedHeader = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match the section content between this header and the next ## header (or end of text)
  const sectionPattern = new RegExp(`${escapedHeader}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  const match = text.match(sectionPattern);

  if (match && match[1]) {
    // Clean up the content - remove bullet points and trim
    let content = match[1].trim();

    // If the content is just bullet points, combine them into prose
    const lines = content.split('\n').filter(line => line.trim());
    const isBulletList = lines.every(line => /^[-•*]/.test(line.trim()));

    if (isBulletList) {
      // Convert bullet list to prose
      content = lines
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .join(' ');
    }

    return content;
  }

  return '';
}

/**
 * Extract bullet points from a section with ## header format
 */
function extractBulletSectionByHeader(text: string, header: string): string[] {
  const bullets: string[] = [];

  // Escape special regex characters in the header
  const escapedHeader = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match the section content between this header and the next ## header (or end of text)
  const sectionPattern = new RegExp(`${escapedHeader}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  const match = text.match(sectionPattern);

  if (match && match[1]) {
    const sectionContent = match[1];
    const lines = sectionContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*')) {
        const bulletContent = trimmedLine.replace(/^[-•*]\s*/, '').trim();
        if (bulletContent.length > 0) {
          bullets.push(bulletContent);
        }
      }
    }
  }

  return bullets;
}

/**
 * Format a four-section control response back to markdown
 */
export function formatFourSectionResponse(parsed: FourSectionControlResponse): string {
  let formatted = '';

  if (parsed.purpose) {
    formatted += `${CONTROL_SECTION_HEADERS.purpose}\n${parsed.purpose}\n\n`;
  }

  if (parsed.controlRequirements.length > 0) {
    formatted += `${CONTROL_SECTION_HEADERS.control_requirements}\n`;
    formatted += parsed.controlRequirements.map(r => `- ${r}`).join('\n');
    formatted += '\n\n';
  }

  if (parsed.commonImplementations.length > 0) {
    formatted += `${CONTROL_SECTION_HEADERS.common_implementations}\n`;
    formatted += parsed.commonImplementations.map(i => `- ${i}`).join('\n');
    formatted += '\n\n';
  }

  if (parsed.typicalEvidence.length > 0) {
    formatted += `${CONTROL_SECTION_HEADERS.typical_evidence}\n`;
    formatted += parsed.typicalEvidence.map(e => `- ${e}`).join('\n');
  }

  return formatted.trim();
}

/**
 * Validate and enhance a four-section control response
 * Adds missing sections with placeholder text if needed
 */
export function validateFourSectionResponse(
  parsed: FourSectionControlResponse,
  controlId?: string
): FourSectionControlResponse {
  const result = { ...parsed };

  // Add placeholder content for missing sections
  if (!result.purpose && controlId) {
    result.purpose = `This control establishes security requirements for ${controlId}.`;
  }

  if (result.controlRequirements.length === 0) {
    result.controlRequirements = ['Refer to NIST 800-53 documentation for specific control requirements.'];
  }

  if (result.commonImplementations.length === 0) {
    result.commonImplementations = ['Implementation details vary by organization and system context.'];
  }

  if (result.typicalEvidence.length === 0) {
    result.typicalEvidence = ['Evidence requirements depend on the organization\'s assessment procedures.'];
  }

  // Mark as valid after enhancement
  result.isValid = true;
  result.missingSections = [];

  return result;
}

/**
 * Check if a response appears to have four-section structure
 * Used to detect whether to apply four-section parsing
 */
export function hasFourSectionStructure(text: string): boolean {
  if (!text) return false;

  const textLower = text.toLowerCase();

  // Check for presence of the expected section headers
  const headers = Object.values(CONTROL_SECTION_HEADERS);
  const foundHeaders = headers.filter(header =>
    textLower.includes(header.toLowerCase())
  );

  // Consider it four-section if at least 2 headers are present
  return foundHeaders.length >= 2;
}

