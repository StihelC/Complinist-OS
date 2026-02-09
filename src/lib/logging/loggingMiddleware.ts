/**
 * Logging Middleware
 *
 * Provides a middleware layer for logging that automatically redacts sensitive data.
 * Supports different strategies for development vs production environments.
 */

import { createRedactor } from './redactionEngine';
import { RedactionPattern } from './redactionPatterns';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggingConfig {
  /** Enable/disable logging entirely */
  enabled: boolean;
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Enable redaction of sensitive data */
  redactionEnabled: boolean;
  /** Environment mode (affects redaction rules) */
  mode: 'development' | 'production';
  /** Include timestamps in log output */
  includeTimestamps: boolean;
  /** Include source location in log output */
  includeSource: boolean;
  /** Custom log prefix */
  prefix?: string;
  /** Custom patterns to add */
  customPatterns?: RedactionPattern[];
  /** Pattern names to disable */
  disabledPatterns?: string[];
  /** Write logs to file (path or false to disable) */
  logFile?: string | false;
  /** Maximum log file size before rotation (in bytes) */
  maxLogFileSize?: number;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  args: unknown[];
  source?: string;
  wasRedacted: boolean;
  matchedPatterns: string[];
}

type LogHandler = (entry: LogEntry) => void;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Detect environment mode
 */
function detectEnvironmentMode(): 'development' | 'production' {
  // Check Vite env first (for React/renderer)
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return 'development';
  }

  // Check Node.js env (for Electron main)
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    return 'development';
  }

  return 'production';
}

/**
 * Default configuration based on environment
 */
function getDefaultConfig(): LoggingConfig {
  const mode = detectEnvironmentMode();

  return {
    enabled: true,
    minLevel: mode === 'development' ? 'debug' : 'info',
    redactionEnabled: true,
    mode,
    includeTimestamps: mode === 'production',
    includeSource: mode === 'development',
    prefix: undefined,
    logFile: false,
    maxLogFileSize: 5 * 1024 * 1024, // 5MB
  };
}

/**
 * LoggingMiddleware class
 *
 * Main class for creating and managing logging with automatic redaction.
 */
export class LoggingMiddleware {
  private config: LoggingConfig;
  private handlers: LogHandler[] = [];
  private redactor: ReturnType<typeof createRedactor>;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  constructor(config: Partial<LoggingConfig> = {}) {
    const defaultConfig = getDefaultConfig();
    this.config = { ...defaultConfig, ...config };

    this.redactor = createRedactor({
      enabled: this.config.redactionEnabled,
      mode: this.config.mode,
      customPatterns: this.config.customPatterns,
      disabledPatterns: this.config.disabledPatterns,
    });

    // Add default console handler
    this.addHandler(this.createConsoleHandler());
  }

  /**
   * Update configuration
   */
  public configure(config: Partial<LoggingConfig>): void {
    this.config = { ...this.config, ...config };

    this.redactor.updateConfig({
      enabled: this.config.redactionEnabled,
      mode: this.config.mode,
      customPatterns: this.config.customPatterns,
      disabledPatterns: this.config.disabledPatterns,
    });
  }

  /**
   * Add a custom log handler
   */
  public addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove a log handler
   */
  public removeHandler(handler: LogHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Clear all handlers
   */
  public clearHandlers(): void {
    this.handlers = [];
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevel];
  }

  /**
   * Create a log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    args: unknown[]
  ): LogEntry {
    const redactedMessage = this.config.redactionEnabled
      ? this.redactor.redact(message)
      : { output: message, wasRedacted: false, matchedPatterns: [] };

    const redactedArgs = this.config.redactionEnabled
      ? this.redactor.redactArgs(args)
      : args;

    return {
      timestamp: new Date().toISOString(),
      level,
      message: redactedMessage.output,
      args: redactedArgs,
      wasRedacted: redactedMessage.wasRedacted || args.some((_, i) => args[i] !== redactedArgs[i]),
      matchedPatterns: redactedMessage.matchedPatterns,
    };
  }

  /**
   * Process and dispatch a log entry
   */
  private processLog(level: LogLevel, message: string, args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, args);

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Dispatch to handlers
    for (const handler of this.handlers) {
      try {
        handler(entry);
      } catch (err) {
        // Silently ignore handler errors to prevent infinite loops
        console.error('[LoggingMiddleware] Handler error:', err);
      }
    }
  }

  /**
   * Create the default console handler
   */
  private createConsoleHandler(): LogHandler {
    return (entry: LogEntry) => {
      const { level, message, args, timestamp } = entry;

      const parts: string[] = [];

      if (this.config.includeTimestamps) {
        parts.push(`[${timestamp}]`);
      }

      parts.push(`[${level.toUpperCase()}]`);

      if (this.config.prefix) {
        parts.push(`[${this.config.prefix}]`);
      }

      parts.push(message);

      const prefix = parts.join(' ');

      // Use appropriate console method
      const consoleFn = console[level] || console.log;
      if (args.length > 0) {
        consoleFn(prefix, ...args);
      } else {
        consoleFn(prefix);
      }
    };
  }

  /**
   * Debug log
   */
  public debug(message: string, ...args: unknown[]): void {
    this.processLog('debug', message, args);
  }

  /**
   * Info log
   */
  public info(message: string, ...args: unknown[]): void {
    this.processLog('info', message, args);
  }

  /**
   * Warning log
   */
  public warn(message: string, ...args: unknown[]): void {
    this.processLog('warn', message, args);
  }

  /**
   * Error log
   */
  public error(message: string, ...args: unknown[]): void {
    this.processLog('error', message, args);
  }

  /**
   * Log at a specific level
   */
  public log(level: LogLevel, message: string, ...args: unknown[]): void {
    this.processLog(level, message, args);
  }

  /**
   * Get recent log entries
   */
  public getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Clear log buffer
   */
  public clearLogs(): void {
    this.logBuffer = [];
  }

  /**
   * Get current configuration
   */
  public getConfig(): LoggingConfig {
    return { ...this.config };
  }

  /**
   * Wrap console.log style function to add redaction
   */
  public wrapConsole(): void {
    const originalConsole = {
      log: console.log,
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    console.log = (...args: unknown[]) => {
      const redactedArgs = this.config.redactionEnabled
        ? this.redactor.redactArgs(args)
        : args;
      originalConsole.log(...redactedArgs);
    };

    console.debug = (...args: unknown[]) => {
      const redactedArgs = this.config.redactionEnabled
        ? this.redactor.redactArgs(args)
        : args;
      originalConsole.debug(...redactedArgs);
    };

    console.info = (...args: unknown[]) => {
      const redactedArgs = this.config.redactionEnabled
        ? this.redactor.redactArgs(args)
        : args;
      originalConsole.info(...redactedArgs);
    };

    console.warn = (...args: unknown[]) => {
      const redactedArgs = this.config.redactionEnabled
        ? this.redactor.redactArgs(args)
        : args;
      originalConsole.warn(...redactedArgs);
    };

    console.error = (...args: unknown[]) => {
      const redactedArgs = this.config.redactionEnabled
        ? this.redactor.redactArgs(args)
        : args;
      originalConsole.error(...redactedArgs);
    };
  }
}

/**
 * Factory function to create a pre-configured logger
 */
export function createLogger(config: Partial<LoggingConfig> = {}): LoggingMiddleware {
  return new LoggingMiddleware(config);
}

/**
 * Factory for development logger (more permissive redaction, debug enabled)
 */
export function createDevLogger(config: Partial<LoggingConfig> = {}): LoggingMiddleware {
  return new LoggingMiddleware({
    mode: 'development',
    minLevel: 'debug',
    includeTimestamps: false,
    includeSource: true,
    ...config,
  });
}

/**
 * Factory for production logger (strict redaction, no debug)
 */
export function createProdLogger(config: Partial<LoggingConfig> = {}): LoggingMiddleware {
  return new LoggingMiddleware({
    mode: 'production',
    minLevel: 'info',
    includeTimestamps: true,
    includeSource: false,
    ...config,
  });
}

// Export singleton instance for convenience
export const logger = new LoggingMiddleware();

export default LoggingMiddleware;
