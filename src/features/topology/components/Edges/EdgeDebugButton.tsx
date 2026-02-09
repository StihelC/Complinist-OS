/**
 * Edge Debug Button Component
 *
 * Provides a button to toggle the edge debug overlay and handles
 * the keyboard shortcut (Ctrl/Cmd + Shift + E).
 *
 * This component can be placed in the topology toolbar or used standalone.
 */

import { useState, useEffect, useCallback, memo } from 'react';
import { Bug } from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { EdgeDebugOverlay } from './EdgeDebugOverlay';
import { EdgeQualityStatusBadge } from './EdgeQualityPanel';

// =============================================================================
// Types
// =============================================================================

interface EdgeDebugButtonProps {
  /** Optional class name */
  className?: string;
  /** Show as compact status badge instead of button */
  showAsBadge?: boolean;
  /** Whether to include the overlay in this component */
  includeOverlay?: boolean;
}

// =============================================================================
// Main Component
// =============================================================================

export const EdgeDebugButton = memo(({
  className,
  showAsBadge = false,
  includeOverlay = true,
}: EdgeDebugButtonProps) => {
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const edges = useFlowStore((state) => state.edges);

  // Handle keyboard shortcut (Ctrl/Cmd + Shift + E)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsDebugOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggle = useCallback(() => {
    setIsDebugOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsDebugOpen(false);
  }, []);

  // If no edges, don't show anything
  if (edges.length === 0) return null;

  // Show as badge mode
  if (showAsBadge) {
    return (
      <>
        <EdgeQualityStatusBadge onClick={handleToggle} className={className} />
        {includeOverlay && (
          <EdgeDebugOverlay isOpen={isDebugOpen} onClose={handleClose} />
        )}
      </>
    );
  }

  // Show as button mode
  return (
    <>
      <button
        className={cn(
          'topology-toolbar-button',
          isDebugOpen && 'active',
          className
        )}
        onClick={handleToggle}
        aria-label="Toggle edge debug overlay"
        title={`Edge Debug (${navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Shift+E)`}
        data-testid="edge-debug-button"
      >
        <Bug className="w-5 h-5" />
      </button>
      {includeOverlay && (
        <EdgeDebugOverlay isOpen={isDebugOpen} onClose={handleClose} />
      )}
    </>
  );
});

EdgeDebugButton.displayName = 'EdgeDebugButton';

// =============================================================================
// Wrapper for ViewRouter Integration
// =============================================================================

/**
 * EdgeDebugWrapper - Standalone component for ViewRouter integration
 *
 * This component only renders the overlay and handles keyboard shortcuts.
 * It doesn't show a button - the overlay is toggled via keyboard shortcut
 * or programmatically.
 */
export const EdgeDebugWrapper = memo(() => {
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const edges = useFlowStore((state) => state.edges);

  // Handle keyboard shortcut (Ctrl/Cmd + Shift + E)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        // Only toggle if we have edges
        if (edges.length > 0) {
          setIsDebugOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [edges.length]);

  const handleClose = useCallback(() => {
    setIsDebugOpen(false);
  }, []);

  // Don't render overlay if no edges
  if (edges.length === 0) return null;

  return <EdgeDebugOverlay isOpen={isDebugOpen} onClose={handleClose} />;
});

EdgeDebugWrapper.displayName = 'EdgeDebugWrapper';

export default EdgeDebugButton;
