/**
 * Error Handling Module
 *
 * This module exports all error-related types, classes, and utilities
 * for consistent error handling across the application.
 */

// Export error types
export * from './types';

// Export AppError class and helpers
export { AppError, isAppError, createError } from './AppError';

// Export error handler utilities
export {
  handleError,
  withErrorHandling,
  withErrorHandlingSync,
  initializeGlobalErrorHandlers,
  executeRecoveryAction,
  getErrorStats,
  resetErrorStats,
  configureErrorHandler,
} from './errorHandler';

// Re-export commonly used types for convenience
export type {
  ErrorSeverity,
  ErrorCategory,
  ErrorMetadata,
  RecoveryAction,
  ErrorResponse,
  SuccessResponse,
  IPCResponse,
} from './types';

export { ErrorCode } from './types';
