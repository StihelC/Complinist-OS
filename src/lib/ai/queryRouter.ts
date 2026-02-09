// Query Router
// Analyzes user queries and routes them to the appropriate AI handler
// Supports: NIST docs, topology queries, narrative generation, general questions

export type QueryType = 'nist-docs' | 'topology' | 'narrative' | 'general';

export interface QueryRouteDecision {
  type: QueryType;
  confidence: number; // 0-1
  parameters: {
    // For topology queries
    deviceNames?: string[];
    controlIds?: string[];
    focusArea?: 'devices' | 'connections' | 'controls' | 'general';

    // For narrative queries
    narrativeControlId?: string;

    // For NIST doc queries
    documentTypes?: string[];
    families?: string[];
  };
}

// Keywords that strongly suggest NIST document queries
const NIST_DOC_KEYWORDS = [
  'what is ac-',
  'what is au-',
  'what is at-',
  'what is ca-',
  'what is cm-',
  'what is cp-',
  'what is ia-',
  'what is ir-',
  'what is ma-',
  'what is mp-',
  'what is pe-',
  'what is pl-',
  'what is ps-',
  'what is pt-',
  'what is ra-',
  'what is sa-',
  'what is sc-',
  'what is si-',
  'what is sr-',
  'explain control',
  'explain nist',
  'nist 800-53',
  'nist 800-171',
  'nist csf',
  'cmmc',
  'framework',
  'baseline',
  'moderate baseline',
  'high baseline',
  'low baseline',
  'requirements for',
  'guidance for',
  'standard',
  'compliance framework',
  'security control family',
];

// Keywords that suggest topology/device queries
const TOPOLOGY_KEYWORDS = [
  'devices on',
  'device on',
  'on the canvas',
  'on canvas',
  'in the topology',
  'in topology',
  'in the diagram',
  'in diagram',
  'what devices',
  'list devices',
  'show devices',
  'connections',
  'connected to',
  'connects to',
  'connection between',
  'linked to',
  'communicate with',
  'talks to',
  'network diagram',
  'topology',
  'my network',
  'my system',
  'servers',
  'firewalls',
  'routers',
  'workstations',
  'endpoints',
];

// Keywords that suggest narrative generation
const NARRATIVE_KEYWORDS = [
  'generate narrative',
  'write narrative',
  'create narrative',
  'generate implementation',
  'write implementation',
  'how do i implement',
  'implementation for',
  'narrative for control',
];

// Control ID pattern (e.g., AC-2, SI-7, RA-5(1))
const CONTROL_ID_PATTERN = /\b([A-Z]{2,3})-(\d+(?:\(\d+\))?)\b/gi;

// Control family pattern (e.g., AC, AU, SI)
const CONTROL_FAMILY_PATTERN = /\b(AC|AU|AT|CM|CP|IA|IR|MA|MP|PE|PL|PS|PT|RA|SA|SC|SI|SR)\b/gi;

/**
 * Main query routing function
 * Analyzes the query and returns routing decision
 */
export function routeQuery(query: string): QueryRouteDecision {
  const lowerQuery = query.toLowerCase();
  
  // Extract control IDs and families
  const controlIds = extractControlIds(query);
  const families = extractControlFamilies(query);

  // Check for narrative generation requests
  if (hasKeywords(lowerQuery, NARRATIVE_KEYWORDS)) {
    return {
      type: 'narrative',
      confidence: 0.9,
      parameters: {
        narrativeControlId: controlIds[0], // Use first control ID if found
      },
    };
  }

  // Check for topology queries
  if (hasKeywords(lowerQuery, TOPOLOGY_KEYWORDS)) {
    const deviceNames = extractDeviceNames(query);
    const focusArea = determineFocusArea(lowerQuery);

    return {
      type: 'topology',
      confidence: 0.85,
      parameters: {
        deviceNames,
        controlIds,
        focusArea,
      },
    };
  }

  // Check for NIST document queries
  if (hasKeywords(lowerQuery, NIST_DOC_KEYWORDS) || controlIds.length > 0) {
    return {
      type: 'nist-docs',
      confidence: 0.9,
      parameters: {
        controlIds,
        families,
      },
    };
  }

  // If query asks about controls and we have a control ID, likely NIST docs
  if (
    (lowerQuery.includes('control') || lowerQuery.includes('requirement')) &&
    controlIds.length > 0
  ) {
    return {
      type: 'nist-docs',
      confidence: 0.8,
      parameters: {
        controlIds,
        families,
      },
    };
  }

  // Default to general assistant
  return {
    type: 'general',
    confidence: 0.5,
    parameters: {
      controlIds,
    },
  };
}

/**
 * Check if query contains any of the keywords
 */
function hasKeywords(query: string, keywords: string[]): boolean {
  return keywords.some((keyword) => query.includes(keyword));
}

/**
 * Extract control IDs from query (e.g., AC-2, SI-7)
 */
function extractControlIds(query: string): string[] {
  const matches = Array.from(query.matchAll(CONTROL_ID_PATTERN));
  return matches.map((match) => match[0].toUpperCase());
}

/**
 * Extract control families from query (e.g., AC, AU, SI)
 */
function extractControlFamilies(query: string): string[] {
  const matches = Array.from(query.matchAll(CONTROL_FAMILY_PATTERN));
  return [...new Set(matches.map((match) => match[0].toUpperCase()))];
}

/**
 * Extract device names from query (quoted strings or common device terms)
 */
function extractDeviceNames(query: string): string[] {
  const names: string[] = [];

  // Extract quoted strings
  const quotedPattern = /"([^"]+)"|'([^']+)'/g;
  const quotedMatches = Array.from(query.matchAll(quotedPattern));
  quotedMatches.forEach((match) => {
    const name = match[1] || match[2];
    if (name) names.push(name);
  });

  return names;
}

/**
 * Determine the focus area of a topology query
 */
function determineFocusArea(
  query: string
): 'devices' | 'connections' | 'controls' | 'general' {
  if (
    query.includes('connection') ||
    query.includes('connected') ||
    query.includes('link') ||
    query.includes('communicate')
  ) {
    return 'connections';
  }

  if (
    query.includes('control') ||
    query.includes('compliance') ||
    query.includes('applicable')
  ) {
    return 'controls';
  }

  if (
    query.includes('device') ||
    query.includes('server') ||
    query.includes('firewall') ||
    query.includes('router')
  ) {
    return 'devices';
  }

  return 'general';
}

/**
 * Helper to check if a query is about a specific control
 */
export function isControlSpecificQuery(query: string): boolean {
  const controlIds = extractControlIds(query);
  return controlIds.length > 0;
}

/**
 * Helper to check if a query is about topology
 */
export function isTopologyQuery(query: string): boolean {
  const decision = routeQuery(query);
  return decision.type === 'topology';
}

/**
 * Helper to check if a query is about NIST documents
 */
export function isNISTDocQuery(query: string): boolean {
  const decision = routeQuery(query);
  return decision.type === 'nist-docs';
}





























