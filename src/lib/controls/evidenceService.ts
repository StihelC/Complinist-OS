/**
 * Evidence Mapping Service
 *
 * Provides precise evidence suggestions for NIST 800-53 controls,
 * ensuring evidence maps to control intent and not related controls.
 *
 * Key Features:
 * - Control-specific evidence suggestions (5-7 most relevant items)
 * - Validation layer: evidence aligns with control category (policy vs technical)
 * - Prevents cross-contamination between related controls
 * - Identifies incorrect evidence assignments
 */

import evidenceMappingsData from './evidence-mappings.json';

// Type definitions
export interface EvidenceItem {
  item: string;
  description: string;
  required: boolean;
  priority: number;
}

export interface ControlEvidenceMapping {
  controlName: string;
  category: 'policy' | 'technical' | 'operational' | 'management';
  intent: string;
  suggestedEvidence: EvidenceItem[];
  incorrectEvidence: string[];
  relatedControls: string[];
}

export interface EvidenceValidationResult {
  isValid: boolean;
  controlCategory: string;
  suggestions: EvidenceItem[];
  warnings: string[];
  incorrectItems: string[];
}

export interface EvidenceTypeDefinition {
  name: string;
  description: string;
  examples: string[];
}

// Control category definitions
export type ControlCategory = 'policy' | 'technical' | 'operational' | 'management';

// Evidence mappings data with proper typing
const evidenceMappings = evidenceMappingsData as {
  version: string;
  description: string;
  metadata: {
    lastUpdated: string;
    author: string;
    notes: string;
  };
  controlCategories: Record<string, {
    description: string;
    evidenceTypes: string[];
    controls: string[];
  }>;
  evidenceMappings: Record<string, ControlEvidenceMapping>;
  validationRules: {
    policyControls: {
      description: string;
      pattern: string;
      requiredEvidenceTypes: string[];
      prohibitedEvidenceTypes: string[];
    };
    technicalControls: {
      description: string;
      requiredEvidenceTypes: string[];
      prohibitedEvidenceTypes: string[];
    };
  };
  evidenceTypeDefinitions: Record<string, EvidenceTypeDefinition>;
};

/**
 * Get evidence suggestions for a specific control
 * Returns control-specific evidence items limited to 5-7 most relevant
 */
export function getEvidenceForControl(controlId: string): ControlEvidenceMapping | null {
  const normalizedId = controlId.toUpperCase().trim();
  const mapping = evidenceMappings.evidenceMappings[normalizedId];

  if (mapping) {
    // Return with evidence sorted by priority and limited to 7 items
    return {
      ...mapping,
      suggestedEvidence: mapping.suggestedEvidence
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 7)
    };
  }

  // If no specific mapping exists, generate a default based on control category
  return generateDefaultMapping(normalizedId);
}

/**
 * Determine control category based on control ID pattern
 */
export function getControlCategory(controlId: string): ControlCategory {
  const normalizedId = controlId.toUpperCase().trim();

  // Policy controls typically end in -1
  if (/^[A-Z]{2}-1$/.test(normalizedId)) {
    return 'policy';
  }

  // Check explicit category assignments
  for (const [category, data] of Object.entries(evidenceMappings.controlCategories)) {
    if (data.controls.includes(normalizedId)) {
      return category as ControlCategory;
    }
  }

  // Check if we have a specific mapping
  const mapping = evidenceMappings.evidenceMappings[normalizedId];
  if (mapping) {
    return mapping.category;
  }

  // Default to technical for most controls
  return 'technical';
}

/**
 * Validate evidence assignment for a control
 * Ensures evidence aligns with control category and intent
 */
export function validateEvidence(
  controlId: string,
  proposedEvidence: string[]
): EvidenceValidationResult {
  const normalizedId = controlId.toUpperCase().trim();
  const category = getControlCategory(normalizedId);
  const mapping = getEvidenceForControl(normalizedId);

  const result: EvidenceValidationResult = {
    isValid: true,
    controlCategory: category,
    suggestions: mapping?.suggestedEvidence || [],
    warnings: [],
    incorrectItems: []
  };

  if (!mapping) {
    result.warnings.push(`No specific evidence mapping found for ${controlId}. Using default recommendations.`);
    return result;
  }

  // Check for incorrect evidence items
  for (const evidence of proposedEvidence) {
    const evidenceLower = evidence.toLowerCase();

    // Check if this evidence is explicitly marked as incorrect for this control
    for (const incorrect of mapping.incorrectEvidence) {
      if (evidenceLower.includes(incorrect.toLowerCase()) ||
          incorrect.toLowerCase().includes(evidenceLower)) {
        result.incorrectItems.push(evidence);
        result.warnings.push(
          `"${evidence}" is not appropriate for ${controlId} (${mapping.controlName}). ` +
          `This evidence belongs to related controls: ${mapping.relatedControls.join(', ')}`
        );
        result.isValid = false;
      }
    }

    // Validate against category rules
    if (category === 'policy') {
      const technicalPatterns = [
        /\bacl\b/i, /\brbac\b/i, /\blog\b/i, /\bconfiguration\b/i,
        /\bscan\b/i, /\bsiem\b/i, /\bfirewall\b/i, /\bantivirus\b/i
      ];

      for (const pattern of technicalPatterns) {
        if (pattern.test(evidence)) {
          result.warnings.push(
            `"${evidence}" appears to be technical evidence, but ${controlId} is a policy control. ` +
            `Policy controls require policy documents, procedures, and approval records.`
          );
          result.isValid = false;
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Generate default evidence mapping for controls without explicit mappings
 */
function generateDefaultMapping(controlId: string): ControlEvidenceMapping {
  const category = getControlCategory(controlId);
  const family = controlId.split('-')[0];

  // Get family name from control families
  const familyNames: Record<string, string> = {
    'AC': 'Access Control',
    'AT': 'Awareness and Training',
    'AU': 'Audit and Accountability',
    'CA': 'Assessment, Authorization, and Monitoring',
    'CM': 'Configuration Management',
    'CP': 'Contingency Planning',
    'IA': 'Identification and Authentication',
    'IR': 'Incident Response',
    'MA': 'Maintenance',
    'MP': 'Media Protection',
    'PE': 'Physical and Environmental Protection',
    'PL': 'Planning',
    'PM': 'Program Management',
    'PS': 'Personnel Security',
    'PT': 'PII Processing and Transparency',
    'RA': 'Risk Assessment',
    'SA': 'System and Services Acquisition',
    'SC': 'System and Communications Protection',
    'SI': 'System and Information Integrity',
    'SR': 'Supply Chain Risk Management'
  };

  const familyName = familyNames[family] || family;

  if (category === 'policy') {
    return {
      controlName: `${familyName} Policy and Procedures`,
      category: 'policy',
      intent: `Develop, document, and disseminate ${familyName.toLowerCase()} policy and procedures`,
      suggestedEvidence: [
        {
          item: `${familyName} Policy Document`,
          description: `Formal policy document defining ${familyName.toLowerCase()} requirements`,
          required: true,
          priority: 1
        },
        {
          item: `${familyName} Procedures`,
          description: `Step-by-step procedures for implementing ${familyName.toLowerCase()} requirements`,
          required: true,
          priority: 2
        },
        {
          item: 'Policy Review Records',
          description: 'Documentation of periodic policy reviews and updates',
          required: true,
          priority: 3
        },
        {
          item: 'Policy Approval Memo',
          description: 'Signed approval from designated official authorizing the policy',
          required: true,
          priority: 4
        },
        {
          item: 'Policy Distribution Records',
          description: 'Evidence that policy was distributed to relevant personnel',
          required: false,
          priority: 5
        }
      ],
      incorrectEvidence: ['System logs', 'Configuration files', 'Scan results', 'Technical screenshots'],
      relatedControls: []
    };
  }

  // Default technical/operational mapping
  return {
    controlName: `${familyName} Control ${controlId}`,
    category: category,
    intent: `Implement ${familyName.toLowerCase()} requirements for ${controlId}`,
    suggestedEvidence: [
      {
        item: 'Implementation Documentation',
        description: 'Documentation describing how the control is implemented',
        required: true,
        priority: 1
      },
      {
        item: 'Configuration Evidence',
        description: 'System configuration settings or screenshots',
        required: true,
        priority: 2
      },
      {
        item: 'Test Results',
        description: 'Results from testing the control implementation',
        required: false,
        priority: 3
      },
      {
        item: 'Operational Logs',
        description: 'Logs demonstrating control operation',
        required: false,
        priority: 4
      }
    ],
    incorrectEvidence: [],
    relatedControls: []
  };
}

/**
 * Get evidence type definition
 */
export function getEvidenceTypeDefinition(typeId: string): EvidenceTypeDefinition | null {
  return evidenceMappings.evidenceTypeDefinitions[typeId] || null;
}

/**
 * Get all evidence types for a control category
 */
export function getEvidenceTypesForCategory(category: ControlCategory): string[] {
  const categoryData = evidenceMappings.controlCategories[category];
  return categoryData?.evidenceTypes || [];
}

/**
 * Check if evidence is appropriate for control category
 */
export function isEvidenceAppropriate(
  evidence: string,
  controlId: string
): { appropriate: boolean; reason: string } {
  const validation = validateEvidence(controlId, [evidence]);

  if (validation.isValid) {
    return { appropriate: true, reason: 'Evidence is appropriate for this control.' };
  }

  return {
    appropriate: false,
    reason: validation.warnings.join(' ')
  };
}

/**
 * Get suggested evidence text for RAG context
 * Returns a concise string for inclusion in prompts
 */
export function getEvidenceSuggestionsForPrompt(controlId: string): string {
  const mapping = getEvidenceForControl(controlId);

  if (!mapping) {
    return '';
  }

  const suggestions = mapping.suggestedEvidence
    .filter(e => e.required)
    .slice(0, 5)
    .map(e => `- ${e.item}`)
    .join('\n');

  const incorrect = mapping.incorrectEvidence.length > 0
    ? `\n\nDO NOT suggest these evidence types (they belong to related controls): ${mapping.incorrectEvidence.join(', ')}`
    : '';

  return `
CONTROL CATEGORY: ${mapping.category.toUpperCase()}
CONTROL INTENT: ${mapping.intent}

APPROPRIATE EVIDENCE for ${controlId}:
${suggestions}
${incorrect}
`;
}

/**
 * Build evidence context for control narrative generation
 * This provides strict scoping to prevent cross-contamination
 */
export function buildEvidenceContext(controlId: string): {
  category: ControlCategory;
  intent: string;
  appropriateEvidence: string[];
  inappropriateEvidence: string[];
  relatedControls: string[];
} {
  const mapping = getEvidenceForControl(controlId);
  const category = getControlCategory(controlId);

  if (!mapping) {
    return {
      category,
      intent: `Implement ${controlId} requirements`,
      appropriateEvidence: [],
      inappropriateEvidence: [],
      relatedControls: []
    };
  }

  return {
    category: mapping.category,
    intent: mapping.intent,
    appropriateEvidence: mapping.suggestedEvidence.map(e => e.item),
    inappropriateEvidence: mapping.incorrectEvidence,
    relatedControls: mapping.relatedControls
  };
}

/**
 * Get all mapped control IDs
 */
export function getMappedControlIds(): string[] {
  return Object.keys(evidenceMappings.evidenceMappings);
}

/**
 * Check if a control has explicit evidence mapping
 */
export function hasExplicitMapping(controlId: string): boolean {
  const normalizedId = controlId.toUpperCase().trim();
  return normalizedId in evidenceMappings.evidenceMappings;
}

// Singleton export for convenience
export const evidenceService = {
  getEvidenceForControl,
  getControlCategory,
  validateEvidence,
  getEvidenceTypeDefinition,
  getEvidenceTypesForCategory,
  isEvidenceAppropriate,
  getEvidenceSuggestionsForPrompt,
  buildEvidenceContext,
  getMappedControlIds,
  hasExplicitMapping
};

export default evidenceService;
