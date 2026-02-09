# Testing the AI System

Quick reference guide for testing the AI embedding and RAG system in CompliNist.

## Prerequisites

1. **AI Models**: Ensure models are downloaded and placed in `.data/models/`:
   - `mistral-7b-instruct-v0.1.Q4_K_M.gguf` (LLM)
   - `bge-m3-FP16.gguf` (Embeddings)

2. **Build**: Run `npm run build` before testing

3. **Dependencies**: Run `npm install` to ensure all deps are installed

## Quick Tests

### 1. Schema Validation Test (Fastest)
Tests the Zod schema fix for accepting string or array.

```bash
node scripts/test/test-ai-embedding-fix.js
```

**Expected Output:**
```
✨ All tests passed! The schema fix is working correctly.
📊 Test Results: 9 passed, 0 failed
```

**Duration:** < 1 second

---

### 2. Integration Test (Manual)
Launches the Electron app for manual verification.

```bash
node scripts/test/test-ai-embedding-integration.js
```

**Test Steps:**
1. Wait for app to load (AI models preload ~30 seconds)
2. Navigate to "AI Assistant" view
3. Select "NIST Documents" mode
4. Type: `what is ac-3`
5. Click Send

**Expected Result:**
- ✅ No error in console
- ✅ Streaming response about AC-3 (Access Enforcement)
- ✅ Response includes NIST control details

**Previous Error (now fixed):**
```
❌ Error: IPC validation failed for ai:embed:
   text: Invalid input: expected string, received array
```

**Duration:** ~1-2 minutes (including model preload)

---

### 3. E2E Test Suite (Playwright)
Automated end-to-end tests using Playwright.

```bash
npx playwright test tests/e2e/ai-embedding.spec.js
```

**Test Cases:**
- ✅ Embed single string via IPC
- ✅ Embed array of strings via IPC
- ✅ NIST query with query expansion
- ✅ ChromaDB vector search
- ✅ AI service health check
- ✅ Invalid input rejection
- ✅ Embedding caching
- ✅ Control ID extraction

**Duration:** ~2-3 minutes

---

## Development Tests

### Watch Mode (Vitest)
For unit tests of AI utilities:

```bash
npm run test:watch -- tests/unit/ai
```

### Type Checking
Ensure TypeScript types are correct:

```bash
npm run typecheck
```

### Linting
Check code quality:

```bash
npm run lint
```

---

## CLI AI Testing

Test AI services from command line:

```bash
# Check AI service health
npm run ai:health

# Query NIST documents
npm run ai:query

# Interactive AI CLI
npm run ai:cli
```

---

## Debugging

### Enable Debug Logging

```bash
# Launch with debug enabled
npm run dev:debug
```

Then open Chrome DevTools at `chrome://inspect`

### Check Logs

**Renderer Console:**
- Open DevTools (F12)
- Look for `[NIST RAG]`, `[AI Service]`, `[Embedding]` prefixes

**Main Process Logs:**
- Check terminal where you ran `npm run dev:hmr`
- Look for `[AI IPC]`, `[AI]` prefixes

**Key Log Patterns:**

**Success:**
```
[NIST RAG Stream] Expanded query: "what is ac-3" → "what is AC-3 (Access Enforcement)"
[AI IPC] Embed request { textType: 'object', isArray: true, length: 1 }
[AI IPC] Embed success { embeddingsCount: 1, dimensions: 1024 }
```

**Failure (pre-fix):**
```
[AI IPC] Embed error: IPC validation failed for ai:embed
```

---

## Performance Benchmarks

### Expected Timings

| Operation | Expected Duration |
|-----------|-------------------|
| AI Service Init | 5-30 seconds (first time) |
| Embedding (single) | 100-500ms |
| Embedding (batch of 3) | 200-1000ms |
| NIST Query (full) | 2-5 seconds |
| LLM Response | 5-15 seconds |

**Note:** Times vary based on:
- CPU/GPU availability
- Model size (7B parameters)
- Context length
- System load

---

## Troubleshooting

### "AI models not found"

**Solution:**
```bash
# Check model paths
ls -lh .data/models/

# Should show:
# mistral-7b-instruct-v0.1.Q4_K_M.gguf (~4GB)
# bge-m3-FP16.gguf (~2GB)
```

### "IPC validation failed"

**Solution:**
- Ensure you've pulled the latest fix
- Check `electron/ipc-validation.js` line 192-198
- Should accept `z.union([string, array])`

### "Embedding generation timed out"

**Solution:**
```bash
# Rebuild native modules
npm run electron:rebuild

# Check GPU layers
# Edit electron/ai-service-manager.js line 266
# Try reducing GPU layers or forcing CPU: gpuLayers = 0
```

### "ChromaDB query failed"

**Solution:**
```bash
# Verify ChromaDB is initialized
# Check .data/chromadb/ exists

# Re-ingest NIST documents
npm run ingest:800-53
```

---

## Continuous Integration

### GitLab CI Pipeline

Tests run automatically on push:

```yaml
test:unit:
  script:
    - npm run test:run

test:ai:
  script:
    - node scripts/test/test-ai-embedding-fix.js
```

### Pre-commit Checks

```bash
# Run before committing
npm run lint
npm run typecheck
npm run test:run
```

---

## Test Coverage

### AI System Coverage

| Component | Unit Tests | Integration | E2E |
|-----------|-----------|-------------|-----|
| Embedding Service | ✅ | ✅ | ✅ |
| NIST RAG | ✅ | ✅ | ✅ |
| IPC Validation | ✅ | ✅ | ✅ |
| Control Catalog | ✅ | ❌ | ❌ |
| ChromaDB | ❌ | ✅ | ✅ |

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View in UI
npm run test:coverage:ui
```

---

## Next Steps

After testing the AI embedding fix:

1. ✅ Verify schema validation passes
2. ✅ Test NIST queries in running app
3. ✅ Check AI-generated narratives work
4. ✅ Verify document RAG queries work
5. 📝 Update regression test suite
6. 📝 Add performance benchmarks
7. 📝 Document any edge cases

---

**Related Documentation:**
- [AI Integration Summary](./AI_INTEGRATION_SUMMARY.md)
- [AI Embedding Fix Details](./AI_EMBEDDING_FIX.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Architecture Overview](./ARCHITECTURE.md)

---

**Last Updated:** 2026-01-11
**Tested Versions:**
- Electron: 33.x
- node-llama-cpp: Latest
- Zod: 3.x
