/**
 * Logging Module
 *
 * Provides automatic redaction of sensitive data in logs.
 * Supports configurable patterns and different strategies for dev/prod environments.
 *
 * Usage:
 *
 * ```typescript
 * import { logger, createLogger, createDevLogger, createProdLogger } from '@/lib/logging';
 *
 * // Use default logger (auto-detects environment)
 * logger.info('User logged in', { userId: 123 });
 *
 * // Sensitive data is automatically redacted
 * logger.info('Payment processed', { cardNumber: '4111-1111-1111-1111' });
 * // Output: Payment processed { cardNumber: '****1111' }
 *
 * // Create custom logger
 * const customLogger = createLogger({
 *   prefix: 'MyApp',
 *   minLevel: 'warn',
 * });
 *
 * // Wrap console to add redaction to all console.* calls
 * logger.wrapConsole();
 * ```
 */

// Core redaction functionality
export {
  redact,
  redactArgs,
  quickRedact,
  containsSensitiveData,
  createRedactor,
  DEFAULT_CONFIG,
  type RedactionConfig,
  type RedactionResult,
} from './redactionEngine';

// Pattern definitions
export {
  DEFAULT_PATTERNS,
  PATTERN_CATEGORIES,
  getPatternsByCategory,
  getPatternByName,
  type RedactionPattern,
  type RedactionStrategy,
} from './redactionPatterns';

// Logging middleware
export {
  LoggingMiddleware,
  createLogger,
  createDevLogger,
  createProdLogger,
  logger,
  type LoggingConfig,
  type LogLevel,
  type LogEntry,
} from './loggingMiddleware';

// Re-export default as the main logger instance
export { logger as default } from './loggingMiddleware';
