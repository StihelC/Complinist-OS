/**
 * Centralized Error Handler for Renderer Process
 *
 * This module provides a centralized error handling system that integrates
 * with the notification system and implements recovery procedures.
 */

import { AppError, createError, ErrorCode, ErrorSeverity, RecoveryAction } from './index';
import { useNotificationStore, showErrorNotification } from '@/shared/components/ErrorNotification';

// Error handler configuration
interface ErrorHandlerConfig {
  logToConsole: boolean;
  showNotifications: boolean;
  captureGlobalErrors: boolean;
}

const config: ErrorHandlerConfig = {
  logToConsole: true,
  showNotifications: true,
  captureGlobalErrors: true,
};

// Error statistics tracking
interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  recentErrors: Array<{ timestamp: number; message: string; code: ErrorCode }>;
}

const stats: ErrorStats = {
  totalErrors: 0,
  errorsByCategory: {},
  errorsBySeverity: {},
  recentErrors: [],
};

const MAX_RECENT_ERRORS = 50;

/**
 * Track error statistics
 */
function trackError(error: AppError): void {
  stats.totalErrors++;

  // Track by category
  stats.errorsByCategory[error.category] = (stats.errorsByCategory[error.category] || 0) + 1;

  // Track by severity
  stats.errorsBySeverity[error.severity] = (stats.errorsBySeverity[error.severity] || 0) + 1;

  // Track recent errors
  stats.recentErrors.push({
    timestamp: error.timestamp,
    message: error.message,
    code: error.code,
  });

  // Trim recent errors list
  if (stats.recentErrors.length > MAX_RECENT_ERRORS) {
    stats.recentErrors = stats.recentErrors.slice(-MAX_RECENT_ERRORS);
  }
}

/**
 * Log error to console with formatting
 */
function logError(error: AppError): void {
  if (!config.logToConsole) return;

  const prefix = `[${error.severity.toUpperCase()}]`;
  const category = `[${error.category}]`;
  const code = `[${error.code}]`;

  const logFn =
    error.severity === 'critical' || error.severity === 'error'
      ? console.error
      : error.severity === 'warning'
      ? console.warn
      : console.info;

  logFn(`${prefix} ${category} ${code} ${error.message}`);

  if (error.metadata.component) {
    console.log(`  Component: ${error.metadata.component}`);
  }
  if (error.metadata.operation) {
    console.log(`  Operation: ${error.metadata.operation}`);
  }
  if (error.stack && error.severity !== 'info') {
    console.log('  Stack:', error.stack);
  }
}

/**
 * Show notification for error
 */
function notifyError(error: AppError): void {
  if (!config.showNotifications) return;

  // Don't show notifications for cancelled operations (user initiated)
  if (error.code === ErrorCode.OPERATION_CANCELLED || error.code === ErrorCode.EXPORT_CANCELLED) {
    return;
  }

  showErrorNotification(error);
}

/**
 * Execute recovery action
 */
export async function executeRecoveryAction(
  action: RecoveryAction,
  context?: { operation?: string; onRetry?: () => Promise<void> }
): Promise<boolean> {
  switch (action) {
    case 'retry':
      if (context?.onRetry) {
        try {
          await context.onRetry();
          return true;
        } catch (error) {
          return false;
        }
      }
      return false;

    case 'reload':
      window.location.reload();
      return true;

    case 'restart':
      // In Electron, we can send message to main process to restart
      if (window.electronAPI?.restartApp) {
        window.electronAPI.restartApp();
        return true;
      }
      // Fallback to reload
      window.location.reload();
      return true;

    case 'check_connection':
      // Check if online
      if (navigator.onLine) {
        const store = useNotificationStore.getState();
        store.showInfo('Connection appears to be working. Please try again.');
        return true;
      }
      return false;

    case 'update_license':
      // Dispatch event to open license dialog
      window.dispatchEvent(new CustomEvent('open-license-dialog'));
      return true;

    case 'clear_cache':
      // Clear localStorage and sessionStorage
      try {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
        return true;
      } catch {
        return false;
      }

    case 'contact_support':
      // Open support page or email
      window.open('mailto:support@complinist.com?subject=Error Report', '_blank');
      return true;

    case 'none':
    default:
      return false;
  }
}

/**
 * Main error handler function
 */
export function handleError(
  error: unknown,
  context?: {
    component?: string;
    operation?: string;
    severity?: ErrorSeverity;
    showNotification?: boolean;
    logError?: boolean;
  }
): AppError {
  // Convert to AppError if needed
  const appError = error instanceof AppError
    ? error
    : AppError.from(error, {
        metadata: {
          component: context?.component,
          operation: context?.operation,
        },
        severity: context?.severity,
      });

  // Update metadata if provided
  if (context?.component && !appError.metadata.component) {
    appError.metadata.component = context.component;
  }
  if (context?.operation && !appError.metadata.operation) {
    appError.metadata.operation = context.operation;
  }

  // Track statistics
  trackError(appError);

  // Log if enabled (and not explicitly disabled)
  if (context?.logError !== false) {
    logError(appError);
  }

  // Show notification if enabled (and not explicitly disabled)
  if (context?.showNotification !== false) {
    notifyError(appError);
  }

  return appError;
}

/**
 * Async error handler wrapper for async functions
 */
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context?: {
    component?: string;
    operation?: string;
    fallback?: R;
    onError?: (error: AppError) => void;
  }
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = handleError(error, {
        component: context?.component,
        operation: context?.operation,
      });

      if (context?.onError) {
        context.onError(appError);
      }

      if (context?.fallback !== undefined) {
        return context.fallback;
      }

      throw appError;
    }
  };
}

/**
 * Sync error handler wrapper for sync functions
 */
export function withErrorHandlingSync<T extends unknown[], R>(
  fn: (...args: T) => R,
  context?: {
    component?: string;
    operation?: string;
    fallback?: R;
    onError?: (error: AppError) => void;
  }
): (...args: T) => R {
  return (...args: T): R => {
    try {
      return fn(...args);
    } catch (error) {
      const appError = handleError(error, {
        component: context?.component,
        operation: context?.operation,
      });

      if (context?.onError) {
        context.onError(appError);
      }

      if (context?.fallback !== undefined) {
        return context.fallback;
      }

      throw appError;
    }
  };
}

/**
 * Initialize global error handlers for the renderer process
 */
export function initializeGlobalErrorHandlers(): void {
  if (!config.captureGlobalErrors) return;

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    handleError(event.error || new Error(event.message), {
      component: 'global',
      operation: 'uncaughtError',
      severity: 'error',
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason || new Error('Unhandled promise rejection'), {
      component: 'global',
      operation: 'unhandledRejection',
      severity: 'error',
    });
  });

  // Listen for errors from main process
  if (window.electronAPI?.onMainProcessError) {
    window.electronAPI.onMainProcessError((errorData: { message: string; severity: string }) => {
      handleError(new Error(errorData.message), {
        component: 'main-process',
        severity: errorData.severity as ErrorSeverity,
      });
    });
  }

  console.info('[ErrorHandler] Global error handlers initialized');
}

/**
 * Get error statistics
 */
export function getErrorStats(): ErrorStats {
  return { ...stats };
}

/**
 * Reset error statistics
 */
export function resetErrorStats(): void {
  stats.totalErrors = 0;
  stats.errorsByCategory = {};
  stats.errorsBySeverity = {};
  stats.recentErrors = [];
}

/**
 * Configure error handler
 */
export function configureErrorHandler(newConfig: Partial<ErrorHandlerConfig>): void {
  Object.assign(config, newConfig);
}

// Export for convenience
export { createError };
