/**
 * Layout Logger
 *
 * Provides environment-aware logging for layout operations.
 * Respects the layoutDebugMode setting from global settings.
 *
 * - Browser (debug off): Only errors shown
 * - Browser (debug on): All logs shown with [Layout Debug] prefix
 * - Terminal: Full verbose debug/info logging
 *
 * Usage:
 * ```typescript
 * import { layoutLogger } from '@/lib/topology/layoutLogger';
 *
 * layoutLogger.debug('Verbose debug info'); // Terminal or when debug mode on
 * layoutLogger.info('Important info', data); // Browser: summary (if debug on), Terminal: full
 * layoutLogger.warn('Warning message'); // Browser: only if debug on, Terminal: always
 * layoutLogger.error('Error occurred', error); // Both (always)
 * ```
 */

/**
 * Check if layout debug mode is enabled in global settings
 */
function isDebugModeEnabled(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('complinist-global-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.layoutDebugMode === true;
    }
  } catch {
    // Ignore errors
  }
  return false;
}

/**
 * Detect if we're running in a browser environment vs terminal/Electron main process
 */
function isBrowser(): boolean {
  // Check if we're in a browser context
  if (typeof window !== 'undefined') {
    // Electron renderer process has window but also has electronAPI
    // Pure browser doesn't have electronAPI
    if ('electronAPI' in window && (window as any).electronAPI !== undefined) {
      // Electron renderer - still treat as browser for console output filtering
      return true;
    }
    // Regular browser
    return true;
  }
  // Node.js/Electron main process - has process.stdout
  if (typeof process !== 'undefined' && process.stdout) {
    return false;
  }
  // Default to browser if we can't determine
  return true;
}

/**
 * Check if we should show verbose logs
 * Now also respects layoutDebugMode setting when in browser
 */
function isVerboseMode(): boolean {
  // Always verbose in terminal/Node.js
  if (!isBrowser()) return true;

  // In browser, only verbose if debug mode is enabled
  return isDebugModeEnabled();
}

/**
 * Format log message with prefix
 */
function formatMessage(prefix: string, message: string): string {
  return `[${prefix}] ${message}`;
}

interface LayoutLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, data?: any) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Layout logger instance
 * 
 * Automatically filters logs based on environment:
 * - Browser: Only errors, warnings, and summary stats
 * - Terminal: All debug/info/warn/error logs
 */
export const layoutLogger: LayoutLogger = {
  /**
   * Debug level - terminal only
   */
  debug: (message: string, ...args: unknown[]) => {
    if (isVerboseMode()) {
      console.log(message, ...args);
    }
  },

  /**
   * Info level - browser shows summary, terminal shows full details
   */
  info: (message: string, data?: any) => {
    if (isVerboseMode()) {
      // Terminal: show full details
      if (data !== undefined) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    } else {
      // Browser: show summary only for info logs
      // Extract prefix from message if it exists (e.g., "[AutoTidy]")
      const prefixMatch = message.match(/^\[([^\]]+)\]/);
      const prefix = prefixMatch ? prefixMatch[1] : '';
      const cleanMessage = prefixMatch ? message.replace(/^\[[^\]]+\]\s*/, '') : message;
      
      // Try to create a summary from the data
      let summary: string;
      if (data && typeof data === 'object') {
        // Handle stats objects
        if (data.stats) {
          const stats = data.stats;
          const nodeCount = stats.nodes ?? 0;
          const boundaryCount = stats.boundaries ?? 0;
          if (nodeCount > 0 || boundaryCount > 0) {
            summary = formatMessage(prefix, `Complete: ${nodeCount} nodes, ${boundaryCount} boundaries`);
          } else {
            summary = formatMessage(prefix, cleanMessage);
          }
        }
        // Handle nodeCount/boundaryCount directly
        else if (data.nodeCount !== undefined || data.boundaryCount !== undefined) {
          const nodeCount = data.nodeCount ?? 0;
          const boundaryCount = data.boundaryCount ?? 0;
          summary = formatMessage(prefix, `Complete: ${nodeCount} nodes, ${boundaryCount} boundaries`);
        }
        // Handle processing boundary logs
        else if (data.label && data.childCount !== undefined) {
          summary = formatMessage(prefix, `Processing "${data.label}": ${data.childCount} children`);
        }
        // Handle boundariesProcessed
        else if (data.boundariesProcessed !== undefined) {
          summary = formatMessage(prefix, `Pre-sized ${data.boundariesProcessed} boundaries`);
        }
        // Default: use the message as-is
        else {
          summary = formatMessage(prefix, cleanMessage);
        }
      } else {
        summary = formatMessage(prefix, cleanMessage);
      }
      
      console.log(summary);
    }
  },

  /**
   * Warn level - shown in both browser and terminal
   */
  warn: (message: string, ...args: unknown[]) => {
    if (isBrowser()) {
      // Browser: show simplified warnings
      const simplified = args.length > 0 ? message : message;
      console.warn(simplified, ...args);
    } else {
      // Terminal: show full warnings
      console.warn(message, ...args);
    }
  },

  /**
   * Error level - always shown in both browser and terminal
   */
  error: (message: string, ...args: unknown[]) => {
    console.error(message, ...args);
  },
};
