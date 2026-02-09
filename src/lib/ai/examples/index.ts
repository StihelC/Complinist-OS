/**
 * Implementation Examples Module
 *
 * Exports real-world implementation examples for NIST 800-53 controls
 * organized by environment type.
 */

export {
  // Types
  type EnvironmentType,
  type ImplementationExample,
  type EnvironmentPatterns,

  // Data
  ENVIRONMENT_PATTERNS,
  IMPLEMENTATION_EXAMPLES,

  // Functions
  getImplementationExamples,
  getImplementationExamplePrompt,
  detectEnvironmentFromTopology,
  getAvailableControlIds,
  hasImplementationExamples,
  getEnvironmentDisplayName,
} from './implementationExamples';
