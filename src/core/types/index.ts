// Barrel export for all types
// Re-exports all types from domain-specific files for backward compatibility

// Common types
export type {
  SecurityZone,
  AssetValue,
  VulnerabilityManagement,
  ComplianceStatus,
  SecurityLevel,
  DataFlow,
  NetworkLayer,
  ITCategory,
} from './common.types';

// Topology types
export type {
  DeviceType,
  BoundaryType,
  DeviceMetadata,
  EdgeType,
  ConnectionState,
  EdgeMetadata,
  LabelPosition,
  LabelPlacement,
  DeviceAlignment,
  LayoutDirection,
  BoundaryMetadata,
  BoundaryStyle,
  DeviceNodeData,
  BoundaryNodeData,
  AppNode,
  AppEdge,
  DiagramState,
  DeviceCategory,
} from './topology.types';

export {
  boundaryStyles,
  getEffectiveBoundaryStyle,
} from './topology.types';

// Control types
export type {
  ControlPriority,
  ControlNarrative,
  ControlFamily,
  ControlCoverageStatus,
} from './controls.types';

// Project types
export type {
  NistBaseline,
  Project,
  GlobalSettings,
} from './project.types';

// SSP types
export type {
  SSPBaseline,
  UneditedControlsMode,
  CustomSection,
  SSPSystemCharacteristics,
  SSPGenerationRequest,
  NISTControl,
  NISTControlFamily,
  ControlImplementer,
  SSPDocument,
} from './ssp.types';

// Export types
export type {
  ReportMetadata,
  DeviceReport,
  BoundaryReport,
  ConnectionReport,
  FullReport,
} from './export.types';

// Inventory types
export type {
  InventoryCategory,
  InventoryItem,
  InventoryExtractionResult,
} from './inventory.types';

