import { useReactFlow } from '@xyflow/react';
import { Target, ZoomIn, ZoomOut, Lock, Unlock } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils/utils';

export const ZoomControlToolbar = () => {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const [isLocked, setIsLocked] = useState(false);

  const handleRecenter = () => {
    fitView({
      padding: 0.2,
      duration: 500,
    });
  };

  const handleZoomIn = () => {
    zoomIn({ duration: 200 });
  };

  const handleZoomOut = () => {
    zoomOut({ duration: 200 });
  };

  const toggleLock = () => {
    setIsLocked(!isLocked);
  };

  return (
    <div className="topology-toolbar topology-toolbar-bottom-left">
      <div className="topology-toolbar-group">
        <button
          onClick={handleZoomIn}
          className="topology-toolbar-button"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="topology-toolbar-button"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleRecenter}
          className="topology-toolbar-button"
          title="Fit view to all nodes"
          aria-label="Fit view to all nodes"
        >
          <Target className="w-4 h-4" />
        </button>
        <button
          onClick={toggleLock}
          className={cn('topology-toolbar-button', isLocked && 'active')}
          title={isLocked ? 'Unlock canvas' : 'Lock canvas position'}
          aria-label={isLocked ? 'Unlock canvas' : 'Lock canvas position'}
        >
          {isLocked ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Unlock className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};

// Keep old export for backward compatibility
export const RecenterButton = ZoomControlToolbar;
































