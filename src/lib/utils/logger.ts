/**
 * Structured logger utility for development and production environments.
 * Replaces raw console.log statements with environment-aware logging.
 *
 * This logger automatically redacts sensitive data (API keys, tokens,
 * passwords, emails, credit cards) before outputting to console or files.
 *
 * @example
 * ```typescript
 * import logger from '@/lib/utils/logger';
 *
 * // Sensitive data is automatically redacted
 * logger.info('User payment', { card: '4111-1111-1111-1111' });
 * // Output: [INFO] User payment { card: '****1111' }
 *
 * logger.debug('API call', { apiKey: 'sk-abc123xyz789...' });
 * // Output: [DEBUG] API call { apiKey: 'sk-a****789...' }
 * ```
 */

import {
  createLogger,
  LoggingMiddleware,
  type LoggingConfig,
} from '@/lib/logging';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV === 'development';

// Create the main logger instance with automatic redaction
const loggingMiddleware = createLogger({
  mode: isDev ? 'development' : 'production',
  minLevel: isDev ? 'debug' : 'info',
  redactionEnabled: true,
  includeTimestamps: !isDev,
  includeSource: isDev,
});

interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  /** Configure logger settings */
  configure: (config: Partial<LoggingConfig>) => void;
  /** Get underlying LoggingMiddleware instance */
  getMiddleware: () => LoggingMiddleware;
  /** Wrap global console methods to add redaction */
  wrapConsole: () => void;
}

const logger: Logger = {
  /**
   * Debug level logging - only shown in development
   * Sensitive data is automatically redacted
   */
  debug: (message: string, ...args: unknown[]) => {
    loggingMiddleware.debug(message, ...args);
  },

  /**
   * Info level logging - only shown in development
   * Sensitive data is automatically redacted
   */
  info: (message: string, ...args: unknown[]) => {
    loggingMiddleware.info(message, ...args);
  },

  /**
   * Warning level logging - always shown
   * Sensitive data is automatically redacted
   */
  warn: (message: string, ...args: unknown[]) => {
    loggingMiddleware.warn(message, ...args);
  },

  /**
   * Error level logging - always shown
   * Sensitive data is automatically redacted
   */
  error: (message: string, ...args: unknown[]) => {
    loggingMiddleware.error(message, ...args);
  },

  /**
   * Configure logger settings
   */
  configure: (config: Partial<LoggingConfig>) => {
    loggingMiddleware.configure(config);
  },

  /**
   * Get underlying LoggingMiddleware instance for advanced usage
   */
  getMiddleware: () => loggingMiddleware,

  /**
   * Wrap global console methods to add redaction to all console.* calls
   */
  wrapConsole: () => {
    loggingMiddleware.wrapConsole();
  },
};

export default logger;
export { logger };
export type { LogLevel, LoggingConfig };
