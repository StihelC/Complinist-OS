import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/utils';

export interface TidyResult {
  success: boolean;
  nodesBefore: number;
  nodesAfter: number;
  collisionsBefore: number;
  collisionsResolved: number;
  qualityScore: number; // 0-100
  duration: number; // milliseconds
  timestamp: number;
  error?: string;
}

export type TidyStatus = 'idle' | 'loading' | 'success' | 'warning' | 'error';

export interface TidyStatusIndicatorProps {
  result?: TidyResult | null;
  status?: TidyStatus;
  className?: string;
}

export const TidyStatusIndicator = ({
  result,
  status: overrideStatus,
  className,
}: TidyStatusIndicatorProps) => {
  // Determine status from result if not overridden
  const status: TidyStatus = overrideStatus || (result
    ? result.error
      ? 'error'
      : result.qualityScore < 50
        ? 'warning'
        : 'success'
    : 'idle');

  if (status === 'idle' && !result) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    if (status === 'loading') return 'Tidying diagram...';

    if (!result) return '';

    if (result.error) return `Error: ${result.error}`;

    if (result.collisionsResolved > 0) {
      return `Tidied - ${result.collisionsResolved} overlap${result.collisionsResolved !== 1 ? 's' : ''} resolved`;
    }

    return 'Diagram tidied';
  };

  const getQualityLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  const statusBgColors = {
    idle: 'bg-gray-50 border-gray-200',
    loading: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    error: 'bg-red-50 border-red-200',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm animate-in fade-in slide-in-from-top-2 duration-200',
        statusBgColors[status],
        className
      )}
      role="status"
      aria-live="polite"
      data-testid="tidy-status-indicator"
    >
      {getStatusIcon()}
      <div className="flex flex-col">
        <span className="text-xs font-medium">{getStatusText()}</span>
        {result && result.success && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Quality: {getQualityLabel(result.qualityScore)} ({result.qualityScore})</span>
            <span className="text-gray-300">|</span>
            <span>
              {result.duration < 1000
                ? `${Math.round(result.duration)}ms`
                : `${(result.duration / 1000).toFixed(1)}s`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Inline status badge for showing in toolbars or compact spaces
 */
export interface TidyStatusBadgeProps {
  status: TidyStatus;
  collisionCount?: number;
  className?: string;
}

export const TidyStatusBadge = ({
  status,
  collisionCount = 0,
  className,
}: TidyStatusBadgeProps) => {
  if (status === 'idle' && collisionCount === 0) return null;

  const badgeColors = {
    idle: collisionCount > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700',
    loading: 'bg-blue-100 text-blue-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
  };

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-3 h-3" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3" />;
      case 'error':
        return <XCircle className="w-3 h-3" />;
      default:
        return collisionCount > 0 ? <AlertTriangle className="w-3 h-3" /> : null;
    }
  };

  const getText = () => {
    switch (status) {
      case 'loading':
        return 'Tidying...';
      case 'success':
        return 'Tidied';
      case 'warning':
        return 'Needs attention';
      case 'error':
        return 'Failed';
      default:
        return collisionCount > 0 ? `${collisionCount} overlaps` : '';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        badgeColors[status],
        className
      )}
      data-testid="tidy-status-badge"
    >
      {getIcon()}
      {getText()}
    </span>
  );
};
