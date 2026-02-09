// AI Service Types

export interface DetectedModel {
  filename: string;
  path: string;
  sizeGB: number;
  type: 'llm' | 'embedding' | 'unknown';
  capabilities: {
    canDoLLM: boolean;
    canDoEmbeddings: boolean;
  };
}

export interface ModelPreferences {
  llmModelPath: string;
  embeddingModelPath: string;
}

export interface AIConfig {
  embeddingModelPath: string;
  llmModelPath: string;
  chromaDbPath: string;
  gpuBackend: 'auto' | 'cuda' | 'metal' | 'vulkan' | 'cpu';
  temperature: number;
  maxTokens: number;
  topK: number;
  useInstructionFormat?: boolean; // Enable Mistral instruction formatting
  chatTemplate?: 'mistral' | 'llama' | 'generic'; // Chat template to use
}

export interface LLMRequest {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  isFirstTurn?: boolean; // For multi-turn conversations (affects instruction formatting)
}

export interface LLMResponse {
  text: string;
  tokensUsed: number;
  finishReason: string;
}

export interface EmbeddingRequest {
  text: string | string[];
}

export interface EmbeddingResponse {
  embeddings: number[][];
  dimensions: number;
}

export interface ChromaDBQuery {
  queryEmbedding: number[];
  topK: number;
  filters?: {
    controlIdHints?: { $contains?: string };
    controlFamily?: string;
    baseline?: string;
    topologyVersion?: { $gte?: number };
  };
}

export interface ChromaDBResult {
  id: string;
  text: string;
  metadata: Record<string, any>;
  score: number;
}

export interface RAGRequest {
  controlId: string;
  baseline: 'LOW' | 'MODERATE' | 'HIGH';
  systemName: string;
  selectedDeviceIds?: string[];
  selectedBoundaryIds?: string[];
  additionalContext?: string;
  topologyVersion?: number;
}

export interface RAGResponse {
  controlId: string;
  narrative: string;
  references: Array<{ chunkId: string; reason: string; score: number }>;
  tokensUsed: number;
  retrievedChunks: ChromaDBResult[];
}

export interface TopologyContext {
  deviceCount: number;
  devicesByType: Record<string, number>;
  zones: string[];
  securityMetrics: {
    mfaEnabled: number;
    encryptionAtRest: number;
    encryptionInTransit: number;
    backupsConfigured: number;
  };
  selectedDevices: Array<{
    id: string;
    name: string;
    type: string;
    os?: string;
    zone?: string;
    riskLevel?: string;
    encryptionStatus?: string;
    securityNotes?: string;
  }>;
  selectedBoundaries: Array<{
    id: string;
    label: string;
    type: string;
    zoneType?: string;
  }>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  references?: Array<{ chunkId: string; reason: string }>;
}

export interface AINarrativeStatus {
  controlId: string;
  status: 'idle' | 'queued' | 'retrieving' | 'generating' | 'completed' | 'error';
  narrative?: string;
  references?: Array<{ chunkId: string; reason: string; score: number }>;
  error?: string;
  requestedAt: number;
  updatedAt: number;
}

export interface AIServiceStatus {
  status: 'not_initialized' | 'initializing' | 'loading' | 'ready' | 'error';
  llmStatus: 'not_loaded' | 'loading' | 'ready' | 'error';
  embeddingStatus: 'not_loaded' | 'loading' | 'ready' | 'error';
  chromaDbStatus: 'not_connected' | 'connecting' | 'connected' | 'error';
  gpuBackend: 'auto' | 'cuda' | 'metal' | 'vulkan' | 'cpu';
  error?: string;
  modelInfo?: {
    llmModel: string;
    embeddingModel: string;
    contextWindow: number;
  };
}

// NIST RAG Query Types (following Wang et al. 2024 best practices)

export type SearchScope = 'user' | 'shared' | 'both';

/**
 * Explanation mode for AI responses
 * - 'standard': Four-section structured response (Purpose, Requirements, Implementations, Evidence)
 * - 'eli5': Explain Like I'm 5 - Uses analogies and simple language
 */
export type ExplanationMode = 'standard' | 'eli5';

export interface NISTQueryRequest {
  query: string;
  documentTypes?: string[];  // Filter by document_type metadata
  families?: string[];        // Filter by control family
  topK?: number;              // Number of small chunks to retrieve
  maxTokens?: number;         // Maximum tokens for LLM response
  maxContextTokens?: number;  // Maximum tokens for context (parent chunks)
  searchScope?: SearchScope;  // Which document sources to search
  explanationMode?: ExplanationMode;  // Response format mode (standard or eli5)
}

export interface NISTQueryResponse {
  answer: string;
  retrievedChunks: ChromaDBResult[];
  references: Array<{
    chunkId: string;
    documentType: string;
    controlId?: string;
    controlName?: string;
    family?: string;
    parentTokenCount: number;
    score: number;
    hypotheticalQuestions?: string[];
    source?: 'user_document' | 'compliance_library';
    filename?: string;
  }>;
  tokensUsed: number;
  contextTokensUsed: number;
}

export interface NISTQueryHistory {
  id: string;
  query: string;
  response: NISTQueryResponse;
  timestamp: number;
  filters?: {
    documentTypes?: string[];
    families?: string[];
  };
}

// Extended ChromaDB query for Small2Big retrieval
export interface ChromaDBSmall2BigQuery {
  queryEmbedding: number[];
  topK: number;
  filters?: {
    is_small_chunk?: boolean;
    document_type?: { $in?: string[] };
    family?: { $in?: string[] };
    token_count?: { $lte?: number };
    section_type?: { $in?: ControlSectionType[] };
    [key: string]: any;
  };
}

/**
 * Control section types for structured AI responses
 * Matches the assessor workflow: intent → requirement → implementation → evidence
 */
export type ControlSectionType = 'purpose' | 'control_requirements' | 'common_implementations' | 'typical_evidence';

/**
 * Extended metadata for ChromaDB documents supporting structured responses
 */
export interface StructuredDocumentMetadata {
  // Standard Small2Big metadata
  is_small_chunk?: boolean;
  parent_text?: string;
  parent_token_count?: number;
  token_count?: number;
  document_type?: string;
  control_id?: string;
  control_name?: string;
  family?: string;

  // Section type for structured responses
  section_type?: ControlSectionType;

  // Source tracking
  source?: 'user_document' | 'compliance_library';
  filename?: string;

  // Additional metadata
  hypothetical_questions?: string[];
  [key: string]: any;
}

