/**
 * DI Container Type Definitions and Service Interfaces
 *
 * This module defines the interfaces and contracts for services
 * that can be registered with the DI container. These interfaces
 * enable:
 * - Clear service contracts
 * - Easy mocking for tests
 * - Documentation of service capabilities
 *
 * @module electron/di/types
 */

/**
 * @typedef {Object} ServiceLifetimeOptions
 * @property {'singleton' | 'transient'} lifetime - Service lifetime
 */

/**
 * @typedef {Object} IAIService
 * @property {function(): Promise<{success: boolean, message?: string, error?: string}>} initialize - Initialize AI services
 * @property {function(string, Object): Promise<{text: string, tokensUsed: number, finishReason: string}>} generateText - Generate text from prompt
 * @property {function(string, Object): AsyncGenerator<string>} generateTextStream - Stream text generation
 * @property {function(string|string[]): Promise<{embeddings: number[][], dimensions: number}>} generateEmbedding - Generate embeddings
 * @property {function(string, number[], Object): Promise<Array>} queryChromaDB - Query ChromaDB
 * @property {function(string, string[], number[][], Object[], string[]): Promise<{success: boolean}>} addToChromaDB - Add documents to ChromaDB
 * @property {function(): Promise<{llm: boolean, embedding: boolean, chroma: boolean, contextSize: number}>} checkHealth - Check AI service health
 * @property {function(): number} getCalibratedContextSize - Get calibrated context size
 * @property {function(): void} shutdown - Shutdown AI services
 */

/**
 * @typedef {Object} IDatabaseService
 * @property {function(): Database} getDatabase - Get the database instance
 * @property {function(): void} initialize - Initialize the database
 * @property {function(): void} close - Close the database connection
 * @property {function(number, Array): void} syncDevicesToTable - Sync devices to table
 * @property {function(number, Array): Array} enrichNodesWithDeviceMetadata - Enrich nodes with device metadata
 */

/**
 * @typedef {Object} IFileService
 * @property {function(string): Promise<string>} readFile - Read file contents
 * @property {function(string, string): Promise<void>} writeFile - Write file contents
 * @property {function(string): Promise<boolean>} exists - Check if file exists
 * @property {function(string): Promise<void>} mkdir - Create directory
 * @property {function(string): Promise<void>} remove - Remove file or directory
 * @property {function(string): Promise<string[]>} readDir - Read directory contents
 */

/**
 * @typedef {Object} IUserDataService
 * @property {function(): string} getUserDataPath - Get user data directory path
 * @property {function(): string} getModelsPath - Get models directory path
 * @property {function(): string} getChromaDbPath - Get ChromaDB directory path
 * @property {function(string): string} getConfigPath - Get configuration file path
 */

/**
 * @typedef {Object} IExportService
 * @property {function(Object): Promise<string>} exportToJson - Export to JSON
 * @property {function(Object): Promise<string>} exportToCsv - Export to CSV
 * @property {function(Object): Promise<Buffer>} exportToPng - Export to PNG
 * @property {function(Object): Promise<string>} exportToSvg - Export to SVG
 */

/**
 * @typedef {Object} IPdfService
 * @property {function(Object): Promise<Buffer>} generateSspPdf - Generate SSP PDF
 */

/**
 * @typedef {Object} ILicenseService
 * @property {function(): Promise<Object|null>} getCurrentLicense - Get current license
 * @property {function(Object): Promise<{success: boolean}>} saveLicense - Save license
 * @property {function(): Promise<boolean>} validateLicense - Validate current license
 * @property {function(): Promise<void>} clearLicense - Clear stored license
 */

/**
 * @typedef {Object} IChunkingService
 * @property {function(string, string): Promise<Array>} chunkDocument - Chunk a document
 * @property {function(string, Array): Promise<void>} indexDocument - Index document chunks
 * @property {function(string): Promise<Array>} getUserDocuments - Get user's documents
 * @property {function(string, string): Promise<void>} deleteDocument - Delete a document
 * @property {function(string, number[], Object): Promise<Array>} queryUserChromaDB - Query user's ChromaDB
 */

/**
 * @typedef {Object} ITerraformService
 * @property {function(string): Promise<Object>} parseTerraformPlan - Parse Terraform plan
 * @property {function(Object): Promise<Array>} convertToTopology - Convert plan to topology
 */

/**
 * @typedef {Object} IProjectService
 * @property {function(string, string): Promise<Object>} createProject - Create a new project
 * @property {function(): Promise<Array>} getAllProjects - Get all projects
 * @property {function(number): Promise<Object|null>} getProject - Get project by ID
 * @property {function(number): Promise<void>} deleteProject - Delete a project
 * @property {function(number, string): Promise<void>} updateProjectBaseline - Update project baseline
 */

/**
 * @typedef {Object} IDeviceService
 * @property {function(number, Object): Promise<Array>} queryDevices - Query devices
 * @property {function(number, string): Promise<Object|null>} getDevice - Get device by ID
 * @property {function(number, string, number): Promise<Array>} searchDevices - Search devices
 */

/**
 * @typedef {Object} IControlService
 * @property {function(number, string): Promise<Object|null>} getControlNarrative - Get control narrative
 * @property {function(number, Object): Promise<void>} saveControlNarratives - Save control narratives
 * @property {function(number, string): Promise<void>} resetControlNarrative - Reset control narrative
 */

/**
 * @typedef {Object} IConfigService
 * @property {function(string): any} get - Get config value
 * @property {function(string, any): void} set - Set config value
 * @property {function(): Object} getAll - Get all config values
 */

/**
 * Service interface registry
 * Maps service tokens to their interface types for documentation
 */
export const ServiceInterfaces = {
  aiService: 'IAIService',
  database: 'IDatabaseService',
  fileService: 'IFileService',
  userDataService: 'IUserDataService',
  exportService: 'IExportService',
  pdfService: 'IPdfService',
  licenseService: 'ILicenseService',
  chunkingService: 'IChunkingService',
  terraformService: 'ITerraformService',
  projectService: 'IProjectService',
  deviceService: 'IDeviceService',
  controlService: 'IControlService',
  config: 'IConfigService',
};

/**
 * Create a mock service that throws on any method call
 * Useful for testing to ensure dependencies are properly injected
 * @param {string} serviceName - Name of the service for error messages
 * @returns {Proxy} - A proxy that throws on any property access
 */
export function createMockService(serviceName) {
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === 'then') return undefined; // Avoid Promise detection issues
        return (...args) => {
          throw new Error(
            `Mock service "${serviceName}" method "${String(prop)}" was called but not implemented. ` +
            `Please provide a proper mock implementation.`
          );
        };
      },
    }
  );
}

/**
 * Create a partial mock service that only implements specified methods
 * @param {string} serviceName - Name of the service for error messages
 * @param {Object} implementations - Object with method implementations
 * @returns {Proxy} - A proxy with the provided implementations
 */
export function createPartialMock(serviceName, implementations) {
  return new Proxy(implementations, {
    get(target, prop) {
      if (prop === 'then') return undefined;
      if (prop in target) {
        return target[prop];
      }
      return (...args) => {
        throw new Error(
          `Mock service "${serviceName}" method "${String(prop)}" was called but not implemented. ` +
          `Implement it in the mock or use createMockService for full mocking.`
        );
      };
    },
  });
}

/**
 * Validate that an object implements the expected interface methods
 * @param {Object} instance - The service instance to validate
 * @param {string[]} requiredMethods - Array of required method names
 * @param {string} serviceName - Name of the service for error messages
 * @throws {Error} If any required method is missing
 */
export function validateServiceInterface(instance, requiredMethods, serviceName) {
  const missingMethods = requiredMethods.filter(
    method => typeof instance[method] !== 'function'
  );

  if (missingMethods.length > 0) {
    throw new Error(
      `Service "${serviceName}" is missing required methods: ${missingMethods.join(', ')}`
    );
  }
}

export default {
  ServiceInterfaces,
  createMockService,
  createPartialMock,
  validateServiceInterface,
};
