# Problem Analysis: ERR_FILE_NOT_FOUND

## Error
```
Failed to load: file:///home/cam/Desktop/CompliNist/dist/index.html -6 ERR_FILE_NOT_FOUND
```

## Root Cause Analysis

### The `electron:dev` Script Flow
```bash
npm run build && vite build --watch & wait-on file:dist/index.html && electron . --no-sandbox
```

**What happens:**
1. `npm run build` - Runs initial build (synchronous, completes)
2. `vite build --watch &` - Starts watch mode in **background** (async)
3. `wait-on file:dist/index.html` - Waits for file to exist
4. `electron . --no-sandbox` - Starts Electron

### The Problem

Looking at the terminal output:
```
build started...
transforming (1) index.html          ← First build or watch rebuild?
✓ Updated 1729 existing device type entries
Database initialized
[MAIN] IPC handlers registered
Failed to load: file:///.../dist/index.html -6 ERR_FILE_NOT_FOUND  ← ERROR HERE
transforming (4) src/app/App.tsx     ← Watch mode still building!
✓ 3336 modules transformed.          ← Build completes AFTER error
```

**Timeline:**
1. ✅ Initial build completes → `dist/index.html` exists
2. ✅ `wait-on` sees file → proceeds
3. ✅ Electron starts → tries to load file
4. ❌ **Watch mode is rebuilding** → file might be:
   - Temporarily locked/unavailable
   - Being rewritten
   - In inconsistent state
5. ❌ Electron gets `ERR_FILE_NOT_FOUND`
6. ✅ Watch build completes → file exists again (too late)

### Why This Happens

1. **Race Condition**: `vite build --watch` runs in background and can rebuild files while Electron is starting
2. **File Locking**: During rebuild, the file might be temporarily unavailable
3. **Timing**: Electron tries to load before watch rebuild completes

### Solutions

#### Option 1: Wait for Watch to Stabilize (Recommended)
Add a delay or better check after `wait-on`:

```bash
wait-on file:dist/index.html && sleep 2 && electron . --no-sandbox
```

#### Option 2: Don't Use Watch Mode Initially
Build once, then start watch separately:

```bash
npm run build && electron . --no-sandbox & vite build --watch
```

#### Option 3: Use Vite Dev Server Instead
Load from `http://localhost:5173` instead of file:// (but this changes the architecture)

#### Option 4: Retry Logic in Electron
Add retry logic in `createWindow()` to retry loading if file not found initially.

### Current Workaround

The file DOES exist (we verified with `ls -la`), but Electron can't access it at that moment because:
- Watch mode is actively rebuilding
- File system might have brief lock during write
- Timing issue between processes

### Recommended Fix

Modify the script to ensure file is stable before Electron loads:

```json
"electron:dev": "npm run build && (vite build --watch &) && wait-on file:dist/index.html && sleep 1 && electron . --no-sandbox"
```

Or better: Check file is not being written:

```json
"electron:dev": "npm run build && (vite build --watch &) && wait-on file:dist/index.html --interval 100 --delay 500 && electron . --no-sandbox"
```

