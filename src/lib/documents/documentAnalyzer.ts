// Document Analyzer - Auto-detect document types and suggest relevant controls
// Analyzes uploaded documents to identify compliance-relevant content

export interface DocumentSuggestion {
  type: 'nist' | 'cis' | 'iso' | 'hipaa' | 'pci' | 'fedramp' | 'general';
  confidence: 'high' | 'medium' | 'low';
  framework?: string;
  suggestedControls?: string[];
  description: string;
}

// Common NIST document patterns
const NIST_PATTERNS = [
  { pattern: /800-53/i, framework: 'NIST 800-53', description: 'NIST Security and Privacy Controls' },
  { pattern: /800-37/i, framework: 'NIST 800-37', description: 'Risk Management Framework' },
  { pattern: /800-171/i, framework: 'NIST 800-171', description: 'Controlled Unclassified Information' },
  { pattern: /800-61/i, framework: 'NIST 800-61', description: 'Incident Handling Guide' },
  { pattern: /800-30/i, framework: 'NIST 800-30', description: 'Risk Assessment Guide' },
  { pattern: /800-137/i, framework: 'NIST 800-137', description: 'Continuous Monitoring' },
  { pattern: /800-34/i, framework: 'NIST 800-34', description: 'Contingency Planning' },
  { pattern: /800-86/i, framework: 'NIST 800-86', description: 'Forensics' },
  { pattern: /cybersecurity.framework/i, framework: 'NIST CSF', description: 'Cybersecurity Framework' },
  { pattern: /nist.*csf/i, framework: 'NIST CSF', description: 'Cybersecurity Framework' },
  { pattern: /\bNIST\b/i, framework: 'NIST', description: 'NIST Publication' },
];

// Other framework patterns
const FRAMEWORK_PATTERNS = [
  { pattern: /\bCIS\b.*benchmark/i, type: 'cis' as const, description: 'CIS Benchmark' },
  { pattern: /\bISO.*27001/i, type: 'iso' as const, description: 'ISO 27001 Standard' },
  { pattern: /\bISO.*27002/i, type: 'iso' as const, description: 'ISO 27002 Controls' },
  { pattern: /\bHIPAA\b/i, type: 'hipaa' as const, description: 'HIPAA Compliance' },
  { pattern: /\bPCI.*DSS/i, type: 'pci' as const, description: 'PCI DSS Compliance' },
  { pattern: /\bFedRAMP\b/i, type: 'fedramp' as const, description: 'FedRAMP Authorization' },
  { pattern: /\bSOC.*2/i, type: 'general' as const, description: 'SOC 2 Report' },
];

// Content keywords that suggest specific control families
const CONTROL_KEYWORDS: Record<string, string[]> = {
  'access control': ['AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6'],
  'authentication': ['IA-1', 'IA-2', 'IA-4', 'IA-5', 'IA-8'],
  'audit': ['AU-1', 'AU-2', 'AU-3', 'AU-6', 'AU-12'],
  'encryption': ['SC-8', 'SC-12', 'SC-13', 'SC-28'],
  'incident response': ['IR-1', 'IR-2', 'IR-4', 'IR-5', 'IR-6', 'IR-8'],
  'risk assessment': ['RA-1', 'RA-2', 'RA-3', 'RA-5'],
  'configuration management': ['CM-1', 'CM-2', 'CM-3', 'CM-4', 'CM-6', 'CM-7'],
  'system integrity': ['SI-1', 'SI-2', 'SI-3', 'SI-4', 'SI-7'],
  'contingency planning': ['CP-1', 'CP-2', 'CP-4', 'CP-9', 'CP-10'],
  'physical security': ['PE-1', 'PE-2', 'PE-3', 'PE-6'],
  'personnel security': ['PS-1', 'PS-2', 'PS-3', 'PS-4', 'PS-5'],
  'security training': ['AT-1', 'AT-2', 'AT-3', 'AT-4'],
  'planning': ['PL-1', 'PL-2', 'PL-4', 'PL-8'],
  'security assessment': ['CA-1', 'CA-2', 'CA-5', 'CA-7'],
  'media protection': ['MP-1', 'MP-2', 'MP-4', 'MP-5', 'MP-6'],
  'maintenance': ['MA-1', 'MA-2', 'MA-4', 'MA-5'],
  'network security': ['SC-7', 'SC-8', 'SC-10', 'SC-23'],
  'vulnerability': ['RA-5', 'SI-2', 'CM-4'],
  'backup': ['CP-9', 'CP-10'],
  'logging': ['AU-2', 'AU-3', 'AU-6', 'AU-12'],
  'password': ['IA-5', 'IA-5(1)'],
  'mfa': ['IA-2(1)', 'IA-2(2)', 'IA-2(8)'],
  'firewall': ['SC-7', 'AC-4'],
  'data classification': ['RA-2', 'MP-3', 'SC-16'],
};

/**
 * Analyze a document filename to suggest its type and relevance
 */
export function analyzeDocumentFilename(filename: string): DocumentSuggestion {
  // Check for NIST patterns first
  for (const pattern of NIST_PATTERNS) {
    if (pattern.pattern.test(filename)) {
      return {
        type: 'nist',
        confidence: 'high',
        framework: pattern.framework,
        description: pattern.description,
        suggestedControls: getSuggestedControlsFromFilename(filename)
      };
    }
  }

  // Check for other framework patterns
  for (const pattern of FRAMEWORK_PATTERNS) {
    if (pattern.pattern.test(filename)) {
      return {
        type: pattern.type,
        confidence: 'high',
        description: pattern.description,
        suggestedControls: getSuggestedControlsFromFilename(filename)
      };
    }
  }

  // Check for general compliance keywords
  if (/security|compliance|policy|procedure|ssp|plan/i.test(filename)) {
    return {
      type: 'general',
      confidence: 'medium',
      description: 'Security/Compliance Document',
      suggestedControls: getSuggestedControlsFromFilename(filename)
    };
  }

  // Default to general with low confidence
  return {
    type: 'general',
    confidence: 'low',
    description: 'General Document'
  };
}

/**
 * Get suggested controls based on filename keywords
 */
function getSuggestedControlsFromFilename(filename: string): string[] {
  const controls = new Set<string>();
  const filenameLower = filename.toLowerCase();

  for (const [keyword, controlList] of Object.entries(CONTROL_KEYWORDS)) {
    if (filenameLower.includes(keyword.replace(' ', '')) ||
        filenameLower.includes(keyword.split(' ')[0])) {
      controlList.forEach(c => controls.add(c));
    }
  }

  return Array.from(controls);
}

/**
 * Analyze document content for compliance relevance (basic text analysis)
 */
export function analyzeDocumentContent(content: string): {
  suggestedControls: string[];
  keywords: string[];
} {
  const foundKeywords: string[] = [];
  const controls = new Set<string>();
  const contentLower = content.toLowerCase();

  for (const [keyword, controlList] of Object.entries(CONTROL_KEYWORDS)) {
    if (contentLower.includes(keyword)) {
      foundKeywords.push(keyword);
      controlList.forEach(c => controls.add(c));
    }
  }

  // Also look for explicit control IDs in the content
  const controlPattern = /\b(AC|AT|AU|CA|CM|CP|IA|IR|MA|MP|PE|PL|PM|PS|PT|RA|SA|SC|SI|SR)-\d+(\(\d+\))?/gi;
  const matches = content.match(controlPattern) || [];
  matches.forEach(m => controls.add(m.toUpperCase()));

  return {
    suggestedControls: Array.from(controls),
    keywords: foundKeywords
  };
}

/**
 * Get suggested NIST documents based on project context
 */
export interface NISTDocumentSuggestion {
  id: string;
  title: string;
  description: string;
  url: string;
  priority: 'essential' | 'recommended' | 'optional';
  categories: string[];
}

export function getSuggestedNISTDocuments(): NISTDocumentSuggestion[] {
  return [
    {
      id: 'sp-800-53',
      title: 'NIST SP 800-53 Rev. 5',
      description: 'Security and Privacy Controls for Information Systems and Organizations',
      url: 'https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final',
      priority: 'essential',
      categories: ['controls', 'security']
    },
    {
      id: 'sp-800-53b',
      title: 'NIST SP 800-53B',
      description: 'Control Baselines for Information Systems and Organizations',
      url: 'https://csrc.nist.gov/publications/detail/sp/800-53b/final',
      priority: 'essential',
      categories: ['baselines', 'controls']
    },
    {
      id: 'sp-800-37',
      title: 'NIST SP 800-37 Rev. 2',
      description: 'Risk Management Framework for Information Systems and Organizations',
      url: 'https://csrc.nist.gov/publications/detail/sp/800-37/rev-2/final',
      priority: 'essential',
      categories: ['rmf', 'risk']
    },
    {
      id: 'sp-800-171',
      title: 'NIST SP 800-171 Rev. 2',
      description: 'Protecting Controlled Unclassified Information in Nonfederal Systems',
      url: 'https://csrc.nist.gov/publications/detail/sp/800-171/rev-2/final',
      priority: 'recommended',
      categories: ['cui', 'contractors']
    },
    {
      id: 'sp-800-30',
      title: 'NIST SP 800-30 Rev. 1',
      description: 'Guide for Conducting Risk Assessments',
      url: 'https://csrc.nist.gov/publications/detail/sp/800-30/rev-1/final',
      priority: 'recommended',
      categories: ['risk', 'assessment']
    },
    {
      id: 'csf',
      title: 'NIST Cybersecurity Framework',
      description: 'Framework for Improving Critical Infrastructure Cybersecurity',
      url: 'https://www.nist.gov/cyberframework',
      priority: 'recommended',
      categories: ['framework', 'general']
    },
    {
      id: 'sp-800-61',
      title: 'NIST SP 800-61 Rev. 2',
      description: 'Computer Security Incident Handling Guide',
      url: 'https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final',
      priority: 'optional',
      categories: ['incident', 'response']
    },
    {
      id: 'sp-800-34',
      title: 'NIST SP 800-34 Rev. 1',
      description: 'Contingency Planning Guide for Federal Information Systems',
      url: 'https://csrc.nist.gov/publications/detail/sp/800-34/rev-1/final',
      priority: 'optional',
      categories: ['contingency', 'planning']
    }
  ];
}
