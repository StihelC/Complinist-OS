/**
 * HMR Module Exports
 *
 * Provides utilities for handling Electron main process HMR (Hot Module Replacement)
 * and preserving renderer state during restarts.
 */

export {
  initHMRStateManager,
  registerStateSaveCallback,
  unregisterStateSaveCallback,
  registerStateRestoreCallback,
  unregisterStateRestoreCallback,
  getHMRStatus,
  triggerMainProcessReload,
  default as hmrStateManager,
} from './hmr-state-manager';
