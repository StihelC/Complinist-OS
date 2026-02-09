/**
 * Layout Debugger
 *
 * Provides conditional logging for layout operations.
 * Only logs when layoutDebugMode is enabled in global settings.
 */

// Get debug mode from localStorage (avoid circular dependency with store)
const isDebugEnabled = (): boolean => {
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
};

export const layoutDebugger = {
  log: (message: string, ...args: unknown[]) => {
    if (isDebugEnabled()) {
      console.log(`[Layout Debug] ${message}`, ...args);
    }
  },

  info: (message: string, ...args: unknown[]) => {
    if (isDebugEnabled()) {
      console.info(`[Layout Debug] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: unknown[]) => {
    if (isDebugEnabled()) {
      console.warn(`[Layout Debug] ${message}`, ...args);
    }
  },

  error: (message: string, ...args: unknown[]) => {
    // Always log errors
    console.error(`[Layout Debug] ${message}`, ...args);
  },

  group: (label: string) => {
    if (isDebugEnabled()) {
      console.group(`[Layout Debug] ${label}`);
    }
  },

  groupEnd: () => {
    if (isDebugEnabled()) {
      console.groupEnd();
    }
  },

  table: (data: unknown) => {
    if (isDebugEnabled()) {
      console.table(data);
    }
  },

  // Check if debug mode is enabled
  isEnabled: isDebugEnabled,
};

export default layoutDebugger;
