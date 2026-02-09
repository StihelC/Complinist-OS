/**
 * HMR State Manager
 *
 * Manages renderer state preservation during main process HMR restarts.
 * Provides utilities for saving and restoring application state when
 * the Electron main process is reloaded.
 */

// State storage key for sessionStorage
const HMR_STATE_KEY = 'hmr_preserved_state';
const HMR_TIMESTAMP_KEY = 'hmr_last_reload';

// Type for state to preserve
interface HMRState {
  // Current route/page
  currentRoute?: string;
  // Scroll positions
  scrollPositions?: Record<string, { x: number; y: number }>;
  // Form data (for unsaved forms)
  formData?: Record<string, unknown>;
  // Selected items
  selectedItems?: string[];
  // UI state (panels open, modals, etc.)
  uiState?: Record<string, unknown>;
  // Custom state from app
  customState?: Record<string, unknown>;
  // Timestamp
  timestamp: number;
}

// Callbacks registered for state save
type StateSaveCallback = () => Record<string, unknown>;
const stateSaveCallbacks: Map<string, StateSaveCallback> = new Map();

// Callbacks for state restore
type StateRestoreCallback = (state: Record<string, unknown>) => void;
const stateRestoreCallbacks: Map<string, StateRestoreCallback> = new Map();

/**
 * Check if we're running in Electron
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && 'electronAPI' in window;
}

/**
 * Register a callback to save state before HMR reload
 */
export function registerStateSaveCallback(
  key: string,
  callback: StateSaveCallback
): void {
  stateSaveCallbacks.set(key, callback);
}

/**
 * Unregister a state save callback
 */
export function unregisterStateSaveCallback(key: string): void {
  stateSaveCallbacks.delete(key);
}

/**
 * Register a callback to restore state after HMR reload
 */
export function registerStateRestoreCallback(
  key: string,
  callback: StateRestoreCallback
): void {
  stateRestoreCallbacks.set(key, callback);
}

/**
 * Unregister a state restore callback
 */
export function unregisterStateRestoreCallback(key: string): void {
  stateRestoreCallbacks.delete(key);
}

/**
 * Save current state to sessionStorage
 */
function saveStateToStorage(state: HMRState): void {
  try {
    sessionStorage.setItem(HMR_STATE_KEY, JSON.stringify(state));
    sessionStorage.setItem(HMR_TIMESTAMP_KEY, state.timestamp.toString());
    console.log('[HMR] State saved to sessionStorage');
  } catch (error) {
    console.error('[HMR] Failed to save state to sessionStorage:', error);
  }
}

/**
 * Load preserved state from sessionStorage
 */
function loadStateFromStorage(): HMRState | null {
  try {
    const stateJson = sessionStorage.getItem(HMR_STATE_KEY);
    const timestamp = sessionStorage.getItem(HMR_TIMESTAMP_KEY);

    if (!stateJson || !timestamp) {
      return null;
    }

    // Check if state is recent (within 30 seconds)
    const stateTime = parseInt(timestamp, 10);
    if (Date.now() - stateTime > 30000) {
      console.log('[HMR] State is stale, clearing');
      clearStoredState();
      return null;
    }

    return JSON.parse(stateJson);
  } catch (error) {
    console.error('[HMR] Failed to load state from sessionStorage:', error);
    return null;
  }
}

/**
 * Clear stored state
 */
function clearStoredState(): void {
  sessionStorage.removeItem(HMR_STATE_KEY);
  sessionStorage.removeItem(HMR_TIMESTAMP_KEY);
}

/**
 * Collect state from all registered callbacks
 */
function collectState(): HMRState {
  const customState: Record<string, unknown> = {};

  stateSaveCallbacks.forEach((callback, key) => {
    try {
      customState[key] = callback();
    } catch (error) {
      console.error(`[HMR] Failed to collect state from ${key}:`, error);
    }
  });

  return {
    currentRoute: window.location.hash || window.location.pathname,
    scrollPositions: {
      main: { x: window.scrollX, y: window.scrollY },
    },
    customState,
    timestamp: Date.now(),
  };
}

/**
 * Restore state to all registered callbacks
 */
function restoreState(state: HMRState): void {
  // Restore scroll position
  if (state.scrollPositions?.main) {
    requestAnimationFrame(() => {
      window.scrollTo(state.scrollPositions!.main.x, state.scrollPositions!.main.y);
    });
  }

  // Call registered restore callbacks
  if (state.customState) {
    stateRestoreCallbacks.forEach((callback, key) => {
      if (key in state.customState!) {
        try {
          callback(state.customState![key] as Record<string, unknown>);
        } catch (error) {
          console.error(`[HMR] Failed to restore state to ${key}:`, error);
        }
      }
    });
  }
}

/**
 * Handle save state request from main process
 */
function handleSaveStateRequest(): void {
  console.log('[HMR] Main process requested state save');
  const state = collectState();
  saveStateToStorage(state);

  // Notify main process that state was saved
  if (isElectron() && (window as any).electronAPI?.saveHMRState) {
    (window as any).electronAPI.saveHMRState({ saved: true, keys: Array.from(stateSaveCallbacks.keys()) });
  }
}

/**
 * Handle before reload notification
 */
function handleBeforeReload(data: { changedFile: string; timestamp: number }): void {
  console.log(`[HMR] Main process reloading (changed: ${data.changedFile})`);
  // Additional pre-reload cleanup can be done here
}

/**
 * Handle restored notification after HMR restart
 */
function handleRestored(data: { changedFile: string; lastReload: number }): void {
  console.log(`[HMR] Restored after HMR restart (changed: ${data.changedFile})`);

  // Try to restore state from sessionStorage
  const state = loadStateFromStorage();
  if (state) {
    restoreState(state);
    clearStoredState();
    console.log('[HMR] State restored from sessionStorage');
  }
}

/**
 * Initialize HMR state manager
 * Sets up listeners for HMR events from main process
 */
export function initHMRStateManager(): () => void {
  if (!isElectron()) {
    console.log('[HMR] Not in Electron environment, skipping HMR state manager init');
    return () => {};
  }

  const api = (window as any).electronAPI;

  // Check if HMR APIs are available
  if (!api?.onHMRSaveState) {
    console.log('[HMR] HMR APIs not available in preload');
    return () => {};
  }

  console.log('[HMR] Initializing HMR state manager');

  // Set up listeners
  api.onHMRSaveState(handleSaveStateRequest);
  api.onHMRBeforeReload?.(handleBeforeReload);
  api.onHMRRestored?.(handleRestored);
  api.onMainProcessReloading?.(() => {
    console.log('[HMR] Main process is reloading...');
  });

  // Check for state to restore on init
  const savedState = loadStateFromStorage();
  if (savedState) {
    console.log('[HMR] Found saved state, restoring...');
    // Delay restore to allow app to initialize
    setTimeout(() => {
      restoreState(savedState);
      clearStoredState();
    }, 100);
  }

  // Return cleanup function
  return () => {
    api.removeHMRSaveStateListener?.();
    api.removeHMRBeforeReloadListener?.();
    api.removeHMRRestoredListener?.();
    api.removeMainProcessReloadingListener?.();
    stateSaveCallbacks.clear();
    stateRestoreCallbacks.clear();
  };
}

/**
 * Get HMR status from main process
 */
export async function getHMRStatus(): Promise<{
  enabled: boolean;
  electronReloaderActive: boolean;
  watchDirs: string[];
  watchExtensions: string[];
  isRestarting: boolean;
} | null> {
  if (!isElectron()) {
    return null;
  }

  try {
    return await (window as any).electronAPI.getHMRDetailedStatus?.();
  } catch (error) {
    console.error('[HMR] Failed to get HMR status:', error);
    return null;
  }
}

/**
 * Manually trigger main process reload
 */
export async function triggerMainProcessReload(): Promise<boolean> {
  if (!isElectron()) {
    return false;
  }

  try {
    const result = await (window as any).electronAPI.triggerHMRReload?.();
    return result?.success ?? false;
  } catch (error) {
    console.error('[HMR] Failed to trigger reload:', error);
    return false;
  }
}

export default {
  init: initHMRStateManager,
  registerSaveCallback: registerStateSaveCallback,
  unregisterSaveCallback: unregisterStateSaveCallback,
  registerRestoreCallback: registerStateRestoreCallback,
  unregisterRestoreCallback: unregisterStateRestoreCallback,
  getStatus: getHMRStatus,
  triggerReload: triggerMainProcessReload,
};
