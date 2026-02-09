import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { Camera, X } from 'lucide-react';

interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionData {
  bounds: SelectionBounds;
  previewImage: string;
}

interface ExportSelectionOverlayProps {
  onCapture: (data: SelectionData) => void;
}

export const ExportSelectionOverlay = ({ onCapture }: ExportSelectionOverlayProps) => {
  const { cancelExportSelection, setExportSelectionBounds } = useFlowStore();
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<SelectionData | null>(null);
  const [isCapturingPreview, setIsCapturingPreview] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Calculate selection rectangle from start and current positions
  const getSelectionBounds = useCallback((start: { x: number; y: number }, current: { x: number; y: number }): SelectionBounds => {
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);
    return { x, y, width, height };
  }, []);

  // Capture preview image from the selected area
  const capturePreviewImage = useCallback(async (bounds: SelectionBounds): Promise<string> => {
    if (!overlayRef.current) throw new Error('Overlay ref not available');
    
    // Get the React Flow container
    const flowContainer = document.querySelector('.react-flow') as HTMLElement;
    if (!flowContainer) throw new Error('Flow container not found');

    // Get overlay position to calculate absolute coordinates
    const overlayRect = overlayRef.current.getBoundingClientRect();
    // const flowRect = flowContainer.getBoundingClientRect(); // Unused - kept for potential future use
    
    // Calculate the absolute position within the flow container
    // const _absoluteX = bounds.x + overlayRect.left - flowRect.left; // Unused - kept for potential future use
    // const _absoluteY = bounds.y + overlayRect.top - flowRect.top; // Unused - kept for potential future use

    // Create a canvas to draw the preview
    const canvas = document.createElement('canvas');
    const scale = 0.4; // 40% scale for preview thumbnail
    canvas.width = bounds.width * scale;
    canvas.height = bounds.height * scale;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Could not get canvas context');

    // Use html2canvas-like approach: we'll use Electron's capture API
    // For now, create a placeholder with the flow container background
    try {
      // Call Electron API to capture just the selection area
      const captureBounds = {
        x: Math.floor(overlayRect.left + bounds.x),
        y: Math.floor(overlayRect.top + bounds.y),
        width: Math.floor(bounds.width),
        height: Math.floor(bounds.height),
      };

      console.log('[Preview] Capturing with bounds:', captureBounds);
      const result = await window.electronAPI.captureViewport(captureBounds);
      console.log('[Preview] Capture result:', result);
      
      if (result.success && result.imageData) {
        // Scale down the captured image for preview
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = (err) => {
            console.error('[Preview] Image load error:', err);
            // Fallback on image load error
            ctx.fillStyle = '#f3f4f6';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#9333ea';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Preview Unavailable', canvas.width / 2, canvas.height / 2);
            resolve(canvas.toDataURL('image/png'));
          };
          img.src = result.imageData;
        });
      } else {
        console.error('[Preview] Capture failed:', result.error);
        throw new Error(result.error || 'Failed to capture preview');
      }
    } catch (error) {
      console.error('Error capturing preview:', error);
      // Fallback: create a simple placeholder
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#9333ea';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Preview', canvas.width / 2, canvas.height / 2);
      return canvas.toDataURL('image/png');
    }
  }, []);

  // Handle mouse down - start drawing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!overlayRef.current) return;
    
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentPos({ x, y });
    setSelection(null);
  }, []);

  // Handle mouse move - update selection
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !startPos || !overlayRef.current) return;
    
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCurrentPos({ x, y });
  }, [isDrawing, startPos]);

  // Handle mouse up - finalize selection
  const handleMouseUp = useCallback(async () => {
    if (!isDrawing || !startPos || !currentPos) return;
    
    const bounds = getSelectionBounds(startPos, currentPos);
    
    // Only set selection if it's large enough (at least 50x50)
    if (bounds.width >= 50 && bounds.height >= 50) {
      setIsDrawing(false);
      setIsCapturingPreview(true);
      
      try {
        // Capture preview image
        const previewImage = await capturePreviewImage(bounds);
        setSelection({ bounds, previewImage });
        setExportSelectionBounds(bounds);
      } catch (error) {
        console.error('Failed to capture preview:', error);
        // Still set selection without preview
        setSelection({ bounds, previewImage: '' });
        setExportSelectionBounds(bounds);
      } finally {
        setIsCapturingPreview(false);
      }
    } else {
      setIsDrawing(false);
    }
  }, [isDrawing, startPos, currentPos, getSelectionBounds, setExportSelectionBounds, capturePreviewImage]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelExportSelection();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelExportSelection]);

  // Get current selection bounds for display
  const displayBounds = isDrawing && startPos && currentPos
    ? getSelectionBounds(startPos, currentPos)
    : selection?.bounds;

  // Handle capture button click
  const handleCapture = () => {
    if (selection && overlayRef.current) {
      // Convert overlay-relative coordinates to screen coordinates
      const overlayRect = overlayRef.current.getBoundingClientRect();
      const screenBounds = {
        x: overlayRect.left + selection.bounds.x,
        y: overlayRect.top + selection.bounds.y,
        width: selection.bounds.width,
        height: selection.bounds.height,
      };
      onCapture({
        bounds: screenBounds,
        previewImage: selection.previewImage,
      });
    }
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-[9999]"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        cursor: selection ? 'default' : 'crosshair',
      }}
    >
      {/* Interactive drawing area */}
      <div
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: selection ? 'default' : 'crosshair',
        }}
      />

      {/* Instructions */}
      {!selection && !isDrawing && !isCapturingPreview && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <Camera className="w-16 h-16 text-white mx-auto mb-4 opacity-80" />
          <p className="text-white text-xl font-semibold mb-2">Select Capture Area</p>
          <p className="text-white/80 text-sm">Click and drag to select the region to export</p>
          <p className="text-white/60 text-xs mt-2">Press ESC to cancel</p>
        </div>
      )}

      {/* Capturing preview indicator */}
      {isCapturingPreview && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <Camera className="w-16 h-16 text-white mx-auto mb-4 opacity-80 animate-pulse" />
          <p className="text-white text-xl font-semibold mb-2">Generating Preview...</p>
        </div>
      )}

      {/* Selection Rectangle */}
      {displayBounds && displayBounds.width > 0 && displayBounds.height > 0 && (
        <>
          {/* Clear area inside selection */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: displayBounds.x,
              top: displayBounds.y,
              width: displayBounds.width,
              height: displayBounds.height,
              backgroundColor: 'transparent',
              border: '2px dashed #9333ea',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            }}
          />
          
          {/* Dimension label */}
          <div
            className="absolute pointer-events-none bg-purple-600 text-white px-3 py-1.5 rounded-md text-sm font-semibold shadow-lg"
            style={{
              left: displayBounds.x + displayBounds.width / 2,
              top: displayBounds.y - 40,
              transform: 'translateX(-50%)',
            }}
          >
            {Math.round(displayBounds.width)} × {Math.round(displayBounds.height)}
          </div>
        </>
      )}

      {/* Action Buttons */}
      <div className="absolute top-4 right-4 flex gap-2 pointer-events-auto">
        <Button
          onClick={cancelExportSelection}
          variant="outline"
          className="bg-white hover:bg-gray-100 shadow-lg"
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        
        {selection && (
          <Button
            onClick={handleCapture}
            className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
          >
            <Camera className="w-4 h-4 mr-2" />
            Capture
          </Button>
        )}
      </div>
    </div>
  );
};

