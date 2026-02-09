# Topology Feature

Topology visualization and editing functionality.

## Components

- `components/Canvas/` - ReactFlow canvas
- `components/Nodes/` - Device and boundary nodes
- `components/Edges/` - Connection edges
- `components/DevicePalette/` - Device selection palette
- `components/BoundaryPanel/` - Boundary creation
- `components/AlignmentPanel/` - Alignment tools
- `components/PropertiesPanel/` - Node/edge properties

## Services

- `services/topologyAnalyzer.ts` - Topology analysis
- `services/inventoryExtractor.ts` - Inventory extraction
- `services/flowAnalysis.ts` - Flow analysis

## Store Dependencies

- `useFlowStore` - Topology state management

## External Dependencies

- ReactFlow (@xyflow/react)
- Core types (`@/core/types`)
- Core database (`@/core/database`)

