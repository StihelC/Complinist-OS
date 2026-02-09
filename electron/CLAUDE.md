# Electron Main Process Memory

Context for working in `electron/` - Electron main process code.

---

## Directory Structure

```
electron/
├── main.js                    # Entry point, window management
├── preload.mjs                # IPC bridge exposed to renderer
├── ai-service-manager.js      # AI service lifecycle management
├── chunking-service.js        # Document chunking
├── database/                  # SQLite database utilities
├── di/                        # Dependency injection
├── encryption/                # Encryption utilities
├── hmr/                       # Hot module reload
├── ipc/                       # IPC handlers organized by domain
├── middleware/                # Middleware
├── modules/                    # Main process modules
├── trpc/                      # tRPC setup
└── utils/                     # Utilities
```

---

## Main Entry Point (`main.js`)

**Purpose**: Electron main process entry point.

**Responsibilities**:
- Create application windows
- Set up IPC handlers
- Initialize services (database, AI)
- Handle application lifecycle
- Menu management

**Key Patterns**:
- Window creation and management
- IPC handler registration
- Service initialization
- Error handling

---

## Preload Script (`preload.mjs`)

**Purpose**: IPC bridge exposed to renderer with context isolation.

**Pattern**:
```javascript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  createProject: (data) => ipcRenderer.invoke('db:create-project', data),
  saveDiagram: (data) => ipcRenderer.invoke('db:save-diagram', data),
  // ... more IPC methods
});
```

**Security**: Context isolation enabled, no direct Node.js access from renderer.

**See**: `@.cursor/rules/electron-ipc.md` for IPC patterns.

---

## IPC Handlers (`electron/ipc/`)

**Purpose**: IPC handlers organized by domain.

**Structure**:
- `database.js` - Database operations
- `ai.js` - AI service operations
- `export.js` - File export operations
- `terraform.js` - Terraform import
- `license.js` - License management
- `device-types.js` - Device type queries

**Handler Pattern**:
```javascript
import { ipcMain } from 'electron';

ipcMain.handle('db:create-project', async (event, data) => {
  const { name, baseline } = data;
  const project = await createProject(name, baseline);
  return project;
});
```

**Error Handling**: Errors are serialized and returned to renderer.

---

## Database (`electron/database/`)

**Purpose**: SQLite database utilities.

**Key Files**:
- Database initialization
- Schema management
- Query utilities

**Database**: better-sqlite3 (synchronous, fast)

**Location**: Electron's userData directory:
- Linux: `~/.config/complinist-desktop/`
- Windows: `%APPDATA%/complinist-desktop/`
- macOS: `~/Library/Application Support/complinist-desktop/`

---

## AI Service Manager (`ai-service-manager.js`)

**Purpose**: Manages AI service lifecycle in main process.

**Responsibilities**:
- Initialize LLM service (node-llama-cpp)
- Initialize embedding service
- Initialize ChromaDB connection
- Health checks
- Context size calibration
- GPU backend configuration

**Key Functions**:
- `initializeAIServices()` - Initialize all AI services
- `checkHealth()` - Check service health
- `getContextSize()` - Get calibrated context size

**Models Location**:
- Development: `.data/models/`
- Production: `models/` (adjacent to executable)

**Required Models**:
- LLM: `mistral-7b-instruct-v0.1.Q4_K_M.gguf`
- Embedding: `bge-m3-FP16.gguf`

---

## Chunking Service (`chunking-service.js`)

**Purpose**: Document chunking for RAG indexing.

**Responsibilities**:
- Chunk documents into smaller pieces
- Generate embeddings for chunks
- Store chunks in ChromaDB

**Usage**: Called when documents are uploaded for RAG.

---

## Modules (`electron/modules/`)

**Purpose**: Main process modules.

**Key Modules**:
- `window-manager.js` - Window management
- `app-lifecycle.js` - Application lifecycle
- Other utility modules

---

## IPC Channel Naming

**Namespaced Channels**:
- `db:*` - Database operations
- `ai:*` - AI service operations
- `export-*` - File export
- `license:*` - License management
- `device-types:*` - Device type queries

**See**: `@.cursor/rules/electron-ipc.md` for complete channel list.

---

## Security

**Context Isolation**: Always enabled.

**Preload Bridge**: Only exposes necessary APIs.

**No Direct Node.js**: Renderer cannot access Node.js directly.

**Input Validation**: Validate all IPC inputs in handlers.

---

## Error Handling

**Pattern**: Errors are serialized and returned to renderer.

```javascript
ipcMain.handle('db:create-project', async (event, data) => {
  try {
    return await createProject(data);
  } catch (error) {
    return { error: error.message };
  }
});
```

---

## Service Initialization

**Order**:
1. Database initialization
2. AI service initialization
3. IPC handler registration
4. Window creation

**Pattern**: Initialize services in `main.js` before creating windows.

---

## Context7 Integration

**Always fetch Context7 docs** (`electron/electron`) when:
- Creating new IPC handlers
- Working with `ipcMain` or `ipcRenderer`
- Implementing context bridge
- Working with window management
- Handling file system operations

**Key APIs to verify**:
- `ipcMain.handle()` - Request-response handlers
- `ipcMain.on()` - Event listeners
- `contextBridge.exposeInMainWorld()` - Expose APIs
- `app` - Application lifecycle
- `BrowserWindow` - Window management

---

## Best Practices

1. **IPC Security**: Always validate inputs, use context isolation
2. **Error Handling**: Serialize errors properly
3. **Service Lifecycle**: Initialize services before use
4. **Resource Cleanup**: Clean up resources on app quit
5. **Type Safety**: Use TypeScript types for IPC data
6. **Logging**: Log important operations for debugging

---

## Testing

**Pattern**: Mock Electron APIs in tests.

**Location**: `tests/` (unit and e2e tests).

---

## References

- Electron Docs: Use Context7 to fetch `electron/electron`
- IPC Patterns: `@.cursor/rules/electron-ipc.md`
- Root Memory: `@CLAUDE.md`
- Architecture: `@docs/ARCHITECTURE.md`
