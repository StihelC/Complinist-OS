# CompliNist

[![CI](https://github.com/StihelC/Complinist-OS/actions/workflows/release.yml/badge.svg)](https://github.com/StihelC/Complinist-OS/actions)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

CompliNist is a desktop application for NIST compliance management. It combines visual network topology modeling, NIST SP 800-53 control narrative management, and local AI-assisted compliance guidance into a single tool for building System Security Plans (SSPs).

## Getting Started

### Prerequisites

- Node.js 18+
- Git
- Python 3.8+ (optional, for document ingestion scripts)

### Install and Run

```bash
git clone https://github.com/StihelC/Complinist-OS.git
cd Complinist-OS
npm install
npm run electron:rebuild
```

The main entry point is the launch script in the project root:

```bash
# Start the app (cleans up stale processes, launches Electron with HMR)
./launch.sh start

# Stop all running processes
./launch.sh stop
```

Or use npm scripts directly:

```bash
npm start              # Same as ./launch.sh start
npm stop               # Same as ./launch.sh stop
npm run electron:dev   # Start without HMR (build mode)
```

### Build for Distribution

```bash
npm run electron:build         # Current platform
npm run electron:build:win     # Windows
npm run electron:build:linux   # Linux
```

## Features

- **Topology Modeling** -- Drag-and-drop network diagrams with devices, security boundaries, and connections using ReactFlow
- **NIST SP 800-53 Controls** -- Manage control narratives across LOW, MODERATE, and HIGH baselines
- **AI Compliance Assistant** -- Local LLM + RAG pipeline for querying NIST documentation and generating control narratives (runs entirely on your machine, no data leaves your desktop)
- **SSP Generation** -- Generate System Security Plan PDFs from your topology and control data
- **Device Inventory** -- Track device metadata, security posture, and compliance status
- **Terraform Import** -- Import infrastructure-as-code and map it to compliance controls
- **Export** -- Diagrams as JSON, SVG, or PNG

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, Radix UI, ReactFlow |
| State | Zustand |
| Desktop | Electron 33 |
| Database | SQLite (better-sqlite3) |
| AI | node-llama-cpp, ChromaDB |

## Project Structure

```
launch.sh              # Main entry point -- start/stop the app
electron/              # Electron main process (SQLite, AI, IPC handlers)
src/
  app/                 # App shell and routing
  components/          # Shared UI components
  core/                # Stores, database client, types, DI
  features/            # Feature modules (ai-assistant, controls, topology, ssp, ...)
  lib/                 # Business logic (AI/RAG, layout, export, terraform)
tests/                 # Unit, integration, e2e, and visual tests
scripts/               # Build, CI, ingestion, and dev utility scripts
docs/                  # Architecture, module guide, troubleshooting
```

## AI Setup

CompliNist runs AI models locally. Place `.gguf` model files in `.data/models/` (dev) or `models/` (production):

- **LLM**: `mistral-7b-instruct-v0.1.Q4_K_M.gguf`
- **Embedding**: `bge-m3-FP16.gguf`

AI features are optional -- the app works without them, but compliance queries and narrative generation will be unavailable.

## Development

### Common Commands

```bash
npm run dev              # Vite dev server only (no Electron)
npm run typecheck        # TypeScript checking
npm run lint             # ESLint
npm run format           # Prettier
npm test                 # Vitest unit tests
npm run test:coverage    # Tests with coverage
```

### Before Submitting a PR

```bash
npm run lint && npm run typecheck && npm test
```

## Contributing

1. Fork the repo and branch from `master`
2. Use conventional branch names: `feature/`, `fix/`, `docs/`, `refactor/`
3. Keep PRs focused -- one feature or fix per PR
4. Run lint, typecheck, and tests before submitting
5. Open a PR with a clear description of your changes

## Documentation

- [Architecture](docs/ARCHITECTURE.md) -- System design, data flow, IPC patterns
- [Module Guide](docs/MODULE_GUIDE.md) -- Module APIs and usage
- [Dependency Map](docs/DEPENDENCY_MAP.md) -- Module dependency graph
- [AI Models Setup](docs/AI_MODELS_SETUP.md) -- Model configuration
- [Troubleshooting](docs/TROUBLESHOOTING.md) -- Common issues and fixes

## License

Apache License 2.0 -- see [LICENSE](LICENSE).

## Support

- [GitHub Issues](https://github.com/StihelC/Complinist-OS/issues) -- Bug reports and feature requests
- [GitHub Discussions](https://github.com/StihelC/Complinist-OS/discussions) -- Questions and ideas
