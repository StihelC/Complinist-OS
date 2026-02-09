# CompliNist Project Context

## Overview

**CompliNist** is a desktop application built with Electron that helps organizations create network topology diagrams, manage NIST SP 800-53 control narratives, and generate System Security Plans (SSPs) with AI-assisted compliance guidance. It's designed for security professionals and compliance teams working with federal government security requirements.

---

## Core Purpose

CompliNist addresses the complex task of NIST compliance documentation by providing:
- **Visual Network Modeling**: Drag-and-drop interface for creating network topology diagrams
- **Control Management**: Organize and document NIST SP 800-53 controls (LOW, MODERATE, HIGH baselines)
- **AI-Powered Assistance**: RAG (Retrieval-Augmented Generation) system that queries NIST documentation to help write control narratives
- **SSP Generation**: Automated generation of System Security Plan PDFs from topology and control data
- **Infrastructure Import**: Import Terraform configurations to map infrastructure to compliance requirements

---

## Key Features

### 1. Visual Topology Modeling
- Create network diagrams with devices (firewalls, servers, routers, etc.), security boundaries, and connections
- Built on ReactFlow for interactive diagram editing
- Export diagrams as JSON, SVG, or PNG
- Device inventory tracking with metadata

### 2. NIST Control Management
- Full NIST SP 800-53 control catalog organized by families (AC, SC, SI, etc.)
- Baseline filtering (LOW, MODERATE, HIGH)
- Control narrative editing with auto-save
- Status tracking (Implemented, Partially Implemented, Not Implemented, Not Applicable)

### 3. AI-Assisted Compliance
- **NIST Query System**: Ask questions about NIST documentation with RAG-powered responses
- **Narrative Generation**: AI-generated control narratives based on topology analysis
- **Document RAG**: Upload your own compliance documents for AI queries
- **Smart Recommendations**: Control suggestions based on network topology

### 4. System Security Plan (SSP) Generation
- Multi-step wizard for collecting SSP metadata
- Control selection interface
- Automated PDF generation from topology and narratives
- Support for unedited controls mode

### 5. Additional Capabilities
- **Terraform Integration**: Import infrastructure-as-code for compliance mapping
- **License Management**: JWT-based license validation with feature gating
- **Document Chunking**: Process compliance documents for RAG indexing
- **Export/Import**: Full project export/import as JSON

---

## Architecture Overview

CompliNist follows a **layered architecture** with clear separation between UI, state, business logic, and data persistence:

```
┌─────────────────────────────────────┐
│      UI Layer (React Components)    │
│  ReactFlow, Tailwind CSS, Radix UI  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   State Management (Zustand)        │
│   24+ stores organized in domains    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Business Logic (lib/)             │
│  Controls, Topology, AI, Export     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   IPC Database Wrapper              │
│   Type-safe Electron IPC client     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Electron Main Process             │
│   SQLite, File I/O, AI Services     │
└──────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
- **React 18** + **TypeScript** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible UI primitives
- **ReactFlow (@xyflow/react)** - Diagram/canvas engine
- **Zustand** - State management (24+ stores organized in domains)

### Desktop
- **Electron 33** - Desktop application framework
- **better-sqlite3** - Embedded SQLite database

### AI/ML
- **node-llama-cpp** - Local LLM inference (Mistral 7B)
- **ChromaDB** - Vector database for RAG
- **Custom RAG Orchestrator** - NIST document querying

### Other Key Libraries
- **Dagre** / **ELK.js** - Graph layout algorithms
- **React JSON Schema Forms (@rjsf)** - Dynamic form generation
- **html-to-image** - Export diagrams as images

---

## Project Structure

```
CompliNist/
├── electron/              # Electron main process
│   ├── main.js            # Entry point, window management
│   ├── preload.mjs        # IPC bridge exposed to renderer
│   ├── ipc/               # IPC handlers organized by domain
│   │   ├── database.js    # Database operations
│   │   ├── ai.js          # AI service operations
│   │   ├── export.js      # File export
│   │   ├── terraform.js   # Terraform import
│   │   └── ...
│   ├── database/          # SQLite database utilities
│   ├── modules/           # Main process modules
│   │   ├── window-manager.js
│   │   ├── app-lifecycle.js
│   │   └── ...
│   ├── ai-service-manager.js  # AI service lifecycle
│   └── chunking-service.js    # Document chunking
│
├── src/                   # Renderer process (React app)
│   ├── app/               # App shell and routing
│   │   ├── App.tsx        # Main app component
│   │   └── ViewRouter.tsx # View routing
│   │
│   ├── core/              # Core infrastructure
│   │   ├── database/      # Type-safe IPC database client
│   │   ├── stores/        # Zustand state stores (24+ stores)
│   │   │   ├── flow/      # Flow sub-stores (6 stores)
│   │   │   │   ├── useCanvasUIStore.ts
│   │   │   │   ├── useProjectStore.ts
│   │   │   │   ├── useSelectionStore.ts
│   │   │   │   ├── useSettingsStore.ts
│   │   │   │   ├── useTopologyStore.ts
│   │   │   │   └── useUndoRedoStore.ts
│   │   │   ├── useFlowStore.ts              # Flow facade
│   │   │   ├── useControlNarrativesStore.ts # Control narratives
│   │   │   ├── useAuthStore.ts              # License/auth
│   │   │   ├── useAIServiceStore.ts         # AI service health
│   │   │   ├── useNISTQueryStore.ts         # NIST RAG queries
│   │   │   ├── useAINarrativesStore.ts      # AI-generated narratives
│   │   │   ├── useControlSelectionStore.ts  # SSP control selection
│   │   │   ├── useTerraformStore.ts         # Terraform import state
│   │   │   ├── useDocumentStore.ts          # Document management
│   │   │   ├── useErrorDashboardStore.ts   # Error tracking
│   │   │   ├── useNavigationHistoryStore.ts # Navigation history
│   │   │   └── sspMetadataStore.ts          # SSP form data
│   │   └── types/         # Shared TypeScript types
│   │
│   ├── lib/               # Business logic libraries
│   │   ├── ai/            # AI/RAG services
│   │   │   ├── nistRAG.ts           # NIST document RAG orchestrator
│   │   │   ├── llamaServer.ts       # LLM server wrapper
│   │   │   └── types.ts             # AI-related types
│   │   ├── controls/      # NIST control catalog
│   │   │   ├── catalog.ts           # Control catalog data
│   │   │   ├── recommendations.ts   # Control recommendations
│   │   │   └── suggestions.ts       # Topology-based suggestions
│   │   ├── topology/      # Topology analysis
│   │   │   ├── analyzer.ts          # Network analysis
│   │   │   ├── inventory.ts         # Device inventory extraction
│   │   │   └── flow.ts              # Flow analysis
│   │   ├── export/        # Export utilities
│   │   ├── ssp/           # SSP generation logic
│   │   ├── terraform/     # Terraform parsing
│   │   ├── layout/        # Graph layout algorithms
│   │   └── utils/         # Shared utilities
│   │
│   ├── features/          # Feature modules (organized by domain)
│   │   ├── topology/      # Topology editing feature
│   │   │   └── components/Canvas/, Nodes/, Edges/, etc.
│   │   ├── controls/      # Control narrative management
│   │   ├── ssp/           # SSP generation wizard
│   │   ├── ai-assistant/  # AI chat interface
│   │   ├── inventory/     # Device inventory management
│   │   ├── terraform/     # Terraform import UI
│   │   ├── documents/     # Document upload/chunking
│   │   └── auth/          # License management
│   │
│   ├── components/        # Shared React components
│   │   ├── Canvas/        # Topology canvas components
│   │   ├── Nodes/         # Device/boundary node components
│   │   ├── Edges/         # Connection edge components
│   │   ├── ControlNarratives/  # Control editor UI
│   │   ├── SSP/           # SSP wizard components
│   │   ├── AI/            # AI chat interface
│   │   ├── Dialogs/       # Modal dialogs
│   │   └── ui/            # UI primitives (shadcn/Radix)
│   │
│   └── assets/            # Static assets (icons, data files)
│
├── docs/                  # Documentation
│   ├── ARCHITECTURE.md    # System architecture details
│   ├── MODULE_GUIDE.md    # Module usage guide
│   ├── DEPENDENCY_MAP.md  # Module dependencies
│   ├── cicd/              # CI/CD pipeline documentation
│   └── ...
│
├── scripts/               # Build and utility scripts
│   ├── ci/                # CI/CD helper scripts
│   └── chunking/          # Document chunking utilities
│
├── tests/                 # Test files
│   ├── e2e/               # End-to-end tests
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   ├── visual/             # Visual regression tests
│   ├── fixtures/          # Test fixtures
│   └── terraform/         # Terraform tests
│
└── examples/              # Example projects and reference code
```

---

## Key Architectural Patterns

### 1. IPC Communication Pattern
All communication between the renderer (React) and main process (Electron) goes through type-safe IPC channels:
- **Database operations**: `db:*` channels
- **AI services**: `ai:*` channels
- **File operations**: `export-*`, `file-*` channels
- **License**: `license:*` channels

The renderer uses `src/core/database/client.ts` which wraps `window.electronAPI.*` calls with type safety.

### 2. State Management Pattern
24+ Zustand stores manage different domains of application state, organized into:
- **Core Stores**: useAuthStore, useDocumentStore, useTerraformStore, useDeltaTrackingStore, useErrorDashboardStore, useNavigationHistoryStore
- **Flow Stores**: useFlowStore (facade) + 6 sub-stores (useCanvasUIStore, useProjectStore, useSelectionStore, useSettingsStore, useTopologyStore, useUndoRedoStore)
- **AI Stores**: useAIStore (facade) + useAIServiceStore, useNISTQueryStore, useAINarrativesStore
- **Compliance Stores**: useComplianceStore (facade) + useControlNarrativesStore, useControlSelectionStore, useSSPMetadataStore, useSSPTemplateStore, useOrganizationDefaultsStore
- **Feature Stores**: useTourStore (in features/tour/)

Stores can access each other when needed (e.g., `useFlowStore` is accessed via the `flowStoreAccessor` module for type-safe cross-module access without circular dependencies).

### 3. Feature Module Pattern
Features are organized in `src/features/` with their own components, but shared components live in `src/components/`. This keeps feature code modular while allowing component reuse.

### 4. Business Logic Separation
Business logic lives in `src/lib/` organized by domain (controls, topology, AI, export, etc.). Components call into these libraries rather than containing complex logic themselves.

### 5. Auto-Save Pattern
Diagram changes are automatically saved to the database after a 1-second debounce. No explicit "Save" button is needed for topology edits.

---

## Data Flow Examples

### Topology Editing Flow
```
User edits diagram (adds node/edge)
  ↓
ReactFlow event (onNodesChange/onEdgesChange)
  ↓
useFlowStore.setNodes() / setEdges()
  ↓
Debounced auto-save (1s delay)
  ↓
database.ts.saveDiagram()
  ↓
Electron IPC: db:save-diagram
  ↓
SQLite database update
```

### AI Query Flow
```
User asks NIST question
  ↓
useNISTQueryStore.askQuestion()
  ↓
lib/ai/nistRAG.ts.query()
  ↓
ChromaDB vector search
  ↓
LLM prompt with context
  ↓
Streaming response back to UI
  ↓
useNISTQueryStore updates state
```

### SSP Generation Flow
```
User initiates SSP wizard
  ↓
sspMetadataStore collects form data
  ↓
useControlSelectionStore selects controls
  ↓
User clicks "Generate PDF"
  ↓
Electron IPC: generate-ssp-pdf
  ↓
Main process generates PDF
  ↓
File saved, path returned to renderer
```

---

## Database Schema

SQLite database stores:
- **Projects**: Project metadata (name, baseline, created/updated dates)
- **Diagrams**: Serialized topology (nodes and edges as JSON)
- **Control Narratives**: User-written control narratives per project
- **SSP Metadata**: SSP form data per project
- **Devices**: Device inventory with metadata
- **Documents**: Uploaded compliance documents for RAG
- **Chunks**: Document chunks with embeddings for vector search

---

## Development Workflow

### Running Locally
```bash
npm install              # Install dependencies
npm run electron:rebuild # Rebuild native modules (better-sqlite3)
npm run dev              # Start Vite dev server
npm run electron:dev     # Start Electron (in another terminal)
```

### Building
```bash
npm run electron:build        # Build for current platform
npm run electron:build:linux  # Build for Linux
npm run electron:build:win    # Build for Windows
```

### Testing
```bash
npm test              # Run Vitest unit tests
npm run test:coverage # Run with coverage
```

### Linting/Formatting
```bash
npm run lint          # Check code quality
npm run format        # Format code
```

---

## AI Models Configuration

CompliNist requires local AI models for RAG functionality:

- **LLM Model**: `mistral-7b-instruct-v0.1.Q4_K_M.gguf`
- **Embedding Model**: `bge-m3-FP16.gguf`

Models should be placed in:
- **Development**: `.data/models/`
- **Production**: `models/` (adjacent to executable)

---

## Key Configuration Files

- **`electron/main.js`**: Electron main process entry point
- **`electron/preload.mjs`**: IPC bridge definition
- **`vite.config.ts`**: Vite build configuration
- **`electron-builder.yml`**: Electron build/packaging config
- **`tailwind.config.js`**: Tailwind CSS configuration
- **`tsconfig.json`**: TypeScript configuration

---

## CI/CD Pipeline

CompliNist uses GitLab CI/CD with automated:
- Type checking and linting
- Unit tests and coverage reporting
- Security scanning (SAST, dependency scanning)
- Multi-platform builds (Linux, Windows)
- Progressive deployment (dev → staging → production)

See `docs/cicd/` for detailed pipeline documentation.

---

## Documentation

Comprehensive documentation is available in `docs/`:
- **ARCHITECTURE.md**: Detailed system architecture
- **MODULE_GUIDE.md**: Module APIs and usage
- **DEPENDENCY_MAP.md**: Module dependency graph
- **AI_INTEGRATION_SUMMARY.md**: AI features overview
- **TROUBLESHOOTING.md**: Common issues and solutions

---

## Beginner Summary

**CompliNist** is like a specialized drawing tool for network security experts. Instead of just drawing network diagrams, it helps you:
1. Create visual network layouts (like Visio but focused on security)
2. Document which security rules (NIST controls) apply to your network
3. Use AI to help write explanations of how you've implemented those rules
4. Generate official security plan documents automatically

The app is built as a desktop application using Electron (which combines web technologies with native desktop capabilities), stores data in a local SQLite database, and uses AI models running on your computer (not in the cloud) to help answer questions about security requirements.
