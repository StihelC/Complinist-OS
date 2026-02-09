# Core Infrastructure Memory

Context for working in `src/core/` - the core infrastructure layer of CompliFlow.

---

## Directory Structure

```
src/core/
├── context/          # React context providers
├── database/         # Database client (IPC wrapper)
├── debug/            # Debug utilities
├── di/               # Dependency injection
├── errors/           # Error handling
├── stores/            # Zustand stores
└── types/            # Shared TypeScript types
```

---

## Stores (`src/core/stores/`)

**Purpose**: All Zustand stores are located here, organized by domain.

### Store Organization

**Core Stores** (Standalone):
- `useFlowStore.ts` - Topology, projects, UI state
- `useAuthStore.ts` - License-based authentication
- `useDocumentStore.ts` - User document management
- `useTerraformStore.ts` - Terraform visualization

**Unified AI Store** (Facade):
- `useAIStore.ts` - Single interface for all AI functionality
  - `useAIServiceStore.ts` - Service health & status
  - `useNISTQueryStore.ts` - NIST document queries
  - `useAINarrativesStore.ts` - AI narrative generation

**Unified Compliance Store** (Facade):
- `useComplianceStore.ts` - Single interface for compliance
  - `useControlNarrativesStore.ts` - Control implementations
  - `useControlSelectionStore.ts` - Control selection
  - `sspMetadataStore.ts` - SSP metadata
  - `useSSPTemplateStore.ts` - SSP templates
  - `useOrganizationDefaultsStore.ts` - Organization defaults

**Flow Store Split** (Domain-based):
- `flow/useTopologyStore.ts` - Topology state
- `flow/useProjectStore.ts` - Project management
- `flow/useCanvasUIStore.ts` - Canvas UI state
- `flow/useSelectionStore.ts` - Selection state
- `flow/useSettingsStore.ts` - Global settings
- `flow/useUndoRedoStore.ts` - Undo/redo functionality

**Other Stores**:
- `deltaTrackingStore.ts` - Incremental save tracking
- `useErrorDashboardStore.ts` - Error tracking
- `useNavigationHistoryStore.ts` - Navigation history

### Cross-Store Access

**Flow Store Accessor**: `flowStoreAccessor.ts`
- Provides type-safe access to flow store from non-React contexts
- Avoids circular dependencies
- Use `getFlowStoreState()` or `getFlowStoreStateSafe()`

**Store Exports**: `index.ts`
- Exports all stores for easy importing
- Documents store architecture

### Selectors

**Location**: `src/core/stores/selectors/`

**Purpose**: Reusable selectors for computed state.

**Files**:
- `flowSelectors.ts` - Flow store selectors
- `controlNarrativesSelectors.ts` - Control narratives selectors
- `aiServiceSelectors.ts` - AI service selectors

**Usage**:
```typescript
import { useFlowStore } from '@/core/stores/useFlowStore';
import { selectNodesByType } from '@/core/stores/selectors/flowSelectors';

const deviceNodes = useFlowStore(selectNodesByType('device'));
```

---

## Database Client (`src/core/database/`)

**Purpose**: Type-safe wrapper around Electron IPC for database operations.

**Files**:
- `client.ts` - Database client implementation
- `types.ts` - Database types
- `index.ts` - Exports

**Usage**:
```typescript
import { db } from '@/core/database/client';

const project = await db.createProject('My Project', 'MODERATE');
await db.saveDiagram(projectId, nodes, edges, viewport);
const diagram = await db.loadDiagram(projectId);
```

**Pattern**: All database operations go through this client, which calls `window.electronAPI.*` methods.

---

## Types (`src/core/types/`)

**Purpose**: Shared TypeScript type definitions organized by domain.

**Files**:
- `common.types.ts` - Common types
- `controls.types.ts` - Control-related types
- `delta.types.ts` - Delta tracking types
- `export.types.ts` - Export types
- `inventory.types.ts` - Inventory types
- `project.types.ts` - Project types
- `ssp.types.ts` - SSP types
- `topology.types.ts` - Topology types
- `index.ts` - Exports

**Usage**:
```typescript
import type { AppNode, AppEdge, Project } from '@/core/types';
```

**Legacy Types**: Some types still in `src/lib/utils/types.ts` (being migrated).

---

## Error Handling (`src/core/errors/`)

**Purpose**: Centralized error handling and error types.

**Files**:
- `AppError.ts` - Application error class
- `errorHandler.ts` - Error handler utilities
- `types.ts` - Error types
- `index.ts` - Exports

**Usage**:
```typescript
import { AppError } from '@/core/errors';

throw new AppError('Something went wrong', { code: 'ERROR_CODE' });
```

---

## Dependency Injection (`src/core/di/`)

**Purpose**: Dependency injection container for managing dependencies.

**Files**:
- `container.ts` - DI container
- `setup.ts` - Container setup
- `index.ts` - Exports

**Usage**: (If used in the codebase)

---

## Debug Utilities (`src/core/debug/`)

**Purpose**: Debug utilities for development.

**Files**:
- `snapshot.ts` - State snapshot utilities
- `index.ts` - Exports
- `README.md` - Debug utilities documentation

---

## Context Providers (`src/core/context/`)

**Purpose**: React context providers.

**Files**:
- `LoadingContext.tsx` - Loading state context

**Usage**:
```typescript
import { useLoadingContext } from '@/core/context/LoadingContext';
```

---

## Best Practices

1. **Store Organization**: Keep stores focused on single domains
2. **Type Safety**: Use types from `src/core/types/`
3. **Cross-Store Access**: Use `flowStoreAccessor` for type-safe access
4. **Database Operations**: Always use `db` client, never direct IPC
5. **Error Handling**: Use `AppError` for application errors
6. **Selectors**: Use selectors for computed state

---

## Import Patterns

**From Core**:
```typescript
import { useFlowStore } from '@/core/stores/useFlowStore';
import { db } from '@/core/database/client';
import type { AppNode } from '@/core/types';
```

**Within Core**:
```typescript
import { getFlowStoreState } from '../stores/flowStoreAccessor';
```

---

## References

- Store Patterns: `@.cursor/rules/zustand-stores.md`
- IPC Patterns: `@.cursor/rules/electron-ipc.md`
- Root Memory: `@CLAUDE.md`
- Architecture: `@docs/ARCHITECTURE.md`
