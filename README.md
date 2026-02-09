# CompliNist

**NIST Compliance and System Security Planning Tool**

[![Pipeline Status](https://gitlab.com/your-group/complinist/badges/main/pipeline.svg)](https://gitlab.com/your-group/complinist/-/pipelines)
[![Coverage](https://gitlab.com/your-group/complinist/badges/main/coverage.svg)](https://gitlab.com/your-group/complinist/-/graphs/main/charts)

CompliNist is an Electron-based desktop application for creating network topology diagrams, managing NIST SP 800-53 control narratives, and generating System Security Plans (SSPs) with AI-assisted compliance guidance.

---

## Features

- **Visual Topology Modeling** - Create network diagrams with devices, boundaries, and connections
- **NIST Control Management** - Manage control narratives for SP 800-53 (LOW, MODERATE, HIGH baselines)
- **AI-Assisted Compliance** - RAG-powered queries against NIST documentation
- **SSP Generation** - Generate System Security Plan PDFs from topology and metadata
- **Device Inventory** - Track device metadata, security posture, and compliance status
- **Control Recommendations** - Smart control suggestions based on topology analysis
- **Export Capabilities** - Export diagrams as JSON, SVG, or PNG
- **Document Chunking** - Upload and process your own compliance documents for AI queries
- **Terraform Integration** - Import infrastructure-as-code for compliance mapping

---

## Architecture Overview

CompliNist follows a layered architecture:

```
┌─────────────────────────────────────┐
│         UI Components                │
│  (React + ReactFlow + Tailwind)     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      State Management (Zustand)     │
│  24+ stores organized in domains    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    Business Logic (lib/)             │
│  Controls, Topology, AI, Export     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    Database Wrapper (IPC)            │
│   Type-safe Electron IPC client      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    Electron Main Process             │
│  SQLite, File I/O, AI Services       │
└──────────────────────────────────────┘
```

### Key Technologies

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, Radix UI, ReactFlow
- **State**: Zustand (24+ stores organized in domains)
- **Desktop**: Electron 33
- **Database**: SQLite (better-sqlite3)
- **AI/ML**: node-llama-cpp, ChromaDB (RAG)

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+ (for ingestion scripts)
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd CompliNist

# Install dependencies
npm install

# Rebuild native modules (better-sqlite3)
npm run electron:rebuild
```

### Development

```bash
# Start Vite dev server (renderer process)
npm run dev

# Start Electron with hot reload (in another terminal)
npm run electron:dev
```

### Building

```bash
# Build for current platform
npm run electron:build

# Build for specific platform
npm run electron:build:linux
npm run electron:build:win

# Build for all platforms
npm run electron:build:all
```

---

## CI/CD Pipeline

CompliNist uses **GitLab CI/CD** for automated testing, building, and deployment.

### Pipeline Overview

The pipeline automatically runs on every commit and includes:

- **Code Quality**: TypeScript type checking, ESLint, Prettier
- **Testing**: Unit tests with Vitest, E2E tests, coverage reporting
- **Security**: Dependency scanning, license compliance, SAST
- **Building**: Multi-platform builds (Linux, Windows) with electron-builder
- **Deployment**: Progressive deployment to dev/staging/production

### Pipeline Stages

```
validate → test → security → build → deploy-dev → deploy-staging → deploy-prod
```

**Typical Duration**: 15-25 minutes for full pipeline

### Quick Links

- **View Pipelines**: [CI/CD → Pipelines](https://gitlab.com/your-group/complinist/-/pipelines)
- **Download Builds**: Available in pipeline artifacts (90-day retention)
- **Pipeline Status**: See badges at top of README

### Documentation

Comprehensive CI/CD documentation is available in `docs/cicd/`:

- **[PIPELINE_ARCHITECTURE.md](docs/cicd/PIPELINE_ARCHITECTURE.md)** - Pipeline design, stages, and technical architecture
- **[PIPELINE_GUIDE.md](docs/cicd/PIPELINE_GUIDE.md)** - User guide with troubleshooting and FAQs
- **[INTERACTIVE_WALKTHROUGH.md](docs/cicd/INTERACTIVE_WALKTHROUGH.md)** - Hands-on tutorial for using the pipeline
- **[DEPLOYMENT_RUNBOOK.md](docs/cicd/DEPLOYMENT_RUNBOOK.md)** - Deployment procedures and incident response
- **[SECRETS_MANAGEMENT.md](docs/cicd/SECRETS_MANAGEMENT.md)** - Managing secrets and credentials safely

### For Developers

**Before pushing code**:
```bash
npm run lint          # Check code quality
npm run typecheck     # Verify TypeScript
npm test              # Run tests
```

**Pipeline will automatically**:
- Run validation and tests on your branch
- Build artifacts on main branch
- Deploy to dev on main branch merge
- Require manual trigger for staging/production

### Deployment Environments

| Environment | Trigger | URL | Purpose |
|-------------|---------|-----|---------|
| Development | Automatic (main branch) | `dev.complinist.example.com` | Quick testing |
| Staging | Manual | `staging.complinist.example.com` | Pre-production QA |
| Production | Manual + Approval | `complinist.example.com` | Live users |

### Getting Started with CI/CD

New to the CI/CD pipeline? Start with the [Interactive Walkthrough](docs/cicd/INTERACTIVE_WALKTHROUGH.md) for a hands-on introduction.

---

## Project Structure

```
CompliNist/
├── docs/                  # Documentation
│   ├── cicd/              # CI/CD pipeline documentation
│   │   ├── PIPELINE_ARCHITECTURE.md  # Pipeline design
│   │   ├── PIPELINE_GUIDE.md         # User guide
│   │   ├── INTERACTIVE_WALKTHROUGH.md # Hands-on tutorial
│   │   ├── DEPLOYMENT_RUNBOOK.md     # Deployment procedures
│   │   └── SECRETS_MANAGEMENT.md     # Secrets guide
│   ├── ARCHITECTURE.md    # System architecture
│   ├── DEPENDENCY_MAP.md  # Module dependencies
│   └── MODULE_GUIDE.md    # Module usage guide
├── electron/              # Electron main process
│   ├── main.js            # Main entry point
│   ├── preload.mjs        # IPC bridge
│   ├── ai-service-manager.js  # AI service lifecycle
│   ├── chunking-service.js    # Document chunking
│   ├── ipc/               # IPC handlers by domain
│   ├── di/                 # Dependency injection
│   ├── encryption/         # Encryption services
│   ├── hmr/                # Hot module reload
│   ├── middleware/         # IPC middleware
│   ├── modules/            # Main process modules
│   └── trpc/               # tRPC routers
├── examples/              # Example projects
├── public/                # Static assets
├── scripts/               # Build and utility scripts
│   ├── ci/                # CI/CD helper scripts
│   │   ├── validate-build.sh        # Build validation
│   │   ├── health-check.sh          # Deployment health checks
│   │   └── generate-release-notes.sh # Release notes generator
│   ├── *.sh               # Shell scripts (bash)
│   ├── *.py               # Python scripts (ingestion)
│   ├── *.js               # Node.js scripts
│   └── chunking/          # Document chunking utilities
├── src/
│   ├── app/               # App shell
│   │   ├── App.tsx        # Main app component
│   │   └── ViewRouter.tsx # View routing
│   ├── components/        # Shared React components
│   │   ├── Canvas/        # Topology canvas
│   │   ├── Nodes/         # Node components
│   │   ├── ControlNarratives/  # Control editor
│   │   ├── SSP/           # SSP wizard
│   │   ├── AI/            # AI chat interface
│   │   ├── Dialogs/       # Modal dialogs
│   │   └── ui/            # UI primitives (shadcn)
│   ├── core/              # Core infrastructure
│   │   ├── database/      # Database client
│   │   ├── stores/        # Zustand stores
│   │   │   ├── flow/      # Flow sub-stores (6 stores)
│   │   │   └── selectors/ # Store selectors
│   │   ├── types/         # Shared type definitions
│   │   ├── di/            # Dependency injection
│   │   ├── errors/        # Error handling
│   │   ├── debug/         # Debug utilities
│   │   └── context/       # React contexts
│   ├── features/          # Feature modules
│   │   ├── ai-assistant/  # AI chat feature
│   │   ├── auth/          # License management
│   │   ├── controls/      # Control management
│   │   ├── documents/     # Document upload
│   │   ├── error-dashboard/ # Error tracking
│   │   ├── inventory/     # Device inventory
│   │   ├── projects/      # Project management
│   │   ├── ssp/           # SSP generation
│   │   ├── terraform/     # Terraform integration
│   │   ├── topology/      # Topology editing
│   │   └── tour/          # User tour/onboarding
│   ├── lib/               # Business logic
│   │   ├── ai/            # AI/RAG services
│   │   ├── controls/      # NIST control catalog
│   │   ├── export/        # Export utilities
│   │   ├── layout/        # Graph layout algorithms
│   │   ├── ssp/           # SSP generation
│   │   ├── terraform/     # Terraform parsing
│   │   ├── topology/      # Topology analysis
│   │   └── utils/         # Shared utilities
│   └── assets/            # Static assets
├── tests/                 # Test files
│   ├── e2e/               # End-to-end tests
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   ├── visual/            # Visual regression tests
│   ├── fixtures/          # Test fixtures
│   └── terraform/         # Terraform tests
├── index.html                    # Entry point
├── package.json                  # Dependencies & scripts
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript configuration (renderer)
├── tsconfig.node.json            # TypeScript configuration (Node.js scripts)
├── tailwind.config.js            # Tailwind CSS configuration
├── postcss.config.js             # PostCSS configuration
├── eslint.config.js              # ESLint configuration
├── vitest.config.ts              # Vitest configuration
├── playwright.cursor-tests.config.ts  # Playwright test configuration
└── electron-builder.yml          # Electron build configuration
```

---

## npm Scripts

### Development & Building

```bash
npm run dev                    # Start Vite dev server
npm run build                  # Build renderer (Vite)
npm run electron:dev           # Start Electron with hot reload
npm run electron:build         # Build Electron app
npm run electron:build:linux   # Build for Linux
npm run electron:build:win     # Build for Windows
npm run electron:build:all     # Build for all platforms
npm run electron:rebuild       # Rebuild native modules
```

### Testing

```bash
npm test                       # Run tests (Vitest)
npm run test:ui                # Run tests with UI
npm run test:coverage          # Run tests with coverage
npm run test:license           # Test license import
npm run test:license:all       # Run all license tests
```

### Linting & Formatting

```bash
npm run lint                   # Run ESLint
npm run lint:fix               # Fix ESLint issues
npm run format                 # Format with Prettier
npm run format:check           # Check formatting
```

### AI & Data Ingestion

```bash
npm run ai:cli                 # AI CLI interface
npm run ai:query               # Query AI assistant
npm run ai:health              # Check AI service health
npm run ingest:800-53          # Ingest NIST 800-53 data
npm run ingest:list            # List ingested documents
npm run ingest:file            # Ingest single file
npm run ingest:dir             # Ingest directory
```

### Releases

```bash
npm run build-release          # Build release package
npm run release:package        # Create release archive
npm run package-data           # Package compliance data
npm run upload-data            # Upload data to S3
npm run upload-installers      # Upload installers to S3
```

---

## Core Concepts

### Projects

Each project contains:
- **Topology** - Network diagram (nodes and edges)
- **Control Narratives** - NIST control implementations
- **SSP Metadata** - System Security Plan data
- **Baseline** - LOW, MODERATE, or HIGH

### Topology

- **Devices** - Network devices (firewalls, servers, etc.)
- **Boundaries** - Security zones (ATO boundaries, network segments)
- **Connections** - Links between devices

### Controls

NIST SP 800-53 controls organized by:
- **Families** - AC (Access Control), SC (System Communications), etc.
- **Baseline Applicability** - Controls required for each baseline
- **Narratives** - Implementation descriptions

### AI Features

- **NIST Query** - Ask questions about NIST documentation
- **Narrative Generation** - AI-generated control narratives
- **Topology Analysis** - Smart recommendations based on topology
- **Document RAG** - Query your uploaded compliance documents

---

## Configuration

### AI Models

AI models are expected in:
- **Development**: `.data/models/`
- **Production**: `models/` (adjacent to executable)

Required models:
- LLM: `mistral-7b-instruct-v0.1.Q4_K_M.gguf`
- Embedding: `bge-m3-FP16.gguf`

### Database

SQLite database is created automatically in Electron's userData directory:
- **Linux**: `~/.config/complinist-desktop/`
- **Windows**: `%APPDATA%/complinist-desktop/`
- **macOS**: `~/Library/Application Support/complinist-desktop/`

---

## Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture, data flow, IPC patterns
- **[DEPENDENCY_MAP.md](docs/DEPENDENCY_MAP.md)** - Complete module dependency graph
- **[MODULE_GUIDE.md](docs/MODULE_GUIDE.md)** - Module purpose, APIs, and usage
- **[AI_INTEGRATION_SUMMARY.md](docs/AI_INTEGRATION_SUMMARY.md)** - AI features overview
- **[AI_MODELS_SETUP.md](docs/AI_MODELS_SETUP.md)** - Model configuration guide
- **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** - Common issues and solutions

---

## Development

### Adding a New Feature

1. Create feature directory: `src/features/my-feature/`
2. Add components: `components/`
3. Add services: `services/`
4. Create store if needed: `src/core/stores/useMyFeatureStore.ts` (or in `src/core/stores/flow/` for flow-related stores)
5. Add to ViewRouter if needed
6. Document in `docs/MODULE_GUIDE.md`

### State Management

Stores use Zustand pattern:

```typescript
import { create } from 'zustand';

export const useMyStore = create((set, get) => ({
  items: [],
  addItem: (item) => set({ items: [...get().items, item] }),
}));
```

### IPC Communication

All Electron IPC goes through `src/core/database/client.ts`:

```typescript
import { db } from '@/core/database/client';

const project = await db.createProject('My Project', 'MODERATE');
```

### AI Services

AI services are managed in Electron main process:

```typescript
import { getLLMServer } from '@/lib/ai/llamaServer';

const llm = getLLMServer();
const response = await llm.generate(prompt);
```

---

## Contributing

1. Follow TypeScript and React best practices
2. Use Zustand for state management
3. Keep components focused and composable
4. Run `npm run lint` and `npm run format` before committing
5. Document new modules in `docs/MODULE_GUIDE.md`
6. Update dependency map in `docs/DEPENDENCY_MAP.md`

---

## Troubleshooting

### AI Services Not Starting

- Check model files are in correct location
- Verify GPU backend configuration
- Check Electron console for errors

### Database Errors

- Ensure SQLite database is writable
- Check userData directory permissions
- Verify better-sqlite3 is rebuilt for your platform

### Build Issues

- Run `npm run electron:rebuild` after npm install
- Clear `node_modules` and reinstall
- Check Node.js version (18+ required)

See `docs/TROUBLESHOOTING.md` for more details.

---

## License

PROPRIETARY - See license file for details.

---

## Support

For issues, questions, or contributions, please contact: support@complinist.com
