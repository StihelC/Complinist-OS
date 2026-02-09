# Layout System Documentation

**Last Updated:** 2026-01-25

Comprehensive documentation for CompliFlow's layout system, including ELKjs integration, nested boundary support, debug tools, and configuration options.

---

## Table of Contents

1. [Overview](#overview)
2. [Layout Algorithms](#layout-algorithms)
3. [Nested Boundary Support](#nested-boundary-support)
4. [Layout Settings](#layout-settings)
5. [Debug Mode](#debug-mode)
6. [Auto-Tidy Feature](#auto-tidy-feature)
7. [Architecture](#architecture)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Overview

CompliFlow's layout system automatically organizes topology diagrams with support for:

- **Hierarchical layouts** using ELKjs (primary) or Dagre (fallback)
- **Nested boundaries** - devices inside boundaries inside boundaries
- **Auto-resizing** - boundaries expand to fit their children
- **Configurable spacing** - padding, node gaps, and nested boundary spacing
- **Debug tools** - visual DevTools and conditional logging

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `elkLayout.ts` | `src/lib/layout/` | ELKjs layout engine |
| `dagreLayout.ts` | `src/lib/layout/` | Dagre layout engine (fallback) |
| `auto-tidy.ts` | `src/lib/topology/` | Layout orchestration |
| `LayoutPanel.tsx` | `src/features/topology/components/` | Settings UI |
| `LayoutDevTools.tsx` | `src/features/topology/components/Canvas/` | Debug panel |
| `layoutDebugger.ts` | `src/lib/layout/` | Conditional logging |
| `layoutLogger.ts` | `src/lib/topology/` | Environment-aware logging |

---

## Layout Algorithms

### ELKjs (Recommended)

ELKjs (Eclipse Layout Kernel for JavaScript) is the primary layout engine, offering:

- **Native compound node support** via `hierarchyHandling: INCLUDE_CHILDREN`
- **Single-pass layout** for entire hierarchy
- **Better edge routing** around nested structures

#### ELK Algorithm Variants

| Variant | Best For | Description |
|---------|----------|-------------|
| `mrtree` | General use | Tree-like hierarchical layout (default) |
| `layered` | Network diagrams | Layer-based orthogonal layout |

#### ELK Configuration

```typescript
// Key ELK options used
{
  'elk.algorithm': 'mrtree',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '40',
  'elk.padding': '[top=45,left=45,bottom=45,right=45]',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
}
```

### Dagre (Fallback)

Dagre provides a fallback layout option with:

- Viewport-aware sizing
- Adaptive direction based on aspect ratio
- Node-count-based spacing reduction

See [DAGRE_LAYOUT_IMPROVEMENTS.md](./DAGRE_LAYOUT_IMPROVEMENTS.md) for details.

---

## Nested Boundary Support

The layout system fully supports deeply nested boundaries:

```
┌─ Outer Boundary ─────────────────────────┐
│  ┌─ Middle Boundary ──────────────────┐  │
│  │  ┌─ Inner Boundary ─────────────┐  │  │
│  │  │  [Device 1]  [Device 2]      │  │  │
│  │  └──────────────────────────────┘  │  │
│  │  [Device 3]                        │  │
│  └────────────────────────────────────┘  │
│  [Device 4]                              │
└──────────────────────────────────────────┘
```

### How Nesting Works

1. **Flat to Hierarchical**: React Flow nodes use `parentId` for parent-child relationships
2. **ELK Graph Building**: `convertToElkNode()` recursively builds ELK's nested structure
3. **Position Extraction**: ELK returns positions relative to parent, matching React Flow's model
4. **Auto-Resize**: Boundaries expand based on ELK's computed dimensions

### Nested Boundary Spacing

When a boundary contains other boundaries (not just devices), extra spacing is added:

```typescript
const hasNestedBoundaries = children.some(child => child.type === 'boundary');
const nestedExtra = hasNestedBoundaries ? nestedBoundarySpacing : 0;
const padding = basePadding + nestedExtra;
```

This ensures labels and borders don't overlap in deeply nested structures.

---

## Layout Settings

### Global Settings

Layout settings are stored in `globalSettings.layoutSettings`:

```typescript
interface LayoutSettings {
  algorithm: 'elkjs' | 'dagre';      // Layout engine
  elkAlgorithm: 'mrtree' | 'layered'; // ELK variant
  direction: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
  horizontalSpacing: number;          // 20-200px
  verticalSpacing: number;            // 20-200px
  nodeSpacing: number;                // 20-150px (gap between nodes)
  rankSpacing: number;                // 30-200px (gap between levels)
  boundaryPadding: number;            // 20-100px (inner padding)
  nestedBoundarySpacing: number;      // 10-80px (extra for nested)
  edgeRouting: EdgeRoutingType;       // Edge style
  spacingTier: SpacingTier;           // compact/comfortable/spacious
  autoResize: boolean;                // Auto-resize boundaries
  animate: boolean;                   // Animate transitions
  animationDuration: number;          // 100-1000ms
}
```

### Default Values

```typescript
const DEFAULT_LAYOUT_SETTINGS = {
  algorithm: 'elkjs',
  elkAlgorithm: 'mrtree',
  direction: 'RIGHT',
  horizontalSpacing: 50,
  verticalSpacing: 50,
  nodeSpacing: 40,
  rankSpacing: 60,
  boundaryPadding: 45,
  nestedBoundarySpacing: 30,
  edgeRouting: 'smart',
  spacingTier: 'comfortable',
  autoResize: true,
  animate: true,
  animationDuration: 300,
};
```

### Settings Flow

```
LayoutPanel (UI)
    ↓
globalSettings.layoutSettings (stored)
    ↓
AutoTidyButton → tidyDiagram()
    ↓
auto-tidy.ts → elkLayout.ts or dagreLayout.ts
```

---

## Debug Mode

### Enabling Debug Mode

1. Click the **Auto-Tidy** button's dropdown (gear icon)
2. Scroll to **Debug** section
3. Toggle **Layout Debug Mode** ON

Or programmatically:
```typescript
const { setGlobalSettings } = useFlowStore.getState();
setGlobalSettings({ layoutDebugMode: true });
```

### Debug Features

#### 1. Layout DevTools Panel

When debug mode is enabled, a DevTools panel appears showing:

- **Stats**: Total nodes, boundaries, devices, max depth
- **Hierarchy Tree**: Visual tree of all nodes with positions and dimensions
- **Depth Indicators**: Color-coded nesting levels

Location: `src/features/topology/components/Canvas/LayoutDevTools.tsx`

#### 2. Console Logging

Debug mode enables detailed console logging:

```
[Layout Debug] Boundary "outer": basePadding=45, nestedExtra=30, totalPadding=75
[Layout Debug] Boundary "outer" computed size: 600x450, autoResize=true
[Layout Debug] [TidyDiagram] Options received: {...}
[Layout Debug] [ELK Layout Options] {...}
```

### Logging Architecture

| Logger | File | Purpose |
|--------|------|---------|
| `layoutDebugger` | `src/lib/layout/layoutDebugger.ts` | Layout-specific debug logs |
| `layoutLogger` | `src/lib/topology/layoutLogger.ts` | Environment-aware logging |

Both respect `layoutDebugMode` setting - logs are suppressed when disabled.

---

## Auto-Tidy Feature

### Quick Tidy

- **Keyboard**: `Ctrl+Shift+T` (or `Cmd+Shift+T` on Mac)
- **Button**: Click the wand icon in the toolbar
- Uses stored layout settings

### Tidy with Options

1. Click the dropdown arrow next to Auto-Tidy button
2. Adjust settings in the Layout Panel
3. Click **Apply Layout**

### Tidy Options

```typescript
interface TidyOptions {
  layoutAlgorithm?: 'elkjs' | 'dagre';
  elkAlgorithm?: 'mrtree' | 'layered';
  layoutDirection?: LayoutDirection;
  horizontalSpacing?: number;
  verticalSpacing?: number;
  nodeSpacing?: number;
  rankSpacing?: number;
  boundaryPadding?: number;
  nestedBoundarySpacing?: number;
  spacingTier?: 'compact' | 'comfortable' | 'spacious';
  autoResize?: boolean;
  animate?: boolean;
  animationDuration?: number;
  edgeOptimization?: {
    edgeRoutingType?: EdgeRoutingType;
  };
}
```

### Tidy Result

```typescript
interface TidyResult {
  nodes: AppNode[];           // Updated nodes with new positions
  edges?: AppEdge[];          // Updated edges (if routing changed)
  stats: {
    totalNodes: number;
    boundariesProcessed: number;
    devicesRepositioned: number;
    processingTimeMs: number;
  };
  originalPositions?: Map<string, {x: number, y: number}>;
  targetPositions?: Map<string, {x: number, y: number}>;
}
```

---

## Architecture

### Data Flow

```
User clicks Auto-Tidy
       ↓
AutoTidyButton.tsx
       ↓
layoutSettingsToTidyOptions() - Convert settings
       ↓
useProjectStore.tidyDiagram()
       ↓
auto-tidy.ts::tidyDiagram()
       ↓
┌─────────────────────────────────────┐
│  ELKjs Path (algorithm === 'elkjs') │
│  ─────────────────────────────────  │
│  1. preSizeBoundaries()             │
│  2. applyElkLayout()                │
│     - convertToElkGraph()           │
│     - elk.layout()                  │
│     - extractPositions()            │
└─────────────────────────────────────┘
       ↓
Return TidyResult
       ↓
Store updates nodes/edges
       ↓
React Flow re-renders
```

### File Structure

```
src/lib/layout/
├── elkLayout.ts          # ELKjs layout engine
├── dagreLayout.ts        # Dagre layout engine
├── layoutConfig.ts       # Constants and defaults
├── layoutDebugger.ts     # Conditional debug logging
└── layoutInterface.ts    # Shared types and interfaces

src/lib/topology/
├── auto-tidy.ts          # Layout orchestration
└── layoutLogger.ts       # Environment-aware logging

src/features/topology/components/
├── AutoTidy/
│   ├── AutoTidyButton.tsx
│   └── TidyStatusIndicator.tsx
├── LayoutPanel/
│   └── LayoutPanel.tsx   # Settings UI
└── Canvas/
    └── LayoutDevTools.tsx # Debug panel
```

---

## Testing

### Unit Tests

Comprehensive tests for nested boundary layouts:

```bash
npm test -- tests/unit/topology/nested-boundary-layout.test.ts
```

**Test Coverage**:

- Two-level nesting (device in boundary)
- Three-level nesting (device in boundary in boundary)
- Four-level nesting (deeply nested)
- Mixed content at multiple levels
- Boundary padding settings
- Nested boundary spacing
- Edge cases (empty boundaries, max depth)

### Test File Location

`tests/unit/topology/nested-boundary-layout.test.ts`

### Running Tests

```bash
# Run all layout tests
npm test -- tests/unit/topology/

# Run specific test file
npm test -- tests/unit/topology/nested-boundary-layout.test.ts

# Run with coverage
npm run test:coverage -- tests/unit/topology/
```

---

## Troubleshooting

### Boundaries Not Expanding

**Symptoms**: Content runs into boundary edges

**Solutions**:
1. Increase **Boundary Padding** in Layout Panel (try 60-80px)
2. Increase **Nested Spacing** for deeply nested structures
3. Reduce **Node Gap** if nodes are too spread out
4. Enable **Auto-resize Boundaries**

### Layout Looks Wrong

**Symptoms**: Nodes positioned unexpectedly

**Solutions**:
1. Enable **Debug Mode** to see computed positions
2. Check console for layout options being applied
3. Try different **Algorithm** (ELKjs vs Dagre)
4. Try different **ELK Variant** (mrtree vs layered)

### Debug Logs Not Showing

**Symptoms**: No console output when debug mode is on

**Solutions**:
1. Verify `layoutDebugMode: true` in global settings
2. Check localStorage: `localStorage.getItem('complinist-global-settings')`
3. Refresh the page after enabling debug mode

### Performance Issues

**Symptoms**: Layout takes too long

**Solutions**:
1. Reduce diagram complexity
2. Disable animation for faster results
3. Use **compact** spacing tier
4. Consider using Dagre for very large diagrams

---

## Related Documentation

- [DAGRE_LAYOUT_IMPROVEMENTS.md](./DAGRE_LAYOUT_IMPROVEMENTS.md) - Dagre-specific improvements
- [AUTO_TIDY_EDGE_ROUTING.md](./AUTO_TIDY_EDGE_ROUTING.md) - Edge routing options
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture

---

## Changelog

### 2026-01-25
- Added ELKjs as primary layout engine
- Implemented nested boundary support with depth-based spacing
- Added Layout DevTools panel
- Added `layoutDebugMode` global setting
- Added `layoutDebugger` and updated `layoutLogger` for conditional logging
- Created comprehensive unit tests for nested boundaries
- Added `boundaryPadding` and `nestedBoundarySpacing` settings
- Fixed settings flow from LayoutPanel through to ELK layout

### 2026-01-12
- Added viewport-aware layout sizing
- Implemented adaptive rankdir selection for Dagre
- Added node-count-based spacing reduction
