# Business Logic Libraries Memory

Context for working in `src/lib/` - business logic libraries organized by domain.

---

## Directory Structure

```
src/lib/
├── ai/               # AI/RAG services
├── controls/         # NIST control catalog
├── export/           # Export utilities
├── layout/           # Graph layout algorithms
├── ssp/              # SSP generation
├── terraform/         # Terraform parsing
├── topology/         # Topology analysis
└── utils/            # Shared utilities
```

---

## Library Organization

**Each library is domain-specific** and contains:
- Business logic functions
- Type definitions (if domain-specific)
- Utilities for that domain
- **No React/UI code** - pure TypeScript functions

**Pattern**: Libraries are called by components and stores, not the other way around.

---

## AI Library (`src/lib/ai/`)

**Purpose**: AI/RAG services and orchestration.

**Key Files**:
- `ragOrchestrator.ts` - RAG orchestration
- `nistRAG.ts` - NIST document RAG (Small2Big pattern)
- `llamaServer.ts` - LLM client (Electron IPC wrapper)
- `embeddingService.ts` - Embedding client (Electron IPC wrapper)
- `chromaClient.ts` - ChromaDB client (Electron IPC wrapper)
- `types.ts` - AI-related types

**Usage**:
```typescript
import { getRAGOrchestrator } from '@/lib/ai/ragOrchestrator';
import { getLLMServer } from '@/lib/ai/llamaServer';

const orchestrator = getRAGOrchestrator();
const response = await orchestrator.queryNISTDocuments(request);
```

**See**: `@.cursor/rules/ai-rag.md` for detailed patterns.

---

## Controls Library (`src/lib/controls/`)

**Purpose**: NIST control catalog, recommendations, and suggestions.

**Key Files**:
- `controlCatalog.ts` - Control catalog loading
- `controlRecommendations.ts` - Topology-based recommendations
- `controlSuggestions.ts` - Device-based suggestions

**Usage**:
```typescript
import { getAllControlsWithBaselineFlags } from '@/lib/controls/controlCatalog';
import { getControlRecommendations } from '@/lib/controls/controlRecommendations';

const catalog = await getAllControlsWithBaselineFlags('MODERATE');
const recommendations = getControlRecommendations(nodes, edges);
```

---

## Topology Library (`src/lib/topology/`)

**Purpose**: Topology analysis, inventory extraction, and layout orchestration.

**Key Files**:
- `topologyAnalyzer.ts` - Network topology analysis
- `inventoryExtractor.ts` - Device inventory extraction
- `flowAnalysis.ts` - Flow analysis
- `auto-tidy.ts` - Layout orchestration (coordinates ELK/Dagre)
- `layoutLogger.ts` - Environment-aware logging

**Usage**:
```typescript
import { analyzeTopology } from '@/lib/topology/topologyAnalyzer';
import { extractInventoryByCategory } from '@/lib/topology/inventoryExtractor';

const intelligence = analyzeTopology(nodes, edges);
const inventory = extractInventoryByCategory(nodes, edges);
```

**Returns**:
```typescript
{
  devices: { details: DeviceDetail[] },
  boundaries: { zones: SecurityZone[] },
  connections: ConnectionDetail[],
  security: SecurityAnalysis
}
```

---

## Export Library (`src/lib/export/`)

**Purpose**: Export utilities for diagrams and reports.

**Key Files**:
- `exportUtils.ts` - JSON export/import
- `modernExport.ts` - SVG/PNG export
- `svgExport.ts` - SVG export utilities
- `imageExport.ts` - Image export utilities

**Usage**:
```typescript
import { exportToJSON } from '@/lib/export/exportUtils';
import { exportDiagramAsSVG } from '@/lib/export/modernExport';

const result = await exportToJSON(nodes, edges, projectName, projectId);
const svg = await exportDiagramAsSVG(projectName, nodes, edges, ...);
```

---

## SSP Library (`src/lib/ssp/`)

**Purpose**: SSP document generation and validation.

**Key Files**:
- `sspGenerator.ts` - SSP document generation
- `sspValidation.ts` - SSP validation
- `sspPrintTemplate.tsx` - React template for SSP

**Usage**:
```typescript
import { buildSSPDocument, generateSSPFromDocument } from '@/lib/ssp/sspGenerator';

const document = buildSSPDocument(request);
const pdf = await generateSSPFromDocument(document);
```

---

## Layout Library (`src/lib/layout/`)

**Purpose**: Graph layout algorithms for hierarchical diagrams with nested boundary support.

**Key Files**:
- `elkLayout.ts` - ELKjs layout engine (primary, supports nested boundaries)
- `dagreLayout.ts` - Dagre layout engine (fallback)
- `layoutConfig.ts` - Layout constants and defaults
- `layoutInterface.ts` - Shared types and interfaces
- `layoutDebugger.ts` - Conditional debug logging

**Usage**:
```typescript
import { applyElkLayout } from '@/lib/layout/elkLayout';
import { layoutDebugger } from '@/lib/layout/layoutDebugger';

// Apply ELK layout
const result = await applyElkLayout(nodes, edges, {
  direction: 'RIGHT',
  boundaryPadding: 45,
  nestedBoundarySpacing: 30,
  autoResize: true,
});

// Conditional debug logging
layoutDebugger.log('Layout complete:', result.stats);
```

**Key Features**:
- Native nested boundary support via ELKjs
- Configurable padding and spacing
- Auto-resize boundaries to fit content
- Debug mode with conditional logging

**See**: `@docs/LAYOUT_SYSTEM.md` for comprehensive documentation.

---

## Terraform Library (`src/lib/terraform/`)

**Purpose**: Terraform parsing and infrastructure mapping.

**Key Files**:
- Terraform parsing utilities
- Infrastructure mapping

**Usage**: Called by Terraform import feature.

---

## Utils Library (`src/lib/utils/`)

**Purpose**: Shared utilities used across the application.

**Key Files**:
- `database.ts` - Database client (legacy, use `@/core/database/client` instead)
- `types.ts` - Legacy types (being migrated to `@/core/types`)
- `deviceIconMapping.ts` - Device icon metadata
- `narrativeGenerators.ts` - Narrative generation utilities
- Other utility functions

**Note**: Some files in `utils/` are legacy and being migrated to `core/`.

---

## IPC Usage Pattern

**Libraries use Electron IPC** for system operations:

```typescript
// In lib/ai/llamaServer.ts
const response = await window.electronAPI.invoke('ai:llm-generate', { prompt });
```

**Pattern**: Libraries wrap IPC calls with type-safe interfaces.

---

## No React/UI Code

**Rule**: Libraries contain **no React components or UI code**.

**If you need UI**:
- Create components in `src/components/` or `src/features/*/components/`
- Libraries provide data/logic, components render UI

---

## Type Definitions

**Domain-Specific Types**: Each library may have its own types.

**Shared Types**: Use `src/core/types/` for shared types.

**Legacy Types**: Some types still in `src/lib/utils/types.ts` (being migrated).

---

## Best Practices

1. **Pure Functions**: Libraries contain pure TypeScript functions
2. **No Side Effects**: Minimize side effects, use IPC for system operations
3. **Type Safety**: Use TypeScript types throughout
4. **Error Handling**: Return errors, don't throw (or document throws)
5. **Testability**: Functions should be easily testable
6. **Documentation**: Document function purposes and parameters

---

## Import Patterns

**From Libraries**:
```typescript
import { analyzeTopology } from '@/lib/topology/topologyAnalyzer';
import { getRAGOrchestrator } from '@/lib/ai/ragOrchestrator';
```

**Within Libraries**:
```typescript
import { AppNode, AppEdge } from '@/lib/utils/types';
// Or from core/types when migrated
```

---

## Testing

**Unit Tests**: Test libraries in isolation.

**Location**: `tests/unit/` organized by library domain.

**Pattern**: Mock IPC calls, test pure functions.

---

## References

- Root Memory: `@CLAUDE.md`
- Architecture: `@docs/ARCHITECTURE.md`
- Module Guide: `@docs/MODULE_GUIDE.md`
- AI/RAG Patterns: `@.cursor/rules/ai-rag.md`
- IPC Patterns: `@.cursor/rules/electron-ipc.md`
