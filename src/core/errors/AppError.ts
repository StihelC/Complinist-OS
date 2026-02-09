/**
 * Custom Application Error Class
 *
 * A standardized error class that provides consistent error handling
 * across the application with support for error codes, categories,
 * metadata, and recovery actions.
 */

import {
  ErrorCode,
  ErrorCategory,
  ErrorSeverity,
  ErrorMetadata,
  RecoveryAction,
  ERROR_MESSAGES,
  getErrorCategory,
  getDefaultSeverity,
} from './types';

export interface AppErrorOptions {
  code?: ErrorCode;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  metadata?: Partial<ErrorMetadata>;
  cause?: Error;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly metadata: ErrorMetadata;
  public readonly timestamp: number;
  public readonly isAppError = true;

  constructor(message?: string, options: AppErrorOptions = {}) {
    const code = options.code ?? ErrorCode.UNKNOWN_ERROR;
    const displayMessage = message ?? ERROR_MESSAGES[code] ?? 'An unexpected error occurred';

    super(displayMessage);

    // Maintain proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }

    this.name = 'AppError';
    this.code = code;
    this.category = options.category ?? getErrorCategory(code);
    this.severity = options.severity ?? getDefaultSeverity(code);
    this.timestamp = Date.now();

    this.metadata = {
      ...options.metadata,
      timestamp: this.timestamp,
      stack: this.stack,
      originalError: options.cause,
    };

    // Set the prototype explicitly for ES5 compatibility
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Creates an AppError from a native Error or unknown value
   */
  static from(error: unknown, options: AppErrorOptions = {}): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(error.message, {
        ...options,
        cause: error,
        metadata: {
          ...options.metadata,
          originalError: error,
          stack: error.stack,
        },
      });
    }

    // Handle string errors
    if (typeof error === 'string') {
      return new AppError(error, options);
    }

    // Handle other types
    return new AppError(
      typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error),
      options
    );
  }

  /**
   * Gets the user-friendly message for this error
   */
  getUserMessage(): string {
    return ERROR_MESSAGES[this.code] ?? this.message;
  }

  /**
   * Gets the recovery action for this error
   */
  getRecoveryAction(): RecoveryAction {
    if (this.metadata.recoveryAction) {
      return this.metadata.recoveryAction;
    }

    // Default recovery actions based on category
    switch (this.category) {
      case 'network':
        return 'check_connection';
      case 'auth':
        return 'update_license';
      case 'database':
        return this.severity === 'critical' ? 'restart' : 'retry';
      case 'file':
      case 'export':
      case 'import':
        return 'retry';
      case 'ai':
        return 'retry';
      case 'render':
        return 'reload';
      default:
        return 'retry';
    }
  }

  /**
   * Checks if this error is recoverable
   */
  isRecoverable(): boolean {
    if (this.metadata.recoverable !== undefined) {
      return this.metadata.recoverable;
    }

    // Cancelled operations are considered "recoverable" (user can retry)
    if (this.code === ErrorCode.OPERATION_CANCELLED || this.code === ErrorCode.EXPORT_CANCELLED) {
      return true;
    }

    // Critical errors are generally not recoverable without restart
    return this.severity !== 'critical';
  }

  /**
   * Creates a plain object representation for serialization
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp,
      metadata: {
        source: this.metadata.source,
        component: this.metadata.component,
        operation: this.metadata.operation,
        userAction: this.metadata.userAction,
        recoverable: this.isRecoverable(),
        recoveryAction: this.getRecoveryAction(),
      },
      stack: this.stack,
    };
  }

  /**
   * Creates an error response object for IPC communication
   */
  toErrorResponse() {
    return {
      success: false as const,
      error: this.getUserMessage(),
      code: this.code,
      category: this.category,
      severity: this.severity,
      metadata: {
        ...this.metadata,
        recoverable: this.isRecoverable(),
        recoveryAction: this.getRecoveryAction(),
      },
      canceled: this.code === ErrorCode.OPERATION_CANCELLED || this.code === ErrorCode.EXPORT_CANCELLED,
    };
  }

  /**
   * Logs the error with full context
   */
  log(): void {
    const logFn = this.severity === 'critical' || this.severity === 'error'
      ? console.error
      : this.severity === 'warning'
      ? console.warn
      : console.info;

    logFn(`[${this.severity.toUpperCase()}] [${this.category}] ${this.message}`, {
      code: this.code,
      metadata: this.metadata,
      stack: this.stack,
    });
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError || (
    typeof error === 'object' &&
    error !== null &&
    'isAppError' in error &&
    (error as { isAppError: boolean }).isAppError === true
  );
}

/**
 * Helper function to create common error types
 */
export const createError = {
  database: (message: string, code: ErrorCode = ErrorCode.DATABASE_QUERY_FAILED, metadata?: Partial<ErrorMetadata>) =>
    new AppError(message, { code, category: 'database', metadata }),

  network: (message: string, code: ErrorCode = ErrorCode.NETWORK_REQUEST_FAILED, metadata?: Partial<ErrorMetadata>) =>
    new AppError(message, { code, category: 'network', metadata }),

  validation: (message: string, code: ErrorCode = ErrorCode.VALIDATION_SCHEMA_FAILED, metadata?: Partial<ErrorMetadata>) =>
    new AppError(message, { code, category: 'validation', severity: 'warning', metadata }),

  file: (message: string, code: ErrorCode = ErrorCode.FILE_READ_FAILED, metadata?: Partial<ErrorMetadata>) =>
    new AppError(message, { code, category: 'file', metadata }),

  ai: (message: string, code: ErrorCode = ErrorCode.AI_SERVICE_UNAVAILABLE, metadata?: Partial<ErrorMetadata>) =>
    new AppError(message, { code, category: 'ai', metadata }),

  auth: (message: string, code: ErrorCode = ErrorCode.AUTH_UNAUTHORIZED, metadata?: Partial<ErrorMetadata>) =>
    new AppError(message, { code, category: 'auth', severity: 'warning', metadata }),

  export: (message: string, code: ErrorCode = ErrorCode.EXPORT_FAILED, metadata?: Partial<ErrorMetadata>) =>
    new AppError(message, { code, category: 'export', metadata }),

  import: (message: string, code: ErrorCode = ErrorCode.IMPORT_FAILED, metadata?: Partial<ErrorMetadata>) =>
    new AppError(message, { code, category: 'import', metadata }),

  ipc: (message: string, code: ErrorCode = ErrorCode.IPC_COMMUNICATION_FAILED, metadata?: Partial<ErrorMetadata>) =>
    new AppError(message, { code, category: 'ipc', metadata }),

  render: (message: string, code: ErrorCode = ErrorCode.RENDER_COMPONENT_FAILED, metadata?: Partial<ErrorMetadata>) =>
    new AppError(message, { code, category: 'render', metadata }),

  cancelled: (operation: string) =>
    new AppError(`${operation} was cancelled`, {
      code: ErrorCode.OPERATION_CANCELLED,
      severity: 'info',
      metadata: { operation, recoverable: true },
    }),

  unknown: (message: string, cause?: Error) =>
    new AppError(message, { code: ErrorCode.UNKNOWN_ERROR, cause }),
};
