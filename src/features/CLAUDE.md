# Feature Modules Memory

Context for working in `src/features/` - feature modules organized by domain.

---

## Directory Structure

```
src/features/
├── ai-assistant/     # AI chat interface
├── auth/             # License management
├── controls/         # Control management
├── documents/        # Document upload
├── inventory/        # Device inventory
├── ssp/              # SSP generation
├── terraform/        # Terraform integration
└── topology/         # Topology editing
```

---

## Feature Module Pattern

**Each feature module is self-contained** with its own:
- Components (`components/`)
- Services (`services/`) - if needed
- Types (`types.ts`) - if feature-specific
- Hooks (`hooks/`) - if needed
- Utilities (`utils/`) - if needed

**Shared components** live in `src/components/` and are used across features.

---

## Feature Modules

### Topology (`src/features/topology/`)

**Purpose**: Visual topology diagram editing with nested boundary support.

**Key Components**:
- `components/Canvas/FlowCanvas.tsx` - Main ReactFlow canvas
- `components/Canvas/LayoutDevTools.tsx` - Debug panel (shows when layoutDebugMode enabled)
- `components/Nodes/DeviceNode.tsx` - Device node rendering
- `components/Nodes/GroupNode.tsx` - Boundary node rendering
- `components/Edges/CustomEdge.tsx` - Edge rendering
- `components/LayoutPanel/LayoutPanel.tsx` - Layout settings UI
- `components/AutoTidy/AutoTidyButton.tsx` - Auto-tidy button with options

**Key Features**:
- Node placement and editing
- Edge connections
- Boundary drawing with nesting support
- Auto-layout (ELKjs with nested boundaries)
- Layout DevTools for debugging
- Export (SVG, PNG, JSON)

**Store**: Uses `useFlowStore` for topology state.

**See**:
- `@.cursor/rules/reactflow.md` for ReactFlow patterns
- `@docs/LAYOUT_SYSTEM.md` for layout documentation

---

### Controls (`src/features/controls/`)

**Purpose**: NIST control narrative management.

**Key Components**:
- Control narrative editor
- Control card components
- Control family sections
- Coverage gap analysis

**Store**: Uses `useControlNarrativesStore` and `useComplianceStore`.

**Business Logic**: `lib/controls/` (control catalog, recommendations, suggestions).

---

### SSP (`src/features/ssp/`)

**Purpose**: System Security Plan generation.

**Key Components**:
- SSP wizard (multi-step form)
- Control selection widget
- SSP generator modal
- SSP print template

**Stores**: Uses `useSSPMetadataStore`, `useControlSelectionStore`, `useComplianceStore`.

**Business Logic**: `lib/ssp/` (SSP generation, validation).

---

### AI Assistant (`src/features/ai-assistant/`)

**Purpose**: AI chat interface for NIST queries and narrative generation.

**Key Components**:
- Unified AI chat interface
- NIST query panel
- AI status indicator
- Narrative review modal

**Stores**: Uses `useAIStore`, `useNISTQueryStore`, `useAINarrativesStore`.

**Business Logic**: `lib/ai/` (RAG orchestrator, NIST RAG, LLM client).

**See**: `@.cursor/rules/ai-rag.md` for AI/RAG patterns.

---

### Inventory (`src/features/inventory/`)

**Purpose**: Device inventory management.

**Key Components**:
- Inventory panel
- Device management table
- Device editor modal

**Store**: Uses `useFlowStore` for topology data.

**Business Logic**: `lib/topology/inventoryExtractor.ts`.

---

### Terraform (`src/features/terraform/`)

**Purpose**: Terraform infrastructure import and visualization.

**Key Components**:
- Terraform import UI
- Terraform visualization

**Store**: Uses `useTerraformStore`.

**Business Logic**: `lib/terraform/` (Terraform parsing).

---

### Documents (`src/features/documents/`)

**Purpose**: Document upload and chunking for RAG.

**Key Components**:
- Document upload UI
- Document management

**Store**: Uses `useDocumentStore`.

**Business Logic**: `electron/chunking-service.js` (main process).

---

### Auth (`src/features/auth/`)

**Purpose**: License management and authentication.

**Key Components**:
- License token dialog
- Authentication UI

**Store**: Uses `useAuthStore`.

**Business Logic**: `lib/auth/` (license validation, storage).

---

## Feature Communication

**Cross-Feature Communication**:
- Features communicate via Zustand stores
- No direct feature-to-feature imports
- Shared components in `src/components/`

**Example**:
```typescript
// Feature A needs topology data
import { useFlowStore } from '@/core/stores/useFlowStore';

const { nodes, edges } = useFlowStore();
```

---

## Component Organization

**Feature Components**: In `src/features/*/components/`

**Shared Components**: In `src/components/`

**Pattern**: If a component is used by multiple features, move it to `src/components/`.

---

## Business Logic Separation

**Feature Components**: UI only, no business logic.

**Business Logic**: In `src/lib/` organized by domain:
- `lib/controls/` - Control catalog, recommendations
- `lib/topology/` - Topology analysis, inventory
- `lib/ai/` - AI/RAG services
- `lib/ssp/` - SSP generation
- `lib/export/` - Export utilities

**Pattern**: Components call into `lib/` functions, don't contain complex logic.

---

## Adding a New Feature

1. Create feature directory: `src/features/my-feature/`
2. Add components: `components/`
3. Add services: `services/` (if needed)
4. Create store if needed: `src/core/stores/useMyFeatureStore.ts`
5. Add business logic: `src/lib/my-feature/` (if needed)
6. Add to ViewRouter: `src/app/ViewRouter.tsx`
7. Document in `docs/MODULE_GUIDE.md`

---

## Best Practices

1. **Self-Contained**: Features should be self-contained
2. **No Direct Dependencies**: Features don't import from other features
3. **Shared Components**: Use `src/components/` for shared UI
4. **Business Logic**: Keep business logic in `src/lib/`
5. **Store Usage**: Use Zustand stores for state management
6. **Type Safety**: Use TypeScript types from `src/core/types/`

---

## Import Patterns

**From Features**:
```typescript
import { DeviceNode } from '@/features/topology/components/Nodes/DeviceNode';
```

**From Shared Components**:
```typescript
import { Button } from '@/components/ui/button';
```

**From Stores**:
```typescript
import { useFlowStore } from '@/core/stores/useFlowStore';
```

**From Business Logic**:
```typescript
import { analyzeTopology } from '@/lib/topology/topologyAnalyzer';
```

---

## References

- Root Memory: `@CLAUDE.md`
- Architecture: `@docs/ARCHITECTURE.md`
- Module Guide: `@docs/MODULE_GUIDE.md`
- ReactFlow Patterns: `@.cursor/rules/reactflow.md`
- AI/RAG Patterns: `@.cursor/rules/ai-rag.md`
