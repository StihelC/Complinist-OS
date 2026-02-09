/**
 * Standardized Error Types for CompliNist
 *
 * This module provides a consistent error type system for both main and renderer processes.
 * It includes error codes, severity levels, and structured error classes.
 */

// Error severity levels
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

// Error categories for grouping and routing errors
export type ErrorCategory =
  | 'database'
  | 'network'
  | 'ipc'
  | 'validation'
  | 'file'
  | 'ai'
  | 'auth'
  | 'export'
  | 'import'
  | 'render'
  | 'unknown';

// Error codes for specific error types
export enum ErrorCode {
  // Database errors (1xxx)
  DATABASE_CONNECTION_FAILED = 1001,
  DATABASE_QUERY_FAILED = 1002,
  DATABASE_MIGRATION_FAILED = 1003,
  DATABASE_INTEGRITY_ERROR = 1004,

  // Network errors (2xxx)
  NETWORK_REQUEST_FAILED = 2001,
  NETWORK_TIMEOUT = 2002,
  NETWORK_OFFLINE = 2003,

  // IPC errors (3xxx)
  IPC_COMMUNICATION_FAILED = 3001,
  IPC_HANDLER_NOT_FOUND = 3002,
  IPC_VALIDATION_FAILED = 3003,
  IPC_RESPONSE_INVALID = 3004,

  // Validation errors (4xxx)
  VALIDATION_REQUIRED_FIELD = 4001,
  VALIDATION_INVALID_FORMAT = 4002,
  VALIDATION_OUT_OF_RANGE = 4003,
  VALIDATION_SCHEMA_FAILED = 4004,

  // File errors (5xxx)
  FILE_NOT_FOUND = 5001,
  FILE_READ_FAILED = 5002,
  FILE_WRITE_FAILED = 5003,
  FILE_PERMISSION_DENIED = 5004,
  FILE_FORMAT_INVALID = 5005,

  // AI service errors (6xxx)
  AI_SERVICE_UNAVAILABLE = 6001,
  AI_MODEL_LOAD_FAILED = 6002,
  AI_INFERENCE_FAILED = 6003,
  AI_EMBEDDING_FAILED = 6004,
  AI_CHROMADB_ERROR = 6005,

  // Auth errors (7xxx)
  AUTH_LICENSE_INVALID = 7001,
  AUTH_LICENSE_EXPIRED = 7002,
  AUTH_UNAUTHORIZED = 7003,
  AUTH_TOKEN_VALIDATION_FAILED = 7004,

  // Export errors (8xxx)
  EXPORT_FAILED = 8001,
  EXPORT_CANCELLED = 8002,
  EXPORT_FORMAT_UNSUPPORTED = 8003,
  EXPORT_DATA_INVALID = 8004,

  // Import errors (9xxx)
  IMPORT_FAILED = 9001,
  IMPORT_FORMAT_UNSUPPORTED = 9002,
  IMPORT_DATA_CORRUPTED = 9003,
  IMPORT_VERSION_MISMATCH = 9004,

  // Render errors (10xxx)
  RENDER_COMPONENT_FAILED = 10001,
  RENDER_STATE_INVALID = 10002,
  RENDER_RESOURCE_MISSING = 10003,

  // Unknown/General errors (0xxx)
  UNKNOWN_ERROR = 0,
  OPERATION_CANCELLED = 1,
  OPERATION_TIMEOUT = 2,
}

// Error metadata for additional context
export interface ErrorMetadata {
  // Where the error occurred
  source?: string;
  // Component or module name
  component?: string;
  // Operation being performed when error occurred
  operation?: string;
  // User-facing action hint
  userAction?: string;
  // Technical details for debugging
  technicalDetails?: Record<string, unknown>;
  // Whether the error is recoverable
  recoverable?: boolean;
  // Recovery action suggestion
  recoveryAction?: RecoveryAction;
  // Stack trace
  stack?: string;
  // Original error if wrapped
  originalError?: Error;
  // Timestamp of when the error occurred
  timestamp?: number;
}

// Recovery actions that can be suggested
export type RecoveryAction =
  | 'retry'
  | 'reload'
  | 'restart'
  | 'contact_support'
  | 'check_connection'
  | 'update_license'
  | 'clear_cache'
  | 'none';

// Structured error response for IPC communication
export interface ErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
  category: ErrorCategory;
  severity: ErrorSeverity;
  metadata?: ErrorMetadata;
  // For backward compatibility
  canceled?: boolean;
}

// Success response for IPC communication
export interface SuccessResponse<T = unknown> {
  success: true;
  data?: T;
  filePath?: string;
}

// Union type for IPC responses
export type IPCResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// Helper type guard for error responses
export function isErrorResponse(response: IPCResponse): response is ErrorResponse {
  return response.success === false;
}

// Helper type guard for success responses
export function isSuccessResponse<T>(response: IPCResponse<T>): response is SuccessResponse<T> {
  return response.success === true;
}

// User-friendly error messages mapping
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.DATABASE_CONNECTION_FAILED]: 'Unable to connect to the database. Please restart the application.',
  [ErrorCode.DATABASE_QUERY_FAILED]: 'A database operation failed. Your data may not have been saved.',
  [ErrorCode.DATABASE_MIGRATION_FAILED]: 'Database upgrade failed. Please contact support.',
  [ErrorCode.DATABASE_INTEGRITY_ERROR]: 'Database integrity check failed. Some data may be corrupted.',

  [ErrorCode.NETWORK_REQUEST_FAILED]: 'Network request failed. Please check your connection.',
  [ErrorCode.NETWORK_TIMEOUT]: 'The operation timed out. Please try again.',
  [ErrorCode.NETWORK_OFFLINE]: 'You appear to be offline. Please check your internet connection.',

  [ErrorCode.IPC_COMMUNICATION_FAILED]: 'Internal communication error. Please restart the application.',
  [ErrorCode.IPC_HANDLER_NOT_FOUND]: 'The requested operation is not available.',
  [ErrorCode.IPC_VALIDATION_FAILED]: 'Invalid data provided. Please check your input.',
  [ErrorCode.IPC_RESPONSE_INVALID]: 'Received invalid response. Please try again.',

  [ErrorCode.VALIDATION_REQUIRED_FIELD]: 'Please fill in all required fields.',
  [ErrorCode.VALIDATION_INVALID_FORMAT]: 'Invalid format. Please check your input.',
  [ErrorCode.VALIDATION_OUT_OF_RANGE]: 'Value is out of acceptable range.',
  [ErrorCode.VALIDATION_SCHEMA_FAILED]: 'Data validation failed. Please check your input.',

  [ErrorCode.FILE_NOT_FOUND]: 'The requested file was not found.',
  [ErrorCode.FILE_READ_FAILED]: 'Unable to read the file. It may be corrupted or in use.',
  [ErrorCode.FILE_WRITE_FAILED]: 'Unable to save the file. Please check disk space and permissions.',
  [ErrorCode.FILE_PERMISSION_DENIED]: 'Access denied. Please check file permissions.',
  [ErrorCode.FILE_FORMAT_INVALID]: 'Invalid file format. Please select a valid file.',

  [ErrorCode.AI_SERVICE_UNAVAILABLE]: 'AI service is not available. Please check the AI status.',
  [ErrorCode.AI_MODEL_LOAD_FAILED]: 'Failed to load AI model. Please check your system resources.',
  [ErrorCode.AI_INFERENCE_FAILED]: 'AI processing failed. Please try again.',
  [ErrorCode.AI_EMBEDDING_FAILED]: 'Text embedding failed. Please try again.',
  [ErrorCode.AI_CHROMADB_ERROR]: 'Vector database error. Please check AI service status.',

  [ErrorCode.AUTH_LICENSE_INVALID]: 'Invalid license. Please enter a valid license key.',
  [ErrorCode.AUTH_LICENSE_EXPIRED]: 'Your license has expired. Please renew your subscription.',
  [ErrorCode.AUTH_UNAUTHORIZED]: 'You are not authorized to perform this action.',
  [ErrorCode.AUTH_TOKEN_VALIDATION_FAILED]: 'License validation failed. Please try again.',

  [ErrorCode.EXPORT_FAILED]: 'Export failed. Please try again.',
  [ErrorCode.EXPORT_CANCELLED]: 'Export was cancelled.',
  [ErrorCode.EXPORT_FORMAT_UNSUPPORTED]: 'Unsupported export format.',
  [ErrorCode.EXPORT_DATA_INVALID]: 'Cannot export: data is invalid.',

  [ErrorCode.IMPORT_FAILED]: 'Import failed. Please check the file and try again.',
  [ErrorCode.IMPORT_FORMAT_UNSUPPORTED]: 'Unsupported import format.',
  [ErrorCode.IMPORT_DATA_CORRUPTED]: 'The import file appears to be corrupted.',
  [ErrorCode.IMPORT_VERSION_MISMATCH]: 'File version is not compatible with this version of CompliNist.',

  [ErrorCode.RENDER_COMPONENT_FAILED]: 'A display error occurred. Please refresh the page.',
  [ErrorCode.RENDER_STATE_INVALID]: 'Application state error. Please refresh.',
  [ErrorCode.RENDER_RESOURCE_MISSING]: 'A required resource could not be loaded.',

  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
  [ErrorCode.OPERATION_CANCELLED]: 'Operation was cancelled.',
  [ErrorCode.OPERATION_TIMEOUT]: 'Operation timed out. Please try again.',
};

// Map error codes to categories
export function getErrorCategory(code: ErrorCode): ErrorCategory {
  if (code >= 1001 && code <= 1999) return 'database';
  if (code >= 2001 && code <= 2999) return 'network';
  if (code >= 3001 && code <= 3999) return 'ipc';
  if (code >= 4001 && code <= 4999) return 'validation';
  if (code >= 5001 && code <= 5999) return 'file';
  if (code >= 6001 && code <= 6999) return 'ai';
  if (code >= 7001 && code <= 7999) return 'auth';
  if (code >= 8001 && code <= 8999) return 'export';
  if (code >= 9001 && code <= 9999) return 'import';
  if (code >= 10001 && code <= 10999) return 'render';
  return 'unknown';
}

// Map error codes to default severity
export function getDefaultSeverity(code: ErrorCode): ErrorSeverity {
  // Critical errors
  if ([
    ErrorCode.DATABASE_CONNECTION_FAILED,
    ErrorCode.DATABASE_INTEGRITY_ERROR,
    ErrorCode.IPC_COMMUNICATION_FAILED,
  ].includes(code)) {
    return 'critical';
  }

  // Warning level
  if ([
    ErrorCode.NETWORK_OFFLINE,
    ErrorCode.AUTH_LICENSE_EXPIRED,
    ErrorCode.EXPORT_CANCELLED,
    ErrorCode.OPERATION_CANCELLED,
  ].includes(code)) {
    return 'warning';
  }

  // Info level
  if ([
    ErrorCode.OPERATION_TIMEOUT,
  ].includes(code)) {
    return 'info';
  }

  // Default to error
  return 'error';
}
