/**
 * Error Dashboard
 *
 * A comprehensive error monitoring dashboard that aggregates errors from all
 * layers of the application (renderer, main process, IPC, AI services, database).
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  RefreshCw,
  Download,
  Trash2,
  Search,
  Filter,
  TrendingUp,
  Server,
  Monitor,
  Database,
  Cpu,
  Zap,
  BarChart3,
} from 'lucide-react';
import { useErrorDashboardStore } from '@/core/stores/useErrorDashboardStore';
import { ErrorStatsCards } from './ErrorStatsCards';
import { ErrorTrendsChart } from './ErrorTrendsChart';
import { ErrorTable } from './ErrorTable';
import { ErrorFiltersPanel } from './ErrorFiltersPanel';
import { ErrorDetailsModal } from './ErrorDetailsModal';
import { cn } from '@/lib/utils/utils';

export function ErrorDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showFilters, setShowFilters] = useState(false);

  const {
    errors,
    totalErrors,
    stats,
    trends,
    isLoading,
    isLoadingStats,
    isLoadingTrends,
    filters,
    timeRangePreset,
    currentPage,
    pageSize,
    selectedError,
    fetchErrors,
    fetchStats,
    fetchTrends,
    setFilter,
    setTimeRangePreset,
    setCurrentPage,
    selectError,
    clearAllErrors,
    exportErrors,
    resetFilters,
    refresh,
  } = useErrorDashboardStore();

  // Initial data fetch
  useEffect(() => {
    refresh();
  }, []);

  // Refetch when filters or time range change
  useEffect(() => {
    fetchErrors();
    fetchStats();
    fetchTrends(timeRangePreset === 'last_hour' ? 'hour' : timeRangePreset === 'last_24h' ? 'hour' : 'day');
  }, [filters, timeRangePreset, currentPage]);

  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const handleExport = useCallback(async () => {
    const result = await exportErrors();
    if (result.success && result.data) {
      // Create download
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error-log-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [exportErrors]);

  const handleClearAll = useCallback(async () => {
    if (confirm('Are you sure you want to clear all error logs? This action cannot be undone.')) {
      await clearAllErrors();
    }
  }, [clearAllErrors]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter('searchTerm', e.target.value);
  }, [setFilter]);

  const totalPages = Math.ceil(totalErrors / pageSize);

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Error Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor and analyze errors across all application layers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isLoadingStats}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", (isLoading || isLoadingStats) && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearAll} className="text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="px-6 py-3 bg-white border-b flex items-center gap-4">
        <span className="text-sm text-gray-500">Time Range:</span>
        <div className="flex gap-1">
          {[
            { value: 'last_hour', label: 'Last Hour' },
            { value: 'last_24h', label: 'Last 24h' },
            { value: 'last_7d', label: 'Last 7 Days' },
            { value: 'last_30d', label: 'Last 30 Days' },
          ].map((preset) => (
            <Button
              key={preset.value}
              variant={timeRangePreset === preset.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRangePreset(preset.value as typeof timeRangePreset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search errors..."
            value={filters.searchTerm}
            onChange={handleSearch}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? 'bg-gray-100' : ''}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <ErrorFiltersPanel
          filters={filters}
          onFilterChange={setFilter}
          onReset={resetFilters}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="errors">
              <AlertCircle className="w-4 h-4 mr-2" />
              Error Log ({totalErrors})
            </TabsTrigger>
            <TabsTrigger value="trends">
              <TrendingUp className="w-4 h-4 mr-2" />
              Trends
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 overflow-auto">
            {/* Stats Cards */}
            <ErrorStatsCards stats={stats} isLoading={isLoadingStats} />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Error Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Error Trends</CardTitle>
                  <CardDescription>Error frequency over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ErrorTrendsChart trends={trends} isLoading={isLoadingTrends} />
                </CardContent>
              </Card>

              {/* Category Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">By Category</CardTitle>
                  <CardDescription>Error distribution by component</CardDescription>
                </CardHeader>
                <CardContent>
                  <CategoryBreakdown stats={stats} />
                </CardContent>
              </Card>
            </div>

            {/* Recent Errors */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Recent Errors</CardTitle>
                <CardDescription>Most recent error occurrences</CardDescription>
              </CardHeader>
              <CardContent>
                <ErrorTable
                  errors={stats?.recent || []}
                  onSelectError={selectError}
                  compact
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="flex-1 overflow-auto">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Error Log</CardTitle>
                    <CardDescription>
                      Showing {errors.length} of {totalErrors} errors
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      Page {currentPage} of {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                <ErrorTable
                  errors={errors}
                  onSelectError={selectError}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="flex-1 overflow-auto">
            <div className="grid grid-cols-1 gap-6">
              {/* Full Width Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Error Frequency Over Time</CardTitle>
                  <CardDescription>Detailed view of error patterns</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ErrorTrendsChart trends={trends} isLoading={isLoadingTrends} detailed />
                </CardContent>
              </Card>

              {/* Top Components */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top Components</CardTitle>
                    <CardDescription>Components with most errors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TopItemsList items={stats?.topComponents || []} type="component" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top Operations</CardTitle>
                    <CardDescription>Operations with most errors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TopItemsList items={stats?.topOperations || []} type="operation" />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Error Details Modal */}
      {selectedError && (
        <ErrorDetailsModal
          error={selectedError}
          onClose={() => selectError(null)}
        />
      )}
    </div>
  );
}

// Category breakdown component
function CategoryBreakdown({ stats }: { stats: ReturnType<typeof useErrorDashboardStore.getState>['stats'] }) {
  if (!stats?.byCategory) {
    return (
      <div className="text-center text-gray-500 py-8">
        No category data available
      </div>
    );
  }

  const categories = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]);
  const total = categories.reduce((sum, [, count]) => sum + count, 0);

  const categoryIcons: Record<string, React.ReactNode> = {
    database: <Database className="w-4 h-4" />,
    network: <Zap className="w-4 h-4" />,
    ipc: <Server className="w-4 h-4" />,
    ai: <Cpu className="w-4 h-4" />,
    render: <Monitor className="w-4 h-4" />,
    unknown: <AlertCircle className="w-4 h-4" />,
  };

  const categoryColors: Record<string, string> = {
    database: 'bg-blue-500',
    network: 'bg-yellow-500',
    ipc: 'bg-purple-500',
    ai: 'bg-green-500',
    render: 'bg-orange-500',
    file: 'bg-cyan-500',
    validation: 'bg-pink-500',
    auth: 'bg-red-500',
    export: 'bg-indigo-500',
    import: 'bg-teal-500',
    unknown: 'bg-gray-500',
  };

  return (
    <div className="space-y-3">
      {categories.map(([category, count]) => {
        const percentage = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={category} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
              {categoryIcons[category] || <AlertCircle className="w-4 h-4" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium capitalize">{category}</span>
                <span className="text-sm text-gray-500">{count}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", categoryColors[category] || 'bg-gray-400')}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Top items list component
function TopItemsList({
  items,
  type,
}: {
  items: Array<{ component?: string; operation?: string; count: number }>;
  type: 'component' | 'operation';
}) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No {type} data available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const name = type === 'component' ? item.component : item.operation;
        return (
          <div
            key={name || index}
            className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-400">#{index + 1}</span>
              <span className="text-sm font-medium truncate max-w-[200px]">
                {name || 'Unknown'}
              </span>
            </div>
            <Badge variant="secondary">{item.count}</Badge>
          </div>
        );
      })}
    </div>
  );
}

export default ErrorDashboard;
