# CompliNist Troubleshooting Guide

## Problem: Electron Window Not Launching

### Symptoms
- Running `npm run electron:dev` but no window appears
- Terminal shows processes running but window doesn't open
- Multiple stuck processes
- Error: "SUID sandbox helper binary was found, but is not configured correctly"

### Root Cause
**FIXED:** Electron was failing due to Linux sandbox configuration. The fix is to use `--no-sandbox` flag, which is now included in the `electron:dev` script.

## Solutions

### **Option 1: Use Unified Launch (RECOMMENDED)**

```bash
npm start
```

This will:
1. Start all AI services (LLM, Embedding, ChromaDB)
2. Kill any existing processes
3. Clear port 5173
4. Launch the CompliNist application
5. Handle cleanup on Ctrl+C

### **Option 2: Manual Cleanup**

```bash
# Step 1: Stop all processes
npm stop

# Step 2: Start fresh
npm start
```

### **Option 3: Nuclear Option**

If nothing else works:

```bash
# Kill everything
pkill -9 -f electron
pkill -9 -f vite
pkill -9 -f node

# Clear the port
lsof -ti:5173 | xargs kill -9

# Restart
npm run electron:dev
```

## Helper Commands

### `npm start`
Launch app + AI services - automatically handles cleanup and startup

### `npm stop`
Stop everything - stops all AI services and the application

### `npm run ai-cli`
AI testing CLI - test AI services without launching the full app

## Common Issues

### Issue: "Port 5173 already in use"

```bash
npm stop
npm start
```

### Issue: Window opens but is blank/white

This usually means Vite didn't start properly:

```bash
npm run stop
npm start
```

Wait for the console to show:
```
VITE v5.x.x  ready in XXX ms
➜  Local:   http://localhost:5173/
```

### Issue: Multiple windows opening

You have multiple instances running:

```bash
npm run stop
# Wait 3 seconds
npm start
```

### Issue: Database locked

```bash
# Close all instances
npm run stop

# Remove lock file (if exists)
rm ~/.config/complinist-desktop/complinist.db-wal
rm ~/.config/complinist-desktop/complinist.db-shm

# Start fresh
npm start
```

## Checking if App is Running

```bash
# Check for processes
ps aux | grep -E "(electron|vite)" | grep -v grep

# Check if port is in use
lsof -i:5173
```

If you see output, something is running.

## Development Workflow

### Starting Development

```bash
npm start
```

### Stopping Development

**Press `Ctrl+C` in the terminal, then:**

```bash
npm run stop
```

Or just:

```bash
npm run stop
```

### Making Code Changes

1. Code changes in `src/` → **Auto-reload** (Vite HMR)
2. Changes in `electron/` → **Manual restart required**:
   ```bash
   npm run stop
   npm start
   ```

## Production Build

```bash
# Build the app
npm run build

# Package for distribution
npm run electron:build
```

## Logs Location

- **Electron logs**: Check console output
- **Database**: `~/.config/complinist-desktop/complinist.db`
- **App data**: `~/.config/complinist-desktop/`

## Still Having Issues?

1. **Clear node_modules and reinstall**:
   ```bash
   npm run stop
   rm -rf node_modules package-lock.json
   npm install
   npm start
   ```

2. **Check for conflicting processes**:
   ```bash
   ps aux | grep -E "(electron|vite|5173)"
   ```

3. **Clear Electron cache**:
   ```bash
   rm -rf ~/.config/complinist-desktop/
   npm start
   ```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm start` | Launch app + AI services |
| `npm stop` | Stop everything |
| `npm run ai-cli` | AI testing CLI |
| `npm run build` | Build production |
| `npm run electron:dev` | Dev mode (no AI cleanup) |

## Environment Info

- **Node version required**: 18.x or higher
- **Electron version**: 33.x
- **Vite dev server**: Port 5173
- **Platform**: Linux (Ubuntu/Debian)

## Success Indicators

When starting correctly, you should see:

```
[0] > complinist-desktop@1.0.0 dev
[0] > vite
[0] 
[0] VITE v5.4.21  ready in XXX ms
[0] 
[0] ➜  Local:   http://localhost:5173/
[1] 
[1] > wait-on http://localhost:5173 && electron .
[1] 
```

Then an Electron window should appear showing the CompliNist interface.

## Known Console Warnings

### React defaultProps Warning

**Warning Message:**
```
Warning: TextareaWidget: Support for defaultProps will be removed from function components in a future major release. Use JavaScript default parameters instead.
```

**Status:** Known issue, no action required

**Explanation:** This warning comes from the `@rjsf/core` library (version 5.24.13) used for the SSP form. The library's `TextareaWidget` component uses `defaultProps`, which React is deprecating for function components. This is a third-party library issue and will be resolved when the library updates to remove `defaultProps` usage.

**Impact:** None - this is a deprecation warning that does not affect functionality. The warning will disappear once `@rjsf/core` is updated to a version that uses JavaScript default parameters instead of `defaultProps`.

**No action needed** - this is expected behavior until the library is updated.


