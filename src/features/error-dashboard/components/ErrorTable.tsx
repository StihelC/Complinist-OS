/**
 * Error Table
 *
 * Displays error records in a tabular format with sorting and selection.
 */

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  XCircle,
  Server,
  Monitor,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import type { ErrorRecord } from '@/core/stores/useErrorDashboardStore';

interface ErrorTableProps {
  errors: ErrorRecord[];
  onSelectError: (error: ErrorRecord) => void;
  isLoading?: boolean;
  compact?: boolean;
}

export function ErrorTable({ errors, onSelectError, isLoading, compact }: ErrorTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!errors || errors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <AlertCircle className="w-12 h-12 mb-4 text-gray-300" />
        <p className="text-lg font-medium">No errors found</p>
        <p className="text-sm">Adjust your filters or time range to see more results</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", compact && "max-h-80 overflow-y-auto")}>
      {errors.map((error, index) => (
        <ErrorRow
          key={error.id || index}
          error={error}
          onClick={() => onSelectError(error)}
          compact={compact}
        />
      ))}
    </div>
  );
}

interface ErrorRowProps {
  error: ErrorRecord;
  onClick: () => void;
  compact?: boolean;
}

function ErrorRow({ error, onClick, compact }: ErrorRowProps) {
  const severityConfig = getSeverityConfig(error.severity);
  const sourceIcon = error.source === 'main' ? Server : Monitor;
  const SourceIcon = sourceIcon;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border transition-colors hover:bg-gray-50 group",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Severity Icon */}
        <div className={cn("p-2 rounded-lg shrink-0", severityConfig.bgColor)}>
          <severityConfig.icon className={cn("w-4 h-4", severityConfig.textColor)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Message */}
            <span className={cn("font-medium text-gray-900 truncate", compact && "text-sm")}>
              {error.message}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Severity Badge */}
            <Badge
              variant="secondary"
              className={cn("text-xs", severityConfig.badgeClass)}
            >
              {error.severity}
            </Badge>

            {/* Category Badge */}
            <Badge variant="outline" className="text-xs capitalize">
              {error.category}
            </Badge>

            {/* Source Badge */}
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <SourceIcon className="w-3 h-3" />
              {error.source}
            </Badge>

            {/* Component */}
            {error.component && (
              <span className="text-xs text-gray-500">
                in <span className="font-medium">{error.component}</span>
              </span>
            )}

            {/* Timestamp */}
            <span className="text-xs text-gray-400 ml-auto">
              {formatTimestamp(error.timestamp)}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 shrink-0" />
      </div>
    </button>
  );
}

function getSeverityConfig(severity: string) {
  switch (severity) {
    case 'critical':
      return {
        icon: XCircle,
        textColor: 'text-red-600',
        bgColor: 'bg-red-100',
        badgeClass: 'bg-red-100 text-red-700 border-red-200',
      };
    case 'error':
      return {
        icon: AlertTriangle,
        textColor: 'text-orange-600',
        bgColor: 'bg-orange-100',
        badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
      };
    case 'warning':
      return {
        icon: AlertTriangle,
        textColor: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      };
    case 'info':
    default:
      return {
        icon: Info,
        textColor: 'text-blue-600',
        bgColor: 'bg-blue-100',
        badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
      };
  }
}

function formatTimestamp(timestamp: string): string {
  if (!timestamp) return '';

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}
