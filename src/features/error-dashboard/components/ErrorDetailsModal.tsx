/**
 * Error Details Modal
 *
 * Displays detailed information about a selected error.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Info,
  XCircle,
  Copy,
  Server,
  Monitor,
  Clock,
  Code,
  Layers,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import type { ErrorRecord } from '@/core/stores/useErrorDashboardStore';

interface ErrorDetailsModalProps {
  error: ErrorRecord;
  onClose: () => void;
}

export function ErrorDetailsModal({ error, onClose }: ErrorDetailsModalProps) {
  const severityConfig = getSeverityConfig(error.severity);
  const SeverityIcon = severityConfig.icon;

  const handleCopyError = () => {
    const errorText = JSON.stringify(error, null, 2);
    navigator.clipboard.writeText(errorText);
  };

  const handleCopyStack = () => {
    if (error.stack) {
      navigator.clipboard.writeText(error.stack);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-lg shrink-0", severityConfig.bgColor)}>
              <SeverityIcon className={cn("w-5 h-5", severityConfig.textColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold break-words">
                {error.message}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className={severityConfig.badgeClass}
                >
                  {error.severity}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {error.category}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  {error.source === 'main' ? (
                    <Server className="w-3 h-3" />
                  ) : (
                    <Monitor className="w-3 h-3" />
                  )}
                  {error.source}
                </Badge>
                {error.code !== 0 && (
                  <Badge variant="outline">
                    Code: {error.code}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Timestamp */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>{formatFullTimestamp(error.timestamp)}</span>
          </div>

          {/* Component & Operation */}
          {(error.component || error.operation) && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Location
              </h4>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                {error.component && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Component:</span>
                    <code className="text-sm bg-white px-2 py-0.5 rounded border">
                      {error.component}
                    </code>
                  </div>
                )}
                {error.operation && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Operation:</span>
                    <code className="text-sm bg-white px-2 py-0.5 rounded border">
                      {error.operation}
                    </code>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stack Trace */}
          {error.stack && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Stack Trace
                </h4>
                <Button variant="ghost" size="sm" onClick={handleCopyStack}>
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto max-h-48">
                {error.stack}
              </pre>
            </div>
          )}

          {/* Metadata */}
          {error.metadata && Object.keys(error.metadata).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Code className="w-4 h-4" />
                Metadata
              </h4>
              <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-x-auto">
                {JSON.stringify(error.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="ghost" size="sm" onClick={handleCopyError}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Error Details
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
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

function formatFullTimestamp(timestamp: string): string {
  if (!timestamp) return 'Unknown';

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;

    return date.toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
}
