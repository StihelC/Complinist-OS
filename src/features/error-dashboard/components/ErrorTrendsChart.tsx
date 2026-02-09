/**
 * Error Trends Chart
 *
 * Displays error frequency over time using a simple bar/line visualization.
 */

import { Skeleton } from '@/components/ui/skeleton';
import type { TrendDataPoint } from '@/core/stores/useErrorDashboardStore';

interface ErrorTrendsChartProps {
  trends: TrendDataPoint[];
  isLoading: boolean;
  detailed?: boolean;
}

export function ErrorTrendsChart({ trends, isLoading, detailed = false }: ErrorTrendsChartProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {detailed ? (
          <div className="flex items-end gap-1 h-48">
            {[...Array(24)].map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1"
                style={{ height: `${Math.random() * 100 + 20}px` }}
              />
            ))}
          </div>
        ) : (
          <Skeleton className="h-32 w-full" />
        )}
      </div>
    );
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        No trend data available
      </div>
    );
  }

  const maxCount = Math.max(...trends.map((t) => t.count), 1);
  const chartHeight = detailed ? 256 : 128;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span>Critical</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-500" />
          <span>Error</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-500" />
          <span>Warning</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>Info</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <div
          className="flex items-end gap-1"
          style={{ height: chartHeight }}
        >
          {trends.map((point, index) => {
            const criticalHeight = (point.critical_count / maxCount) * chartHeight;
            const errorHeight = (point.error_count / maxCount) * chartHeight;
            const warningHeight = (point.warning_count / maxCount) * chartHeight;
            const infoHeight = (point.info_count / maxCount) * chartHeight;

            return (
              <div
                key={point.time_bucket || index}
                className="flex-1 flex flex-col-reverse group relative"
                style={{ height: chartHeight }}
              >
                {/* Stacked bars */}
                <div
                  className="w-full bg-red-500 rounded-t transition-all group-hover:opacity-80"
                  style={{ height: criticalHeight || 0 }}
                />
                <div
                  className="w-full bg-orange-500 transition-all group-hover:opacity-80"
                  style={{ height: errorHeight || 0 }}
                />
                <div
                  className="w-full bg-yellow-500 transition-all group-hover:opacity-80"
                  style={{ height: warningHeight || 0 }}
                />
                <div
                  className="w-full bg-blue-500 transition-all group-hover:opacity-80"
                  style={{ height: infoHeight || 0 }}
                />

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    <div className="font-medium">
                      {formatTimeBucket(point.time_bucket)}
                    </div>
                    <div>Total: {point.count}</div>
                    {point.critical_count > 0 && (
                      <div className="text-red-300">Critical: {point.critical_count}</div>
                    )}
                    {point.error_count > 0 && (
                      <div className="text-orange-300">Error: {point.error_count}</div>
                    )}
                    {point.warning_count > 0 && (
                      <div className="text-yellow-300">Warning: {point.warning_count}</div>
                    )}
                    {point.info_count > 0 && (
                      <div className="text-blue-300">Info: {point.info_count}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* X-axis labels (show every few items) */}
        {detailed && (
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            {trends
              .filter((_, i) => i % Math.ceil(trends.length / 6) === 0)
              .map((point, index) => (
                <span key={index}>{formatTimeBucket(point.time_bucket, true)}</span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeBucket(bucket: string, short = false): string {
  if (!bucket) return '';

  try {
    const date = new Date(bucket);
    if (isNaN(date.getTime())) return bucket;

    if (short) {
      // Short format for x-axis labels
      const hours = date.getHours();
      const minutes = date.getMinutes();
      if (hours === 0 && minutes === 0) {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
      return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }

    // Full format for tooltips
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return bucket;
  }
}
