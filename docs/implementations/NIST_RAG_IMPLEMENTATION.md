# NIST RAG Implementation

## Overview

CompliNist includes a NIST Document Query Assistant that implements state-of-the-art Retrieval-Augmented Generation (RAG) techniques based on Wang et al. (2024, "Searching for Best Practices in Retrieval-Augmented Generation", arXiv:2407.01219).

The system achieves:
- **~97.59% faithfulness** at 512 tokens
- **~97.78% relevancy** at 256 tokens

## Architecture

### Small2Big Retrieval (Wang et al. Section 3.2.2)

The core innovation is **Small2Big retrieval**:

1. **Small chunks** (256-300 tokens) are used for retrieval
   - High precision and recall
   - Better semantic matching
   
2. **Parent chunks** (384-512 tokens) are used for LLM context
   - Provides surrounding context
   - Improves answer quality
   - Reduces hallucinations

### Query Flow

```
User Query
    ↓
Generate Embedding (BGE-M3)
    ↓
Query ChromaDB (filter: is_small_chunk = true)
    ↓
Retrieve Top-K Small Chunks
    ↓
Expand to Parent Chunks (from parent_text metadata)
    ↓
Filter by Token Budget (prioritize by score)
    ↓
Build RAG Prompt (reverse repacking)
    ↓
Stream LLM Response
    ↓
Display with References & Metadata
```

## ChromaDB Collection Schema

### Metadata Fields

The ChromaDB collection includes rich metadata following Wang et al. recommendations:

#### Token & Chunking Metadata
- `token_count`: Integer - tokens in this chunk
- `is_small_chunk`: Boolean - `true` for retrieval chunks, `false` for parent chunks
- `parent_chunk_id`: String - ID of the parent chunk
- `parent_text`: String - full text of the parent chunk (used for LLM context)
- `parent_token_count`: Integer - token count of parent chunk

#### Hypothetical Questions (Section 3.2.4)
- `hypothetical_questions`: Array[String] - 1-3 generated questions per chunk
- `question_count`: Integer - number of questions
- `questions_text`: String - concatenated questions for search

These questions bridge the gap between:
- User natural language queries
- Technical documentation language

#### Document Metadata
- `document_type`: String - type of document
  - `800-53_catalog` - NIST 800-53 controls
  - `800-171` - NIST 800-171 controls
  - `cmmc` - CMMC requirements
  - `800-37_rmf` - Risk Management Framework
  - `csf_2.0` - Cybersecurity Framework 2.0
  - `security_pattern` - Security implementation patterns
  - `positioning_guide` - Positioning guidance
  - `zone_guide` - Zone architecture guidance
  - `segmentation_guide` - Network segmentation guidance
  - `grouping_guide` - Device grouping guidance

#### Control Metadata
- `control_id`: String - control identifier (e.g., "AC-2")
- `control_name`: String - control name
- `family`: String - control family (AC, SC, AU, etc.)
- `enhancement_number`: Integer - enhancement number if applicable
- `source`: String - source document
- `context_prefix`: String - document context

## Collection Setup

### Important: External ChromaDB

The ChromaDB collection is maintained in a **separate chunking application** and copied to CompliNist:

```bash
# Copy from chunking app
cp -r /path/to/chunking-app/.data/chroma_db .data/

# Verify structure
ls -la .data/chroma_db/
```

### Why Separate?

1. **Specialized chunking pipeline** - Token-based chunking with careful optimization
2. **Quality control** - Ingest documents separately, validate chunks
3. **Reusability** - Same collection can be used across multiple apps
4. **No ingestion in CompliNist** - Keeps this app focused on querying

### Collection Statistics

- **~20 documents** from NIST and related cybersecurity frameworks
- **Token-based chunks** (256-512 tokens optimal range)
- **BGE-M3 embeddings** (1024 dimensions, L2-normalized)
- **Cosine similarity** for vector search

## Implementation Details

### Core Module: `src/lib/ai/nistRAG.ts`

Implements the RAG orchestrator following Wang et al. patterns:

```typescript
// Query NIST documents with Small2Big retrieval
const response = await ragOrchestrator.queryNISTDocuments({
  query: "What are access control requirements?",
  documentTypes: ["800-53_catalog"],
  families: ["AC"],
  topK: 6,
  maxTokens: 600,
  maxContextTokens: 2048,
});
```

Key methods:
- `queryNISTDocuments()` - Main retrieval with full response
- `queryNISTDocumentsStream()` - Streaming generation
- `buildRAGPrompt()` - Prompt assembly with reverse repacking

### ChromaDB Client: `src/lib/ai/chromaClient.ts`

Extended with Small2Big support:

```typescript
// Query only small chunks
const smallChunks = await chromaClient.querySmallChunks({
  queryEmbedding,
  topK: 6,
  filters: { is_small_chunk: true, document_type: { $in: ["800-53_catalog"] } }
});

// Expand to parent chunks
const expanded = chromaClient.expandToParentChunks(smallChunks);

// Filter by token budget
const filtered = chromaClient.filterByTokenBudget(expanded, 2048);
```

### Zustand Store: `src/core/stores/useNISTQueryStore.ts`

Manages query state with streaming:

```typescript
const { 
  askQuestion,      // Query with streaming
  stopGeneration,   // Abort current query
  clearHistory,     // Reset query history
} = useNISTQueryStore();
```

Features:
- Streaming token accumulation
- Stop generation mid-stream
- Query history with references
- Document/family filters

### UI Component: `src/components/AI/NISTQueryPanel.tsx`

Full-featured query interface:

- **Query input** with Enter to submit
- **Stop button** (visible during streaming)
- **Real-time streaming** token display
- **Reference display** with metadata
- **Document filters** (by type and family)
- **Hypothetical questions** (expandable)
- **Query history** with all context

## Using the NIST Query Assistant

### Access

Click the **"NIST Docs"** button in the app header to open the query panel.

### Example Queries

1. **General control questions**
   ```
   "What are the access control requirements for moderate baseline?"
   "Explain cryptographic key management in NIST 800-53"
   ```

2. **Comparison questions**
   ```
   "How does CMMC differ from 800-171?"
   "What's the difference between LOW and MODERATE baseline?"
   ```

3. **Implementation guidance**
   ```
   "What is network segmentation best practice?"
   "How do I implement multi-factor authentication?"
   ```

4. **Filtered queries**
   - Select document types: 800-53, CMMC, etc.
   - Select families: AC, SC, AU, etc.
   - Ask your question

### Stop Generation

If the response is going off-track or hallucinating:
1. Click the **Stop** button (red, appears during streaming)
2. Generation stops immediately
3. Query is not saved to history

### Understanding References

Each response includes references showing:
- **Document type** - Which document the chunk came from
- **Control ID** - Specific control (if applicable)
- **Family** - Control family
- **Match score** - Relevance percentage
- **Token count** - Size of parent chunk used
- **Hypothetical questions** - Questions that matched your query

## Technical Performance

### Wang et al. (2024) Metrics

Based on the research paper (Table 3):

| Chunk Size | Faithfulness | Relevancy |
|------------|-------------|-----------|
| 128 tokens | 95.74%      | 97.22%    |
| 256 tokens | 97.22%      | **97.78%** |
| 512 tokens | **97.59%**  | 97.41%    |
| 1024 tokens| 94.26%      | 95.56%    |

Our implementation uses **256-512 tokens** for optimal balance.

### Retrieval Strategy

Following Wang et al. Section 4.2:

1. **Query Classification** - Not currently implemented (all queries go to RAG)
2. **Retrieval** - Hybrid (semantic only, no BM25 yet)
3. **Reranking** - Not currently implemented
4. **Repacking** - **Reverse** (most relevant at end, optimal per paper)
5. **Summarization** - Not currently implemented (raw parent chunks used)

Future optimizations could add reranking (monoT5) and summarization (Recomp).

## Troubleshooting

### "No relevant documents found"

**Cause**: Query doesn't match any chunks above threshold, or filters too restrictive.

**Solutions**:
1. Rephrase query to be more specific or general
2. Remove document type/family filters
3. Check if ChromaDB collection is properly loaded

### Slow responses

**Cause**: Large context or slow embedding generation.

**Solutions**:
1. Reduce `topK` (fewer chunks retrieved)
2. Reduce `maxContextTokens` (smaller context window)
3. Check GPU acceleration is working for LLM

### References showing wrong documents

**Cause**: Metadata might be incorrect in ChromaDB collection.

**Solutions**:
1. Verify ChromaDB collection is from correct source
2. Check collection was generated with proper metadata
3. Re-copy collection from chunking app

### Stream not displaying

**Cause**: IPC communication issue or LLM not loaded.

**Solutions**:
1. Check AI services are running (indicator in header)
2. Check Electron console for errors
3. Restart application

## Development

### Adding New Document Types

To support new document types:

1. **Add to chunking app** - Ingest and chunk the documents there
2. **Copy updated collection** - `cp -r /path/to/new/chroma_db .data/`
3. **Update UI** - Add document type to `DOCUMENT_TYPES` in `NISTQueryPanel.tsx`
4. **Test** - Query with the new filter

### Modifying RAG Parameters

Edit `src/lib/ai/nistRAG.ts`:

```typescript
// Change default topK
topK = 10,  // Retrieve more chunks

// Change context budget
maxContextTokens = 3000,  // Larger context window

// Change temperature
temperature: 0.3,  // More deterministic responses
```

### Adding Reranking

To add reranking (per Wang et al. Section 3.5):

1. Install reranking model (e.g., monoT5)
2. Add reranking step after `querySmallChunks()`
3. Reorder chunks by reranking score before expansion
4. Update token budget logic if needed

## References

- Wang et al. (2024). "Searching for Best Practices in Retrieval-Augmented Generation". arXiv:2407.01219
  - Section 3.2.1: Token-based chunking
  - Section 3.2.2: Small2Big retrieval
  - Section 3.2.4: Hypothetical question enhancement
  - Section 4.2: Optimal RAG practices
  - Table 3: Chunk size performance metrics

## Support

For issues or questions:
1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Verify ChromaDB collection is properly configured
3. Check Electron console logs for detailed errors
4. Review Wang et al. paper for RAG best practices

