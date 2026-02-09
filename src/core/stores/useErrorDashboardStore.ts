/**
 * Error Dashboard Store
 *
 * Zustand store for managing error dashboard state, including
 * error data, filters, statistics, and trends.
 */

import { create } from 'zustand';

// IPC result types for error dashboard operations
interface ErrorHistoryResult {
  success: boolean;
  errors?: ErrorRecord[];
  total?: number;
}

interface ErrorStatsResult {
  success: boolean;
  data?: {
    database?: ErrorStats;
  };
}

interface ErrorTrendsResult {
  success: boolean;
  data?: TrendDataPoint[];
}

interface ErrorClearResult {
  success: boolean;
}

interface ErrorExportResult {
  success: boolean;
  data?: unknown;
}

// Error record type from database
export interface ErrorRecord {
  id: number;
  timestamp: string;
  message: string;
  code: number;
  category: string;
  severity: string;
  source: string;
  component?: string;
  operation?: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}

// Trend data point
export interface TrendDataPoint {
  time_bucket: string;
  count: number;
  critical_count: number;
  error_count: number;
  warning_count: number;
  info_count: number;
}

// Aggregated stats from the backend
export interface ErrorStats {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  bySource: Record<string, number>;
  topComponents: Array<{ component: string; count: number }>;
  topOperations: Array<{ operation: string; count: number }>;
  recent: ErrorRecord[];
  lastHourCount: number;
  lastDayCount: number;
}

// Dashboard filter state
export interface ErrorFilters {
  category: string;
  severity: string;
  source: string;
  startDate: string | null;
  endDate: string | null;
  searchTerm: string;
}

// Time range presets
export type TimeRangePreset = 'last_hour' | 'last_24h' | 'last_7d' | 'last_30d' | 'custom';

interface ErrorDashboardState {
  // Data
  errors: ErrorRecord[];
  totalErrors: number;
  stats: ErrorStats | null;
  trends: TrendDataPoint[];

  // Loading states
  isLoading: boolean;
  isLoadingStats: boolean;
  isLoadingTrends: boolean;

  // Filters
  filters: ErrorFilters;
  timeRangePreset: TimeRangePreset;

  // Pagination
  currentPage: number;
  pageSize: number;

  // Selected error for details view
  selectedError: ErrorRecord | null;

  // Actions
  fetchErrors: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchTrends: (interval?: 'hour' | 'day' | 'month') => Promise<void>;
  setFilter: <K extends keyof ErrorFilters>(key: K, value: ErrorFilters[K]) => void;
  setFilters: (filters: Partial<ErrorFilters>) => void;
  setTimeRangePreset: (preset: TimeRangePreset) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  selectError: (error: ErrorRecord | null) => void;
  clearAllErrors: () => Promise<boolean>;
  exportErrors: () => Promise<{ success: boolean; data?: unknown }>;
  logError: (error: Partial<ErrorRecord>) => Promise<void>;
  resetFilters: () => void;
  refresh: () => Promise<void>;
}

const defaultFilters: ErrorFilters = {
  category: 'all',
  severity: 'all',
  source: 'all',
  startDate: null,
  endDate: null,
  searchTerm: '',
};

// Helper to get date range from preset
function getDateRangeFromPreset(preset: TimeRangePreset): { startDate: string | null; endDate: string | null } {
  const now = new Date();
  let startDate: Date | null = null;

  switch (preset) {
    case 'last_hour':
      startDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case 'last_24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'last_7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last_30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'custom':
      return { startDate: null, endDate: null };
  }

  return {
    startDate: startDate ? startDate.toISOString() : null,
    endDate: now.toISOString(),
  };
}

export const useErrorDashboardStore = create<ErrorDashboardState>((set, get) => ({
  // Initial state
  errors: [],
  totalErrors: 0,
  stats: null,
  trends: [],
  isLoading: false,
  isLoadingStats: false,
  isLoadingTrends: false,
  filters: { ...defaultFilters },
  timeRangePreset: 'last_24h',
  currentPage: 1,
  pageSize: 50,
  selectedError: null,

  // Fetch error history with current filters
  fetchErrors: async () => {
    const { filters, currentPage, pageSize, timeRangePreset } = get();

    set({ isLoading: true });

    try {
      const dateRange = getDateRangeFromPreset(timeRangePreset);
      const effectiveStartDate = filters.startDate || dateRange.startDate;
      const effectiveEndDate = filters.endDate || dateRange.endDate;

      const result = await window.electronAPI?.invoke('error-dashboard:get-history', {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        category: filters.category !== 'all' ? filters.category : undefined,
        severity: filters.severity !== 'all' ? filters.severity : undefined,
        source: filters.source !== 'all' ? filters.source : undefined,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        searchTerm: filters.searchTerm || undefined,
      }) as ErrorHistoryResult | undefined;

      if (result?.success) {
        set({
          errors: result.errors || [],
          totalErrors: result.total || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch errors:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // Fetch aggregated statistics
  fetchStats: async () => {
    const { timeRangePreset, filters } = get();

    set({ isLoadingStats: true });

    try {
      const dateRange = getDateRangeFromPreset(timeRangePreset);

      const result = await window.electronAPI?.invoke('error-dashboard:get-stats', {
        startDate: filters.startDate || dateRange.startDate,
        endDate: filters.endDate || dateRange.endDate,
      }) as ErrorStatsResult | undefined;

      if (result?.success && result.data?.database) {
        set({ stats: result.data.database });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      set({ isLoadingStats: false });
    }
  },

  // Fetch error trends
  fetchTrends: async (interval = 'hour') => {
    const { timeRangePreset, filters } = get();

    set({ isLoadingTrends: true });

    try {
      const dateRange = getDateRangeFromPreset(timeRangePreset);

      const result = await window.electronAPI?.invoke('error-dashboard:get-trends', {
        interval,
        startDate: filters.startDate || dateRange.startDate,
        endDate: filters.endDate || dateRange.endDate,
        category: filters.category !== 'all' ? filters.category : undefined,
        severity: filters.severity !== 'all' ? filters.severity : undefined,
      }) as ErrorTrendsResult | undefined;

      if (result?.success) {
        set({ trends: result.data || [] });
      }
    } catch (error) {
      console.error('Failed to fetch trends:', error);
    } finally {
      set({ isLoadingTrends: false });
    }
  },

  // Set a single filter value
  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
      currentPage: 1, // Reset to first page when filter changes
    }));
  },

  // Set multiple filters at once
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      currentPage: 1,
    }));
  },

  // Set time range preset
  setTimeRangePreset: (preset) => {
    const dateRange = getDateRangeFromPreset(preset);
    set({
      timeRangePreset: preset,
      filters: {
        ...get().filters,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
      currentPage: 1,
    });
  },

  // Set current page
  setCurrentPage: (page) => {
    set({ currentPage: page });
  },

  // Set page size
  setPageSize: (size) => {
    set({ pageSize: size, currentPage: 1 });
  },

  // Select an error for details view
  selectError: (error) => {
    set({ selectedError: error });
  },

  // Clear all errors
  clearAllErrors: async () => {
    try {
      const result = await window.electronAPI?.invoke('error-dashboard:clear') as ErrorClearResult | undefined;
      if (result?.success) {
        set({
          errors: [],
          totalErrors: 0,
          stats: null,
          trends: [],
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to clear errors:', error);
      return false;
    }
  },

  // Export errors
  exportErrors: async () => {
    try {
      const result = await window.electronAPI?.invoke('error-dashboard:export') as ErrorExportResult | undefined;
      return result || { success: false };
    } catch (error) {
      console.error('Failed to export errors:', error);
      return { success: false };
    }
  },

  // Log a new error
  logError: async (error) => {
    try {
      await window.electronAPI?.invoke('error-dashboard:log-error', {
        timestamp: new Date().toISOString(),
        message: error.message || 'Unknown error',
        code: error.code || 0,
        category: error.category || 'unknown',
        severity: error.severity || 'error',
        source: error.source || 'renderer',
        component: error.component,
        operation: error.operation,
        stack: error.stack,
        metadata: error.metadata,
      });
    } catch (err) {
      console.error('Failed to log error:', err);
    }
  },

  // Reset all filters to defaults
  resetFilters: () => {
    set({
      filters: { ...defaultFilters },
      timeRangePreset: 'last_24h',
      currentPage: 1,
    });
  },

  // Refresh all data
  refresh: async () => {
    const { fetchErrors, fetchStats, fetchTrends } = get();
    await Promise.all([fetchErrors(), fetchStats(), fetchTrends()]);
  },
}));

// Selectors for optimized re-renders
export const selectErrorDashboardFilters = (state: ErrorDashboardState) => state.filters;
export const selectErrorDashboardErrors = (state: ErrorDashboardState) => state.errors;
export const selectErrorDashboardStats = (state: ErrorDashboardState) => state.stats;
export const selectErrorDashboardTrends = (state: ErrorDashboardState) => state.trends;
export const selectErrorDashboardLoading = (state: ErrorDashboardState) => ({
  isLoading: state.isLoading,
  isLoadingStats: state.isLoadingStats,
  isLoadingTrends: state.isLoadingTrends,
});
