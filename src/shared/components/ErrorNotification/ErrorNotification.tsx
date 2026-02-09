/**
 * Error Notification System
 *
 * A comprehensive toast/notification system for displaying errors,
 * warnings, and informational messages to users. Uses a global store
 * for managing notifications across the application.
 */

import React, { useState, useCallback } from 'react';
import { create } from 'zustand';
import { ErrorSeverity, ErrorCode, RecoveryAction } from '@/core/errors';
import { X, AlertCircle, AlertTriangle, Info, RefreshCw } from 'lucide-react';

// Notification types
export interface Notification {
  id: string;
  message: string;
  title?: string;
  severity: ErrorSeverity;
  code?: ErrorCode;
  duration?: number; // Duration in ms, 0 for persistent
  recoveryAction?: RecoveryAction;
  onRecovery?: () => void;
  timestamp: number;
  dismissed?: boolean;
}

// Notification store interface
interface NotificationStore {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  // Convenience methods
  showError: (message: string, options?: Partial<Notification>) => string;
  showWarning: (message: string, options?: Partial<Notification>) => string;
  showInfo: (message: string, options?: Partial<Notification>) => string;
  showSuccess: (message: string, options?: Partial<Notification>) => string;
}

// Generate unique ID
const generateId = () => `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Default durations by severity
const DEFAULT_DURATIONS: Record<ErrorSeverity, number> = {
  info: 3000,
  warning: 5000,
  error: 7000,
  critical: 0, // Persistent
};

// Create the notification store
export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = generateId();
    const severity = notification.severity || 'info';
    const duration = notification.duration ?? DEFAULT_DURATIONS[severity];

    const newNotification: Notification = {
      ...notification,
      id,
      severity,
      duration,
      timestamp: Date.now(),
    };

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    // Auto-dismiss after duration (if not persistent)
    if (duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, duration);
    }

    return id;
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },

  showError: (message, options = {}) => {
    return get().addNotification({
      message,
      severity: 'error',
      ...options,
    });
  },

  showWarning: (message, options = {}) => {
    return get().addNotification({
      message,
      severity: 'warning',
      ...options,
    });
  },

  showInfo: (message, options = {}) => {
    return get().addNotification({
      message,
      severity: 'info',
      ...options,
    });
  },

  showSuccess: (message, options = {}) => {
    return get().addNotification({
      message,
      severity: 'info',
      title: 'Success',
      ...options,
    });
  },
}));

// Severity configuration
const SEVERITY_CONFIG: Record<
  ErrorSeverity,
  {
    icon: React.FC<{ className?: string }>;
    bgColor: string;
    borderColor: string;
    textColor: string;
    iconColor: string;
  }
> = {
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-500',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-800',
    iconColor: 'text-yellow-500',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    iconColor: 'text-red-500',
  },
  critical: {
    icon: AlertCircle,
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    textColor: 'text-red-900',
    iconColor: 'text-red-600',
  },
};

// Recovery action labels
const RECOVERY_LABELS: Record<RecoveryAction, string> = {
  retry: 'Retry',
  reload: 'Reload Page',
  restart: 'Restart App',
  contact_support: 'Contact Support',
  check_connection: 'Check Connection',
  update_license: 'Update License',
  clear_cache: 'Clear Cache',
  none: '',
};

/**
 * Single notification toast component
 */
function NotificationToast({ notification }: { notification: Notification }) {
  const { removeNotification } = useNotificationStore();
  const config = SEVERITY_CONFIG[notification.severity];
  const Icon = config.icon;
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      removeNotification(notification.id);
    }, 200);
  }, [notification.id, removeNotification]);

  const handleRecovery = useCallback(() => {
    if (notification.onRecovery) {
      notification.onRecovery();
    } else if (notification.recoveryAction === 'reload') {
      window.location.reload();
    } else if (notification.recoveryAction === 'retry') {
      // Default retry just dismisses
      handleDismiss();
    }
  }, [notification, handleDismiss]);

  return (
    <div
      className={`
        transform transition-all duration-200 ease-out
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
    >
      <div
        className={`
          flex items-start gap-3 p-4 rounded-lg shadow-lg border
          ${config.bgColor} ${config.borderColor}
          min-w-[320px] max-w-md
        `}
        role="alert"
      >
        {/* Icon */}
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {notification.title && (
            <h4 className={`font-semibold text-sm ${config.textColor}`}>
              {notification.title}
            </h4>
          )}
          <p className={`text-sm ${config.textColor} ${notification.title ? 'mt-1' : ''}`}>
            {notification.message}
          </p>

          {/* Recovery action button */}
          {notification.recoveryAction && notification.recoveryAction !== 'none' && (
            <button
              onClick={handleRecovery}
              className={`
                mt-2 inline-flex items-center gap-1 text-sm font-medium
                ${config.textColor} hover:underline
              `}
            >
              <RefreshCw className="w-3 h-3" />
              {RECOVERY_LABELS[notification.recoveryAction]}
            </button>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className={`
            flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors
            ${config.textColor}
          `}
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Notification container component
 * Renders all active notifications in a fixed position
 */
export function NotificationContainer() {
  const { notifications } = useNotificationStore();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2"
      aria-live="polite"
      aria-label="Notifications"
    >
      {notifications.map((notification) => (
        <NotificationToast key={notification.id} notification={notification} />
      ))}
    </div>
  );
}

/**
 * Hook for using notifications
 */
export function useNotifications() {
  const store = useNotificationStore();

  return {
    showError: store.showError,
    showWarning: store.showWarning,
    showInfo: store.showInfo,
    showSuccess: store.showSuccess,
    addNotification: store.addNotification,
    removeNotification: store.removeNotification,
    clearAll: store.clearAll,
    notifications: store.notifications,
  };
}

/**
 * Helper to show notification from AppError
 */
export function showErrorNotification(error: {
  message: string;
  severity?: ErrorSeverity;
  code?: ErrorCode;
  getRecoveryAction?: () => RecoveryAction;
  getUserMessage?: () => string;
}) {
  const store = useNotificationStore.getState();

  return store.addNotification({
    message: error.getUserMessage?.() || error.message,
    severity: error.severity || 'error',
    code: error.code,
    recoveryAction: error.getRecoveryAction?.(),
  });
}

export default NotificationContainer;
