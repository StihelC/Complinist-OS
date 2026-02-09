# Debug Snapshot System

The debug snapshot system provides AI-assisted debugging capabilities by capturing complete application state and screenshots.

## Features

- 📸 **Screenshot Capture**: Full window screenshot saved as PNG
- 📊 **State Dump**: Complete Zustand store states exported as JSON
- ⌨️ **Keyboard Shortcut**: `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)
- 🔍 **Console Access**: Global `window.__DEBUG__` API for manual snapshots
- 📁 **Organized Storage**: Snapshots saved to temp directory with timestamps

## Usage

### Keyboard Shortcut (Recommended)

Press **`Ctrl+Shift+D`** (or `Cmd+Shift+D` on Mac) to instantly capture a snapshot. A green notification will appear confirming the capture.

### Console API

Open DevTools console and use:

```javascript
// Capture a snapshot
await __DEBUG__.captureSnapshot()

// List all snapshots
await __DEBUG__.listSnapshots()

// Open snapshots directory in file explorer
await __DEBUG__.openSnapshotsDir()

// Get window information
await __DEBUG__.getWindowInfo()
```

## Snapshot Contents

Each snapshot creates a timestamped directory containing:

### 1. `screenshot.png`
- Full application window capture
- Shows exact visual state at capture time
- Useful for identifying UI issues

### 2. `state.json`
Complete application state including:
- **Topology**: All nodes, edges, and viewport state
- **Projects**: Current project and project list
- **Control Narratives**: All control narratives and selection state
- **Authentication**: License status (token excluded for security)
- **AI Service**: Health status, context size, preload progress
- **NIST Query**: Chat history and current queries
- **AI Narratives**: Generated narratives and review state
- **Control Selection**: Selected controls for SSP generation
- **Terraform**: Import state and progress
- **Documents**: Uploaded documents and processing status
- **SSP Metadata**: Form data and configuration
- **Navigation**: History and current view

### 3. `summary.txt`
Quick overview with:
- Timestamp
- Project information
- Node/edge counts
- AI service status
- License status

## Storage Location

Snapshots are saved to:
- **Development**: `/tmp/complinist-debug/snapshot-{timestamp}/`
- **Production**: OS temp directory + `/complinist-debug/snapshot-{timestamp}/`

Example path: `/tmp/complinist-debug/snapshot-2026-01-14T10-30-45-123Z/`

## AI-Assisted Debugging Workflow

1. **Encounter an issue** → Press `Ctrl+Shift+D` to capture state
2. **Share snapshot path** with AI assistant
3. **AI reads** `screenshot.png` to see visual state
4. **AI analyzes** `state.json` to understand data
5. **AI suggests** fixes based on complete context

## Implementation Details

### Frontend (`src/core/debug/snapshot.ts`)
- Collects state from all 11 Zustand stores
- Sanitizes state for IPC (removes functions, DOM nodes, circular refs)
- Sends serialized state to main process via IPC
- Shows notification on capture
- Initializes keyboard shortcut listener

### Backend (`electron/ipc/debug.js`)
- Captures window screenshot using Electron API
- Writes state JSON to file
- Creates summary file
- Manages snapshot directory structure

### IPC Bridge (`electron/preload.mjs`)
- Exposes debug methods to renderer
- Type-safe IPC communication
- Security-conscious data handling

## Security Considerations

- **License tokens are excluded** from state dumps for security
- **Passwords and secrets** should never be stored in Zustand stores
- Snapshots are **local only** (not uploaded anywhere)
- **Temp directory** is OS-managed and cleaned periodically

## Development

To add new state to snapshots:

1. Import the store in `src/core/debug/snapshot.ts`
2. Add store state to the snapshot object in `captureDebugSnapshot()`
3. Update the summary generation logic if needed

Example:
```typescript
import { useMyNewStore } from '@/core/stores/useMyNewStore';

// In captureDebugSnapshot():
const snapshot = {
  // ... existing state
  myNewFeature: {
    data: useMyNewStore.getState().data,
    isLoading: useMyNewStore.getState().isLoading,
  },
};
```

## Troubleshooting

### Keyboard shortcut not working
- Ensure app is focused
- Check DevTools console for "Debug utilities available" message
- Try manual capture: `__DEBUG__.captureSnapshot()`

### "An object could not be cloned" error
- This has been fixed by adding state sanitization
- State is now properly serialized before IPC transmission
- Functions, DOM nodes, and circular references are automatically removed

### Screenshot is blank
- Window may be minimized or hidden
- Try focusing window first
- Check `summary.txt` for error messages

### State incomplete
- Ensure store is initialized before capture
- Check store imports in `snapshot.ts`
- Verify store is accessible via `getState()`

## Future Enhancements

Possible improvements:
- [ ] In-app debug panel UI
- [ ] Automatic snapshots on errors
- [ ] Snapshot diffing tool
- [ ] Snapshot replay/restore
- [ ] Network request capture
- [ ] Performance metrics capture
- [ ] Database query logging
