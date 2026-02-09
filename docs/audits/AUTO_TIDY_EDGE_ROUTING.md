# Auto-Tidy Edge Routing Feature

> **See also**: [LAYOUT_SYSTEM.md](./LAYOUT_SYSTEM.md) for comprehensive layout documentation including ELKjs, nested boundaries, and debug tools.

## Overview

The Auto-Tidy feature now includes **edge routing type selection**, allowing you to clean up spaghetti connections with a single click by changing how edges are rendered.

## What It Does

When you run Auto-Tidy, you can choose from 5 different edge routing styles:

### 1. **Smart (Recommended)** ⭐
- Uses pathfinding algorithm to avoid intersecting with nodes
- Best for complex diagrams with many overlapping connections
- Automatically routes around obstacles
- **Default option** - works great for most diagrams
- Powered by `@tisoap/react-flow-smart-edge`

### 2. **Smooth Step**
- Orthogonal routing with rounded corners
- Good for reducing visual clutter
- Creates clean 90° connections with smooth transitions

### 3. **Bezier**
- Smooth curved edges
- React Flow's classic style
- Good for organic-looking diagrams
- Can create spaghetti with many connections

### 4. **Step**
- Sharp 90° angle connections
- Pure orthogonal routing
- Technical/schematic appearance
- Very structured look

### 5. **Straight**
- Direct straight lines between nodes
- Minimal visual style
- Works best for simple topologies
- Can overlap when nodes are dense

## How to Use

### Quick Tidy (Keyboard Shortcut)
1. Press `Ctrl+Shift+T` (or `Cmd+Shift+T` on Mac)
2. Uses **Smart** routing by default (pathfinding that avoids nodes)
3. Instantly organizes nodes AND cleans up edge routing

### Tidy with Options
1. Click the **Auto-Tidy** button (wand icon) in the toolbar
2. Click the **dropdown arrow** next to it
3. Select your preferred **Edge Routing** style
4. Choose **Spacing** tier (compact/comfortable/spacious)
5. Toggle options:
   - Auto-resize boundaries
   - Animate transitions
6. Click **Apply**

## Technical Details

### Implementation

The edge routing feature is implemented in the auto-tidy algorithm:

```typescript
// In auto-tidy.ts
export interface EdgeOptimizationOptions {
  edgeRoutingType?: EdgeRoutingType; // 'default' | 'straight' | 'smoothstep' | 'step'
}

export interface TidyResult {
  nodes: AppNode[];
  edges?: AppEdge[]; // Updated edges with new routing type
  // ... other fields
}
```

When an edge routing type is selected, the tidy algorithm:
1. Applies the Dagre layout to organize nodes
2. Updates all edges to use the selected routing type
3. Returns both updated nodes AND edges
4. The store applies both changes together

### Edge Routing Types

Each edge type uses a different path calculation function from ReactFlow:

- **`default`** → `getBezierPath()` - Cubic bezier curves
- **`smoothstep`** → `getSmoothStepPath()` - Orthogonal with rounded corners
- **`step`** → `getSmoothStepPath({ borderRadius: 0 })` - Sharp 90° angles
- **`straight`** → `getStraightPath()` - Direct lines

### Data Flow

```
User clicks Auto-Tidy
  ↓
TidyOptionsPanel captures edgeRoutingType
  ↓
tidyDiagram() in useFlowStore
  ↓
tidyDiagramAlgorithm() applies Dagre layout
  ↓
Edges are updated with new edgeType in metadata
  ↓
Store updates both nodes AND edges
  ↓
CustomEdge component renders with new routing
```

## Use Cases

### Before: Spaghetti Connections
When you have many devices connected across boundaries, bezier curves can create a tangled mess that's hard to follow.

### After: Clean Smooth Step
Switching to Smooth Step routing creates orthogonal paths that:
- Follow grid-like patterns
- Don't overlap as much
- Are easier to trace visually
- Look more professional

## Configuration

Default settings in `DEFAULT_TIDY_OPTIONS`:
```typescript
{
  spacingTier: 'comfortable',
  autoResize: true,
  animate: true,
  edgeRoutingType: 'smart', // ← Default routing type (pathfinding)
}
```

## Performance

Edge routing updates are **instant** - no performance impact since we're just changing the `edgeType` property in metadata. ReactFlow's rendering engine handles the path calculation efficiently.

## Best Practices

1. **For complex diagrams**: Use **Smart** - it avoids node intersections automatically
2. **For medium diagrams**: Use **Smooth Step** - clean orthogonal routing
3. **For simple diagrams**: Use **Straight** - minimalist and clean
4. **For presentations**: Use **Smooth Step** or **Bezier** - more visually appealing
5. **For technical docs**: Use **Step** - traditional schematic style

## Troubleshooting

### Edges still look messy
- Try adjusting **Spacing** to "Spacious" for more room
- Use **Smooth Step** routing for better separation
- Consider reorganizing nodes manually before tidying

### Edges overlap boundaries
- This is expected with straight edges
- Switch to **Smooth Step** for better boundary respect
- Increase spacing tier

### Animation looks jarring
- Disable "Animate transitions" in advanced options
- Or reduce animation duration

## Future Enhancements

Potential improvements:
- [ ] Edge bundling for parallel connections
- [ ] Automatic edge type detection based on diagram density
- [ ] Per-boundary edge routing preferences
- [ ] Custom edge routing with manual waypoints

## Related Files

- `src/lib/topology/auto-tidy.ts` - Main algorithm
- `src/lib/layout/elkLayout.ts` - ELKjs layout engine
- `src/lib/layout/dagreLayout.ts` - Dagre layout engine
- `src/features/topology/components/LayoutPanel/LayoutPanel.tsx` - Layout settings UI
- `src/features/topology/components/AutoTidy/AutoTidyButton.tsx` - Button component
- `src/features/topology/components/Edges/CustomEdge.tsx` - Edge rendering
- `src/core/stores/useFlowStore.ts` - State management

## Related Documentation

- [LAYOUT_SYSTEM.md](./LAYOUT_SYSTEM.md) - Complete layout system documentation
- [DAGRE_LAYOUT_IMPROVEMENTS.md](./DAGRE_LAYOUT_IMPROVEMENTS.md) - Dagre-specific improvements

---

**TIP**: For the cleanest results, use **Smooth Step** routing with **Comfortable** spacing and **Auto-resize boundaries** enabled. This combination works well for most network diagrams!
