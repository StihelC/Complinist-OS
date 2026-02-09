# Scripts Directory Organization

This directory contains build, deployment, and utility scripts for CompliNist. Scripts are organized into logical subdirectories for better maintainability.

## Directory Structure

```
scripts/
├── build/                   # Build scripts
│   ├── fast-build.js
│   ├── build-cache.js
│   ├── build-release.sh
│   ├── build-release.bat
│   ├── create-release-archive.js
│   ├── afterPack.cjs
│   └── sourcemap-optimizer.js
├── dev/                     # Development/launch scripts
│   └── compliflow-launcher.sh
├── ingestion/               # Ingestion scripts
│   ├── ingest_compliance_docs.py
│   ├── ingest_nist_800_53.py
│   └── ingest.sh
├── utils/                   # Utility scripts
│   ├── create-icons.js
│   ├── ai-test.js
│   ├── package-data.sh
│   ├── upload-data-to-s3.sh
│   └── upload-installers-to-s3.sh
├── ci/                      # CI/CD helper scripts
│   ├── generate-release-notes.sh
│   ├── health-check.sh
│   └── validate-build.sh
├── chunking/                # Document chunking utilities (Python)
│   ├── chunker.py
│   ├── file_processor.py
│   ├── metadata_enhancer.py
│   ├── process_documents.py
│   └── token_utils.py
├── legacy/                  # Legacy/one-time scripts (archived)
│   ├── migrations/          # One-time database/migration scripts
│   ├── fixes/               # One-time fix scripts
│   └── ai-cli.sh            # Legacy AI CLI (replaced by ai-test.js)
└── test/                    # Development and testing scripts
    └── dev/                 # Manual testing scripts
```

## Active Scripts by Category

These scripts are actively used in the build process, package.json, or deployment pipelines.

### Build Scripts (`build/`)
- `fast-build.js` - Incremental build system with caching
- `build-cache.js` - Build cache management
- `build-release.sh` / `build-release.bat` - Release build scripts
- `create-release-archive.js` - Package release archives
- `afterPack.cjs` - Electron builder afterPack hook
- `sourcemap-optimizer.js` - Source map optimization utility

### Development/Launch Scripts (`dev/`)
- `compliflow-launcher.sh` - AppImage launcher (used in builds)

> **Note**: The main `launch.sh` has been moved to the project root.

### Ingestion Scripts (`ingestion/`)
- `ingest_compliance_docs.py` - Ingest compliance documents into ChromaDB
- `ingest_nist_800_53.py` - Ingest NIST 800-53 documents
- `ingest.sh` - Interactive ingestion menu wrapper

### Utility Scripts (`utils/`)
- `create-icons.js` - Generate application icons
- `ai-test.js` - AI service testing utility
- `package-data.sh` - Package data files
- `upload-data-to-s3.sh` - Upload data to S3
- `upload-installers-to-s3.sh` - Upload installers to S3

## Legacy Scripts

Legacy scripts are preserved for reference but are no longer actively used. They have been moved to the `legacy/` directory.

### Legacy/Migrations
One-time migration scripts that were used to migrate data formats, database schemas, or icon paths:
- `init-database.js` - Database initialization (still referenced by create-release-archive.js)
- `migrate-icon-paths.js`
- `migrate-devices-to-azure-icons.js`
- `migrate-device-types-to-db.js`
- `populate-device-types.js`
- `ensure-device-icon-paths.js`
- `update-device-icon-mapping.js`
- `README-device-icon-paths.md` - Documentation for icon path migrations

### Legacy/Fixes
One-time fix scripts used to correct data issues:
- `fix-defender-icon-paths.js`
- `fix-duplicate-icons.js`
- `remove-duplicate-icon-keys.js`
- `convert-jpgs-to-svg.js`
- `generate-azure-icon-mapping.mjs`
- `rename-azure-icons.mjs`

### Legacy Root
- `ai-cli.sh` - Legacy AI CLI (replaced by ai-test.js, functionality integrated into Electron)

## Test Scripts

Development and testing scripts are located in `test/dev/`:

- `test-*.mjs`, `test-*.js`, `test-*.cjs` - Various test scripts for AI, RAG, NIST controls, etc.
- `test-*.py` - Python test scripts
- `audit-chromadb.py`, `audit-chromadb-controls.py` - ChromaDB audit scripts
- `validate-sp800-53-baselines.mjs` - Baseline validation script

These scripts are for manual testing and development purposes, not part of the automated test suite (which is in the `tests/` directory).

## Usage

Most scripts are called via npm scripts defined in `package.json`. For example:

```bash
# Build scripts
npm run build:fast
npm run build-release

# Ingestion
npm run ingest:list
npm run ingest:800-53

# AI testing
npm run ai:cli
npm run ai:health
```

For scripts not exposed via npm, run them directly:

```bash
# Example: Create icons
node scripts/utils/create-icons.js

# Example: Launch application
./launch.sh start
```

## Notes

- Scripts in `legacy/` are preserved for historical reference but should not be used in new workflows
- Database initialization is now handled by `electron/modules/database-init.js` during app startup
- The `init-database.js` script in `legacy/migrations/` is still used by `create-release-archive.js` for creating fresh databases in release packages
