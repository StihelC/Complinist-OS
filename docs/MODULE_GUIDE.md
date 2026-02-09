# CompliNist Module Guide

Purpose, APIs, and usage guidelines for each major module in CompliNist.

---

## Core Infrastructure Modules

### Stores (`src/core/stores/`)

#### useFlowStore

**Purpose**: Central store for topology state, project management, and diagram operations.

**Key State**:
- `nodes: AppNode[]` - Topology nodes (devices, boundaries)
- `edges: AppEdge[]` - Connections between nodes
- `currentProject: Project | null` - Active project
- `projects: Project[]` - All projects
- `globalSettings: GlobalSettings` - UI settings

**Key Actions**:
- `loadProject(id)` - Load project and diagram
- `createNewProject()` - Create new project
- `saveCurrentDiagram()` - Auto-save diagram
- `exportFullReport()` - Export JSON report
- `importDiagramFromJSON()` - Import JSON diagram
- `setNodes(nodes)` - Update nodes (auto-saves)
- `setEdges(edges)` - Update edges (auto-saves)

**Usage**:
```typescript
import { useFlowStore } from '@/core/stores/useFlowStore';

const { nodes, edges, currentProject, loadProject } = useFlowStore();
```

**When to Use**:
- Any component that needs topology data
- Project management operations
- Diagram export/import
- Global settings

**Cross-Store Access**:
Accessed via `flowStoreAccessor` module for type-safe cross-module access without circular dependencies.

---

#### useControlNarrativesStore

**Purpose**: Manages NIST control narratives, baseline selection, and auto-population.

**Key State**:
- `items: Record<string, ControlNarrative>` - All controls with narratives
- `families: ControlFamily[]` - Controls grouped by family
- `baseline: NistBaseline` - Current baseline
- `dirtyIds: Set<string>` - Controls with unsaved changes

**Key Actions**:
- `loadControls({ baseline, projectId })` - Load control catalog
- `updateNarrative(controlId, text)` - Update narrative text
- `updateStatus(controlId, status)` - Update implementation status
- `saveNarratives()` - Save all dirty controls
- `autoPopulateFromTopology(nodes, edges)` - Auto-generate narratives

**Usage**:
```typescript
import { useControlNarrativesStore } from '@/core/stores/useControlNarrativesStore';

const { items, families, updateNarrative, saveNarratives } = useControlNarrativesStore();
```

**When to Use**:
- Control narrative editing
- Baseline management
- Auto-population from topology

**Dependencies**:
- Reads topology from `flowStoreAccessor` module
- Uses `lib/controls/controlCatalog` for control data
- Uses `lib/topology/topologyAnalyzer` for analysis

---

#### useAuthStore

**Purpose**: Manages license validation and feature gating.

**Key State**:
- `isAuthenticated: boolean` - License valid
- `license: LicenseFile | null` - License data
- `daysRemaining: number | null` - Days until expiration

**Key Actions**:
- `initialize()` - Load and validate license
- `importLicenseFile()` - Import license via file picker
- `checkAuth()` - Check authentication status

**Usage**:
```typescript
import { useAuthStore } from '@/core/stores/useAuthStore';

const { isAuthenticated, initialize } = useAuthStore();
```

**When to Use**:
- Feature gating (via `RequireAuth` component)
- License management UI
- App initialization

---

#### useAIServiceStore

**Purpose**: Tracks AI service health and configuration.

**Key State**:
- `status: AIServiceStatus` - Service status (ready/error/loading)
- `llmStatus: 'ready' | 'not_loaded'` - LLM status
- `embeddingStatus: 'ready' | 'not_loaded'` - Embedding status
- `chromaDbStatus: 'connected' | 'not_connected'` - ChromaDB status

**Key Actions**:
- `initialize()` - Initialize and check health
- `checkHealth()` - Check all services
- `setGPUBackend(backend)` - Set GPU backend

**Usage**:
```typescript
import { useAIServiceStore } from '@/core/stores/useAIServiceStore';

const { status, checkHealth } = useAIServiceStore();
```

**When to Use**:
- AI status indicators
- Service health monitoring
- GPU backend configuration

---

#### useSSPMetadataStore

**Purpose**: Manages SSP form data and metadata.

**Key State**:
- `metadata: Partial<SSPSystemCharacteristics> | null` - SSP form data
- `isDirty: boolean` - Has unsaved changes
- `selectedControlFamilies: string[]` - Selected families

**Key Actions**:
- `loadMetadata(projectId)` - Load saved metadata
- `saveMetadata(projectId)` - Save metadata
- `updateMetadata(updates)` - Update metadata
- `addCustomSection(section)` - Add custom section

**Usage**:
```typescript
import { useSSPMetadataStore } from '@/core/stores/sspMetadataStore';

const { metadata, loadMetadata, saveMetadata } = useSSPMetadataStore();
```

**When to Use**:
- SSP wizard form
- SSP metadata persistence

**Dependencies**:
- Syncs with `useControlSelectionStore` for control selection

---

#### useControlSelectionStore

**Purpose**: Unified control selection for SSP and narratives.

**Key State**:
- `selectedControlIds: string[]` - Selected control IDs
- `initialized: boolean` - Has been initialized

**Key Actions**:
- `setSelectedControlIds(ids)` - Set selection
- `toggleControl(controlId)` - Toggle control
- `selectByPriority(priorities)` - Select by priority
- `initializeSmartDefaults(nodes, edges, allControlIds)` - Smart initialization

**Usage**:
```typescript
import { useControlSelectionStore } from '@/core/stores/useControlSelectionStore';

const { selectedControlIds, toggleControl } = useControlSelectionStore();
```

**When to Use**:
- Control selection UI
- SSP control selection
- Smart defaults based on topology

---

#### useNISTQueryStore

**Purpose**: Manages NIST document queries with streaming.

**Key State**:
- `queryHistory: NISTQueryHistory[]` - Query history
- `currentResponse: string` - Streaming response
- `isStreaming: boolean` - Currently streaming
- `currentReferences: Reference[]` - Retrieved references

**Key Actions**:
- `askQuestion(query, options)` - Ask question with streaming
- `stopGeneration()` - Stop current generation
- `clearHistory()` - Clear query history

**Usage**:
```typescript
import { useNISTQueryStore } from '@/core/stores/useNISTQueryStore';

const { askQuestion, currentResponse, isStreaming } = useNISTQueryStore();
```

**When to Use**:
- NIST query interface
- AI chat with NIST documents
- Streaming response display

---

#### useAINarrativesStore

**Purpose**: Manages AI-generated narratives and chat history.

**Key State**:
- `narratives: Record<string, AINarrativeStatus>` - Narrative statuses
- `chatHistory: ChatMessage[]` - Chat history

**Key Actions**:
- `requestNarrative(request)` - Request narrative generation
- `generateNarrative(request)` - Generate narrative
- `acceptNarrative(controlId)` - Accept generated narrative
- `sendMessage(message, controlId?)` - Send chat message

**Usage**:
```typescript
import { useAINarrativesStore } from '@/core/stores/useAINarrativesStore';

const { requestNarrative, narratives } = useAINarrativesStore();
```

**When to Use**:
- AI narrative generation
- Narrative review UI
- Chat interface

---

## Business Logic Libraries

### lib/controls/

#### controlCatalog.ts

**Purpose**: Loads and manages NIST control catalog.

**Key Functions**:
- `getAllControlsWithBaselineFlags(baseline)` - Get controls for baseline
- `groupControlsByFamily(controls)` - Group by family
- `getControlById(controlId)` - Get single control

**Usage**:
```typescript
import { getAllControlsWithBaselineFlags } from '@/lib/controls/controlCatalog';

const catalog = await getAllControlsWithBaselineFlags('MODERATE');
```

**When to Use**:
- Loading control catalog
- Filtering by baseline
- Grouping controls

---

#### controlRecommendations.ts

**Purpose**: Provides control recommendations based on topology.

**Key Functions**:
- `getControlRecommendations(nodes, edges)` - Get recommendations

**Usage**:
```typescript
import { getControlRecommendations } from '@/lib/controls/controlRecommendations';

const recommendations = getControlRecommendations(nodes, edges);
```

**When to Use**:
- Smart control selection
- Topology-based recommendations

---

#### controlSuggestions.ts

**Purpose**: Suggests controls for devices based on type.

**Key Functions**:
- `getControlSuggestionsForDevice(deviceType, baseline)` - Get suggestions

**Usage**:
```typescript
import { getControlSuggestionsForDevice } from '@/lib/controls/controlSuggestions';

const suggestions = getControlSuggestionsForDevice('firewall', 'MODERATE');
```

**When to Use**:
- Device control suggestions
- Control assignment UI

---

### lib/layout/

#### elkLayout.ts

**Purpose**: ELKjs layout engine for hierarchical graph layout with native nested boundary support.

**Key Functions**:
- `applyElkLayout(nodes, edges, options)` - Apply ELK layout to entire diagram
- `applyElkLayoutToBoundary(boundaryId, nodes, edges, options)` - Layout single boundary

**Usage**:
```typescript
import { applyElkLayout } from '@/lib/layout/elkLayout';

const result = await applyElkLayout(nodes, edges, {
  direction: 'RIGHT',
  boundaryPadding: 45,
  nestedBoundarySpacing: 30,
});
```

**When to Use**:
- Auto-tidy layout operations
- Nested boundary layouts
- Hierarchical diagram organization

---

#### layoutDebugger.ts

**Purpose**: Conditional logging for layout operations, respects `layoutDebugMode` setting.

**Key Functions**:
- `layoutDebugger.log(message, ...args)` - Debug log (only when enabled)
- `layoutDebugger.info(message, ...args)` - Info log
- `layoutDebugger.warn(message, ...args)` - Warning log
- `layoutDebugger.error(message, ...args)` - Error log (always shown)
- `layoutDebugger.isEnabled()` - Check if debug mode is on

**Usage**:
```typescript
import { layoutDebugger } from '@/lib/layout/layoutDebugger';

layoutDebugger.log('Boundary padding:', padding);
```

**When to Use**:
- Layout algorithm debugging
- Conditional console output

---

### lib/topology/

#### auto-tidy.ts

**Purpose**: Orchestrates layout operations, coordinates between ELK/Dagre and manages tidy workflow.

**Key Functions**:
- `tidyDiagram(nodes, edges, options)` - Main tidy entry point
- `previewTidy(nodes, edges, options)` - Preview without applying
- `createTidyAnimation(original, target)` - Animation interpolation

**Usage**:
```typescript
import { tidyDiagram } from '@/lib/topology/auto-tidy';

const result = await tidyDiagram(nodes, edges, {
  layoutAlgorithm: 'elkjs',
  boundaryPadding: 45,
  autoResize: true,
});
```

**When to Use**:
- Auto-tidy feature
- Layout orchestration
- Boundary resizing

---

#### topologyAnalyzer.ts

**Purpose**: Analyzes topology to extract intelligence.

**Key Functions**:
- `analyzeTopology(nodes, edges)` - Full topology analysis
- `categorizeDevice(node)` - Categorize device type

**Returns**:
```typescript
{
  devices: { details: DeviceDetail[] },
  boundaries: { zones: SecurityZone[] },
  connections: ConnectionDetail[],
  security: SecurityAnalysis
}
```

**Usage**:
```typescript
import { analyzeTopology } from '@/lib/topology/topologyAnalyzer';

const intelligence = analyzeTopology(nodes, edges);
```

**When to Use**:
- Topology analysis
- Auto-population of narratives
- Control recommendations
- Security analysis

---

#### inventoryExtractor.ts

**Purpose**: Extracts device inventory from topology.

**Key Functions**:
- `extractInventoryByCategory(nodes, edges)` - Extract inventory

**Usage**:
```typescript
import { extractInventoryByCategory } from '@/lib/topology/inventoryExtractor';

const inventory = extractInventoryByCategory(nodes, edges);
```

**When to Use**:
- Inventory panel
- SSP generation
- Device reporting

---

### lib/ai/

#### ragOrchestrator.ts

**Purpose**: Orchestrates RAG queries across AI services.

**Key Functions**:
- `orchestrateQuery(request)` - Full RAG orchestration
- `queryNISTDocuments(request)` - Query NIST documents

**Usage**:
```typescript
import { getRAGOrchestrator } from '@/lib/ai/ragOrchestrator';

const orchestrator = getRAGOrchestrator();
const response = await orchestrator.queryNISTDocuments(request);
```

**When to Use**:
- AI query interface
- NIST document queries
- Narrative generation

---

#### nistRAG.ts

**Purpose**: Implements Small2Big RAG for NIST documents.

**Key Functions**:
- `queryNISTDocuments(request)` - Query with Small2Big
- `queryNISTDocumentsStream(request)` - Streaming query

**Usage**:
```typescript
import { getNISTRAGOrchestrator } from '@/lib/ai/nistRAG';

const rag = getNISTRAGOrchestrator();
const response = await rag.queryNISTDocuments(request);
```

**When to Use**:
- NIST-specific queries
- Streaming responses
- Context-aware retrieval

---

#### llamaServer.ts

**Purpose**: Client for LLM service via Electron IPC.

**Key Functions**:
- `generate(prompt, options)` - Generate text
- `generateStream(prompt, options)` - Stream generation
- `checkHealth()` - Check service health

**Usage**:
```typescript
import { getLLMServer } from '@/lib/ai/llamaServer';

const llm = getLLMServer();
const response = await llm.generate(prompt);
```

**When to Use**:
- Direct LLM access
- Custom prompts
- Health checks

---

#### embeddingService.ts

**Purpose**: Client for embedding service via Electron IPC.

**Key Functions**:
- `embed(text)` - Generate embedding
- `checkHealth()` - Check service health

**Usage**:
```typescript
import { getEmbeddingService } from '@/lib/ai/embeddingService';

const embedding = getEmbeddingService();
const vector = await embedding.embed(text);
```

**When to Use**:
- Text embedding
- Vector search preparation

---

#### chromaClient.ts

**Purpose**: Client for ChromaDB via Electron IPC.

**Key Functions**:
- `query(collection, queryVector, options)` - Vector search
- `add(collection, documents, embeddings)` - Add documents
- `checkHealth()` - Check connection

**Usage**:
```typescript
import { getChromaDBClient } from '@/lib/ai/chromaClient';

const chroma = getChromaDBClient();
const results = await chroma.query('documents', queryVector, { nResults: 5 });
```

**When to Use**:
- Vector search
- Document retrieval
- RAG context building

---

### lib/export/

#### exportUtils.ts

**Purpose**: JSON export/import utilities.

**Key Functions**:
- `exportToJSON(nodes, edges, projectName, projectId)` - Export JSON
- `importFromJSON()` - Import JSON
- `generateFullReport(nodes, edges, projectName, projectId)` - Generate report

**Usage**:
```typescript
import { exportToJSON } from '@/lib/export/exportUtils';

const result = await exportToJSON(nodes, edges, projectName, projectId);
```

**When to Use**:
- JSON export/import
- Full report generation
- Data backup

---

#### modernExport.ts

**Purpose**: Modern SVG/PNG export utilities.

**Key Functions**:
- `exportDiagramAsSVG(...)` - Export SVG
- `exportDiagramAsPNGFromSVG(...)` - Export PNG from SVG

**Usage**:
```typescript
import { exportDiagramAsSVG } from '@/lib/export/modernExport';

const result = await exportDiagramAsSVG(projectName, nodes, edges, ...);
```

**When to Use**:
- Image export
- Diagram export
- High-quality rendering

---

### lib/ssp/

#### sspGenerator.ts

**Purpose**: Generates SSP documents from topology and metadata.

**Key Functions**:
- `buildSSPDocument(request)` - Build SSP document
- `generateSSPFromDocument(document)` - Generate PDF

**Usage**:
```typescript
import { buildSSPDocument, generateSSPFromDocument } from '@/lib/ssp/sspGenerator';

const document = buildSSPDocument(request);
const pdf = await generateSSPFromDocument(document);
```

**When to Use**:
- SSP generation
- PDF creation
- Document assembly

---

### lib/utils/

#### database.ts

**Purpose**: Database client wrapper for Electron IPC.

**Key Functions**:
- `db.createProject(name, baseline)` - Create project
- `db.saveDiagram(projectId, nodes, edges, viewport)` - Save diagram
- `db.loadDiagram(projectId)` - Load diagram
- `db.saveControlNarratives(projectId, narratives)` - Save narratives

**Usage**:
```typescript
import { db } from '@/lib/utils/database';

const project = await db.createProject('My Project', 'MODERATE');
```

**When to Use**:
- All database operations
- Data persistence
- Project management

---

#### types.ts

**Purpose**: TypeScript type definitions.

**Key Types**:
- `AppNode`, `AppEdge` - Topology types
- `DeviceNodeData`, `BoundaryNodeData` - Node data
- `ControlNarrative` - Control narrative
- `SSPSystemCharacteristics` - SSP metadata
- `FullReport` - Export report

**Usage**:
```typescript
import type { AppNode, DeviceNodeData } from '@/lib/utils/types';
```

**When to Use**:
- Type definitions
- Type safety
- API contracts

---

## Component Modules

### Canvas Components (`components/Canvas/`)

**FlowCanvas.tsx** - Main ReactFlow canvas
- Renders topology diagram
- Handles node/edge interactions
- Manages viewport

**When to Use**: Topology view

---

### Node Components (`components/Nodes/`)

**DeviceNode.tsx** - Device node rendering
**GroupNode.tsx** - Boundary node rendering
**DeviceToolbar.tsx** - Device node toolbar
**BoundaryToolbar.tsx** - Boundary node toolbar

**When to Use**: Topology rendering

---

### Control Narrative Components (`components/ControlNarratives/`)

**ControlNarrativeEditor.tsx** - Main editor
**ControlCard.tsx** - Individual control card
**ControlFamilySection.tsx** - Family grouping
**CoverageGapPanel.tsx** - Coverage analysis

**When to Use**: Control narrative editing

---

### SSP Components (`components/SSP/`)

**SSPWizard.tsx** - Main SSP wizard
**SSPGeneratorModal.tsx** - Generation modal
**ControlSelectionWidget.tsx** - Control selection UI

**When to Use**: SSP generation

---

### AI Components (`components/AI/`)

**UnifiedAIChat.tsx** - Main AI chat interface
**NISTQueryPanel.tsx** - NIST query panel
**AIStatusIndicator.tsx** - Service status

**When to Use**: AI features

---

## Module Ownership

### Core Infrastructure
- **Stores** - State management team
- **Database** - Data persistence team
- **Types** - Shared types team

### Features
- **Topology** - Topology team
- **Controls** - Compliance team
- **SSP** - Documentation team
- **AI** - AI/ML team
- **Inventory** - Inventory team

### Shared
- **UI Components** - Design system team
- **Export** - Export team
- **Layout** - Layout team
- **Utils** - Shared utilities team

---

## Module Boundaries

### Do's
- ✅ Components use stores via hooks
- ✅ Stores use lib/ for business logic
- ✅ lib/ uses Electron IPC for system operations
- ✅ Features are self-contained

### Don'ts
- ❌ Components directly call Electron IPC
- ❌ Stores contain UI logic
- ❌ lib/ contains React components
- ❌ Features depend on other features directly

---

## Adding New Modules

### New Feature
1. Create feature directory: `src/features/my-feature/`
2. Add components: `components/`
3. Add services: `services/`
4. Create store if needed: `src/core/stores/useMyFeatureStore.ts`
5. Add to ViewRouter if needed (in `src/app/ViewRouter.tsx`)
6. Document in this guide

### New Utility
1. Add to appropriate `lib/` subdirectory
2. Export from index if needed
3. Document API in this guide

### New Store
1. Create in `src/core/stores/`
2. Use Zustand pattern
3. Document state and actions
4. Add to this guide
5. Export from `src/core/stores/index.ts`

---

## Migration Notes

After reorganization to feature-based structure:

1. **Features** become self-contained modules
2. **Core** infrastructure is shared
3. **Shared** utilities are reusable
4. **App** shell is minimal

Module boundaries will be clearer, making it easier to:
- Understand dependencies
- Test in isolation
- Add new features
- Maintain codebase

See `ARCHITECTURE.md` for reorganization details.

