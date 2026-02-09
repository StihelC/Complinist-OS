import { useState } from 'react';
import { Clock, ChevronDown, ChevronUp, X, Trash2 } from 'lucide-react';
import {
  useNavigationHistoryStore,
  type RecentlyEditedControl,
  getFamilyFromControlId,
} from '@/core/stores/useNavigationHistoryStore';
import { Badge } from '@/components/ui/badge';

interface RecentlyEditedPanelProps {
  onNavigateToControl: (controlId: string, familyCode: string) => void;
  className?: string;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getStatusVariant(status?: string): 'default' | 'success' | 'warning' | 'secondary' {
  switch (status) {
    case 'Implemented':
      return 'success';
    case 'Partially Implemented':
    case 'Planned':
      return 'warning';
    case 'Not Applicable':
      return 'secondary';
    default:
      return 'default';
  }
}

export function RecentlyEditedPanel({
  onNavigateToControl,
  className = '',
}: RecentlyEditedPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const recentlyEdited = useNavigationHistoryStore((state) => state.recentlyEdited);
  const removeFromRecent = useNavigationHistoryStore((state) => state.removeFromRecent);
  const clearRecentHistory = useNavigationHistoryStore((state) => state.clearRecentHistory);
  const navigateToControl = useNavigationHistoryStore((state) => state.navigateToControl);

  if (recentlyEdited.length === 0) {
    return null;
  }

  const handleControlClick = (control: RecentlyEditedControl) => {
    const familyCode = getFamilyFromControlId(control.controlId);
    navigateToControl(control.controlId, control.title, familyCode, control.family);
    onNavigateToControl(control.controlId, familyCode);
  };

  const handleRemove = (e: React.MouseEvent, controlId: string) => {
    e.stopPropagation();
    removeFromRecent(controlId);
  };

  // Group controls by family
  const groupedByFamily = recentlyEdited.reduce((acc, control) => {
    const family = control.family || getFamilyFromControlId(control.controlId);
    if (!acc[family]) {
      acc[family] = [];
    }
    acc[family].push(control);
    return acc;
  }, {} as Record<string, RecentlyEditedControl[]>);

  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 rounded-t-lg transition-colors">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <Clock className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Recently Edited</span>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {recentlyEdited.length}
          </span>
        </button>
        <div className="flex items-center gap-2">
          {isExpanded && recentlyEdited.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearRecentHistory();
              }}
              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              title="Clear all recent history"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100 max-h-80 overflow-y-auto">
          {Object.entries(groupedByFamily).map(([family, controls]) => (
            <div key={family} className="border-b border-slate-50 last:border-b-0">
              <div className="px-4 py-2 bg-slate-50">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {family}
                </span>
              </div>
              <ul className="divide-y divide-slate-50">
                {controls.map((control) => (
                  <li key={control.controlId} className="flex items-center hover:bg-blue-50 transition-colors group">
                    <button
                      onClick={() => handleControlClick(control)}
                      className="flex-1 flex items-center px-4 py-2 text-left min-w-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-900">
                            {control.controlId}
                          </span>
                          {control.implementationStatus && (
                            <Badge
                              variant={getStatusVariant(control.implementationStatus)}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {control.implementationStatus}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {control.title}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap ml-2">
                        {formatRelativeTime(control.editedAt)}
                      </span>
                    </button>
                    <button
                      onClick={(e) => handleRemove(e, control.controlId)}
                      className="p-1 mr-2 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                      title="Remove from recent"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
