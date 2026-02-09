// NIST RAG Query Module
// Implements Small2Big retrieval following Wang et al. (2024, arXiv:2407.01219)
// Section 3.2.2: Small chunks for retrieval, parent chunks for LLM context

import type { NISTQueryRequest, NISTQueryResponse, ChromaDBSmall2BigQuery, ExplanationMode } from './types';
import { getChromaDBClient } from './chromaClient';
import { getEmbeddingService } from './embeddingService';
import { getLLMServer } from './llamaServer';
import {
  estimateTokenCount,
  calculateNISTPromptOverhead,
  validatePromptSize,
  calculateAvailableTokensForChunks,
} from './tokenUtils';
import { useAuthStore } from '@/core/stores/useAuthStore';
import {
  buildStructuredControlPrompt,
  type ControlSectionType,
  type StructuredControlQueryContext,
} from './promptTemplates';
import { postProcessControlResponse } from './responseProcessor';
import {
  buildEvidenceContext,
} from '@/lib/controls/evidenceService';
// Parser utilities are available in @/lib/controls/parser for enhancement-aware processing
import {
  getImplementationExamplePrompt,
  hasImplementationExamples,
  type EnvironmentType,
} from '@/lib/ai/examples';
import { buildELI5ControlPrompt } from '@/lib/ai/prompts/eli5';
import {
  formatControlForRAG,
  formatControlName,
  normalizeControlId,
} from '@/lib/controls/formatter';

// Configuration constants for RAG quality control
const RAG_CONFIG = {
  // Minimum relevance score threshold (0-1)
  // Chunks below this threshold are filtered out to prevent hallucinations
  // Increased from 0.35 to 0.45 for higher quality results
  MIN_RELEVANCE_SCORE: 0.45,

  // Enable Small2Big retrieval (filter for is_small_chunk=true)
  // Set to true when collection has proper Small2Big structure
  ENABLE_SMALL2BIG_FILTER: true,

  // Minimum chunks required for a valid response
  MIN_CHUNKS_FOR_RESPONSE: 1,

  // Enable detailed debug logging
  DEBUG_LOGGING: true,

  // Prioritize exact control ID matches
  PRIORITIZE_EXACT_CONTROL_MATCH: true,

  // Enable reranking of top results
  ENABLE_RERANKING: true,

  // Number of top results to rerank
  RERANK_TOP_K: 3,

  // Enable structured four-section response format
  // When true, responses will include: Purpose, Control Requirements,
  // Common Implementations, and Typical Evidence sections
  ENABLE_STRUCTURED_RESPONSE: true,

  // Enable evidence scoping validation
  // When true, evidence suggestions will be validated against control category
  // and filtered to prevent cross-contamination with related controls
  ENABLE_EVIDENCE_SCOPING: true,

  // Maximum number of evidence items to suggest per control
  MAX_EVIDENCE_SUGGESTIONS: 7,

  // Enable real-world implementation examples in responses
  // When true, includes environment-specific implementation patterns
  ENABLE_IMPLEMENTATION_EXAMPLES: true,
};

/**
 * Control ID to Name mapping for query expansion
 * This improves semantic matching by including control names in queries
 */
const CONTROL_NAME_MAP: Record<string, string> = {
  // Access Control (AC)
  'AC-1': 'Policy and Procedures',
  'AC-2': 'Account Management',
  'AC-3': 'Access Enforcement',
  'AC-4': 'Information Flow Enforcement',
  'AC-5': 'Separation of Duties',
  'AC-6': 'Least Privilege',
  'AC-7': 'Unsuccessful Logon Attempts',
  'AC-8': 'System Use Notification',
  'AC-9': 'Previous Logon Notification',
  'AC-10': 'Concurrent Session Control',
  'AC-11': 'Device Lock',
  'AC-12': 'Session Termination',
  'AC-14': 'Permitted Actions Without Identification or Authentication',
  'AC-17': 'Remote Access',
  'AC-18': 'Wireless Access',
  'AC-19': 'Access Control for Mobile Devices',
  'AC-20': 'Use of External Systems',
  'AC-21': 'Information Sharing',
  'AC-22': 'Publicly Accessible Content',
  'AC-23': 'Data Mining Protection',
  'AC-24': 'Access Control Decisions',
  'AC-25': 'Reference Monitor',

  // Awareness and Training (AT)
  'AT-1': 'Policy and Procedures',
  'AT-2': 'Literacy Training and Awareness',
  'AT-3': 'Role-Based Training',
  'AT-4': 'Training Records',
  'AT-5': 'Contacts with Security Groups and Associations',
  'AT-6': 'Training Feedback',

  // Audit and Accountability (AU)
  'AU-1': 'Policy and Procedures',
  'AU-2': 'Event Logging',
  'AU-3': 'Content of Audit Records',
  'AU-4': 'Audit Log Storage Capacity',
  'AU-5': 'Response to Audit Logging Process Failures',
  'AU-6': 'Audit Record Review, Analysis, and Reporting',
  'AU-7': 'Audit Record Reduction and Report Generation',
  'AU-8': 'Time Stamps',
  'AU-9': 'Protection of Audit Information',
  'AU-10': 'Non-repudiation',
  'AU-11': 'Audit Record Retention',
  'AU-12': 'Audit Record Generation',
  'AU-13': 'Monitoring for Information Disclosure',
  'AU-14': 'Session Audit',
  'AU-16': 'Cross-Organizational Audit Logging',

  // Assessment, Authorization and Monitoring (CA)
  'CA-1': 'Policy and Procedures',
  'CA-2': 'Control Assessments',
  'CA-3': 'Information Exchange',
  'CA-5': 'Plan of Action and Milestones',
  'CA-6': 'Authorization',
  'CA-7': 'Continuous Monitoring',
  'CA-8': 'Penetration Testing',
  'CA-9': 'Internal System Connections',

  // Configuration Management (CM)
  'CM-1': 'Policy and Procedures',
  'CM-2': 'Baseline Configuration',
  'CM-3': 'Configuration Change Control',
  'CM-4': 'Impact Analyses',
  'CM-5': 'Access Restrictions for Change',
  'CM-6': 'Configuration Settings',
  'CM-7': 'Least Functionality',
  'CM-8': 'System Component Inventory',
  'CM-9': 'Configuration Management Plan',
  'CM-10': 'Software Usage Restrictions',
  'CM-11': 'User-Installed Software',
  'CM-12': 'Information Location',
  'CM-13': 'Data Action Mapping',
  'CM-14': 'Signed Components',

  // Contingency Planning (CP)
  'CP-1': 'Policy and Procedures',
  'CP-2': 'Contingency Plan',
  'CP-3': 'Contingency Training',
  'CP-4': 'Contingency Plan Testing',
  'CP-6': 'Alternate Storage Site',
  'CP-7': 'Alternate Processing Site',
  'CP-8': 'Telecommunications Services',
  'CP-9': 'System Backup',
  'CP-10': 'System Recovery and Reconstitution',
  'CP-11': 'Alternate Communications Protocols',
  'CP-12': 'Safe Mode',
  'CP-13': 'Alternative Security Mechanisms',

  // Identification and Authentication (IA)
  'IA-1': 'Policy and Procedures',
  'IA-2': 'Identification and Authentication (Organizational Users)',
  'IA-3': 'Device Identification and Authentication',
  'IA-4': 'Identifier Management',
  'IA-5': 'Authenticator Management',
  'IA-6': 'Authentication Feedback',
  'IA-7': 'Cryptographic Module Authentication',
  'IA-8': 'Identification and Authentication (Non-Organizational Users)',
  'IA-9': 'Service Identification and Authentication',
  'IA-10': 'Adaptive Authentication',
  'IA-11': 'Re-authentication',
  'IA-12': 'Identity Proofing',

  // Incident Response (IR)
  'IR-1': 'Policy and Procedures',
  'IR-2': 'Incident Response Training',
  'IR-3': 'Incident Response Testing',
  'IR-4': 'Incident Handling',
  'IR-5': 'Incident Monitoring',
  'IR-6': 'Incident Reporting',
  'IR-7': 'Incident Response Assistance',
  'IR-8': 'Incident Response Plan',
  'IR-9': 'Information Spillage Response',
  'IR-10': 'Integrated Information Security Analysis Team',

  // Maintenance (MA)
  'MA-1': 'Policy and Procedures',
  'MA-2': 'Controlled Maintenance',
  'MA-3': 'Maintenance Tools',
  'MA-4': 'Nonlocal Maintenance',
  'MA-5': 'Maintenance Personnel',
  'MA-6': 'Timely Maintenance',
  'MA-7': 'Field Maintenance',

  // Media Protection (MP)
  'MP-1': 'Policy and Procedures',
  'MP-2': 'Media Access',
  'MP-3': 'Media Marking',
  'MP-4': 'Media Storage',
  'MP-5': 'Media Transport',
  'MP-6': 'Media Sanitization',
  'MP-7': 'Media Use',
  'MP-8': 'Media Downgrading',

  // Physical and Environmental Protection (PE)
  'PE-1': 'Policy and Procedures',
  'PE-2': 'Physical Access Authorizations',
  'PE-3': 'Physical Access Control',
  'PE-4': 'Access Control for Transmission',
  'PE-5': 'Access Control for Output Devices',
  'PE-6': 'Monitoring Physical Access',
  'PE-8': 'Visitor Access Records',
  'PE-9': 'Power Equipment and Cabling',
  'PE-10': 'Emergency Shutoff',
  'PE-11': 'Emergency Power',
  'PE-12': 'Emergency Lighting',
  'PE-13': 'Fire Protection',
  'PE-14': 'Environmental Controls',
  'PE-15': 'Water Damage Protection',
  'PE-16': 'Delivery and Removal',
  'PE-17': 'Alternate Work Site',
  'PE-18': 'Location of System Components',
  'PE-19': 'Information Leakage',
  'PE-20': 'Asset Monitoring and Tracking',
  'PE-21': 'Electromagnetic Pulse Protection',
  'PE-22': 'Component Marking',
  'PE-23': 'Facility Location',

  // Planning (PL)
  'PL-1': 'Policy and Procedures',
  'PL-2': 'System Security and Privacy Plans',
  'PL-4': 'Rules of Behavior',
  'PL-7': 'Concept of Operations',
  'PL-8': 'Security and Privacy Architectures',
  'PL-9': 'Central Management',
  'PL-10': 'Baseline Selection',
  'PL-11': 'Baseline Tailoring',

  // Program Management (PM)
  'PM-1': 'Information Security Program Plan',
  'PM-2': 'Information Security Program Leadership Role',
  'PM-3': 'Information Security and Privacy Resources',
  'PM-4': 'Plan of Action and Milestones Process',
  'PM-5': 'System Inventory',
  'PM-6': 'Measures of Performance',
  'PM-7': 'Enterprise Architecture',
  'PM-8': 'Critical Infrastructure Plan',
  'PM-9': 'Risk Management Strategy',
  'PM-10': 'Authorization Process',
  'PM-11': 'Mission and Business Process Definition',
  'PM-12': 'Insider Threat Program',
  'PM-13': 'Security and Privacy Workforce',
  'PM-14': 'Testing, Training, and Monitoring',
  'PM-15': 'Security and Privacy Groups and Associations',
  'PM-16': 'Threat Awareness Program',
  'PM-17': 'Protecting Controlled Unclassified Information on External Systems',
  'PM-18': 'Privacy Program Plan',
  'PM-19': 'Privacy Program Leadership Role',
  'PM-20': 'Dissemination of Privacy Program Information',
  'PM-21': 'Accounting of Disclosures',
  'PM-22': 'Personally Identifiable Information Quality Management',
  'PM-23': 'Data Governance Body',
  'PM-24': 'Data Integrity Board',
  'PM-25': 'Minimization of Personally Identifiable Information Used in Testing, Training, and Research',
  'PM-26': 'Complaint Management',
  'PM-27': 'Privacy Reporting',
  'PM-28': 'Risk Framing',
  'PM-29': 'Risk Management Program Leadership Roles',
  'PM-30': 'Supply Chain Risk Management Strategy',
  'PM-31': 'Continuous Monitoring Strategy',
  'PM-32': 'Purposing',

  // Personnel Security (PS)
  'PS-1': 'Policy and Procedures',
  'PS-2': 'Position Risk Designation',
  'PS-3': 'Personnel Screening',
  'PS-4': 'Personnel Termination',
  'PS-5': 'Personnel Transfer',
  'PS-6': 'Access Agreements',
  'PS-7': 'External Personnel Security',
  'PS-8': 'Personnel Sanctions',
  'PS-9': 'Position Descriptions',

  // Personally Identifiable Information Processing and Transparency (PT)
  'PT-1': 'Policy and Procedures',
  'PT-2': 'Authority to Process Personally Identifiable Information',
  'PT-3': 'Personally Identifiable Information Processing Purposes',
  'PT-4': 'Consent',
  'PT-5': 'Privacy Notice',
  'PT-6': 'System of Records Notice',
  'PT-7': 'Specific Categories of Personally Identifiable Information',
  'PT-8': 'Computer Matching Requirements',

  // Risk Assessment (RA)
  'RA-1': 'Policy and Procedures',
  'RA-2': 'Security Categorization',
  'RA-3': 'Risk Assessment',
  'RA-5': 'Vulnerability Monitoring and Scanning',
  'RA-6': 'Technical Surveillance Countermeasures Survey',
  'RA-7': 'Risk Response',
  'RA-8': 'Privacy Impact Assessments',
  'RA-9': 'Criticality Analysis',
  'RA-10': 'Threat Hunting',

  // System and Services Acquisition (SA)
  'SA-1': 'Policy and Procedures',
  'SA-2': 'Allocation of Resources',
  'SA-3': 'System Development Life Cycle',
  'SA-4': 'Acquisition Process',
  'SA-5': 'System Documentation',
  'SA-8': 'Security and Privacy Engineering Principles',
  'SA-9': 'External System Services',
  'SA-10': 'Developer Configuration Management',
  'SA-11': 'Developer Testing and Evaluation',
  'SA-15': 'Development Process, Standards, and Tools',
  'SA-16': 'Developer-Provided Training',
  'SA-17': 'Developer Security and Privacy Architecture and Design',
  'SA-20': 'Customized Development of Critical Components',
  'SA-21': 'Developer Screening',
  'SA-22': 'Unsupported System Components',
  'SA-23': 'Specialization',

  // System and Communications Protection (SC)
  'SC-1': 'Policy and Procedures',
  'SC-2': 'Separation of System and User Functionality',
  'SC-3': 'Security Function Isolation',
  'SC-4': 'Information in Shared System Resources',
  'SC-5': 'Denial-of-Service Protection',
  'SC-7': 'Boundary Protection',
  'SC-8': 'Transmission Confidentiality and Integrity',
  'SC-10': 'Network Disconnect',
  'SC-12': 'Cryptographic Key Establishment and Management',
  'SC-13': 'Cryptographic Protection',
  'SC-15': 'Collaborative Computing Devices and Applications',
  'SC-17': 'Public Key Infrastructure Certificates',
  'SC-18': 'Mobile Code',
  'SC-20': 'Secure Name/Address Resolution Service (Authoritative Source)',
  'SC-21': 'Secure Name/Address Resolution Service (Recursive or Caching Resolver)',
  'SC-22': 'Architecture and Provisioning for Name/Address Resolution Service',
  'SC-23': 'Session Authenticity',
  'SC-24': 'Fail in Known State',
  'SC-25': 'Thin Nodes',
  'SC-26': 'Decoys',
  'SC-27': 'Platform-Independent Applications',
  'SC-28': 'Protection of Information at Rest',
  'SC-29': 'Heterogeneity',
  'SC-30': 'Concealment and Misdirection',
  'SC-31': 'Covert Channel Analysis',
  'SC-32': 'System Partitioning',
  'SC-34': 'Non-Modifiable Executable Programs',
  'SC-35': 'External Malicious Code Identification',
  'SC-36': 'Distributed Processing and Storage',
  'SC-37': 'Out-of-Band Channels',
  'SC-38': 'Operations Security',
  'SC-39': 'Process Isolation',
  'SC-40': 'Wireless Link Protection',
  'SC-41': 'Port and I/O Device Access',
  'SC-42': 'Sensor Capability and Data',
  'SC-43': 'Usage Restrictions',
  'SC-44': 'Detonation Chambers',
  'SC-45': 'System Time Synchronization',
  'SC-46': 'Cross Domain Policy Enforcement',
  'SC-47': 'Alternate Communications Paths',
  'SC-48': 'Sensor Relocation',
  'SC-49': 'Hardware-Enforced Separation and Policy Enforcement',
  'SC-50': 'Software-Enforced Separation and Policy Enforcement',
  'SC-51': 'Hardware-Based Protection',

  // System and Information Integrity (SI)
  'SI-1': 'Policy and Procedures',
  'SI-2': 'Flaw Remediation',
  'SI-3': 'Malicious Code Protection',
  'SI-4': 'System Monitoring',
  'SI-5': 'Security Alerts, Advisories, and Directives',
  'SI-6': 'Security and Privacy Function Verification',
  'SI-7': 'Software, Firmware, and Information Integrity',
  'SI-8': 'Spam Protection',
  'SI-10': 'Information Input Validation',
  'SI-11': 'Error Handling',
  'SI-12': 'Information Management and Retention',
  'SI-13': 'Predictable Failure Prevention',
  'SI-14': 'Non-Persistence',
  'SI-15': 'Information Output Filtering',
  'SI-16': 'Memory Protection',
  'SI-17': 'Fail-Safe Procedures',
  'SI-18': 'Personally Identifiable Information Quality Operations',
  'SI-19': 'De-identification',
  'SI-20': 'Tainting',
  'SI-21': 'Information Refresh',
  'SI-22': 'Information Diversity',
  'SI-23': 'Information Fragmentation',

  // Supply Chain Risk Management (SR)
  'SR-1': 'Policy and Procedures',
  'SR-2': 'Supply Chain Risk Management Plan',
  'SR-3': 'Supply Chain Controls and Processes',
  'SR-4': 'Provenance',
  'SR-5': 'Acquisition Strategies, Tools, and Methods',
  'SR-6': 'Supplier Assessments and Reviews',
  'SR-7': 'Supply Chain Operations Security',
  'SR-8': 'Notification Agreements',
  'SR-9': 'Tamper Resistance and Detection',
  'SR-10': 'Inspection of Systems or Components',
  'SR-11': 'Component Authenticity',
  'SR-12': 'Component Disposal',
};

/**
 * Expand query with control names for better semantic matching
 * E.g., "What is AC-2?" becomes "What is AC-2 (Account Management)"
 * Uses standardized control name formatting for consistency
 */
function expandQueryWithControlNames(query: string, controlIds: string[]): string {
  let expandedQuery = query;

  for (const controlId of controlIds) {
    const normalizedId = normalizeControlId(controlId);
    const controlName = CONTROL_NAME_MAP[normalizedId];
    if (controlName) {
      // Check if the control name is already in the query
      if (!query.toLowerCase().includes(controlName.toLowerCase())) {
        // Replace the control ID with standardized "control ID (control name)" format
        const pattern = new RegExp(`\\b${controlId}\\b`, 'gi');
        expandedQuery = expandedQuery.replace(pattern, formatControlForRAG(normalizedId, controlName));
      }
    }
  }

  return expandedQuery;
}

/**
 * Lightweight reranking of top results based on multiple signals
 * Improves result quality by considering keyword overlap and exact matches
 */
function rerankResults(
  chunks: Array<{
    id: string;
    text: string;
    metadata: Record<string, any>;
    score: number;
  }>,
  query: string,
  extractedControlIds: string[],
  topK: number = 3
): typeof chunks {
  if (chunks.length <= 1) return chunks;

  // Normalize query for comparison
  const queryLower = query.toLowerCase();
  const queryWords = new Set(
    queryLower
      .split(/\W+/)
      .filter(w => w.length > 2)
  );

  // Score each chunk with additional signals
  const rerankedChunks = chunks.map(chunk => {
    let rerankScore = chunk.score;
    const textLower = (chunk.text || '').toLowerCase();
    const controlId = chunk.metadata?.control_id || '';

    // Boost 1: Exact control ID match (strong signal)
    if (extractedControlIds.includes(controlId)) {
      rerankScore += 0.15;
    }

    // Boost 2: Keyword overlap with query
    let keywordMatches = 0;
    for (const word of queryWords) {
      if (textLower.includes(word)) {
        keywordMatches++;
      }
    }
    const keywordBoost = Math.min(0.1, (keywordMatches / queryWords.size) * 0.1);
    rerankScore += keywordBoost;

    // Boost 3: Control name appears in text
    if (controlId && CONTROL_NAME_MAP[controlId]) {
      const controlName = CONTROL_NAME_MAP[controlId].toLowerCase();
      if (textLower.includes(controlName)) {
        rerankScore += 0.05;
      }
    }

    // Boost 4: Document type relevance (control text > assessment objectives)
    const docType = (chunk.metadata?.document_type || '').toLowerCase();
    if (docType.includes('control') || docType.includes('800-53')) {
      rerankScore += 0.03;
    }

    return {
      ...chunk,
      originalScore: chunk.score,
      score: Math.min(1.0, rerankScore), // Cap at 1.0
    };
  });

  // Sort by reranked score
  rerankedChunks.sort((a, b) => b.score - a.score);

  // Log reranking results if debug enabled
  if (RAG_CONFIG.DEBUG_LOGGING && chunks.length > 0) {
    console.log(`[NIST RAG] Reranking top ${Math.min(topK, chunks.length)} results:`);
    rerankedChunks.slice(0, topK).forEach((chunk, idx) => {
      const original = (chunk as any).originalScore?.toFixed(3) || 'N/A';
      console.log(`  ${idx + 1}. ${chunk.metadata?.control_id || 'N/A'}: ${original} → ${chunk.score.toFixed(3)}`);
    });
  }

  return rerankedChunks;
}

/**
 * Extract control IDs from a query string
 * Matches patterns like: AC-1, AC-2(1), SI-7, RA-10, etc.
 */
function extractControlIds(query: string): string[] {
  // Match control IDs: 2-3 letter prefix, dash, number, optional parenthetical enhancement
  const controlIdPattern = /\b([A-Z]{2,3})-(\d+)(?:\((\d+)\))?\b/gi;
  const matches = query.matchAll(controlIdPattern);
  const controlIds: string[] = [];
  
  for (const match of matches) {
    // Normalize to uppercase
    const baseId = `${match[1].toUpperCase()}-${match[2]}`;
    controlIds.push(baseId);
    
    // If there's an enhancement number, also add the full ID
    if (match[3]) {
      controlIds.push(`${baseId}(${match[3]})`);
    }
  }
  
  // Remove duplicates
  return [...new Set(controlIds)];
}

// Get calibrated context size from Electron main process
function getCalibratedContextSize(): number {
  // Try to get from window API (set by Electron)
  if (typeof window !== 'undefined' && (window as any).calibratedContextSize) {
    return (window as any).calibratedContextSize;
  }
  // Default fallback
  return 2500;
}

/**
 * Query user documents via IPC when searchScope includes 'user'
 * Returns results in the same format as ChromaDB querySmallChunks
 */
async function queryUserDocumentsViaIPC(
  queryEmbedding: number[],
  topK: number
): Promise<any[]> {
  const license = useAuthStore.getState().license;
  if (!license?.user_id) {
    console.log('[NIST RAG] No user ID available, skipping user document query');
    return [];
  }

  try {
    const result = await window.electronAPI.queryUserDocs({
      userId: license.user_id,
      queryEmbedding,
      topK,
    });

    if (result.success && result.results) {
      console.log(`[NIST RAG] Retrieved ${result.results.length} user document chunks`);
      // Transform to match the expected format
      return result.results.map((r: any) => ({
        id: r.id,
        text: r.text || r.document,
        metadata: {
          ...r.metadata,
          source: 'user_document',
          is_small_chunk: true, // User docs are treated as small chunks
        },
        score: 1 - (r.distance || 0), // Convert distance to similarity score
      }));
    }
    return [];
  } catch (error) {
    console.error('[NIST RAG] Failed to query user documents:', error);
    return [];
  }
}

export class NISTRAGOrchestrator {
  private chromaClient = getChromaDBClient(undefined, 'documents'); // Collection name is 'documents'
  private embeddingService = getEmbeddingService();
  private llmServer = getLLMServer();

  /**
   * Query NIST documents using Small2Big retrieval
   * Following Wang et al. (2024) best practices:
   * - Retrieve small chunks (is_small_chunk: true) for precision
   * - Expand to parent_text for LLM context
   * - Use hypothetical questions for semantic matching
   * - Token-aware context building
   */
  async queryNISTDocuments(request: NISTQueryRequest): Promise<NISTQueryResponse> {
    const {
      query,
      documentTypes,
      families,
      topK = 6,
      maxTokens = 600,
      maxContextTokens: _maxContextTokens, // Will be calculated dynamically
      explanationMode = 'standard',
    } = request;

    // Get calibrated context size from system
    const calibratedContextSize = getCalibratedContextSize();
    const responseReserve = maxTokens; // Reserve space for LLM response

    // Calculate prompt overhead
    const promptOverhead = calculateNISTPromptOverhead(query, topK);
    
    // Calculate available tokens for chunks
    const availableForChunks = calculateAvailableTokensForChunks(
      calibratedContextSize,
      promptOverhead,
      responseReserve,
      256 // Minimum chunk tokens
    );

    console.log(`[NIST RAG] Token budget: context=${calibratedContextSize}, overhead=${promptOverhead}, response=${responseReserve}, available=${availableForChunks}`);

    // Step 1: Extract control IDs from query for exact matching
    const extractedControlIds = extractControlIds(query);
    if (RAG_CONFIG.DEBUG_LOGGING && extractedControlIds.length > 0) {
      console.log(`[NIST RAG] Extracted control IDs from query:`, extractedControlIds);
    }

    // Step 1b: Expand query with control names for better semantic matching
    const expandedQuery = expandQueryWithControlNames(query, extractedControlIds);
    if (expandedQuery !== query && RAG_CONFIG.DEBUG_LOGGING) {
      console.log(`[NIST RAG] Expanded query: "${query}" → "${expandedQuery}"`);
    }

    // Step 2: Generate embedding for expanded query
    const embeddingResponse = await this.embeddingService.embed({ text: expandedQuery });
    const queryEmbedding = embeddingResponse.embeddings[0];

    if (!queryEmbedding) {
      throw new Error('Failed to generate query embedding');
    }

    // Step 3: Build metadata filters for Small2Big retrieval
    // ChromaDB requires $and operator when combining multiple filters
    const filterConditions: any[] = [];
    
    // Enable Small2Big filtering if configured (retrieves only small chunks for precision)
    if (RAG_CONFIG.ENABLE_SMALL2BIG_FILTER) {
      filterConditions.push({ is_small_chunk: true });
    }

    // Add document type filter if specified
    if (documentTypes && documentTypes.length > 0) {
      filterConditions.push({ document_type: { $in: documentTypes } });
    }

    // Add family filter if specified
    if (families && families.length > 0) {
      filterConditions.push({ family: { $in: families } });
    }

    // Build final filter with $and if multiple conditions, otherwise use single condition
    const filters: ChromaDBSmall2BigQuery['filters'] = 
      filterConditions.length > 1 
        ? { $and: filterConditions }
        : filterConditions.length === 1 
          ? filterConditions[0]
          : {};

    if (RAG_CONFIG.DEBUG_LOGGING) {
      console.log(`[NIST RAG] Query filters:`, JSON.stringify(filters));
    }

    // Step 4: Query ChromaDB - first try exact control_id match if control IDs were extracted
    let smallChunks: any[] = [];
    
    if (RAG_CONFIG.PRIORITIZE_EXACT_CONTROL_MATCH && extractedControlIds.length > 0) {
      // First, query with exact control_id filter for the specific control
      const exactMatchFilters: any[] = [...filterConditions];
      
      // Add control_id filter for exact matches
      if (extractedControlIds.length === 1) {
        exactMatchFilters.push({ control_id: extractedControlIds[0] });
      } else {
        exactMatchFilters.push({ control_id: { $in: extractedControlIds } });
      }
      
      const exactFilters = exactMatchFilters.length > 1 
        ? { $and: exactMatchFilters }
        : exactMatchFilters[0];
      
      console.log(`[NIST RAG] Trying exact control_id match:`, JSON.stringify(exactFilters));
      
      try {
        const exactResults = await this.chromaClient.querySmallChunks({
          queryEmbedding,
          topK: Math.min(topK, 4), // Get fewer but exact matches
          filters: exactFilters,
        });
        
        if (exactResults.length > 0) {
          console.log(`[NIST RAG] Found ${exactResults.length} exact control_id matches`);
          smallChunks = exactResults;
          
          // If we didn't get enough exact matches, supplement with semantic search
          if (exactResults.length < 2) {
            console.log(`[NIST RAG] Supplementing with semantic search...`);
            const semanticResults = await this.chromaClient.querySmallChunks({
              queryEmbedding,
              topK: topK - exactResults.length,
              filters,
            });
            
            // Add semantic results that aren't duplicates
            const existingIds = new Set(exactResults.map(r => r.id));
            for (const result of semanticResults) {
              if (!existingIds.has(result.id)) {
                smallChunks.push(result);
              }
            }
          }
        }
      } catch (error) {
        console.warn(`[NIST RAG] Exact control_id query failed, falling back to semantic search:`, error);
      }
    }
    
    // Fall back to pure semantic search if no exact matches found
    if (smallChunks.length === 0) {
      smallChunks = await this.chromaClient.querySmallChunks({
        queryEmbedding,
        topK,
        filters,
      });
    }

    if (RAG_CONFIG.DEBUG_LOGGING) {
      console.log(`[NIST RAG] Retrieved ${smallChunks.length} chunks from ChromaDB`);
      smallChunks.forEach((chunk, idx) => {
        console.log(`[NIST RAG] Raw chunk ${idx + 1}: score=${chunk.score.toFixed(3)}, control_id=${chunk.metadata.control_id || 'N/A'}, text_len=${chunk.text.length}`);
      });
    }

    if (smallChunks.length === 0) {
      return {
        answer: 'No relevant documents found for your query. Please try rephrasing or adjusting filters.',
        retrievedChunks: [],
        references: [],
        tokensUsed: 0,
        contextTokensUsed: 0,
      };
    }

    // Step 4a: Apply lightweight reranking to improve result quality
    if (RAG_CONFIG.ENABLE_RERANKING && smallChunks.length > 1) {
      smallChunks = rerankResults(smallChunks, query, extractedControlIds, RAG_CONFIG.RERANK_TOP_K);
    }

    // Step 4b: Expand small chunks to parent chunks
    const expandedChunks = this.chromaClient.expandToParentChunks(smallChunks);

    // Step 5: Apply minimum relevance score threshold to filter low-quality chunks
    // Note: For exact control_id matches, we use a lower threshold since control_id is a strong signal
    const scoreFilteredChunks = this.filterByMinimumScore(
      expandedChunks, 
      RAG_CONFIG.MIN_RELEVANCE_SCORE,
      true // allow control_id matches with lower threshold
    );
    
    if (RAG_CONFIG.DEBUG_LOGGING) {
      console.log(`[NIST RAG] Score filtering: ${scoreFilteredChunks.length}/${expandedChunks.length} chunks passed threshold (min score: ${RAG_CONFIG.MIN_RELEVANCE_SCORE})`);
    }

    // Check if we have enough quality chunks
    if (scoreFilteredChunks.length < RAG_CONFIG.MIN_CHUNKS_FOR_RESPONSE) {
      console.warn(`[NIST RAG] Only ${scoreFilteredChunks.length} chunks passed score threshold. Best score: ${expandedChunks[0]?.score.toFixed(3) || 'N/A'}`);
      // Use the best chunks available even if below threshold, but warn
      if (expandedChunks.length > 0 && scoreFilteredChunks.length === 0) {
        console.warn(`[NIST RAG] Using top chunk despite low score: ${expandedChunks[0].score.toFixed(3)}`);
        scoreFilteredChunks.push(expandedChunks[0]);
      }
    }

    // Step 6: Filter by dynamic token budget
    const filteredChunks = this.chromaClient.filterByTokenBudget(scoreFilteredChunks, availableForChunks);

    console.log(`[NIST RAG] Final chunks: ${filteredChunks.length} (after score and token filtering)`);

    // Step 6: Build and validate RAG prompt
    const { prompt, finalChunks } = this.validateAndBuildPrompt(
      query,
      filteredChunks,
      calibratedContextSize - responseReserve,
      explanationMode
    );

    // Step 7: Calculate actual context tokens used
    const contextTokensUsed = finalChunks.reduce((sum, chunk) => sum + chunk.parentTokenCount, 0);

    console.log(`[NIST RAG] Final prompt: ${estimateTokenCount(prompt)} tokens, ${finalChunks.length} chunks`);

    // Step 8: Generate response with LLM
    const llmResponse = await this.llmServer.generate({
      prompt,
      temperature: 0.2, // Lower temperature to reduce hallucinations
      maxTokens,
    });

    // Step 9: Build references from final chunks
    const references = finalChunks.map((chunk) => ({
      chunkId: chunk.smallChunkId,
      documentType: chunk.metadata.document_type || 'unknown',
      controlId: chunk.metadata.control_id,
      controlName: chunk.metadata.control_name,
      family: chunk.metadata.family,
      parentTokenCount: chunk.parentTokenCount,
      score: chunk.score,
      hypotheticalQuestions: chunk.metadata.hypothetical_questions || [],
    }));

    // Extract control ID from references for post-processing
    const primaryControlId = references.find(r => r.controlId)?.controlId;

    // Apply post-processing to remove duplicate content and enforce structure
    const processedAnswer = postProcessControlResponse(llmResponse.text.trim(), primaryControlId);

    return {
      answer: processedAnswer,
      retrievedChunks: smallChunks,
      references,
      tokensUsed: llmResponse.tokensUsed,
      contextTokensUsed,
    };
  }

  /**
   * Stream NIST document query response
   * Same as queryNISTDocuments but streams tokens in real-time
   */
  async *queryNISTDocumentsStream(request: NISTQueryRequest): AsyncGenerator<{
    type: 'token' | 'metadata';
    data: string | { references: any[]; contextTokensUsed: number };
  }, void, unknown> {
    const {
      query,
      documentTypes,
      families,
      topK = 6,
      maxTokens = 600,
      maxContextTokens: _maxContextTokens, // Will be calculated dynamically
      searchScope = 'both', // Default to searching both sources
      explanationMode = 'standard',
    } = request;

    // Get calibrated context size from system
    const calibratedContextSize = getCalibratedContextSize();
    const responseReserve = maxTokens;

    // Calculate prompt overhead and available tokens
    const promptOverhead = calculateNISTPromptOverhead(query, topK);
    const availableForChunks = calculateAvailableTokensForChunks(
      calibratedContextSize,
      promptOverhead,
      responseReserve,
      256
    );

    console.log(`[NIST RAG Stream] Token budget: context=${calibratedContextSize}, overhead=${promptOverhead}, available=${availableForChunks}`);

    // Step 1: Extract control IDs from query for exact matching
    const extractedControlIds = extractControlIds(query);
    if (RAG_CONFIG.DEBUG_LOGGING && extractedControlIds.length > 0) {
      console.log(`[NIST RAG Stream] Extracted control IDs from query:`, extractedControlIds);
    }

    // Step 1b: Expand query with control names for better semantic matching
    const expandedQuery = expandQueryWithControlNames(query, extractedControlIds);
    if (expandedQuery !== query && RAG_CONFIG.DEBUG_LOGGING) {
      console.log(`[NIST RAG Stream] Expanded query: "${query}" → "${expandedQuery}"`);
    }

    // Step 2: Generate embedding for expanded query
    const embeddingResponse = await this.embeddingService.embed({ text: expandedQuery });
    const queryEmbedding = embeddingResponse.embeddings[0];

    if (!queryEmbedding) {
      throw new Error('Failed to generate query embedding: embedding array is empty');
    }

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new Error(`Invalid query embedding: expected non-empty array, got ${typeof queryEmbedding} with length ${Array.isArray(queryEmbedding) ? queryEmbedding.length : 'N/A'}`);
    }

    if (queryEmbedding.some(v => typeof v !== 'number' || !isFinite(v))) {
      throw new Error('Invalid query embedding: contains non-numeric or invalid values');
    }

    console.log(`[NIST RAG Stream] Generated query embedding: ${queryEmbedding.length} dimensions`)

    // Step 3: Build metadata filters for retrieval
    // ChromaDB requires $and operator when combining multiple filters
    const filterConditions: any[] = [];
    
    // Enable Small2Big filtering if configured
    if (RAG_CONFIG.ENABLE_SMALL2BIG_FILTER) {
      filterConditions.push({ is_small_chunk: true });
    }

    if (documentTypes && documentTypes.length > 0) {
      filterConditions.push({ document_type: { $in: documentTypes } });
    }

    if (families && families.length > 0) {
      filterConditions.push({ family: { $in: families } });
    }

    // Build final filter with $and if multiple conditions, otherwise use single condition
    const filters: ChromaDBSmall2BigQuery['filters'] = 
      filterConditions.length > 1 
        ? { $and: filterConditions }
        : filterConditions.length === 1 
          ? filterConditions[0]
          : {};

    if (RAG_CONFIG.DEBUG_LOGGING) {
      console.log(`[NIST RAG Stream] Query filters:`, JSON.stringify(filters));
      console.log(`[NIST RAG Stream] Search scope:`, searchScope);
    }

    // Step 4: Query documents based on searchScope
    let smallChunks: any[] = [];
    let userDocChunks: any[] = [];

    // Query user documents if searchScope includes 'user'
    if (searchScope === 'user' || searchScope === 'both') {
      userDocChunks = await queryUserDocumentsViaIPC(queryEmbedding, topK);
      if (RAG_CONFIG.DEBUG_LOGGING) {
        console.log(`[NIST RAG Stream] Retrieved ${userDocChunks.length} user document chunks`);
      }
    }

    // Query shared compliance library if searchScope includes 'shared'
    if (searchScope === 'shared' || searchScope === 'both') {
      // Try exact control_id match first if control IDs were extracted
      if (RAG_CONFIG.PRIORITIZE_EXACT_CONTROL_MATCH && extractedControlIds.length > 0) {
        // First, query with exact control_id filter for the specific control
        const exactMatchFilters: any[] = [...filterConditions];

        // Add control_id filter for exact matches
        if (extractedControlIds.length === 1) {
          exactMatchFilters.push({ control_id: extractedControlIds[0] });
        } else {
          exactMatchFilters.push({ control_id: { $in: extractedControlIds } });
        }

        const exactFilters = exactMatchFilters.length > 1
          ? { $and: exactMatchFilters }
          : exactMatchFilters[0];

        console.log(`[NIST RAG Stream] Trying exact control_id match:`, JSON.stringify(exactFilters));

        try {
          const exactResults = await this.chromaClient.querySmallChunks({
            queryEmbedding,
            topK: Math.min(topK, 4), // Get fewer but exact matches
            filters: exactFilters,
          });

          if (exactResults.length > 0) {
            console.log(`[NIST RAG Stream] Found ${exactResults.length} exact control_id matches`);
            smallChunks = exactResults;

            // If we didn't get enough exact matches, supplement with semantic search
            if (exactResults.length < 2) {
              console.log(`[NIST RAG Stream] Supplementing with semantic search...`);
              const semanticResults = await this.chromaClient.querySmallChunks({
                queryEmbedding,
                topK: topK - exactResults.length,
                filters,
              });

              // Add semantic results that aren't duplicates
              const existingIds = new Set(exactResults.map(r => r.id));
              for (const result of semanticResults) {
                if (!existingIds.has(result.id)) {
                  smallChunks.push(result);
                }
              }
            }
          }
        } catch (error) {
          console.warn(`[NIST RAG Stream] Exact control_id query failed, falling back to semantic search:`, error);
        }
      }

      // Fall back to pure semantic search if no exact matches found
      if (smallChunks.length === 0) {
        smallChunks = await this.chromaClient.querySmallChunks({
          queryEmbedding,
          topK,
          filters,
        });
      }
    }

    // Merge user doc chunks with shared chunks if both were queried
    if (userDocChunks.length > 0) {
      // Add source metadata to shared chunks for display
      smallChunks = smallChunks.map(chunk => ({
        ...chunk,
        metadata: { ...chunk.metadata, source: 'compliance_library' },
      }));

      // Merge and sort by score
      smallChunks = [...userDocChunks, ...smallChunks]
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      console.log(`[NIST RAG Stream] Merged chunks: ${smallChunks.length} total (user: ${userDocChunks.length}, shared: ${smallChunks.length - userDocChunks.length})`);
    }

    if (RAG_CONFIG.DEBUG_LOGGING) {
      console.log(`[NIST RAG Stream] Retrieved ${smallChunks.length} chunks from ChromaDB`);
      smallChunks.forEach((chunk, idx) => {
        console.log(`[NIST RAG Stream] Raw chunk ${idx + 1}: score=${chunk.score.toFixed(3)}, control_id=${chunk.metadata.control_id || 'N/A'}, text_len=${chunk.text.length}`);
      });
    }

    if (smallChunks.length === 0) {
      yield {
        type: 'token',
        data: 'No relevant documents found for your query. Please try rephrasing or adjusting filters.',
      };
      return;
    }

    // Step 4a: Apply lightweight reranking to improve result quality
    if (RAG_CONFIG.ENABLE_RERANKING && smallChunks.length > 1) {
      smallChunks = rerankResults(smallChunks, query, extractedControlIds, RAG_CONFIG.RERANK_TOP_K);
    }

    // Step 4b: Expand small chunks to parent chunks
    // Handle user document chunks separately - they don't have parent_text structure
    const userChunks = smallChunks.filter(chunk => chunk.metadata?.source === 'user_document');
    const sharedChunks = smallChunks.filter(chunk => chunk.metadata?.source !== 'user_document');

    // Expand shared chunks (they have Small2Big structure)
    const expandedSharedChunks = sharedChunks.length > 0
      ? this.chromaClient.expandToParentChunks(sharedChunks)
      : [];

    // User document chunks use their text directly (no parent expansion needed)
    const expandedUserChunks = userChunks.map(chunk => ({
      parentText: chunk.text,
      parentTokenCount: Math.ceil((chunk.text?.length || 0) / 4), // Rough token estimate
      smallChunkId: chunk.id,
      smallChunkText: chunk.text,
      metadata: chunk.metadata,
      score: chunk.score,
    }));

    // Merge expanded chunks
    const expandedChunks = [...expandedUserChunks, ...expandedSharedChunks]
      .sort((a, b) => b.score - a.score);

    // Step 5: Apply minimum relevance score threshold
    // Note: For exact control_id matches, we use a lower threshold since control_id is a strong signal
    const scoreFilteredChunks = this.filterByMinimumScore(
      expandedChunks, 
      RAG_CONFIG.MIN_RELEVANCE_SCORE,
      true // allow control_id matches with lower threshold
    );
    
    if (RAG_CONFIG.DEBUG_LOGGING) {
      console.log(`[NIST RAG Stream] Score filtering: ${scoreFilteredChunks.length}/${expandedChunks.length} chunks passed threshold (min: ${RAG_CONFIG.MIN_RELEVANCE_SCORE})`);
    }

    // Check if we have enough quality chunks
    if (scoreFilteredChunks.length < RAG_CONFIG.MIN_CHUNKS_FOR_RESPONSE) {
      console.warn(`[NIST RAG Stream] Only ${scoreFilteredChunks.length} chunks passed score threshold`);
      if (expandedChunks.length > 0 && scoreFilteredChunks.length === 0) {
        console.warn(`[NIST RAG Stream] Using top chunk despite low score: ${expandedChunks[0].score.toFixed(3)}`);
        scoreFilteredChunks.push(expandedChunks[0]);
      }
    }

    // Step 6: Filter by dynamic token budget
    const filteredChunks = this.chromaClient.filterByTokenBudget(scoreFilteredChunks, availableForChunks);

    console.log(`[NIST RAG Stream] Final chunks: ${filteredChunks.length} (after score and token filtering)`);

    // Step 6: Build and validate RAG prompt
    const { prompt, finalChunks } = this.validateAndBuildPrompt(
      query,
      filteredChunks,
      calibratedContextSize - responseReserve,
      explanationMode
    );

    // Step 7: Calculate context tokens used
    const contextTokensUsed = finalChunks.reduce((sum, chunk) => sum + chunk.parentTokenCount, 0);

    console.log(`[NIST RAG Stream] Final prompt: ${estimateTokenCount(prompt)} tokens, ${finalChunks.length} chunks`);

    // Step 8: Build references
    const references = finalChunks.map((chunk) => ({
      chunkId: chunk.smallChunkId,
      documentType: chunk.metadata.source === 'user_document'
        ? 'user_document'
        : (chunk.metadata.document_type || 'unknown'),
      controlId: chunk.metadata.control_id,
      controlName: chunk.metadata.control_name,
      family: chunk.metadata.family,
      parentTokenCount: chunk.parentTokenCount,
      score: chunk.score,
      hypotheticalQuestions: chunk.metadata.hypothetical_questions || [],
      source: chunk.metadata.source || 'compliance_library',
      filename: chunk.metadata.filename,
    }));

    // Yield metadata first
    yield {
      type: 'metadata',
      data: { references, contextTokensUsed },
    };

    // Step 9: Stream generation
    for await (const token of this.llmServer.generateStream({
      prompt,
      temperature: 0.2, // Lower temperature to reduce hallucinations
      maxTokens,
    })) {
      yield {
        type: 'token',
        data: token,
      };
    }
  }

  /**
   * Validate and build prompt with iterative chunk reduction if needed
   * Ensures final prompt fits within token budget
   */
  private validateAndBuildPrompt(
    query: string,
    chunks: Array<{
      parentText: string;
      parentTokenCount: number;
      smallChunkId: string;
      smallChunkText: string;
      metadata: Record<string, any>;
      score: number;
    }>,
    maxTokens: number,
    explanationMode: ExplanationMode = 'standard'
  ): {
    prompt: string;
    finalChunks: typeof chunks;
  } {
    let currentChunks = [...chunks];
    let attempts = 0;
    const maxAttempts = Math.min(chunks.length, 5);

    while (attempts < maxAttempts && currentChunks.length > 0) {
      const prompt = this.buildRAGPrompt(query, currentChunks, explanationMode);
      const validation = validatePromptSize(prompt, maxTokens + 200, 200); // maxTokens includes response reserve

      if (validation.valid) {
        if (attempts > 0) {
          console.log(`[NIST RAG] Prompt validated after ${attempts} reductions: ${validation.promptTokens} tokens (limit: ${validation.available})`);
        }
        return { prompt, finalChunks: currentChunks };
      }

      // Prompt too large, remove lowest-scoring chunk
      console.warn(`[NIST RAG] Prompt too large: ${validation.promptTokens} tokens (limit: ${validation.available}), removing lowest-scoring chunk`);
      currentChunks = currentChunks.slice(0, -1); // Remove last chunk (lowest score after filtering)
      attempts++;
    }

    // Last resort: use single best chunk
    if (currentChunks.length === 0 && chunks.length > 0) {
      console.warn('[NIST RAG] All chunks removed, using single best chunk as fallback');
      currentChunks = [chunks[0]];
    }

    const prompt = this.buildRAGPrompt(query, currentChunks, explanationMode);
    return { prompt, finalChunks: currentChunks };
  }

  /**
   * Build RAG prompt following Wang et al. (2024) recommendations
   * Uses "reverse" repacking (Section 4.2) - most relevant context near the query
   *
   * When ENABLE_STRUCTURED_RESPONSE is true, produces four-section responses:
   * - Purpose: Security objective
   * - Control Requirements: NIST mandates
   * - Common Implementations: Technical solutions
   * - Typical Evidence: Assessment artifacts
   */
  private buildRAGPrompt(
    query: string,
    expandedChunks: Array<{
      parentText: string;
      parentTokenCount: number;
      metadata: Record<string, any>;
      score: number;
    }>,
    explanationMode: ExplanationMode = 'standard'
  ): string {
    // Sort by relevance score (descending) for reverse repacking
    const sortedChunks = [...expandedChunks].sort((a, b) => b.score - a.score);

    // Debug logging - see what context the LLM receives
    console.log('[NIST RAG] Building prompt with', sortedChunks.length, 'chunks');
    sortedChunks.forEach((chunk, idx) => {
      console.log(`[NIST RAG] Chunk ${idx + 1}:`, {
        control_id: chunk.metadata.control_id,
        control_name: chunk.metadata.control_name,
        document_type: chunk.metadata.document_type,
        section_type: chunk.metadata.section_type,
        score: chunk.score,
        text_length: chunk.parentText.length,
        text_preview: chunk.parentText.substring(0, 150) + '...',
      });
    });

    // Handle ELI5 (Explain Like I'm 5) mode - uses analogy-first explanations
    if (explanationMode === 'eli5') {
      // Extract control ID and name from first relevant chunk
      const controlChunk = sortedChunks.find(c => c.metadata.control_id);
      const controlId = controlChunk?.metadata.control_id;
      const controlName = controlChunk?.metadata.control_name || CONTROL_NAME_MAP[controlId] || undefined;

      // Convert chunks to ELI5 context format
      const retrievedContext = sortedChunks.map(chunk => ({
        text: chunk.parentText,
        sectionType: chunk.metadata.section_type as ControlSectionType | undefined,
        documentType: chunk.metadata.document_type,
        score: chunk.score,
      }));

      console.log(`[NIST RAG] Using ELI5 mode for ${controlId || 'general query'}`);

      return buildELI5ControlPrompt({
        query,
        controlId,
        controlName,
        retrievedContext,
      });
    }

    // Use structured prompt template when enabled
    if (RAG_CONFIG.ENABLE_STRUCTURED_RESPONSE) {
      // Extract control ID and name from first relevant chunk
      const controlChunk = sortedChunks.find(c => c.metadata.control_id);
      const controlId = controlChunk?.metadata.control_id;
      const controlName = controlChunk?.metadata.control_name || CONTROL_NAME_MAP[controlId] || undefined;

      // Convert chunks to structured context format
      const retrievedContext: StructuredControlQueryContext['retrievedContext'] = sortedChunks.map(chunk => ({
        text: chunk.parentText,
        sectionType: chunk.metadata.section_type as ControlSectionType | undefined,
        documentType: chunk.metadata.document_type,
        score: chunk.score,
      }));

      // Build evidence scoping context if enabled
      let evidenceContext: StructuredControlQueryContext['evidenceContext'] | undefined;
      if (RAG_CONFIG.ENABLE_EVIDENCE_SCOPING && controlId) {
        const evidenceMapping = buildEvidenceContext(controlId);
        evidenceContext = {
          category: evidenceMapping.category,
          intent: evidenceMapping.intent,
          appropriateEvidence: evidenceMapping.appropriateEvidence.slice(0, RAG_CONFIG.MAX_EVIDENCE_SUGGESTIONS),
          inappropriateEvidence: evidenceMapping.inappropriateEvidence,
          relatedControls: evidenceMapping.relatedControls
        };
        if (RAG_CONFIG.DEBUG_LOGGING) {
          console.log(`[NIST RAG] Evidence scoping for ${controlId}:`, {
            category: evidenceContext.category,
            appropriateItems: evidenceContext.appropriateEvidence.length,
            inappropriateItems: evidenceContext.inappropriateEvidence.length
          });
        }
      }

      // Build implementation examples context if enabled
      let implementationExamples: string | undefined;
      if (RAG_CONFIG.ENABLE_IMPLEMENTATION_EXAMPLES && controlId && hasImplementationExamples(controlId)) {
        // Get environment from window if available (set by topology analysis)
        const detectedEnvironment = (typeof window !== 'undefined' && (window as any).detectedEnvironment) as EnvironmentType | undefined;
        implementationExamples = getImplementationExamplePrompt(controlId, detectedEnvironment);
        if (RAG_CONFIG.DEBUG_LOGGING && implementationExamples) {
          console.log(`[NIST RAG] Implementation examples for ${controlId}:`, {
            environment: detectedEnvironment || 'multi-environment',
            hasExamples: !!implementationExamples
          });
        }
      }

      return buildStructuredControlPrompt({
        query,
        controlId,
        controlName,
        retrievedContext,
        evidenceContext,
        implementationExamples,
      });
    }

    // Fallback to legacy prompt format
    return this.buildLegacyRAGPrompt(query, sortedChunks);
  }

  /**
   * Legacy RAG prompt format (used when ENABLE_STRUCTURED_RESPONSE is false)
   * Maintains backward compatibility with existing response format
   * Uses standardized control name formatting for consistency
   */
  private buildLegacyRAGPrompt(
    query: string,
    sortedChunks: Array<{
      parentText: string;
      parentTokenCount: number;
      metadata: Record<string, any>;
      score: number;
    }>
  ): string {
    // Build context from parent texts with standardized formatting
    const contextSections = sortedChunks.map((chunk, index) => {
      const metadata = chunk.metadata;
      const isUserDoc = metadata.source === 'user_document';
      let header = `[Document ${index + 1}`;

      // Show source (user document or compliance library)
      if (isUserDoc) {
        header += ` | Source: User Document`;
        if (metadata.filename) {
          header += ` | File: ${metadata.filename}`;
        }
      } else {
        if (metadata.document_type) {
          header += ` | Type: ${metadata.document_type}`;
        }
        // Use standardized control name format: "AC-3 — Access Enforcement"
        if (metadata.control_id) {
          const controlName = metadata.control_name || CONTROL_NAME_MAP[metadata.control_id];
          if (controlName) {
            header += ` | ${formatControlName(metadata.control_id, controlName)}`;
          } else {
            header += ` | ${normalizeControlId(metadata.control_id)}`;
          }
        }
      }
      // Note: Family is shown once in control format, not repeated separately

      // Note: Relevance percentages removed to prevent false precision claims
      // Scores are still used internally for ranking but not exposed to users
      header += `]`;

      return `${header}\n${chunk.parentText}`;
    });

    const prompt = `Answer the user's question about NIST 800-53 using the provided reference documents.

CRITICAL: Focus on CONTROL REQUIREMENTS, not assessment procedures.

Guidelines:
- Be concise and direct - provide a clear answer in 2-4 sentences
- When asked "what is [control]", explain what the control REQUIRES organizations to do
- Include the control ID and name using standard format: "AC-2 — Account Management" (with em dash)
- Do NOT repeat family labels like "Families: AC" - the family is already clear from the control ID
- Prioritize "Control Text" sections that describe requirements over "Assessment Objectives" sections
- Explain what organizations must do, not how to verify compliance
- Avoid assessment language like "examines, interviews, and tests" - these describe verification methods, not requirements
- If Control Text is present in the documents, explain the requirements clearly - do NOT say "the control text does not provide"
- Summarize the information; do not copy text verbatim
- Use only information from the documents below - do not add external knowledge
- If multiple documents are provided, synthesize the key points

What to focus on:
✓ Control Text sections (what organizations must do)
✓ Requirements and obligations
✓ Implementation guidance

What to avoid:
✗ Assessment Objectives (how to verify compliance)
✗ Phrases like "examines, interviews, and tests"
✗ Saying "the control text does not provide" - instead explain what IS in the control text

User Question: ${query}

Reference Documents:
${contextSections.join('\n\n---\n\n')}

Answer:`;

    return prompt;
  }

  /**
   * Filter chunks by minimum relevance score
   * Critical for preventing hallucinations - removes low-quality matches
   * @param allowControlIdMatches - If true, allows chunks with control_id metadata to use a lower threshold (~0.32 for 0.45 base)
   */
  private filterByMinimumScore(
    chunks: Array<{
      parentText: string;
      parentTokenCount: number;
      smallChunkId: string;
      smallChunkText: string;
      metadata: Record<string, any>;
      score: number;
    }>,
    minScore: number,
    allowControlIdMatches: boolean = false
  ): typeof chunks {
    // For chunks with control_id, use a slightly lower threshold since control_id is a strong signal
    // With base threshold of 0.45: controlIdThreshold = max(0.30, 0.45 * 0.7) = 0.315
    const controlIdThreshold = allowControlIdMatches ? Math.max(0.30, minScore * 0.7) : minScore;
    
    const filtered = chunks.filter((chunk) => {
      const hasControlId = !!chunk.metadata.control_id;
      const threshold = hasControlId && allowControlIdMatches ? controlIdThreshold : minScore;
      return chunk.score >= threshold;
    });
    
    // Log chunks that were filtered out
    const removed = chunks.filter((chunk) => {
      const hasControlId = !!chunk.metadata.control_id;
      const threshold = hasControlId && allowControlIdMatches ? controlIdThreshold : minScore;
      return chunk.score < threshold;
    });
    
    if (removed.length > 0 && RAG_CONFIG.DEBUG_LOGGING) {
      console.log(`[NIST RAG] Filtered out ${removed.length} low-score chunks:`);
      removed.forEach((chunk) => {
        const hasControlId = !!chunk.metadata.control_id;
        const threshold = hasControlId && allowControlIdMatches ? controlIdThreshold : minScore;
        console.log(`  - Score: ${chunk.score.toFixed(3)} (threshold: ${threshold.toFixed(3)}), Control: ${chunk.metadata.control_id || 'N/A'}, Type: ${chunk.metadata.document_type || 'N/A'}`);
      });
    }
    
    return filtered.sort((a, b) => b.score - a.score);
  }

  /**
   * Rank and filter chunks by relevance
   * Optional method for additional post-processing
   */
  rankAndFilterChunks(
    chunks: Array<{
      parentText: string;
      parentTokenCount: number;
      metadata: Record<string, any>;
      score: number;
    }>,
    minScore: number = 0.5
  ): typeof chunks {
    return chunks
      .filter((chunk) => chunk.score >= minScore)
      .sort((a, b) => b.score - a.score);
  }
}

// Singleton instance
let nistRAGInstance: NISTRAGOrchestrator | null = null;

export function getNISTRAGOrchestrator(): NISTRAGOrchestrator {
  if (!nistRAGInstance) {
    nistRAGInstance = new NISTRAGOrchestrator();
  }
  return nistRAGInstance;
}

