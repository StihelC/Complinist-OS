/**
 * Debug Snapshot Utilities
 * Captures application state and screenshots for AI-assisted debugging
 */

import { useFlowStore } from '@/core/stores/useFlowStore';
import { useControlNarrativesStore } from '@/core/stores/useControlNarrativesStore';
import { useAuthStore } from '@/core/stores/useAuthStore';
import { useAIServiceStore } from '@/core/stores/useAIServiceStore';
import { useNISTQueryStore } from '@/core/stores/useNISTQueryStore';
import { useAINarrativesStore } from '@/core/stores/useAINarrativesStore';
import { useControlSelectionStore } from '@/core/stores/useControlSelectionStore';
import { useTerraformStore } from '@/core/stores/useTerraformStore';
import { useDocumentStore } from '@/core/stores/useDocumentStore';
import { useSSPMetadataStore } from '@/core/stores/sspMetadataStore';
import { useNavigationHistoryStore } from '@/core/stores/useNavigationHistoryStore';

export interface DebugSnapshot {
  success: boolean;
  snapshotDir?: string;
  screenshotPath?: string;
  statePath?: string;
  summaryPath?: string;
  timestamp?: string;
  error?: string;
}

/**
 * Sanitize state object to make it JSON-serializable
 * Removes functions, DOM nodes, and handles circular references
 */
function sanitizeForIPC(obj: any, seen = new WeakSet()): any {
  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle circular references
  if (seen.has(obj)) {
    return '[Circular Reference]';
  }
  seen.add(obj);

  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Handle Arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForIPC(item, seen));
  }

  // Handle plain objects
  const sanitized: any = {};
  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;

    const value = obj[key];

    // Skip functions
    if (typeof value === 'function') {
      continue;
    }

    // Skip DOM nodes
    if (value instanceof Node) {
      sanitized[key] = '[DOM Node]';
      continue;
    }

    // Skip complex browser objects
    if (value instanceof Window || value instanceof HTMLElement) {
      sanitized[key] = '[Browser Object]';
      continue;
    }

    // Recursively sanitize nested objects
    try {
      sanitized[key] = sanitizeForIPC(value, seen);
    } catch (error) {
      sanitized[key] = '[Unserializable]';
    }
  }

  return sanitized;
}

/**
 * Capture a complete debug snapshot including:
 * - Screenshot of the current application state
 * - All Zustand store states
 * - Current route and navigation history
 * - Window information
 */
export async function captureDebugSnapshot(): Promise<DebugSnapshot> {
  try {
    console.log('[DEBUG] Capturing debug snapshot...');

    // Gather state from all stores
    const flowState = useFlowStore.getState();
    const controlNarrativesState = useControlNarrativesStore.getState();
    const authState = useAuthStore.getState();
    const aiServiceState = useAIServiceStore.getState();
    const nistQueryState = useNISTQueryStore.getState();
    const aiNarrativesState = useAINarrativesStore.getState();
    const controlSelectionState = useControlSelectionStore.getState();
    const terraformState = useTerraformStore.getState();
    const documentState = useDocumentStore.getState();
    const navigationState = useNavigationHistoryStore.getState();

    const snapshot = {
      // Core application state
      currentView: getCurrentView(),
      currentProject: flowState.currentProject,
      projects: flowState.projects,

      // Topology state
      topology: {
        nodes: flowState.nodes,
        edges: flowState.edges,
        viewport: flowState.reactFlowInstance?.getViewport?.() ?? null,
      },

      // Control narratives
      controlNarratives: {
        items: controlNarrativesState.items,
        families: controlNarrativesState.families,
        baseline: controlNarrativesState.baseline,
        loading: controlNarrativesState.loading,
      },

      // Authentication/License
      auth: {
        isAuthenticated: authState.isAuthenticated,
        license: authState.license,
        daysRemaining: authState.daysRemaining,
        // Don't include token for security
      },

      // AI Service status
      aiService: {
        status: aiServiceState.status,
        preloadProgress: aiServiceState.preloadProgress,
        availableModels: aiServiceState.availableModels,
        modelPreferences: aiServiceState.modelPreferences,
      },

      // NIST Query state
      nistQuery: {
        queryHistory: nistQueryState.queryHistory,
        isLoading: nistQueryState.isLoading,
        currentQuery: nistQueryState.currentQuery,
        isStreaming: nistQueryState.isStreaming,
      },

      // AI Narratives
      aiNarratives: {
        narratives: aiNarrativesState.narratives,
        chatHistory: aiNarrativesState.chatHistory,
      },

      // Control Selection (SSP)
      controlSelection: {
        selectedControlIds: controlSelectionState.selectedControlIds,
        initialized: controlSelectionState.initialized,
      },

      // Terraform state
      terraform: {
        currentPlan: terraformState.currentPlan,
        viewMode: terraformState.viewMode,
      },

      // Documents
      documents: {
        documents: documentState.documents,
        isLoading: documentState.isLoading,
        processingProgress: documentState.processingProgress,
        queueStatus: documentState.queueStatus,
      },

      // SSP Metadata
      sspMetadata: useSSPMetadataStore.getState(),

      // Navigation history
      navigation: {
        recentlyEdited: navigationState.recentlyEdited,
        currentPath: navigationState.currentPath,
        selectedControlId: navigationState.selectedControlId,
      },

      // Timestamp
      capturedAt: new Date().toISOString(),
    };

    console.log('[DEBUG] State collected, sanitizing for IPC...');

    // Sanitize the snapshot to ensure it's JSON-serializable
    const sanitizedSnapshot = sanitizeForIPC(snapshot);

    console.log('[DEBUG] State sanitized, sending to main process...');

    // Send to main process via IPC
    const result = await window.electronAPI.captureDebugSnapshot(sanitizedSnapshot);

    if (result.success) {
      console.log('[DEBUG] Snapshot captured successfully:', result.snapshotDir);
      console.log('[DEBUG] Screenshot:', result.screenshotPath);
      console.log('[DEBUG] State:', result.statePath);

      // Show success notification
      showSnapshotNotification(result);
    } else {
      console.error('[DEBUG] Snapshot capture failed:', result.error);
    }

    return result;
  } catch (error) {
    console.error('[DEBUG] Failed to capture snapshot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get the current view/route
 */
function getCurrentView(): string {
  // Try to detect current view from URL hash or other indicators
  if (typeof window !== 'undefined') {
    const hash = window.location.hash;
    if (hash) {
      return hash.replace('#', '');
    }

    // Fallback to checking visible elements or store state
    const flowStore = useFlowStore.getState();
    if (flowStore.currentProject) {
      return 'topology'; // or whatever view is active
    }
  }
  return 'unknown';
}

/**
 * Show a notification about the captured snapshot
 */
function showSnapshotNotification(result: DebugSnapshot) {
  // Create a temporary notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;

  notification.innerHTML = `
    <div style="display: flex; align-items: start; gap: 12px;">
      <div style="flex-shrink: 0;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <div>
        <div style="font-weight: 600; margin-bottom: 4px;">Debug Snapshot Captured</div>
        <div style="font-size: 12px; opacity: 0.9;">
          Screenshot and state saved to:<br/>
          <code style="background: rgba(255,255,255,0.2); padding: 2px 4px; border-radius: 3px; font-size: 11px;">
            ${result.snapshotDir}
          </code>
        </div>
      </div>
    </div>
  `;

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 300);
  }, 5000);
}

/**
 * Initialize debug snapshot keyboard shortcut
 * Triggers on Ctrl+Shift+D (Windows/Linux) or Cmd+Shift+D (Mac)
 */
export function initializeDebugShortcut() {
  if (typeof window === 'undefined') return;

  const handleKeyDown = (event: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifierKey = isMac ? event.metaKey : event.ctrlKey;

    if (modifierKey && event.shiftKey && event.key === 'D') {
      event.preventDefault();
      console.log('[DEBUG] Keyboard shortcut triggered');
      captureDebugSnapshot();
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  console.log('[DEBUG] Keyboard shortcut registered (Ctrl+Shift+D / Cmd+Shift+D)');

  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Expose debug utilities globally for console access
 */
if (typeof window !== 'undefined') {
  (window as any).__DEBUG__ = {
    captureSnapshot: captureDebugSnapshot,
    listSnapshots: async () => {
      return await window.electronAPI.listDebugSnapshots();
    },
    openSnapshotsDir: async () => {
      return await window.electronAPI.openDebugSnapshotsDir();
    },
    getWindowInfo: async () => {
      return await window.electronAPI.getDebugWindowInfo();
    },
  };

  console.log('[DEBUG] Debug utilities available at window.__DEBUG__');
  console.log('[DEBUG] Try: __DEBUG__.captureSnapshot()');
}
