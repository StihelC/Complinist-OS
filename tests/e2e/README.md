# E2E Test Suite

This directory contains end-to-end tests for CompliNist using various testing approaches.

## Test Suites

### 1. License Import Tests
Tests for the license file import system.

**License Test Files:**
- `license/test-license-import.mjs` - Basic license import flow tests
- `license/test-cancel-scenario.mjs` - Cancel dialog scenario tests
- `license/test-persistence.mjs` - License persistence tests
- `license/test-electron-license.mjs` - Electron app test infrastructure
- `license/test-helpers.ts` - Test helper utilities

### 2. AI Embedding System Tests
Comprehensive tests for AI embedding, NIST RAG, and vector search.

**AI Test Files:**
- `ai-embedding.spec.js` - Full E2E test suite using Playwright

**Features Tested:**
- ✅ IPC validation (string and array inputs)
- ✅ Embedding generation (single and batch)
- ✅ ChromaDB vector search
- ✅ NIST RAG orchestration
- ✅ Query expansion with control IDs
- ✅ Error handling and caching

**Quick Commands:**
```bash
# Diagnostic check
npm run test:ai:diagnose

# Schema validation (fastest)
npm run test:ai:schema

# Manual integration test
npm run test:ai:integration

# Full E2E suite
npm run test:ai:e2e
```

## Documentation

- `CODE_AUDIT.md` - Code audit findings and comparison with working import-json handler
- `TEST_RESULTS.md` - Comprehensive test results and findings
- `README.md` - This file

## Running Tests

### Run All Tests
```bash
npm run test:license:all
```

### Run Individual Test Suites
```bash
# Basic license import tests
npm run test:license

# Cancel dialog tests
npm run test:license:cancel

# Persistence tests
npm run test:license:persistence
```

## Test Requirements

- Real license file at `/home/cam/1.license`
- Node.js v18+
- better-sqlite3 (for persistence tests)

## Test Results

Test results are saved as JSON files:
- `test-results.json` - Basic import tests
- `cancel-test-results.json` - Cancel scenario tests
- `persistence-test-results.json` - Persistence tests

## License File Format

The test expects a license file with the following structure:
```json
{
  "license_code": "string",
  "user_id": "string",
  "email": "string",
  "expires_at": number,
  "subscription_status": "active",
  "subscription_plan": "string",
  "subscription_id": "string",
  "created_at": number
}
```

## Notes

- Tests use the real license file from `/home/cam/1.license`
- Full Electron app testing requires manual interaction or advanced test framework
- Database tests create a test database at `test-license.db` in project root

