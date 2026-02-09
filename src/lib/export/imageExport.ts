import type { Node, Rect, ReactFlowInstance } from '@xyflow/react';
import { calculateContentBounds, calculateRequiredPadding, verifyContentInViewport } from './viewportCalculator';
import { hideUIElements } from './uiHider';
import { clearSelections } from './selectionHandler';

/**
 * Export the React Flow diagram as PNG using Electron's native capture API
 * 
 * This uses Electron's webContents.capturePage() to capture the rendered viewport
 * directly, avoiding all the complexity and errors of DOM cloning and image reloading.
 */
export async function exportDiagramAsPNG(
  projectName: string,
  nodes: Node[],
  getNodesBounds: (nodes: Node[]) => Rect,
  reactFlowInstance?: ReactFlowInstance,
  clearSelection?: () => void,
  bounds?: { x: number; y: number; width: number; height: number },
  setSelectedNodeId?: (id: string | null) => void,
  setSelectedEdgeId?: (id: string | null) => void
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  if (!window.electronAPI) {
    return { success: false, error: 'Electron API not available' };
  }

  if (!nodes || nodes.length === 0) {
    return { success: false, error: 'No nodes to export' };
  }

  try {
    console.log('[PNG Export] Starting PNG export...', bounds ? `with custom bounds: ${JSON.stringify(bounds)}` : 'for all nodes');
    
    // Clear any selections before capture
    if (clearSelection) {
      clearSelection();
    }
    if (setSelectedNodeId && setSelectedEdgeId) {
      clearSelections(setSelectedNodeId, setSelectedEdgeId);
    }
    
    // Wait for selection to clear
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Get the React Flow container and background element
    const flowContainer = document.querySelector('.react-flow') as HTMLElement;
    const backgroundElement = document.querySelector('.react-flow__background') as HTMLElement;
    
    if (!flowContainer) {
      throw new Error('React Flow container not found');
    }

    // Store original background settings
    const originalBackgroundColor = flowContainer.style.backgroundColor;
    const originalBackgroundPattern = backgroundElement?.style.display;
    
    // Set white background for export
    console.log('[PNG Export] Setting white background...');
    flowContainer.style.backgroundColor = '#ffffff';
    if (backgroundElement) {
      backgroundElement.style.display = 'none'; // Hide the pattern/grid
    }
    
    // If custom bounds provided (selection mode), skip fitView - use current viewport
    if (bounds) {
      console.log('[PNG Export] Using custom selection bounds, skipping fitView');
      await new Promise(resolve => setTimeout(resolve, 200));
    } else {
      // Center the view - fit all nodes with padding
      console.log('[PNG Export] Centering view with fitView...');
      if (reactFlowInstance && reactFlowInstance.fitView) {
      // First reset any zoom/pan
      if (reactFlowInstance.setViewport) {
        reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Fit view with generous padding to ensure all boundary labels are visible
      // Use 0.35 (35%) padding to ensure labels outside boundaries are captured
      reactFlowInstance.fitView({ 
        padding: 0.35, // Extra padding for boundary labels that extend outside
        includeHiddenNodes: false,
        duration: 0, // No animation
        maxZoom: 0.8, // Zoom out slightly to ensure nothing is cut off
        minZoom: 0.05  // Allow zooming out for large diagrams
      });
      
      console.log('[PNG Export] FitView applied, waiting for render...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Apply fitView again to ensure it's centered (sometimes first call doesn't work)
      reactFlowInstance.fitView({ 
        padding: 0.35, // Generous padding for all labels
        includeHiddenNodes: false,
        duration: 0,
        maxZoom: 0.8, // Zoom out to fit everything
        minZoom: 0.05
      });
      }
      
      // Wait for view to settle completely after fitView
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    // Skip all the complex bounds calculation if using custom selection bounds
    if (!bounds) {
      // Calculate the bounds of all nodes AND boundary labels
      console.log('[PNG Export] Calculating actual content bounds including labels...');
      
      const containerRect = flowContainer.getBoundingClientRect();
      const actualContentBounds = calculateContentBounds(flowContainer, nodes);
      
      console.log('[PNG Export] Actual content bounds (including labels):', actualContentBounds);
      
      // Calculate required padding
      const finalPadding = calculateRequiredPadding(
        actualContentBounds,
        containerRect.width,
        containerRect.height
      );
      
      console.log('[PNG Export] Calculated padding:', finalPadding, '(' + (finalPadding * 100).toFixed(1) + '%)');
      
      // Always apply the calculated padding to ensure all content fits
      if (reactFlowInstance && reactFlowInstance.fitView) {
        console.log('[PNG Export] Applying padding:', finalPadding);
        reactFlowInstance.fitView({ 
          padding: finalPadding,
          includeHiddenNodes: false,
          duration: 0,
          maxZoom: 1.5,
          minZoom: 0.01
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Verification step: Re-measure content bounds to ensure everything fits after fitView
      console.log('[PNG Export] Verifying all content is visible after fitView...');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const { allVisible, extensions } = verifyContentInViewport(flowContainer);
      
      if (!allVisible) {
        console.log('[PNG Export] ⚠️  Content still outside viewport, applying corrective padding...', extensions);
        
        const updatedContainerRect = flowContainer.getBoundingClientRect();
        const verifyContentBounds = calculateContentBounds(flowContainer, nodes);
        const correctivePadding = calculateRequiredPadding(
          verifyContentBounds,
          updatedContainerRect.width,
          updatedContainerRect.height
        ) * 1.2; // Add 20% safety buffer
        const finalCorrectivePadding = Math.min(0.7, Math.max(0.25, correctivePadding));
        
        console.log('[PNG Export] Applying corrective padding:', finalCorrectivePadding);
        
        if (reactFlowInstance && reactFlowInstance.fitView) {
          reactFlowInstance.fitView({ 
            padding: finalCorrectivePadding,
            includeHiddenNodes: false,
            duration: 0,
            maxZoom: 1.5,
            minZoom: 0.01
          });
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        console.log('[PNG Export] ✓ All content verified to be within viewport');
      }
      
      // Calculate the bounds of all nodes for final check
      const nodesBounds: Rect = getNodesBounds(nodes);
      console.log('[PNG Export] Final nodes bounds:', nodesBounds);
    }

    // Hide UI elements - target ALL UI panels and controls
    console.log('[PNG Export] Hiding UI elements...');
    const restoreUI = hideUIElements(flowContainer);
    console.log('[PNG Export] UI elements hidden');
    
    // Wait for UI to hide completely and render to settle
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get the bounding rectangle of the flow container in screen coordinates
    const rect = flowContainer.getBoundingClientRect();
    
    console.log('[PNG Export] Flow container rect:', rect);
    
    let captureBounds;
    
    if (bounds && reactFlowInstance) {
      // Use provided selection bounds (in screen coordinates from overlay)
      console.log('[PNG Export] Using selection bounds:', bounds);
      
      // The bounds are already in screen coordinates from the overlay
      // Just ensure they're within the container
      captureBounds = {
        x: Math.max(0, Math.floor(bounds.x)),
        y: Math.max(0, Math.floor(bounds.y)),
        width: Math.floor(bounds.width),
        height: Math.floor(bounds.height)
      };
    } else {
      // Electron's capturePage uses bounds relative to the window
      captureBounds = {
        x: Math.max(0, Math.floor(rect.left)),
        y: Math.max(0, Math.floor(rect.top)),
        width: Math.floor(rect.width),
        height: Math.floor(rect.height)
      };
    }
    
    // Validate bounds
    if (captureBounds.width <= 0 || captureBounds.height <= 0) {
      // Restore everything before throwing
      flowContainer.style.backgroundColor = originalBackgroundColor;
      if (backgroundElement) {
        backgroundElement.style.display = originalBackgroundPattern || '';
      }
      restoreUI();
      throw new Error(`Invalid capture dimensions: ${captureBounds.width}x${captureBounds.height}`);
    }

    // Use Electron's native capture to get the viewport image (high quality)
    console.log('[PNG Export] Capturing viewport with bounds:', captureBounds);
    let captureResult;
    try {
      captureResult = await window.electronAPI.captureViewport(captureBounds);
      console.log('[PNG Export] Capture result:', captureResult);
    } finally {
      // Always restore everything
      console.log('[PNG Export] Restoring UI elements and background...');
      flowContainer.style.backgroundColor = originalBackgroundColor;
      if (backgroundElement) {
        backgroundElement.style.display = originalBackgroundPattern || '';
      }
      restoreUI();
    }
    
    if (!captureResult.success) {
      throw new Error(captureResult.error || 'Failed to capture viewport');
    }

    if (!captureResult.imageData) {
      throw new Error('No image data returned from capture');
    }

    // Send the captured image to Electron for saving
    console.log('[PNG Export] Sending image to Electron for saving...');
    
    // Use project name as filename
    const filename = projectName;
    
    const result = await window.electronAPI.exportPNG({
      projectName: filename,
      imageData: captureResult.imageData,
    });
    console.log('[PNG Export] Export result:', result);

    return result;
  } catch (error) {
    console.error('[PNG Export] PNG export error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during export',
    };
  }
}
