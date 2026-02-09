import { useLoading, LoadingOperationType } from '@/core/context/LoadingContext';
import { Progress } from './ui/progress';

// Operation type to message mapping for user-friendly messages
const operationMessages: Record<LoadingOperationType, string> = {
  save: 'Saving...',
  export: 'Exporting...',
  import: 'Importing...',
  load: 'Loading...',
  generate: 'Generating...',
  ai: 'Processing AI request...',
  delete: 'Deleting...',
  fetch: 'Fetching data...',
  custom: 'Processing...',
};

export function GlobalLoadingIndicator() {
  const { operations, currentOperation } = useLoading();

  if (!currentOperation) return null;

  const message = currentOperation.message || operationMessages[currentOperation.type];
  const hasProgress = currentOperation.progress !== undefined;

  return (
    <div className="fixed top-16 right-4 z-[9999] animate-slide-in-from-top">
      <div className="bg-card rounded-lg shadow-lg border px-4 py-3 min-w-[200px] space-y-2">
        <div className="flex items-center gap-3">
          <div className="relative w-5 h-5">
            <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <span className="text-sm font-medium text-foreground">{message}</span>
        </div>

        {hasProgress && (
          <Progress
            value={currentOperation.progress}
            size="sm"
            className="w-full"
          />
        )}

        {/* Show count if multiple operations */}
        {operations.length > 1 && (
          <p className="text-xs text-muted-foreground">
            {operations.length} operations in progress
          </p>
        )}
      </div>
    </div>
  );
}

// Simpler inline version for specific areas
export function InlineLoadingIndicator({
  message = 'Loading...',
  className = ''
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
      <div className="relative w-4 h-4">
        <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <span>{message}</span>
    </div>
  );
}
