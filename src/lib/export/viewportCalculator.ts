import type { Node } from '@xyflow/react';

/**
 * Calculate viewport bounds including all nodes and labels
 */
export function calculateContentBounds(
  flowContainer: HTMLElement,
  _nodes: Node[]
): { x: number; y: number; width: number; height: number } {
  const containerRect = flowContainer.getBoundingClientRect();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  // Get all React Flow nodes (devices and boundaries)
  const allNodes = flowContainer.querySelectorAll('.react-flow__node');
  
  allNodes.forEach(nodeEl => {
    const nodeRect = nodeEl.getBoundingClientRect();
    
    // Convert to relative coordinates within the flow container
    const relativeX = nodeRect.left - containerRect.left;
    const relativeY = nodeRect.top - containerRect.top;
    const relativeRight = relativeX + nodeRect.width;
    const relativeBottom = relativeY + nodeRect.height;
    
    minX = Math.min(minX, relativeX);
    minY = Math.min(minY, relativeY);
    maxX = Math.max(maxX, relativeRight);
    maxY = Math.max(maxY, relativeBottom);
  });
  
  // Boundary labels are absolutely positioned and can extend outside their parent nodes
  const boundaryLabelWrappers = flowContainer.querySelectorAll('.react-flow__node .absolute.pointer-events-none.z-50');
  
  boundaryLabelWrappers.forEach(labelWrapper => {
    const hasLabel = labelWrapper.querySelector('.rounded-md.font-semibold');
    if (hasLabel) {
      const labelRect = labelWrapper.getBoundingClientRect();
      if (labelRect.width > 0 && labelRect.height > 0) {
        const labelRelativeX = labelRect.left - containerRect.left;
        const labelRelativeY = labelRect.top - containerRect.top;
        const labelRelativeRight = labelRelativeX + labelRect.width;
        const labelRelativeBottom = labelRelativeY + labelRect.height;
        
        minX = Math.min(minX, labelRelativeX);
        minY = Math.min(minY, labelRelativeY);
        maxX = Math.max(maxX, labelRelativeRight);
        maxY = Math.max(maxY, labelRelativeBottom);
      }
    }
  });
  
  // Also check edge labels
  const edgeLabels = flowContainer.querySelectorAll('.react-flow__edge-label');
  edgeLabels.forEach(label => {
    const labelRect = label.getBoundingClientRect();
    if (labelRect.width > 0 && labelRect.height > 0) {
      const relativeX = labelRect.left - containerRect.left;
      const relativeY = labelRect.top - containerRect.top;
      const relativeRight = relativeX + labelRect.width;
      const relativeBottom = relativeY + labelRect.height;
      
      minX = Math.min(minX, relativeX);
      minY = Math.min(minY, relativeY);
      maxX = Math.max(maxX, relativeRight);
      maxY = Math.max(maxY, relativeBottom);
    }
  });
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Calculate required padding to fit all content
 */
export function calculateRequiredPadding(
  contentBounds: { x: number; y: number; width: number; height: number },
  viewportWidth: number,
  viewportHeight: number
): number {
  // Calculate how much the content extends BEYOND the viewport in each direction
  const extensionBeyondViewport = {
    left: Math.max(0, -contentBounds.x),
    top: Math.max(0, -contentBounds.y),
    right: Math.max(0, (contentBounds.x + contentBounds.width) - viewportWidth),
    bottom: Math.max(0, (contentBounds.y + contentBounds.height) - viewportHeight)
  };
  
  // Calculate the ACTUAL content dimensions including labels
  const totalContentWidth = contentBounds.width + extensionBeyondViewport.left + extensionBeyondViewport.right;
  const totalContentHeight = contentBounds.height + extensionBeyondViewport.top + extensionBeyondViewport.bottom;
  
  // Calculate padding as the percentage of EXTRA space needed beyond the current viewport
  const horizontalExtraSpace = Math.max(0, totalContentWidth - viewportWidth);
  const verticalExtraSpace = Math.max(0, totalContentHeight - viewportHeight);
  
  const horizontalPaddingPercent = (horizontalExtraSpace / 2) / viewportWidth;
  const verticalPaddingPercent = (verticalExtraSpace / 2) / viewportHeight;
  
  // Use the larger padding requirement and add a 25% safety buffer
  const requiredPadding = Math.max(horizontalPaddingPercent, verticalPaddingPercent) * 1.25 + 0.15;
  return Math.min(0.6, Math.max(0.15, requiredPadding));
}

/**
 * Verify all content is within viewport after fitView
 */
export function verifyContentInViewport(
  flowContainer: HTMLElement
): {
  allVisible: boolean;
  extensions: { left: number; top: number; right: number; bottom: number };
} {
  const containerRect = flowContainer.getBoundingClientRect();
  
  // Re-measure all content including labels
  const verifyNodes = flowContainer.querySelectorAll('.react-flow__node');
  let verifyMinX = Infinity, verifyMinY = Infinity, verifyMaxX = -Infinity, verifyMaxY = -Infinity;
  
  verifyNodes.forEach(nodeEl => {
    const nodeRect = nodeEl.getBoundingClientRect();
    const relativeX = nodeRect.left - containerRect.left;
    const relativeY = nodeRect.top - containerRect.top;
    const relativeRight = relativeX + nodeRect.width;
    const relativeBottom = relativeY + nodeRect.height;
    
    verifyMinX = Math.min(verifyMinX, relativeX);
    verifyMinY = Math.min(verifyMinY, relativeY);
    verifyMaxX = Math.max(verifyMaxX, relativeRight);
    verifyMaxY = Math.max(verifyMaxY, relativeBottom);
  });
  
  // Re-measure boundary labels separately
  const verifyLabelWrappers = flowContainer.querySelectorAll('.react-flow__node .absolute.pointer-events-none.z-50');
  
  verifyLabelWrappers.forEach(labelWrapper => {
    const hasLabel = labelWrapper.querySelector('.rounded-md.font-semibold');
    if (hasLabel) {
      const labelRect = labelWrapper.getBoundingClientRect();
      if (labelRect.width > 0 && labelRect.height > 0) {
        const labelRelativeX = labelRect.left - containerRect.left;
        const labelRelativeY = labelRect.top - containerRect.top;
        const labelRelativeRight = labelRelativeX + labelRect.width;
        const labelRelativeBottom = labelRelativeY + labelRect.height;
        
        verifyMinX = Math.min(verifyMinX, labelRelativeX);
        verifyMinY = Math.min(verifyMinY, labelRelativeY);
        verifyMaxX = Math.max(verifyMaxX, labelRelativeRight);
        verifyMaxY = Math.max(verifyMaxY, labelRelativeBottom);
      }
    }
  });
  
  // Check if any content is outside viewport
  const extensions = {
    left: Math.max(0, -verifyMinX),
    top: Math.max(0, -verifyMinY),
    right: Math.max(0, verifyMaxX - containerRect.width),
    bottom: Math.max(0, verifyMaxY - containerRect.height)
  };
  
  const allVisible = !extensions.left && !extensions.top && !extensions.right && !extensions.bottom;
  
  return { allVisible, extensions };
}

