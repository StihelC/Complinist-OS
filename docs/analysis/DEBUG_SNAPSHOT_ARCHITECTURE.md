# Debug Snapshot System - Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                             │
├─────────────────────────────────────────────────────────────────────┤
│  Keyboard: Ctrl+Shift+D  │  Console: __DEBUG__.captureSnapshot()    │
└────────────┬──────────────┴───────────────┬──────────────────────────┘
             │                               │
             └───────────────┬───────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RENDERER PROCESS (React)                          │
│                  src/core/debug/snapshot.ts                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ 1. Collect State from Zustand Stores                   │         │
│  │    - useFlowStore                                       │         │
│  │    - useControlNarrativesStore                          │         │
│  │    - useAuthStore                                       │         │
│  │    - useAIServiceStore                                  │         │
│  │    - useNISTQueryStore                                  │         │
│  │    - useAINarrativesStore                               │         │
│  │    - useControlSelectionStore                           │         │
│  │    - useTerraformStore                                  │         │
│  │    - useDocumentStore                                   │         │
│  │    - useSSPMetadataStore                                │         │
│  │    - useNavigationHistoryStore                          │         │
│  └────────────────────────────────────────────────────────┘         │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ 2. Package State as JSON Object                        │         │
│  │    {                                                    │         │
│  │      currentProject: { ... },                           │         │
│  │      topology: { nodes, edges, viewport },              │         │
│  │      controlNarratives: { ... },                        │         │
│  │      auth: { isLicensed, licenseInfo },                 │         │
│  │      aiService: { isHealthy, ... },                     │         │
│  │      // ... all stores                                  │         │
│  │      capturedAt: "2026-01-14T10:30:45.123Z"             │         │
│  │    }                                                    │         │
│  └────────────────────────────────────────────────────────┘         │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ 3. Send to Main Process via IPC                        │         │
│  │    window.electronAPI.captureDebugSnapshot(state)       │         │
│  └────────────────────────────────────────────────────────┘         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                    IPC: debug:capture-snapshot
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PRELOAD SCRIPT (Bridge)                           │
│                     electron/preload.mjs                             │
├─────────────────────────────────────────────────────────────────────┤
│  contextBridge.exposeInMainWorld('electronAPI', {                   │
│    captureDebugSnapshot: (stateData) =>                             │
│      ipcRenderer.invoke('debug:capture-snapshot', stateData)        │
│  })                                                                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MAIN PROCESS (Electron)                           │
│                    electron/ipc/debug.js                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ 1. Get Main Window Reference                           │         │
│  │    const mainWindow = getMainWindow()                  │         │
│  └────────────────────────────────────────────────────────┘         │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ 2. Create Snapshot Directory                           │         │
│  │    /tmp/complinist-debug/snapshot-{timestamp}/          │         │
│  └────────────────────────────────────────────────────────┘         │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ 3. Capture Screenshot                                  │         │
│  │    const screenshot = await mainWindow.capturePage()   │         │
│  │    await fs.writeFile('screenshot.png', screenshot)     │         │
│  └────────────────────────────────────────────────────────┘         │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ 4. Save State JSON                                     │         │
│  │    await fs.writeFile('state.json',                    │         │
│  │      JSON.stringify(stateData, null, 2))               │         │
│  └────────────────────────────────────────────────────────┘         │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ 5. Generate Summary                                    │         │
│  │    await fs.writeFile('summary.txt', summary)          │         │
│  └────────────────────────────────────────────────────────┘         │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ 6. Return Result                                       │         │
│  │    return {                                            │         │
│  │      success: true,                                    │         │
│  │      snapshotDir: '/tmp/complinist-debug/...',         │         │
│  │      screenshotPath: '.../screenshot.png',             │         │
│  │      statePath: '.../state.json'                       │         │
│  │    }                                                   │         │
│  └────────────────────────────────────────────────────────┘         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                    IPC Response (async)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RENDERER PROCESS (React)                          │
│                  src/core/debug/snapshot.ts                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐         │
│  │ Show Success Notification                              │         │
│  │  ┌──────────────────────────────────────────┐          │         │
│  │  │ ✓ Debug Snapshot Captured                │          │         │
│  │  │                                           │          │         │
│  │  │ Screenshot and state saved to:            │          │         │
│  │  │ /tmp/complinist-debug/snapshot-...        │          │         │
│  │  └──────────────────────────────────────────┘          │         │
│  └────────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. State Collection (Renderer)
```typescript
const snapshot = {
  currentProject: useFlowStore.getState().currentProject,
  topology: {
    nodes: useFlowStore.getState().nodes,
    edges: useFlowStore.getState().edges,
  },
  // ... all other stores
  capturedAt: new Date().toISOString(),
};
```

### 2. IPC Communication
```typescript
// Renderer → Preload → Main
const result = await window.electronAPI.captureDebugSnapshot(snapshot);
```

### 3. Screenshot Capture (Main)
```javascript
const mainWindow = getMainWindow();
const screenshot = await mainWindow.capturePage();
await fs.writeFile(screenshotPath, screenshot.toPNG());
```

### 4. File System Output
```
/tmp/complinist-debug/
└── snapshot-2026-01-14T10-30-45-123Z/
    ├── screenshot.png    (binary PNG file)
    ├── state.json        (formatted JSON)
    └── summary.txt       (plain text)
```

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        App.tsx                                │
│  (Initializes debug shortcut on mount)                       │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             │ initializeDebugShortcut()
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                  snapshot.ts (Frontend)                       │
│                                                               │
│  ┌─────────────────────────────────────────────────┐         │
│  │ Event Listeners:                                 │         │
│  │  • Keyboard: keydown → Ctrl+Shift+D              │         │
│  │                                                  │         │
│  │ Global API:                                      │         │
│  │  • window.__DEBUG__.captureSnapshot()            │         │
│  │  • window.__DEBUG__.listSnapshots()              │         │
│  │  • window.__DEBUG__.openSnapshotsDir()           │         │
│  └─────────────────────────────────────────────────┘         │
│                             │                                │
│                             ▼                                │
│  ┌─────────────────────────────────────────────────┐         │
│  │ State Collectors:                                │         │
│  │  • useFlowStore.getState()                       │         │
│  │  • useControlNarrativesStore.getState()          │         │
│  │  • useAuthStore.getState()                       │         │
│  │  • ... (11 stores total)                         │         │
│  └─────────────────────────────────────────────────┘         │
└────────────────────────────┬─────────────────────────────────┘
                             │
                  window.electronAPI.captureDebugSnapshot()
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                   preload.mjs (Bridge)                        │
│                                                               │
│  contextBridge.exposeInMainWorld('electronAPI', {            │
│    captureDebugSnapshot: (data) =>                           │
│      ipcRenderer.invoke('debug:capture-snapshot', data)      │
│  })                                                          │
└────────────────────────────┬─────────────────────────────────┘
                             │
                  ipcRenderer.invoke('debug:capture-snapshot')
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                ipc-registry.js (Main)                         │
│                                                               │
│  registerAllIPCHandlers() {                                  │
│    registerDebugHandlers();  ← Registers all handlers        │
│  }                                                           │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                 debug.js (IPC Handlers)                       │
│                                                               │
│  ipcMain.handle('debug:capture-snapshot', async (evt, data)  │
│    • Create snapshot directory                               │
│    • Capture screenshot                                      │
│    • Save state JSON                                         │
│    • Generate summary                                        │
│    • Return file paths                                       │
│  )                                                           │
└──────────────────────────────────────────────────────────────┘
```

## Sequence Diagram

```
User              Keyboard       snapshot.ts      preload.mjs      debug.js        FileSystem
 │                   │                │                │               │                │
 │  Press            │                │                │               │                │
 │  Ctrl+Shift+D     │                │                │               │                │
 ├──────────────────>│                │                │               │                │
 │                   │  keydown       │                │               │                │
 │                   │  event         │                │               │                │
 │                   ├───────────────>│                │               │                │
 │                   │                │  Collect       │               │                │
 │                   │                │  state from    │               │                │
 │                   │                │  all stores    │               │                │
 │                   │                │<─────┐         │               │                │
 │                   │                │      │         │               │                │
 │                   │                │<─────┘         │               │                │
 │                   │                │                │               │                │
 │                   │                │  IPC invoke    │               │                │
 │                   │                │  (state data)  │               │                │
 │                   │                ├───────────────>│               │                │
 │                   │                │                │  IPC forward  │                │
 │                   │                │                ├──────────────>│                │
 │                   │                │                │               │  Create dir    │
 │                   │                │                │               ├───────────────>│
 │                   │                │                │               │                │
 │                   │                │                │               │  Capture       │
 │                   │                │                │               │  screenshot    │
 │                   │                │                │               │<─────┐         │
 │                   │                │                │               │      │         │
 │                   │                │                │               │<─────┘         │
 │                   │                │                │               │                │
 │                   │                │                │               │  Write PNG     │
 │                   │                │                │               ├───────────────>│
 │                   │                │                │               │                │
 │                   │                │                │               │  Write JSON    │
 │                   │                │                │               ├───────────────>│
 │                   │                │                │               │                │
 │                   │                │                │               │  Write summary │
 │                   │                │                │               ├───────────────>│
 │                   │                │                │               │                │
 │                   │                │                │  Return paths │                │
 │                   │                │                │<──────────────┤                │
 │                   │                │  Return result │               │                │
 │                   │                │<───────────────┤               │                │
 │                   │                │                │               │                │
 │                   │                │  Show          │               │                │
 │                   │                │  notification  │               │                │
 │                   │                │<─────┐         │               │                │
 │  See notification │                │      │         │               │                │
 │<──────────────────┼────────────────┤<─────┘         │               │                │
 │                   │                │                │               │                │
```

## Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY BOUNDARIES                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Renderer Process (Sandboxed)                               │
│  ┌──────────────────────────────────────────────┐           │
│  │ • No direct file system access                │           │
│  │ • No Node.js APIs                             │           │
│  │ • Can only call exposed electronAPI methods   │           │
│  │ • State sanitized (tokens removed)            │           │
│  └──────────────────────────────────────────────┘           │
│                       ▲                                     │
│                       │                                     │
│          Context Bridge (Isolated)                          │
│  ┌──────────────────────────────────────────────┐           │
│  │ • Type-safe IPC channel                       │           │
│  │ • No arbitrary code execution                 │           │
│  │ • Validates method signatures                 │           │
│  └──────────────────────────────────────────────┘           │
│                       ▲                                     │
│                       │                                     │
│  Main Process (Privileged)                                  │
│  ┌──────────────────────────────────────────────┐           │
│  │ • Full file system access                     │           │
│  │ • Can capture screenshots                     │           │
│  │ • Writes to controlled temp directory         │           │
│  │ • No network requests                         │           │
│  └──────────────────────────────────────────────┘           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling

```
┌─────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING FLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Try/Catch at Every Layer:                                  │
│                                                              │
│  1. snapshot.ts (Frontend)                                  │
│     ├─ Catch store access errors                            │
│     ├─ Catch IPC communication errors                       │
│     └─ Show error in console                                │
│                                                              │
│  2. debug.js (Backend)                                      │
│     ├─ Catch window.capturePage errors                      │
│     ├─ Catch file system errors                             │
│     ├─ Catch directory creation errors                      │
│     └─ Return { success: false, error: message }            │
│                                                              │
│  3. Response Handling                                       │
│     ├─ Check result.success                                 │
│     ├─ Log error if failed                                  │
│     └─ Show notification with error details                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Performance Considerations

- **Screenshot capture**: ~100-200ms
- **State collection**: ~10-50ms (depends on store size)
- **File I/O**: ~50-100ms (depends on disk speed)
- **Total time**: ~200-400ms typical

Non-blocking operations:
- Runs asynchronously
- Doesn't freeze UI
- User can continue working immediately

## Maintenance Notes

### Adding New Stores

To capture state from a new store:

1. Import the store in `src/core/debug/snapshot.ts`
2. Add to snapshot object in `captureDebugSnapshot()`
3. Update summary generation in `electron/ipc/debug.js`

### Modifying Snapshot Format

To change what's captured:

1. Modify `captureDebugSnapshot()` in `snapshot.ts`
2. Update TypeScript types in `window.d.ts`
3. Update documentation in README.md

### Testing

Manual testing checklist:
- [ ] Press Ctrl+Shift+D → notification appears
- [ ] Check snapshot directory → files exist
- [ ] Open screenshot.png → shows correct UI
- [ ] Open state.json → contains expected data
- [ ] Read summary.txt → matches current state
- [ ] Console `__DEBUG__.captureSnapshot()` → works
- [ ] Console `__DEBUG__.listSnapshots()` → shows snapshots
- [ ] Console `__DEBUG__.openSnapshotsDir()` → opens folder

---

**Last Updated**: 2026-01-14
**Version**: 1.0.0
**Status**: Production Ready
