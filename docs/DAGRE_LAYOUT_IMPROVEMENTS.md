# Dagre Layout Improvements - Viewport-Aware Frame-Fitting Layouts

**Date:** 2026-01-12
**Status:** Dagre is now a fallback option; **ELKjs is the recommended layout engine**

> **Note**: As of 2026-01-25, ELKjs is the primary layout engine with native support for nested boundaries. Dagre remains available as a fallback option. See [LAYOUT_SYSTEM.md](./LAYOUT_SYSTEM.md) for comprehensive layout documentation.

**Issue:** Dagre was creating layouts in long straight lines instead of fitting nodes within the user's current viewport

## Problem

The auto-tidy feature was using dagre layout algorithm, but it was creating layouts that:
- Formed long straight lines (especially in TB or LR directions)
- Didn't consider the user's current viewport (visible screen area)
- Didn't adapt to the boundary's aspect ratio
- Used excessive spacing that prevented fitting more nodes in the frame
- Often left large empty spaces in wide or tall boundaries
- Required users to zoom out or scroll to see all nodes after tidying

## Root Cause Analysis

1. **Fixed Rankdir:** The layout direction (TB, LR, etc.) was always respected exactly as configured, even when the boundary aspect ratio suggested a different orientation would be better
2. **Excessive Spacing:** Default spacing values were set for maximum clarity (180px nodesep, 240px ranksep) but didn't scale down for larger graphs
3. **Large Margins:** 100px margins on all sides reduced usable space
4. **No Centering:** Layouts started from corner, leaving one side with large empty space when graph was smaller than boundary

## Solutions Implemented

### 1. Viewport-Aware Layout Sizing ⭐ **NEW**

**Locations:**
- `src/core/stores/useFlowStore.ts:1294-1310` - Viewport capture
- `src/lib/topology/auto-tidy.ts:415-441` - Viewport-based dimension calculation

The most significant improvement: auto-tidy now uses the **user's current viewport** (visible screen area) as the target dimensions for root-level boundaries.

**How it works:**
1. Capture viewport information from ReactFlow instance (position, zoom level)
2. Calculate visible viewport dimensions accounting for UI chrome (sidebar, header)
3. Pass viewport dimensions to the tidy algorithm
4. Use viewport dimensions for root boundaries instead of their actual size
5. Nested boundaries still use their actual dimensions

**Benefits:**
- Layouts **fit within the user's current view** - no need to zoom out or scroll
- Automatically adapts to different screen sizes and zoom levels
- Users see all their nodes organized nicely within their current viewport
- Works seamlessly with multi-monitor setups

**Example:**
```typescript
// User has 1920x1080 screen, zoomed at 100%
// Viewport: 1620x980 (minus sidebar/header)
// Root boundary layout will target: 1520x880 (minus padding)
// Result: All nodes fit perfectly in visible area!
```

### 2. Adaptive Rankdir Selection (`getOptimalRankdir`)

**Location:** `src/lib/layout/dagreLayout.ts:79-105`

Automatically adjusts the layout direction based on boundary aspect ratio:

- **Wide boundaries (aspect > 1.5):** Switch TB/BT layouts to LR for better space utilization
- **Tall boundaries (aspect < 0.67):** Switch LR/RL layouts to TB for better space utilization
- **Small node counts (≤3):** Always respect user's requested direction
- **Moderate aspect ratios:** Keep the requested direction

**Example:**
```typescript
// Boundary: 800px wide × 300px tall (aspect = 2.67)
// Requested: TB (top-to-bottom)
// Result: LR (left-to-right) - better fits the wide shape
```

### 2. Node-Count-Based Spacing Reduction

**Location:** `src/lib/layout/dagreLayout.ts:147-150`

Dynamically reduces spacing based on the number of nodes to fit more in the frame:

```typescript
const nodeCountFactor = Math.max(0.6, 1 - (nodeCount / 50));
const nodesep = Math.round(baseNodesep * nodeCountFactor);
const ranksep = Math.round(baseRanksep * nodeCountFactor);
```

**Scaling:**
- 5 nodes: 90% spacing (144px from 160px base)
- 10 nodes: 80% spacing (128px)
- 25 nodes: 50% spacing (96px)
- 50+ nodes: 60% minimum spacing (96px) - never goes below this

### 3. Reduced Base Spacing Values

**Location:** `src/lib/layout/dagreLayout.ts:41-71`

Updated DAGRE_PRESETS for more compact layouts by default:

| Parameter | Old Value | New Value | Reduction |
|-----------|-----------|-----------|-----------|
| nodesep   | 180px     | 120px     | -33%      |
| ranksep   | 240px     | 160px     | -33%      |
| edgesep   | 50px      | 40px      | -20%      |
| margins   | 100px     | 60px      | -40%      |

### 4. Smart Centering

**Location:** `src/lib/layout/dagreLayout.ts:251-254`

Centers the layout within the boundary when the graph is smaller:

```typescript
const offsetX = Math.max(0, (boundaryWidth - graphWidth) / 2);
const offsetY = Math.max(0, (boundaryHeight - graphHeight) / 2);
```

This prevents layouts from being stuck in the top-left corner and distributes whitespace evenly.

## Before & After Comparison

### Before
```
┌─────────────────────────────────────────────┐
│ [Node1]                                     │
│    ↓                                        │
│ [Node2]                                     │
│    ↓                                        │
│ [Node3]                                     │
│    ↓                                        │
│ [Node4]                                     │
│    ↓                                        │
│ [Node5]                                     │
│                                             │
│                                             │
│                  (Lots of empty space)      │
└─────────────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────────────┐
│         [Node1] → [Node2] → [Node3]         │
│                                             │
│              ↓        ↓        ↓            │
│                                             │
│         [Node4] ────→ [Node5]               │
│                                             │
│         (Centered, utilizing width)         │
└─────────────────────────────────────────────┘
```

## Algorithm Flow

1. **Calculate base spacing** from node dimensions and presets
2. **Detect graph topology** (hierarchical, networked, mixed)
3. **Apply node-count-based reduction** to spacing values
4. **Determine optimal rankdir** based on boundary aspect ratio
5. **Configure dagre graph** with optimized settings
6. **Run dagre layout** algorithm
7. **Center the result** within the boundary
8. **Log optimization decisions** for debugging

## Benefits

1. **Better Space Utilization:** Layouts adapt to boundary shape instead of forcing one direction
2. **Scalability:** Large graphs automatically get tighter spacing
3. **Visual Balance:** Centered layouts look more professional
4. **Flexibility:** Still respects user's choice for small graphs or moderate aspect ratios
5. **Backward Compatible:** Existing projects continue to work, just with better layouts

## Logging & Debugging

Enhanced console logging shows optimization decisions:

```javascript
console.log('[Dagre Layout] Graph dimensions:', {
  boundaryWidth,
  boundaryHeight,
  graphWidth,
  graphHeight,
  optimizedRankdir,    // NEW: shows if direction was changed
  requestedRankdir,    // NEW: shows original request
  nodesep,
  ranksep,
  childCount,
  offsetX,             // NEW: shows centering offset
  offsetY,
});
```

## Testing

Manual testing verified:
- ✅ Wide boundaries switch TB→LR appropriately
- ✅ Tall boundaries switch LR→TB appropriately
- ✅ Small node counts respect user direction
- ✅ Spacing reduction works correctly at different scales
- ✅ Centering works when graph < boundary
- ✅ No TypeScript errors introduced

## Configuration

Users can still override behavior through:
- **Spacing tier selection** in auto-tidy options (compact/comfortable/spacious)
- **Manual boundary alignment** setting per boundary
- **Custom spacing** parameter (bypasses auto-calculation)

## When to Use Dagre vs ELKjs

| Feature | ELKjs (Recommended) | Dagre |
|---------|---------------------|-------|
| Nested boundaries | Native support | Multi-pass workaround |
| Layout quality | Better for hierarchies | Good for flat diagrams |
| Performance | Fast | Very fast |
| Edge routing | Better around nested nodes | May cross boundaries |

**Recommendation**: Use ELKjs (default) unless you have specific reasons to use Dagre.

## Future Enhancements

Many planned improvements have been implemented in ELKjs:

1. ~~**Multi-pass optimization:** Try multiple rankdir options~~ → Use ELKjs layered algorithm
2. ✅ **Viewport-aware tidy:** Implemented in both engines
3. ✅ **Smart boundary resizing:** Implemented via `autoResize` option
4. ~~**Alignment hints:**~~ → Use Layout Panel direction selector
5. ✅ **User preferences:** Implemented via `globalSettings.layoutSettings`

## Files Modified

- `src/lib/layout/dagreLayout.ts` - Core layout algorithm improvements
  - Added `getOptimalRankdir()` function
  - Updated spacing calculation with node-count reduction
  - Reduced DAGRE_PRESETS base values
  - Added smart centering logic
  - Enhanced debug logging

- `src/lib/topology/auto-tidy.ts` - Viewport-aware layout orchestration
  - Added `viewportDimensions` to `TidyOptions` interface
  - Implemented viewport-based sizing for root boundaries
  - Added logging for viewport-based dimension calculation

- `src/core/stores/useFlowStore.ts` - Viewport capture and integration
  - Extended `reactFlowInstance` to include `getViewport()` method
  - Added viewport dimension calculation in `tidyDiagram()`
  - Passes viewport info to tidy algorithm

- `src/features/topology/components/Canvas/FlowCanvas.tsx` - ReactFlow integration
  - Exposed `getViewport` method to store
  - Updated ReactFlow instance initialization

## Migration Notes

No migration needed - changes are fully backward compatible. Existing projects will automatically benefit from:
- More compact layouts on next auto-tidy
- Better aspect ratio handling
- Improved centering

Users may notice tighter layouts, which can be adjusted via:
- Auto-tidy spacing tier: "Spacious" option
- Per-boundary manual spacing adjustments

## References

- Dagre documentation: https://github.com/dagrejs/dagre
- Original issue: "dagre layouts in straight lines instead of fitting in frame"
- Related modules:
  - `src/lib/topology/auto-tidy.ts` - Auto-tidy orchestrator
  - `src/lib/layout/layoutConfig.ts` - Spacing constants
  - `src/lib/topology/flowAnalysis.ts` - Graph topology detection
