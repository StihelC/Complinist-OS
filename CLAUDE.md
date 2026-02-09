# CompliFlow Project Memory

This file serves as the primary source of truth for AI coding assistants working on CompliFlow. It provides essential context about architecture, conventions, and development patterns.

---

## Project Overview

**CompliFlow** (CompliNist) is an Electron-based desktop application for NIST compliance management and system security planning. It provides visual topology modeling, control narrative management, and AI-assisted compliance guidance.

**Tech Stack**:
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Tailwind CSS + Radix UI
- **Diagram Engine**: ReactFlow (@xyflow/react v12)
- **State Management**: Zustand (24+ stores organized in domains)
- **Desktop**: Electron 33
- **Database**: better-sqlite3 (SQLite)
- **AI/ML**: node-llama-cpp, ChromaDB (RAG)
- **Forms**: React JSON Schema Forms (@rjsf)

---

## Critical Safety Boundaries

**DO NOT modify these unless explicitly approved**:
- Database schemas
- Environment variables
- Global/shared state stores
- IPC channels
- Routing/initialization logic
- Build/configuration/deployment settings

See `@.cursor/rules/compliprojectrules.mdc` for complete project rules.

---

## Build & Development Commands

### Development
```bash
npm run dev                    # Start Vite dev server
npm run electron:dev           # Start Electron with hot reload
npm run electron:dev:hmr       # Start with HMR enabled
npm run typecheck              # TypeScript type checking
npm run typecheck:watch        # Watch mode type checking
```

### Building
```bash
npm run build                  # Build renderer (Vite)
npm run electron:build        # Build Electron app
npm run electron:build:linux   # Build for Linux
npm run electron:build:win     # Build for Windows
npm run electron:rebuild       # Rebuild native modules (better-sqlite3)
```

### Testing
```bash
npm test                       # Run Vitest unit tests
npm run test:ui                # Run tests with UI
npm run test:coverage          # Run with coverage
npm run test:license           # Test license import
```

### Linting & Formatting
```bash
npm run lint                   # Run ESLint
npm run lint:fix               # Fix ESLint issues
npm run format                 # Format with Prettier
npm run format:check           # Check formatting
```

---

## Architecture Overview

CompliFlow follows a **layered architecture**:

```
UI Components (React + ReactFlow)
    ↓
State Management (Zustand stores)
    ↓
Business Logic (lib/)
    ↓
Database Wrapper (IPC)
    ↓
Electron Main Process (SQLite, AI services)
```

### Key Documentation
- `@docs/ARCHITECTURE.md` - Detailed system architecture
- `@docs/MODULE_GUIDE.md` - Module APIs and usage
- `@docs/DEPENDENCY_MAP.md` - Module dependencies
- `@docs/LAYOUT_SYSTEM.md` - Layout engine (ELKjs, nested boundaries, debug tools)
- `@docs/context.md` - Project overview

---

## Using Context7 for Library Documentation

**Context7** is an MCP tool for fetching up-to-date library documentation. **Always use Context7** when working with these libraries:

| Library | Context7 ID | When to Fetch |
|---------|-------------|---------------|
| @xyflow/react | `xyflow/xyflow` | Node/edge APIs, hooks, ReactFlow patterns |
| zustand | `pmndrs/zustand` | Store patterns, middleware, subscriptions |
| @radix-ui/* | `radix-ui/primitives` | Component APIs, accessibility patterns |
| zod | `colinhacks/zod` | Schema validation, type inference |
| electron | `electron/electron` | IPC patterns, main process APIs |
| node-llama-cpp | `withcatai/node-llama-cpp` | LLM inference, model loading |
| better-sqlite3 | `WiseLibs/better-sqlite3` | Database operations, transactions |
| tailwindcss | `tailwindlabs/tailwindcss` | Utility classes, configuration |

**Always fetch Context7 docs when**:
1. Using an API you're unsure about
2. The code involves complex patterns
3. You need to verify current API signatures
4. Working with ReactFlow nodes/edges/hooks
5. Setting up Zustand stores or middleware
6. Implementing Electron IPC handlers

**Example**: Before implementing a new ReactFlow node type, fetch `xyflow/xyflow` docs to verify the latest Node API.

---

## State Management (Zustand)

CompliFlow uses **24+ Zustand stores** organized into domains:

### Core Stores (Standalone)
- `useAuthStore` - License-based authentication
- `useDocumentStore` - User document management
- `useTerraformStore` - Terraform visualization
- `useDeltaTrackingStore` - Incremental save tracking
- `useErrorDashboardStore` - Error tracking and dashboard
- `useNavigationHistoryStore` - Navigation history

### Flow Stores (Facade + Sub-stores)
- `useFlowStore` - Facade for topology, projects, UI state
  - `useCanvasUIStore` - Canvas UI state
  - `useProjectStore` - Project management
  - `useSelectionStore` - Selection state
  - `useSettingsStore` - Global settings
  - `useTopologyStore` - Topology state
  - `useUndoRedoStore` - Undo/redo functionality

### Unified AI Store (Facade)
- `useAIStore` - Single interface for all AI functionality
  - `useAIServiceStore` - Service health & status
  - `useNISTQueryStore` - NIST document queries
  - `useAINarrativesStore` - AI narrative generation

### Unified Compliance Store (Facade)
- `useComplianceStore` - Single interface for compliance
  - `useControlNarrativesStore` - Control implementations
  - `useControlSelectionStore` - Control selection
  - `useSSPMetadataStore` - SSP metadata
  - `useSSPTemplateStore` - SSP templates
  - `useOrganizationDefaultsStore` - Organization defaults

### Feature Stores
- `useTourStore` - User tour/onboarding (in `src/features/tour/`)

**Cross-Store Access**: Use `flowStoreAccessor` module for type-safe access to flow store from non-React contexts.

See `@.cursor/rules/zustand-stores.md` for detailed patterns.

---

## IPC Communication Pattern

All Electron IPC communication goes through type-safe channels:

- **Database**: `db:*` channels (create-project, save-diagram, etc.)
- **AI Services**: `ai:*` channels (llm-generate, embed, chromadb-query)
- **Export**: `export-*` channels (json, svg, png)
- **License**: `license:*` channels
- **Device Types**: `device-types:*` channels

**Database Wrapper**: Use `src/core/database/client.ts` which wraps `window.electronAPI.*` calls.

**tRPC Integration**: The database client uses tRPC (`src/lib/trpc/client.ts`) as the preferred IPC method when available, with automatic fallback to legacy `window.electronAPI.*` calls. This provides:
- Type-safe RPC calls with full TypeScript inference
- Better error handling and validation
- Graceful degradation if electron-trpc isn't available
- **Status**: Active implementation, not legacy code

**Security**: Context isolation enabled, preload script exposes only necessary APIs.

See `@.cursor/rules/electron-ipc.md` for detailed patterns.

---

## ReactFlow Patterns

CompliFlow uses **@xyflow/react v12** for topology diagrams.

**Node Types**:
- `device` - DeviceNode (network devices)
- `boundary` - GroupNode (security boundaries)

**Edge Types**: CustomEdge (all edge types use CustomEdge)

**Key Patterns**:
- Node changes via `onNodesChange` → `applyNodeChanges`
- Edge changes via `onEdgesChange` → `applyEdgeChanges`
- Auto-layout with Dagre (`@dagrejs/dagre`)
- Export utilities in `lib/export/`

**Always fetch Context7 docs** (`xyflow/xyflow`) when:
- Creating new node types
- Implementing edge handlers
- Using ReactFlow hooks
- Working with viewport/transform

See `@.cursor/rules/reactflow.md` for detailed patterns.

---

## AI/RAG System

CompliFlow uses a **Small2Big retrieval pattern** for RAG:

1. Query embedding → embedding vector
2. Small chunk retrieval → ChromaDB search
3. Parent expansion → context building
4. LLM generation → response with context

**Key Files**:
- `lib/ai/ragOrchestrator.ts` - RAG orchestration
- `lib/ai/nistRAG.ts` - NIST document RAG
- `lib/ai/llamaServer.ts` - LLM client
- `lib/ai/embeddingService.ts` - Embedding client
- `lib/ai/chromaClient.ts` - ChromaDB client

**Context Size Management**: Calibrated context size stored in `window.calibratedContextSize`.

See `@.cursor/rules/ai-rag.md` for detailed patterns.

---

## UI Component Patterns

**Radix UI**: Wrapper components in `components/ui/` following shadcn/ui patterns.

**Tailwind CSS**: Utility-first styling with consistent class ordering.

**Forms**: React JSON Schema Forms (@rjsf) for dynamic form generation.

**Modal/Dialog**: Radix Dialog with consistent patterns.

See `@.cursor/rules/ui-components.md` for detailed patterns.

---

## Development Tools

### Browser API Adapter (`src/lib/browser-api-adapter.ts`)

**Purpose**: Mocks Electron IPC APIs to enable browser-based development and testing.

**When it's used**:
- Development mode when running in browser (not Electron)
- Testing topology canvas without Electron
- React DevTools debugging in browser

**What it enables**:
- Device palette with full device types
- Topology canvas (positioning, dragging, layout)
- Dagre layout system
- React DevTools debugging

**What's disabled in browser mode**:
- AI features (require Electron main process)
- File save/load (uses in-memory mocks)
- Export operations (require Electron IPC)

**How it works**: Automatically imported in `main.tsx` before other code checks for `window.electronAPI`. If Electron APIs aren't available, it provides mock implementations.

---

## Project Structure

```
src/
├── app/              # App shell and routing
├── components/      # Shared React components
├── core/            # Core infrastructure
│   ├── stores/      # Zustand stores
│   │   ├── flow/    # Flow sub-stores (6 stores)
│   │   └── selectors/ # Store selectors
│   ├── database/    # Database client
│   ├── types/       # Shared type definitions
│   ├── di/          # Dependency injection
│   ├── errors/      # Error handling
│   ├── debug/       # Debug utilities
│   └── context/    # React contexts
├── features/        # Feature modules (organized by domain)
│   ├── ai-assistant/ # AI chat feature
│   ├── auth/        # License management
│   ├── controls/    # Control management
│   ├── documents/   # Document upload
│   ├── error-dashboard/ # Error tracking
│   ├── inventory/   # Device inventory
│   ├── projects/    # Project management
│   ├── ssp/         # SSP generation
│   ├── terraform/   # Terraform integration
│   ├── topology/    # Topology editing
│   └── tour/        # User tour/onboarding
├── lib/             # Business logic libraries
└── assets/          # Static assets

electron/
├── main.js          # Entry point
├── preload.mjs      # IPC bridge
├── ipc/             # IPC handlers by domain
├── database/        # SQLite utilities
├── di/              # Dependency injection
├── encryption/      # Encryption services
├── hmr/             # Hot module reload
├── middleware/      # IPC middleware
├── modules/         # Main process modules
└── trpc/            # tRPC routers
```

**Feature Modules**: Self-contained features in `src/features/` with their own components.

**Business Logic**: Domain-specific logic in `src/lib/` organized by feature (controls, topology, AI, export, etc.).

---

## Code Organization Rules

1. **Minimal Change Policy**: Apply only the smallest possible diff needed
2. **No Invention Rule**: Don't create new functions/classes/modules unless explicitly requested
3. **Follow Existing Architecture**: Conform to current patterns and naming conventions
4. **Diagnose Before Fixing**: Restate problem, identify root cause, wait for approval
5. **Type Safety**: Use TypeScript types from `src/core/types/` or `src/lib/utils/types.ts`

---

## Import Patterns

**Absolute Imports**: Use `@/` alias for all imports:
```typescript
import { useFlowStore } from '@/core/stores/useFlowStore';
import { db } from '@/core/database/client';
```

**Relative Imports**: Only within same directory:
```typescript
import { DeviceNode } from './DeviceNode';
```

---

## Testing Patterns

- **Unit Tests**: Vitest in `tests/unit/`
- **E2E Tests**: Playwright in `tests/e2e/`
- **Store Tests**: Test Zustand stores in isolation
- **Component Tests**: Use React Testing Library

---

## Auto-Save Pattern

Diagram changes are automatically saved after **1-second debounce**:
- `setNodes()` → debounced save
- `setEdges()` → debounced save
- No explicit "Save" button needed for topology edits

---

## Module-Specific Memory Files

For detailed patterns in specific areas, see:
- `@.cursor/rules/reactflow.md` - ReactFlow patterns
- `@.cursor/rules/zustand-stores.md` - State management
- `@.cursor/rules/electron-ipc.md` - IPC communication
- `@.cursor/rules/ai-rag.md` - AI/RAG system
- `@.cursor/rules/ui-components.md` - UI patterns
- `@.cursor/rules/context7-libraries.md` - Context7 usage

Subdirectory memory files (loaded when working in those directories):
- `@src/core/CLAUDE.md` - Core infrastructure
- `@src/features/CLAUDE.md` - Feature modules
- `@src/lib/CLAUDE.md` - Business logic
- `@electron/CLAUDE.md` - Electron main process

---

## Beginner Summary

CompliFlow is a desktop app for security compliance that uses React for the UI, Electron for desktop capabilities, and AI to help write compliance documentation. The code is organized into layers: UI components at the top, state management in the middle, business logic below that, and Electron handling system operations at the bottom. When working with external libraries, always use Context7 to fetch the latest documentation to ensure you're using the correct APIs.
