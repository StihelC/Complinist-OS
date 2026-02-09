/**
 * Centralized Error Reporter for Main Process
 *
 * This module provides a consistent error handling and reporting system
 * for the Electron main process. It captures, logs, and optionally reports
 * errors to external services.
 */

import fs from 'fs';
import path from 'path';
import { app, dialog } from 'electron';

// Error severity levels
const ErrorSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
};

// Error categories
const ErrorCategory = {
  DATABASE: 'database',
  NETWORK: 'network',
  IPC: 'ipc',
  VALIDATION: 'validation',
  FILE: 'file',
  AI: 'ai',
  AUTH: 'auth',
  EXPORT: 'export',
  IMPORT: 'import',
  UNKNOWN: 'unknown',
};

// Error codes mapping
const ErrorCode = {
  // Database errors (1xxx)
  DATABASE_CONNECTION_FAILED: 1001,
  DATABASE_QUERY_FAILED: 1002,
  DATABASE_MIGRATION_FAILED: 1003,
  DATABASE_INTEGRITY_ERROR: 1004,

  // Network errors (2xxx)
  NETWORK_REQUEST_FAILED: 2001,
  NETWORK_TIMEOUT: 2002,
  NETWORK_OFFLINE: 2003,

  // IPC errors (3xxx)
  IPC_COMMUNICATION_FAILED: 3001,
  IPC_HANDLER_NOT_FOUND: 3002,
  IPC_VALIDATION_FAILED: 3003,
  IPC_RESPONSE_INVALID: 3004,

  // Validation errors (4xxx)
  VALIDATION_REQUIRED_FIELD: 4001,
  VALIDATION_INVALID_FORMAT: 4002,
  VALIDATION_OUT_OF_RANGE: 4003,
  VALIDATION_SCHEMA_FAILED: 4004,

  // File errors (5xxx)
  FILE_NOT_FOUND: 5001,
  FILE_READ_FAILED: 5002,
  FILE_WRITE_FAILED: 5003,
  FILE_PERMISSION_DENIED: 5004,
  FILE_FORMAT_INVALID: 5005,

  // AI service errors (6xxx)
  AI_SERVICE_UNAVAILABLE: 6001,
  AI_MODEL_LOAD_FAILED: 6002,
  AI_INFERENCE_FAILED: 6003,
  AI_EMBEDDING_FAILED: 6004,
  AI_CHROMADB_ERROR: 6005,

  // Auth errors (7xxx)
  AUTH_LICENSE_INVALID: 7001,
  AUTH_LICENSE_EXPIRED: 7002,
  AUTH_UNAUTHORIZED: 7003,
  AUTH_TOKEN_VALIDATION_FAILED: 7004,

  // Export errors (8xxx)
  EXPORT_FAILED: 8001,
  EXPORT_CANCELLED: 8002,
  EXPORT_FORMAT_UNSUPPORTED: 8003,
  EXPORT_DATA_INVALID: 8004,

  // Import errors (9xxx)
  IMPORT_FAILED: 9001,
  IMPORT_FORMAT_UNSUPPORTED: 9002,
  IMPORT_DATA_CORRUPTED: 9003,
  IMPORT_VERSION_MISMATCH: 9004,

  // General errors (0xxx)
  UNKNOWN_ERROR: 0,
  OPERATION_CANCELLED: 1,
  OPERATION_TIMEOUT: 2,
};

// User-friendly error messages
const ERROR_MESSAGES = {
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
  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
  [ErrorCode.OPERATION_CANCELLED]: 'Operation was cancelled.',
  [ErrorCode.OPERATION_TIMEOUT]: 'Operation timed out. Please try again.',
};

// Error log storage
let errorLog = [];
const MAX_ERROR_LOG_SIZE = 1000;

// Configuration
const config = {
  logToFile: true,
  logToConsole: true,
  showDialogOnCritical: true,
  maxLogFileSize: 5 * 1024 * 1024, // 5MB
};

/**
 * Get the error log file path
 */
function getLogFilePath() {
  const userDataPath = app?.getPath?.('userData') || '/tmp';
  return path.join(userDataPath, 'error.log');
}

/**
 * Format error for logging
 */
function formatError(error, context = {}) {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    message: error.message || String(error),
    code: context.code || ErrorCode.UNKNOWN_ERROR,
    category: context.category || ErrorCategory.UNKNOWN,
    severity: context.severity || ErrorSeverity.ERROR,
    source: context.source || 'main',
    component: context.component || 'unknown',
    operation: context.operation,
    stack: error.stack,
    details: context.details,
  };
  return errorInfo;
}

/**
 * Log error to file
 */
function logToFile(errorInfo) {
  if (!config.logToFile) return;

  try {
    const logPath = getLogFilePath();
    const logLine = JSON.stringify(errorInfo) + '\n';

    // Check file size and rotate if needed
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      if (stats.size > config.maxLogFileSize) {
        // Rotate log file
        const backupPath = logPath + '.old';
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
        fs.renameSync(logPath, backupPath);
      }
    }

    fs.appendFileSync(logPath, logLine);
  } catch (err) {
    console.error('[ERROR REPORTER] Failed to write to error log file:', err);
  }
}

/**
 * Log error to console with formatting
 */
function logToConsole(errorInfo) {
  if (!config.logToConsole) return;

  const prefix = `[${errorInfo.severity.toUpperCase()}]`;
  const category = `[${errorInfo.category}]`;
  const source = `[${errorInfo.source}]`;

  const logFn =
    errorInfo.severity === ErrorSeverity.CRITICAL ||
    errorInfo.severity === ErrorSeverity.ERROR
      ? console.error
      : errorInfo.severity === ErrorSeverity.WARNING
      ? console.warn
      : console.info;

  logFn(
    `${prefix} ${category} ${source} ${errorInfo.message}`,
    errorInfo.operation ? `(${errorInfo.operation})` : '',
    errorInfo.details ? errorInfo.details : ''
  );

  if (errorInfo.stack && errorInfo.severity !== ErrorSeverity.INFO) {
    console.error('Stack trace:', errorInfo.stack);
  }
}

/**
 * Show error dialog for critical errors
 */
function showErrorDialog(errorInfo) {
  if (!config.showDialogOnCritical || errorInfo.severity !== ErrorSeverity.CRITICAL) {
    return;
  }

  try {
    dialog.showErrorBox(
      'CompliNist Error',
      `${errorInfo.message}\n\nPlease restart the application. If the problem persists, contact support.`
    );
  } catch (err) {
    console.error('[ERROR REPORTER] Failed to show error dialog:', err);
  }
}

/**
 * Store error in memory log
 */
function storeError(errorInfo) {
  errorLog.push(errorInfo);

  // Trim log if it exceeds max size
  if (errorLog.length > MAX_ERROR_LOG_SIZE) {
    errorLog = errorLog.slice(-MAX_ERROR_LOG_SIZE);
  }
}

/**
 * Main error reporting function
 */
function reportError(error, context = {}) {
  const errorInfo = formatError(error, context);

  // Store in memory
  storeError(errorInfo);

  // Log to console
  logToConsole(errorInfo);

  // Log to file
  logToFile(errorInfo);

  // Show dialog for critical errors
  showErrorDialog(errorInfo);

  return errorInfo;
}

/**
 * Create a standardized error response for IPC
 */
function createErrorResponse(error, context = {}) {
  const code = context.code || ErrorCode.UNKNOWN_ERROR;
  const category = context.category || ErrorCategory.UNKNOWN;
  const severity = context.severity || ErrorSeverity.ERROR;

  // Report the error
  reportError(error, context);

  return {
    success: false,
    error: ERROR_MESSAGES[code] || error.message || 'An unexpected error occurred',
    code,
    category,
    severity,
    metadata: {
      source: context.source || 'main',
      component: context.component,
      operation: context.operation,
      recoverable: severity !== ErrorSeverity.CRITICAL,
      timestamp: Date.now(),
    },
    canceled: code === ErrorCode.OPERATION_CANCELLED || code === ErrorCode.EXPORT_CANCELLED,
  };
}

/**
 * Create a success response for IPC
 */
function createSuccessResponse(data, filePath = null) {
  const response = { success: true };
  if (data !== undefined) {
    response.data = data;
  }
  if (filePath) {
    response.filePath = filePath;
  }
  return response;
}

/**
 * Wrap an async handler with error handling
 */
function wrapHandler(handler, context = {}) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return createErrorResponse(error, {
        ...context,
        source: 'main',
      });
    }
  };
}

/**
 * Get recent errors from the log
 */
function getRecentErrors(count = 50) {
  return errorLog.slice(-count);
}

/**
 * Clear error log
 */
function clearErrorLog() {
  errorLog = [];
}

/**
 * Get error statistics
 */
function getErrorStats() {
  const stats = {
    total: errorLog.length,
    byCategory: {},
    bySeverity: {},
    recent: errorLog.slice(-10),
  };

  errorLog.forEach((error) => {
    // Count by category
    stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
    // Count by severity
    stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
  });

  return stats;
}

/**
 * Initialize global error handlers
 */
function initializeGlobalHandlers(mainWindow = null) {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    reportError(error, {
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.UNKNOWN,
      source: 'main',
      operation: 'uncaughtException',
    });

    // Send to renderer if available
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('main-process-error', {
        message: error.message,
        severity: ErrorSeverity.CRITICAL,
      });
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    reportError(error, {
      severity: ErrorSeverity.ERROR,
      category: ErrorCategory.UNKNOWN,
      source: 'main',
      operation: 'unhandledRejection',
      details: { promise: String(promise) },
    });
  });

  // Handle warnings
  process.on('warning', (warning) => {
    reportError(warning, {
      severity: ErrorSeverity.WARNING,
      category: ErrorCategory.UNKNOWN,
      source: 'main',
      operation: 'processWarning',
    });
  });

  console.log('[ERROR REPORTER] Global error handlers initialized');
}

// Export the error reporter
export {
  ErrorSeverity,
  ErrorCategory,
  ErrorCode,
  ERROR_MESSAGES,
  reportError,
  createErrorResponse,
  createSuccessResponse,
  wrapHandler,
  getRecentErrors,
  clearErrorLog,
  getErrorStats,
  initializeGlobalHandlers,
  config as errorReporterConfig,
};

export default {
  ErrorSeverity,
  ErrorCategory,
  ErrorCode,
  ERROR_MESSAGES,
  reportError,
  createErrorResponse,
  createSuccessResponse,
  wrapHandler,
  getRecentErrors,
  clearErrorLog,
  getErrorStats,
  initializeGlobalHandlers,
  config: config,
};
