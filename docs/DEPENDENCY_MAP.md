# CompliNist Dependency Map

Complete module dependency graph showing how components, stores, and libraries interact.

---

## Store Dependencies

### useFlowStore (`src/core/stores/useFlowStore.ts`)

**Dependencies**:
- `@xyflow/react` - ReactFlow types and utilities
- `@/core/types` - AppNode, AppEdge, Project, etc.
- `@/core/database/client` - Database client
- `@/lib/export/exportUtils` - JSON export/import

**Exports**:
- Accessible via `flowStoreAccessor` module for cross-store access

**Used By**:
- `App.tsx` - Main app component
- `ViewRouter.tsx` - View routing
- `FlowCanvas.tsx` - Canvas component
- `useControlNarrativesStore` - Reads topology data
- `useSSPMetadataStore` - Reads current project

**State Flow**:
```
User Interaction → ReactFlow Events → useFlowStore → src/core/database/client.ts → Electron IPC → SQLite
```

---

### useControlNarrativesStore (`src/core/stores/useControlNarrativesStore.ts`)

**Dependencies**:
- `@/core/types` - ControlNarrative, AppNode, AppEdge
- `@/lib/controls/controlCatalog` - Control catalog loading
- `@/core/database/client` - Database client
- `@/lib/topology/topologyAnalyzer` - Topology analysis
- `@/lib/utils/narrativeGenerators` - Auto-generation
- `@/core/stores/flowStoreAccessor` - Access flow store (avoids circular deps)

**Used By**:
- `ControlNarrativeEditor.tsx` - Main editor component
- `ControlCard.tsx` - Individual control cards
- `ControlFamilySection.tsx` - Family grouping

**State Flow**:
```
loadControls → controlCatalog → database → Electron IPC
autoPopulateFromTopology → topologyAnalyzer → narrativeGenerators
```

---

### useAuthStore (`src/core/stores/useAuthStore.ts`)

**Dependencies**:
- `@/lib/auth/licenseStore` - License validation
- `@/lib/auth/licenseFileValidator` - License types

**Used By**:
- `App.tsx` - Initialization
- `RequireAuth.tsx` - Feature gating
- `LicenseTokenDialog.tsx` - License UI

**State Flow**:
```
initialize → licenseStore → Electron IPC → License file validation
```

---

### useAIServiceStore (`src/core/stores/useAIServiceStore.ts`)

**Dependencies**:
- `@/lib/ai/types` - AIServiceStatus
- `@/lib/ai/llamaServer` - LLM service
- `@/lib/ai/embeddingService` - Embedding service
- `@/lib/ai/chromaClient` - ChromaDB client
- `@/lib/ai/config` - AI configuration

**Used By**:
- `AIStatusIndicator.tsx` - Status display
- `UnifiedAIChat.tsx` - AI chat interface

**State Flow**:
```
checkHealth → Electron IPC → ai-service-manager.js → AI services
```

---

### useSSPMetadataStore (`src/core/stores/sspMetadataStore.ts`)

**Dependencies**:
- `@/core/types` - SSPSystemCharacteristics
- `useControlSelectionStore` - Control selection sync

**Used By**:
- `SSPWizard.tsx` - SSP form
- `SSPGeneratorModal.tsx` - Generation modal

**State Flow**:
```
loadMetadata → Electron IPC → SQLite
saveMetadata → Electron IPC → SQLite
```

---

### useControlSelectionStore (`src/core/stores/useControlSelectionStore.ts`)

**Dependencies**:
- `@/core/types` - ControlPriority, AppNode, AppEdge
- `@/lib/controls/controlRecommendations` - Smart recommendations
- `assets/catalog/control-priorities.json` - Priority mappings

**Used By**:
- `SSPWizard.tsx` - Control selection
- `ControlSelectionWidget.tsx` - Selection UI
- `useSSPMetadataStore` - Metadata sync

**State Flow**:
```
initializeSmartDefaults → controlRecommendations → topology analysis
```

---

### useNISTQueryStore (`src/core/stores/useNISTQueryStore.ts`)

**Dependencies**:
- `@/lib/ai/types` - NISTQueryRequest, NISTQueryResponse
- `@/lib/ai/nistRAG` - RAG orchestrator

**Used By**:
- `UnifiedAIChat.tsx` - AI chat interface
- `NISTQueryPanel.tsx` - Query panel

**State Flow**:
```
askQuestion → nistRAG → ragOrchestrator → Electron IPC → AI services
```

---

### useAINarrativesStore (`src/core/stores/useAINarrativesStore.ts`)

**Dependencies**:
- `@/lib/ai/types` - AINarrativeStatus, ChatMessage
- `@/lib/ai/ragOrchestrator` - RAG orchestration
- `@/lib/ai/llamaServer` - LLM service
- `@/lib/ai/embeddingService` - Embedding service
- `@/lib/ai/chromaClient` - ChromaDB client
- `@/lib/ai/promptTemplates` - Prompt building
- `@/lib/controls/controlCatalog` - Control catalog
- `@/lib/controls/nistControls` - NIST control definitions

**Used By**:
- `UnifiedAIChat.tsx` - AI chat interface
- `NarrativeReviewModal.tsx` - Narrative review

**State Flow**:
```
requestNarrative → ragOrchestrator → nistRAG → Electron IPC → AI services
```

---

## Component Dependencies

### App Shell

**App.tsx**
- `useFlowStore` - Main topology store
- `useAuthStore` - Authentication
- `ViewRouter` - View routing
- `AppHeader` - Header component
- `ControlSuggestionModal` - Control suggestions
- `lib/export/modernExport` - Export utilities
- `lib/utils/deviceIconMapping` - Icon initialization

**ViewRouter.tsx**
- `FlowCanvas` - Topology view
- `InventoryPanel` - Inventory view
- `SSPWizard` - SSP view
- `ControlNarrativeEditor` - Narratives view
- `UnifiedAIChat` - AI view
- `DevicePalette` - Device palette
- `BoundaryForm` - Boundary creation
- `AlignmentPanel` - Alignment tools
- `BoundaryProperties` - Boundary properties
- `RequireAuth` - Auth wrapper

**AppHeader.tsx**
- `useFlowStore` - Project state
- Export handlers

---

### Topology Components

**FlowCanvas.tsx**
- `@xyflow/react` - ReactFlow
- `useFlowStore` - Topology state
- `DeviceNode` - Device rendering
- `GroupNode` - Boundary rendering
- `lib/topology/topologyAnalyzer` - Analysis
- `lib/utils/deviceIconMapping` - Icon metadata

**DeviceNode.tsx**
- `useFlowStore` - Node state
- `DeviceToolbar` - Node toolbar
- `DeviceLabel` - Label rendering

**GroupNode.tsx**
- `useFlowStore` - Boundary state
- `BoundaryToolbar` - Boundary toolbar

**DevicePalette.tsx**
- `lib/utils/deviceIconMapping` - Icon catalog
- `DeviceCategories` - Category organization

---

### Control Narrative Components

**ControlNarrativeEditor.tsx**
- `useControlNarrativesStore` - Narrative state
- `useFlowStore` - Topology data
- `ControlFamilySection` - Family grouping
- `ControlCard` - Individual controls
- `CoverageGapPanel` - Coverage analysis
- `BulkAssignment` - Bulk operations
- `DeviceSelectionModal` - Device selection
- `ImplementationTips` - AI tips

**ControlCard.tsx**
- `useControlNarrativesStore` - Narrative state
- `lib/controls/controlCatalog` - Control data

---

### SSP Components

**SSPWizard.tsx**
- `useSSPMetadataStore` - SSP metadata
- `useControlSelectionStore` - Control selection
- `useControlNarrativesStore` - Narrative data
- `useFlowStore` - Topology data
- `lib/ssp/sspGenerator` - Document generation
- `@rjsf/core` - Form rendering
- `TopologyCaptureWidget` - Topology capture
- `ControlSelectionWidget` - Control selection UI
- `ControlStatusWidget` - Status display

**SSPGeneratorModal.tsx**
- `useSSPMetadataStore` - Metadata
- `useControlSelectionStore` - Selection
- `lib/ssp/sspGenerator` - Generation

---

### AI Components

**UnifiedAIChat.tsx**
- `useNISTQueryStore` - Query state
- `useAIServiceStore` - Service status
- `useAINarrativesStore` - Narrative state
- `AIStatusIndicator` - Status display
- `NISTQueryPanel` - Query panel

**NISTQueryPanel.tsx**
- `useNISTQueryStore` - Query state
- `lib/ai/nistRAG` - RAG orchestrator

---

### Inventory Components

**InventoryPanel.tsx**
- `useFlowStore` - Topology data
- `lib/topology/inventoryExtractor` - Inventory extraction
- `DeviceManagementTable` - Device table
- `DeviceEditorModal` - Device editing

---

## Library Dependencies

### lib/controls/

**controlCatalog.ts**
- `lib/controls/nistControls` - Control definitions
- `assets/catalog/NIST_SP-800-53_rev5_catalog_load-*.csv` - Control data

**controlRecommendations.ts**
- `lib/topology/topologyAnalyzer` - Topology analysis
- `lib/utils/types` - Types

**controlSuggestions.ts**
- `lib/controls/controlCatalog` - Control catalog
- `lib/utils/types` - Types

---

### lib/ai/

**ragOrchestrator.ts**
- `lib/ai/nistRAG` - NIST RAG
- `lib/ai/llamaServer` - LLM service
- `lib/ai/embeddingService` - Embedding service
- `lib/ai/chromaClient` - ChromaDB client
- `lib/ai/promptTemplates` - Prompts
- `lib/ai/contextBuilder` - Context building
- `lib/ai/topologyContextBuilder` - Topology context

**nistRAG.ts**
- `lib/ai/chromaClient` - ChromaDB
- `lib/ai/embeddingService` - Embeddings
- `lib/ai/llamaServer` - LLM
- `lib/ai/tokenUtils` - Token management

**llamaServer.ts**
- Electron IPC (`ai:llm-generate`, `ai:llm-generate-stream`)

**embeddingService.ts**
- Electron IPC (`ai:embed`)

**chromaClient.ts**
- Electron IPC (`ai:chromadb-query`, `ai:chromadb-add`)

---

### lib/topology/

**topologyAnalyzer.ts**
- `lib/utils/types` - Types
- `lib/utils/utils` - Utilities

**inventoryExtractor.ts**
- `lib/utils/types` - Types
- `lib/topology/topologyAnalyzer` - Analysis

**flowAnalysis.ts**
- `lib/utils/types` - Types

---

### lib/export/

**exportUtils.ts**
- `lib/utils/types` - Types
- Electron IPC (`export-json`, `import-json`)

**modernExport.ts**
- `lib/export/svgExport` - SVG export
- `lib/export/imageExport` - Image export
- `lib/export/viewportCalculator` - Viewport calculation
- `lib/export/uiHider` - UI hiding
- Electron IPC (`export-svg`, `export-png-from-svg`)

**svgExport.ts**
- `lib/utils/types` - Types

**imageExport.ts**
- `lib/utils/types` - Types
- Electron IPC (`export-png`)

---

### lib/ssp/

**sspGenerator.ts**
- `lib/utils/types` - Types
- `lib/controls/controlCatalog` - Control catalog
- `lib/topology/inventoryExtractor` - Inventory
- `lib/ssp/sspPrintTemplate` - React template
- `react-dom/server` - Server-side rendering
- Electron IPC (`generate-ssp-pdf`)

**sspValidation.ts**
- `lib/utils/types` - Types

**sspPrintTemplate.tsx**
- `lib/utils/types` - Types

---

### lib/utils/

**database.ts**
- Electron IPC (all `db:*` channels)

**types.ts**
- `@xyflow/react` - ReactFlow types

**deviceIconMapping.ts**
- Electron IPC (`device-types:*`)
- `lib/utils/iconPath` - Icon path resolution

**narrativeGenerators.ts**
- `lib/topology/topologyAnalyzer` - Topology analysis

---

## Cross-Cutting Concerns

### Authentication Flow

```
RequireAuth → useAuthStore → licenseStore → Electron IPC → License validation
```

### Export Flow

```
Component → useFlowStore → exportUtils → Electron IPC → File system
```

### AI Query Flow

```
Component → useNISTQueryStore → nistRAG → ragOrchestrator → Electron IPC → AI services
```

### SSP Generation Flow

```
SSPWizard → useSSPMetadataStore + useControlSelectionStore → sspGenerator → Electron IPC → PDF generation
```

---

## Circular Dependency Prevention

### Global Store Reference

`useFlowStore` is exposed globally to prevent circular dependencies:

```typescript
// In useFlowStore.ts
if (typeof window !== 'undefined') {
  (window as any).__FLOW_STORE__ = useFlowStore.getState();
}

// In other stores
if (typeof window !== 'undefined' && (window as any).__FLOW_STORE__) {
  const flowStore = (window as any).__FLOW_STORE__;
  // Access flow store
}
```

**Used By**:
- `useControlNarrativesStore` - Reads topology data
- `useSSPMetadataStore` - Reads current project

---

## Electron IPC Channels

### Database Channels (`db:*`)
- `db:create-project`
- `db:list-projects`
- `db:save-diagram`
- `db:load-diagram`
- `db:delete-project`
- `db:load-control-narratives`
- `db:save-control-narratives`
- `db:update-project-baseline`
- `db:get-ssp-metadata`
- `db:save-ssp-metadata`
- `db:query-devices`
- `db:get-device`
- `db:search-devices`

### Export Channels (`export-*`)
- `export-json`
- `import-json`
- `export-svg`
- `export-png`
- `export-png-from-svg`

### AI Channels (`ai:*`)
- `ai:llm-generate`
- `ai:llm-generate-stream`
- `ai:embed`
- `ai:chromadb-query`
- `ai:chromadb-add`
- `ai:check-health`
- `ai:get-context-size`

### License Channels (`license:*`)
- `license:open-file`
- `license:save`
- `license:get`
- `license:clear`

### Device Types Channels (`device-types:*`)
- `device-types:get-all`
- `device-types:get-by-icon`
- `device-types:migrate`

### Other Channels
- `generate-ssp-pdf`
- `get-downloads-path`
- `save-file`
- `capture-viewport`
- Menu events: `menu-new-project`, `menu-open-project`, `menu-save`, etc.

---

## Dependency Graph Summary

```
App.tsx
├── useFlowStore
│   ├── database.ts → Electron IPC
│   └── exportUtils → Electron IPC
├── useAuthStore
│   └── licenseStore → Electron IPC
└── ViewRouter
    ├── FlowCanvas
    │   └── useFlowStore
    ├── SSPWizard
    │   ├── useSSPMetadataStore
    │   ├── useControlSelectionStore
    │   └── sspGenerator → Electron IPC
    ├── ControlNarrativeEditor
    │   └── useControlNarrativesStore
    │       ├── controlCatalog
    │       ├── topologyAnalyzer
    │       └── flowStoreAccessor
    └── UnifiedAIChat
        ├── useNISTQueryStore
        │   └── nistRAG → Electron IPC
        └── useAIServiceStore
            └── AI services → Electron IPC
```

---

## Module Boundaries

### Clear Boundaries
- **Stores** - State management only, no UI
- **Components** - UI only, business logic in lib/
- **lib/** - Business logic, no UI
- **Electron** - IPC and system operations

### Cross-Boundary Access
- Components → Stores (via hooks)
- Stores → lib/ (business logic)
- lib/ → Electron IPC (system operations)
- Stores → flowStoreAccessor (cross-store access)

---

## Import Patterns

### Absolute Imports
All imports use `@/` alias:
```typescript
import { useFlowStore } from '@/core/stores/useFlowStore';
import { db } from '@/core/database/client';
```

### Relative Imports
Only used within same directory:
```typescript
import { DeviceNode } from './DeviceNode';
```

---

## Future Reorganization Impact

After reorganization to feature-based structure:

1. **Features become self-contained** - Each feature has its own components, services, and store
2. **Core infrastructure** - Stores and database move to `core/`
3. **Shared utilities** - UI components and utilities in `shared/`
4. **Clearer boundaries** - Easier to see dependencies between features

See `ARCHITECTURE.md` for reorganization plan details.

