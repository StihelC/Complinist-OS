import { ChevronRight, Home } from 'lucide-react';
import { useNavigationHistoryStore, type NavigationPath } from '@/core/stores/useNavigationHistoryStore';

interface BreadcrumbNavigationProps {
  onNavigateToFamily?: (familyCode: string) => void;
  onNavigateToControl?: (controlId: string) => void;
  className?: string;
}

export function BreadcrumbNavigation({
  onNavigateToFamily,
  onNavigateToControl,
  className = '',
}: BreadcrumbNavigationProps) {
  const currentPath = useNavigationHistoryStore((state) => state.currentPath);
  const clearPath = useNavigationHistoryStore((state) => state.clearPath);
  const setCurrentPath = useNavigationHistoryStore((state) => state.setCurrentPath);

  if (currentPath.length === 0) {
    return null;
  }

  const handleHomeClick = () => {
    clearPath();
  };

  const handlePathClick = (index: number, item: NavigationPath) => {
    // Truncate path to this item
    const newPath = currentPath.slice(0, index + 1);
    setCurrentPath(newPath);

    if (item.type === 'family' && onNavigateToFamily) {
      onNavigateToFamily(item.id);
    } else if (item.type === 'control' && onNavigateToControl) {
      onNavigateToControl(item.id);
    }
  };

  return (
    <nav
      aria-label="Breadcrumb navigation"
      className={`flex items-center gap-1 text-sm ${className}`}
    >
      <button
        onClick={handleHomeClick}
        className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
        title="Back to all families"
      >
        <Home className="h-4 w-4" />
        <span className="hidden sm:inline">All Families</span>
      </button>

      {currentPath.map((item, index) => (
        <div key={`${item.type}-${item.id}`} className="flex items-center">
          <ChevronRight className="h-4 w-4 text-slate-400 mx-1" />
          {index === currentPath.length - 1 ? (
            // Current item (not clickable)
            <span
              className={`px-2 py-1 rounded font-medium ${
                item.type === 'control'
                  ? 'bg-slate-900 text-white text-xs'
                  : 'text-slate-900'
              }`}
            >
              {item.type === 'control' ? item.id : `${item.id} - ${item.name}`}
            </span>
          ) : (
            // Clickable path item
            <button
              onClick={() => handlePathClick(index, item)}
              className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
            >
              {item.type === 'control' ? item.id : `${item.id} - ${item.name}`}
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}
