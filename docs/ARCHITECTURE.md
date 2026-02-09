# CompliNist Architecture

## System Overview

CompliNist is an Electron-based desktop application for NIST compliance management and system security planning. It provides visual topology modeling, control narrative management, and AI-assisted compliance guidance.

### Technology Stack

- **Frontend Framework**: React 18 + TypeScript
- **Build System**: Vite
- **UI Framework**: Tailwind CSS + Radix UI
- **Diagram Engine**: ReactFlow (@xyflow/react)
- **State Management**: Zustand (24+ stores organized in domains)
- **Desktop Framework**: Electron 33
- **Database**: Better-sqlite3 (SQLite)
- **AI/ML**: node-llama-cpp, ChromaDB (RAG)
- **Forms**: React JSON Schema Forms (@rjsf)

---

## Architecture Layers

### Layer 1: Electron Main Process

**Location**: `electron/`

The main process handles:
- IPC communication between renderer and main
- Database operations (SQLite via better-sqlite3)
- File system operations (export/import)
- AI service management (LLM, embeddings, ChromaDB)
- PDF generation (SSP documents)

**Key Files**:
- `main.js` - Entry point, IPC handlers, window management
- `ai-service-manager.js` - AI service lifecycle management
- `preload.mjs` - IPC bridge exposed to renderer

**IPC Channels**:
```
db:* - Database operations
export-* - File export operations
ai:* - AI service operations
license:* - License management
device-types:* - Device type queries
generate-ssp-pdf - PDF generation
```

### Layer 2: IPC Database Wrapper

**Location**: `src/core/database/client.ts`

Thin wrapper around Electron IPC calls. Provides type-safe interface for:
- Project CRUD operations
- Diagram save/load
- Control narrative persistence
- Device queries
- SSP metadata

**Pattern**: All database operations go through this wrapper, which calls `window.electronAPI.*` methods.

### Layer 3: State Management (Zustand Stores)

**Location**: `src/core/stores/`

24+ Zustand stores manage application state, organized into domains:

**Core Stores (Standalone)**:
- `useAuthStore` - License validation, authentication state, feature gating
- `useDocumentStore` - User document management
- `useTerraformStore` - Terraform visualization
- `useDeltaTrackingStore` - Incremental save tracking
- `useErrorDashboardStore` - Error tracking and dashboard
- `useNavigationHistoryStore` - Navigation history

**Flow Stores** (in `src/core/stores/flow/`):
- `useFlowStore` - Facade for topology, projects, UI state
- `useCanvasUIStore` - Canvas UI state
- `useProjectStore` - Project management
- `useSelectionStore` - Selection state
- `useSettingsStore` - Global settings
- `useTopologyStore` - Topology state (nodes, edges)
- `useUndoRedoStore` - Undo/redo functionality

**AI Stores**:
- `useAIStore` - Unified facade for all AI functionality
- `useAIServiceStore` - AI service health, model information, GPU backend
- `useNISTQueryStore` - NIST RAG query state, query history
- `useAINarrativesStore` - AI-generated narratives, narrative review state

**Compliance Stores**:
- `useComplianceStore` - Unified facade for compliance functionality
- `useControlNarrativesStore` - NIST control catalog, control narratives, baseline selection
- `useControlSelectionStore` - Selected controls for SSP, control filtering
- `useSSPMetadataStore` - SSP form data, metadata persistence
- `useSSPTemplateStore` - SSP templates
- `useOrganizationDefaultsStore` - Organization defaults

**Feature Stores**:
- `useTourStore` - User tour/onboarding (in `src/features/tour/`)

**Cross-Store Access**:
- `useFlowStore` is accessed via the `flowStoreAccessor` module to avoid circular dependencies
- The accessor provides type-safe getters (`getFlowStoreState`, `getFlowStoreStateSafe`) for cross-module access
- This pattern provides better encapsulation and testability than global state

### Layer 4: Business Logic Libraries

**Location**: `src/lib/`

Domain-specific business logic organized by feature:

- **`lib/controls/`** - NIST control catalog, recommendations, suggestions
- **`lib/topology/`** - Topology analysis, inventory extraction, flow analysis
- **`lib/export/`** - JSON/CSV/PNG/SVG export utilities
- **`lib/ssp/`** - SSP document generation and validation
- **`lib/ai/`** - RAG orchestration, LLM prompts, embedding, ChromaDB client
- **`lib/auth/`** - License validation and storage
- **`lib/layout/`** - Graph layout algorithms (Dagre, ELK)
- **`lib/utils/`** - Shared utilities (types, validation, device icons)

### Layer 5: UI Components

**Location**: `src/components/`

Organized by feature domain:
- **Canvas/** - ReactFlow canvas and export UI
- **Nodes/** - Device and boundary node components
- **Edges/** - Connection edge components
- **ControlNarratives/** - Control narrative editor
- **SSP/** - SSP wizard and generation
- **Inventory/** - Device inventory management
- **AI/** - AI chat interface
- **Auth/** - Authentication components
- **ui/** - Reusable UI primitives (Radix UI wrappers)

---

## Data Flow

### Topology Editing Flow

```
User Interaction (Canvas)
  ↓
ReactFlow Events (onNodesChange, onEdgesChange)
  ↓
useFlowStore (setNodes, setEdges)
  ↓
Debounced Auto-Save (1s delay)
  ↓
src/core/database/client.ts (saveDiagram)
  ↓
Electron IPC (db:save-diagram)
  ↓
SQLite Database
```

### Control Narrative Flow

```
User Edits Narrative
  ↓
useControlNarrativesStore (updateNarrative)
  ↓
Mark as Dirty (dirtyIds Set)
  ↓
User Saves
  ↓
src/core/database/client.ts (saveControlNarratives)
  ↓
Electron IPC (db:save-control-narratives)
  ↓
SQLite Database
```

### AI Query Flow

```
User Query (UnifiedAIChat)
  ↓
useNISTQueryStore (submitQuery)
  ↓
lib/ai/ragOrchestrator (orchestrateQuery)
  ↓
lib/ai/nistRAG (queryNISTDocuments)
  ↓
  ├─→ Embedding Service (embed query)
  ├─→ ChromaDB (vector search)
  └─→ LLM Server (generate response)
  ↓
Electron IPC (ai:llm-generate-stream)
  ↓
ai-service-manager.js
  ↓
node-llama-cpp + ChromaDB
```

### SSP Generation Flow

```
User Fills SSP Form (SSPWizard)
  ↓
useSSPMetadataStore + useControlSelectionStore
  ↓
lib/ssp/sspGenerator (buildSSPDocument)
  ↓
Renders SSPPrintTemplate (React component)
  ↓
Electron IPC (generate-ssp-pdf)
  ↓
Puppeteer (render HTML to PDF)
  ↓
File System (save PDF)
```

---

## IPC Communication Patterns

### Request-Response Pattern

```typescript
// Renderer
const result = await window.electronAPI.createProject({ name, baseline });

// Main Process (electron/main.js)
ipcMain.handle('db:create-project', async (event, data) => {
  // Process request
  return result;
});
```

### Event Subscription Pattern

```typescript
// Renderer
window.electronAPI.onMenuSave(() => {
  // Handle menu event
});

// Main Process
mainWindow.webContents.send('menu-save');
```

### Stream Pattern (AI)

```typescript
// Renderer
window.electronAPI.onStreamToken((token) => {
  // Handle streaming token
});

// Main Process
event.sender.send('ai:stream-token', token);
```

---

## State Management Patterns

### Store Structure

```typescript
interface StoreState {
  // State
  items: Record<string, Item>;
  
  // Actions
  loadItems: () => Promise<void>;
  updateItem: (id: string, data: Partial<Item>) => void;
}
```

### Cross-Store Access

```typescript
// Use the flowStoreAccessor for type-safe cross-module access
import { getFlowStoreState, getFlowStoreStateSafe } from '@/core/stores/flowStoreAccessor';

// In utilities and other stores, access the flow store safely
const flowStore = getFlowStoreStateSafe();
if (flowStore?.currentProject) {
  const { nodes, edges } = flowStore;
  // Access flow store data
}
```

### Auto-Save Pattern

```typescript
// Debounced auto-save in useFlowStore
const debounceSave = (callback: () => void, delay: number) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(callback, delay);
};

// Called on every state change
setNodes: (nodes) => {
  set({ nodes });
  debounceSave(() => get().saveCurrentDiagram(), 1000);
}
```

---

## AI/RAG Pipeline

### Small2Big Retrieval

Following Wang et al. (2024) Small2Big pattern:

1. **Query Embedding**: User query → embedding vector
2. **Small Chunk Retrieval**: Search ChromaDB for small chunks (precision)
3. **Parent Expansion**: Expand to parent chunks (context)
4. **Context Building**: Token-aware context assembly
5. **LLM Generation**: Generate response with retrieved context

### Context Size Management

- Calibrated context size stored in `window.calibratedContextSize`
- Dynamic token calculation based on model capabilities
- Prompt overhead calculation for system messages
- Chunk prioritization by relevance score

### RAG Configuration

```typescript
const RAG_CONFIG = {
  MIN_RELEVANCE_SCORE: 0.35,        // Filter low-relevance chunks
  ENABLE_SMALL2BIG_FILTER: true,    // Use Small2Big pattern
  MIN_CHUNKS_FOR_RESPONSE: 1,       // Minimum chunks required
  PRIORITIZE_EXACT_CONTROL_MATCH: true, // Boost exact control ID matches
};
```

---

## Security & Authentication

### License-Based Feature Gating

- License file validation via JWT
- Feature flags: `inventory`, `ssp`, `narratives`, `ai`
- `RequireAuth` component wraps protected features
- License stored in Electron's userData directory

### IPC Security

- Context isolation enabled
- Preload script exposes only necessary APIs
- No direct Node.js access from renderer

---

## Database Schema

### Core Tables

- **projects** - Project metadata (id, name, baseline, timestamps)
- **diagrams** - Serialized topology (project_id, nodes, edges, viewport)
- **control_narratives** - Control implementation narratives
- **ssp_metadata** - SSP form data
- **device_types** - Device type catalog with icon mappings

### Relationships

```
projects (1) ──→ (many) diagrams
projects (1) ──→ (many) control_narratives
projects (1) ──→ (1) ssp_metadata
```

---

## Build & Deployment

### Development

```bash
npm run dev              # Vite dev server
npm run electron:dev     # Electron with hot reload
```

### Production

```bash
npm run build            # Build renderer
npm run electron:build   # Package Electron app
```

### Build Output

- **Renderer**: `dist/` (static assets)
- **Main Process**: Bundled with Electron
- **Models**: External directory (`.data/models/` or `models/`)

---

## Performance Considerations

### Topology Rendering

- ReactFlow virtualization for large graphs
- Debounced auto-save (1s delay)
- Topological node sorting for proper rendering order
- Node validation to prevent orphaned references

### AI Performance

- Lazy loading of AI services
- Context size calibration on startup
- Token-aware chunk selection
- Streaming responses for better UX

### Database

- SQLite with better-sqlite3 (synchronous, fast)
- Indexed queries for device searches
- Batch operations for narrative saves

---

## Current Architecture Status

✅ **Feature-Based Organization**: Completed - All components organized in `features/` directory structure
✅ **Core Infrastructure**: Completed - Stores and database in `core/` directory
✅ **Shared Utilities**: Completed - UI components and utilities in `shared/` and `components/ui/`
✅ **App Shell**: Completed - App-level components in `app/` directory

**Remaining Improvements:**
1. **Type Organization**: Split large `types.ts` into domain-specific files (in progress - types partially organized in `core/types/`)

See `DEPENDENCY_MAP.md` for detailed module dependencies and `MODULE_GUIDE.md` for module usage guidelines.

