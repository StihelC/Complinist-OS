/**
 * SVG Export Utility
 * 
 * Generates vector-based SVG representation of React Flow topology diagrams.
 * Provides infinite zoom capability and crisp rendering at any scale.
 */

import type { Node, Rect } from '@xyflow/react';
import { 
  AppNode, 
  AppEdge, 
  DeviceNodeData, 
  BoundaryNodeData, 
  EdgeMetadata,
  getEffectiveBoundaryStyle 
} from '@/lib/utils/types';
import { getAbsolutePosition } from '@/lib/utils/utils';
import { getIconPath } from '@/lib/utils/iconPath';
import { 
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  getSimpleBezierPath,
  Position
} from '@xyflow/react';

export interface SVGExportOptions {
  /** Image width in pixels (default: 1600) */
  width?: number;
  /** Image height in pixels (default: 1200) */
  height?: number;
  /** Background color (default: '#ffffff') */
  backgroundColor?: string;
  /** Minimum zoom level (default: 0.3) */
  minZoom?: number;
  /** Maximum zoom level (default: 1.5) */
  maxZoom?: number;
  /** Padding around content (0-1, default: 0.15) */
  padding?: number;
}

const DEFAULT_OPTIONS: Required<SVGExportOptions> = {
  width: 1600,
  height: 1200,
  backgroundColor: '#ffffff',
  minZoom: 0.3,
  maxZoom: 1.5,
  padding: 0.15,
};

/**
 * Calculate viewport transform to fit all nodes within specified dimensions
 */
function calculateViewportTransform(
  nodesBounds: Rect,
  imageWidth: number,
  imageHeight: number,
  minZoom: number,
  maxZoom: number,
  padding: number
): { x: number; y: number; zoom: number; viewBox: string } {
  // Add padding to bounds
  const paddedWidth = nodesBounds.width * (1 + padding * 2);
  const paddedHeight = nodesBounds.height * (1 + padding * 2);
  const paddedX = nodesBounds.x - nodesBounds.width * padding;
  const paddedY = nodesBounds.y - nodesBounds.height * padding;

  // Calculate zoom to fit
  const xZoom = imageWidth / paddedWidth;
  const yZoom = imageHeight / paddedHeight;
  const zoom = Math.min(Math.max(Math.min(xZoom, yZoom), minZoom), maxZoom);

  // For SVG, we use viewBox instead of transform
  // ViewBox defines what portion of the coordinate system is visible
  return {
    x: paddedX,
    y: paddedY,
    zoom,
    viewBox: `${paddedX} ${paddedY} ${paddedWidth} ${paddedHeight}`
  };
}

/**
 * Get edge path based on edge type
 * Returns path string and label position (labelX, labelY)
 */
function getEdgePath(
  edgeType: string,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): { path: string; labelX: number; labelY: number } {
  const params = {
    sourceX,
    sourceY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition: Position.Left,
  };

  let pathData: [string, number, number, number, number] | [string, number, number];

  switch (edgeType) {
    case 'straight':
      pathData = getStraightPath(params) as [string, number, number, number, number];
      break;
    case 'step':
      pathData = getSmoothStepPath({ ...params, borderRadius: 0 }) as [string, number, number, number, number];
      break;
    case 'smoothstep':
      pathData = getSmoothStepPath(params) as [string, number, number, number, number];
      break;
    case 'simplebezier':
      pathData = getSimpleBezierPath(params) as [string, number, number, number, number];
      break;
    case 'default':
    default:
      pathData = getBezierPath(params) as [string, number, number, number, number];
      break;
  }

  // React Flow path functions return [path, labelX, labelY, ...]
  return {
    path: pathData[0],
    labelX: pathData[1] || (sourceX + targetX) / 2,
    labelY: pathData[2] || (sourceY + targetY) / 2,
  };
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get node dimensions with proper fallback chain matching DeviceToolbar/BoundaryToolbar
 * Priority: measured?.width/height || width || style?.width || default
 */
function getNodeDimensions(node: AppNode): { width: number; height: number } {
  const isBoundary = node.type === 'boundary';
  const defaultWidth = isBoundary ? 300 : 120;
  const defaultHeight = isBoundary ? 200 : 150;
  
  // React Flow provides measured dimensions for nodes that have been rendered
  const measured = (node as any).measured;
  const width = measured?.width 
    || (node.width as number) 
    || ((node.style as any)?.width as number)
    || defaultWidth;
  
  const height = measured?.height 
    || (node.height as number) 
    || ((node.style as any)?.height as number)
    || defaultHeight;
  
  return { width, height };
}

/**
 * Generate SVG for a boundary node
 * Matches GroupNode rendering exactly
 */
function renderBoundary(
  node: AppNode,
  nodes: AppNode[],
  globalSettings: { globalBoundaryLabelSize: number }
): string {
  const data = node.data as BoundaryNodeData;
  const style = getEffectiveBoundaryStyle(data.type, data);
  
  // Use measured dimensions with proper fallback
  const { width, height } = getNodeDimensions(node);
  
  // Use ABSOLUTE position (handles parent-child relationships)
  const absolutePos = getAbsolutePosition(node.id, nodes);
  const x = absolutePos.x;
  const y = absolutePos.y;
  
  console.log(`[SVG Export] Rendering boundary ${node.id} "${data.label}":`, { 
    relativePos: node.position,
    absolutePos, 
    width, 
    height, 
    parentId: node.parentId 
  });
  
  // Calculate background opacity (matching GroupNode)
  const nestingDepth = data.nestingDepth || 0;
  const backgroundOpacity = (style.backgroundOpacity ?? (10 + nestingDepth * 5)) / 100;
  
  const borderRadius = style.borderRadius || 12;
  const strokeWidth = style.strokeWidth || 2;
  
  // Convert hex color to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  const fillColor = hexToRgba(style.color, backgroundOpacity);
  const strokeColor = style.color;
  const strokeDashArray = style.dashArray || '0';
  
  // Render boundary rectangle (full size - padding is internal spacing in GroupNode, not subtracted from size)
  let svg = `<rect x="${x}" y="${y}" width="${width}" height="${height}" `;
  svg += `rx="${borderRadius}" ry="${borderRadius}" `;
  svg += `fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" `;
  if (strokeDashArray !== '0') {
    svg += `stroke-dasharray="${strokeDashArray}" `;
  }
  svg += `/>\n`;
  
  // Render boundary label - match GroupNode getLabelPositionStyle() and getLabelSizeStyle() exactly
  const labelPosition = data.labelPosition || 'bottom-center';
  const labelPlacement = data.labelPlacement || 'outside';
  const fontSize = globalSettings.globalBoundaryLabelSize; // Always use global setting (matching GroupNode)
  const labelSpacing = data.labelSpacing ?? 8;
  const labelOffset = data.labelOffset ?? 0;
  
  // Calculate label position (matching GroupNode getLabelPositionStyle)
  let labelX = x + width / 2; // Center horizontally
  let labelY: number;
  
  if (labelPlacement === 'outside') {
    // Position outside the boundary
    if (labelPosition.startsWith('top')) {
      // Match: style.top = `-${totalOffset}px` where totalOffset = fontSize + (padding * 2) + spacing - offset
      const totalOffset = fontSize + (Math.max(4, fontSize * 0.4) * 2) + labelSpacing - labelOffset;
      labelY = y - totalOffset;
    } else {
      // Match: style.bottom = `-${totalOffset}px` where totalOffset = fontSize + (padding * 2) + spacing + offset
      const totalOffset = fontSize + (Math.max(4, fontSize * 0.4) * 2) + labelSpacing + labelOffset;
      labelY = y + height + totalOffset;
    }
  } else {
    // Position inside the boundary
    if (labelPosition.startsWith('top')) {
      // Match: style.top = `${spacing + offset}px`
      labelY = y + labelSpacing + labelOffset + fontSize;
    } else {
      // Match: style.bottom = `${spacing - offset}px`
      labelY = y + height - (labelSpacing - labelOffset) + fontSize;
    }
  }
  
  // Determine label colors (matching GroupNode getLabelSizeStyle)
  const labelBgColor = data.labelBackgroundColor && data.labelBackgroundColor !== 'auto'
    ? data.labelBackgroundColor
    : `${style.color}20`; // Match: `${style.color}20` (hex with 20 = ~12.5% opacity)
  
  const labelTextColor = data.labelTextColor && data.labelTextColor !== 'auto'
    ? data.labelTextColor
    : style.color;
  
  // Calculate padding (matching GroupNode: Math.max(4, fontSize * 0.4))
  const labelPadding = Math.max(4, fontSize * 0.4);
  const labelPaddingX = labelPadding * 1.5; // Match: `${padding}px ${padding * 1.5}px`
  
  // Measure text width more accurately
  const textWidth = data.label.length * fontSize * 0.6;
  const rectWidth = textWidth + labelPaddingX * 2;
  const rectHeight = fontSize + labelPadding * 2;
  
  // Render label background
  svg += `<rect x="${labelX - rectWidth / 2}" y="${labelY - rectHeight}" `;
  svg += `width="${rectWidth}" height="${rectHeight}" `;
  svg += `rx="4" fill="${labelBgColor}" stroke="${labelTextColor}" stroke-width="1" />\n`;
  
  // Render label text
  svg += `<text x="${labelX}" y="${labelY - labelPadding}" `;
  svg += `text-anchor="middle" font-size="${fontSize}" font-weight="600" `;
  svg += `fill="${labelTextColor}" font-family="system-ui, -apple-system, sans-serif">`;
  svg += escapeXml(data.label);
  svg += `</text>\n`;
  
  return svg;
}

/**
 * Load an image and convert it to base64 data URL
 */
async function loadImageAsDataURL(imagePath: string): Promise<string | null> {
  // For file:// URLs, use Image element approach (fetch doesn't work with file:// in Electron)
  if (imagePath.startsWith('file://')) {
    return await loadImageViaImageElement(imagePath);
  }
  
  try {
    // Handle relative paths - make them absolute if needed
    let absolutePath = imagePath;
    
    // If it's a relative path (starts with ./), try to resolve it
    if (imagePath.startsWith('./') || imagePath.startsWith('../')) {
      // In browser/Electron context, try to resolve relative to current location
      if (typeof window !== 'undefined' && window.location && window.location.origin) {
        try {
          const baseUrl = new URL(window.location.href);
          const pathParts = baseUrl.pathname.split('/').slice(0, -1); // Remove filename
          baseUrl.pathname = pathParts.join('/') + '/';
          absolutePath = new URL(imagePath, baseUrl).href;
        } catch (e) {
          // Fallback: convert ./ to /
          absolutePath = imagePath.startsWith('./') ? imagePath.substring(1) : imagePath;
          if (!absolutePath.startsWith('/')) {
            absolutePath = '/' + absolutePath;
          }
        }
      } else {
        // Fallback: try with / as base (for dev server)
        absolutePath = imagePath.startsWith('./') ? imagePath.substring(1) : imagePath;
        if (!absolutePath.startsWith('/')) {
          absolutePath = '/' + absolutePath;
        }
      }
    } else if (!imagePath.startsWith('http://') && !imagePath.startsWith('https://') && !imagePath.startsWith('/')) {
      // If it doesn't start with a protocol or /, assume it's relative
      absolutePath = '/' + imagePath;
    }
    
    // Try fetching with the resolved path
    try {
      const response = await fetch(absolutePath);
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch (fetchError) {
      // If fetch fails, try Image element approach as fallback
      console.warn('[SVG Export] Fetch failed for:', absolutePath, 'trying Image element approach');
      return await loadImageViaImageElement(absolutePath);
    }
    
    // If original path is different, try it too
    if (absolutePath !== imagePath) {
      try {
        const response = await fetch(imagePath);
        if (response.ok) {
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        // Fallback to Image element
        return await loadImageViaImageElement(imagePath);
      }
    }
    
    // Final fallback: try Image element
    return await loadImageViaImageElement(imagePath);
  } catch (error) {
    console.warn('[SVG Export] All methods failed for image:', imagePath, error);
    return await loadImageViaImageElement(imagePath);
  }
}

/**
 * Alternative method to load images via Image element (works better with file:// URLs)
 */
function loadImageViaImageElement(imagePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Don't set crossOrigin for file:// URLs
    if (!imagePath.startsWith('file://')) {
      img.crossOrigin = 'anonymous';
    }
    
    const timeout = setTimeout(() => {
      console.warn('[SVG Export] Image load timeout:', imagePath);
      resolve(null);
    }, 5000); // 5 second timeout
    
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          // Use PNG format to preserve quality
          const dataURL = canvas.toDataURL('image/png');
          resolve(dataURL);
        } else {
          resolve(null);
        }
      } catch (error) {
        console.warn('[SVG Export] Canvas conversion failed:', error);
        resolve(null);
      }
    };
    
    img.onerror = (error) => {
      clearTimeout(timeout);
      console.warn('[SVG Export] Image element failed to load:', imagePath, error);
      resolve(null);
    };
    
    img.src = imagePath;
  });
}

// Field display configuration (matches DeviceLabel.tsx)
const FIELD_CONFIG: Record<string, { label: string }> = {
  name: { label: 'Name' },
  deviceType: { label: 'Type' },
  deviceSubtype: { label: 'Subtype' },
  ipAddress: { label: 'IP' },
  macAddress: { label: 'MAC' },
  manufacturer: { label: 'Manufacturer' },
  model: { label: 'Model' },
  operatingSystem: { label: 'OS' },
  osVersion: { label: 'OS Version' },
  securityZone: { label: 'Zone' },
  assetValue: { label: 'Asset Value' },
  complianceStatus: { label: 'Compliance' },
  location: { label: 'Location' },
  department: { label: 'Department' },
  systemOwner: { label: 'Owner' },
  missionCritical: { label: 'Critical' },
};

/**
 * Generate SVG for a device node
 * Matches DeviceNode rendering exactly
 */
function renderDevice(
  node: AppNode,
  nodes: AppNode[],
  globalSettings: { globalDeviceImageSize: number; globalDeviceLabelSize: number },
  iconDataURLs: Map<string, string>
): string {
  const data = node.data as DeviceNodeData;
  
  // Use measured dimensions with proper fallback
  const { width, height } = getNodeDimensions(node);
  
  // Use ABSOLUTE position (handles parent-child relationships)
  const absolutePos = getAbsolutePosition(node.id, nodes);
  const x = absolutePos.x;
  const y = absolutePos.y;
  
  const borderRadius = 8;
  const strokeWidth = 2;
  
  let svg = `<g class="device-node" data-id="${node.id}">\n`;
  
  // Device background
  svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" `;
  svg += `rx="${borderRadius}" fill="white" stroke="#d1d5db" stroke-width="${strokeWidth}" />\n`;
  
  // Device icon - positioned in top 40% of device (matching DeviceNode layout: flex: '0 0 40%')
  // Account for padding (p-3 = 12px on all sides)
  const devicePadding = 12; // p-3 = 12px padding
  const iconAreaHeight = height * 0.4; // Top 40% for icon area (matching DeviceNode: style={{ flex: '0 0 40%' }})
  const labelAreaStart = y + devicePadding + iconAreaHeight; // Start of label area
  
  // Icon sizing - match DeviceNode exactly
  // DeviceNode uses: style={{ width: `${deviceImageSize}%`, height: `${deviceImageSize}%` }}
  // with maxWidth: '80px', maxHeight: '80px'
  const iconSizePercent = data.deviceImageSize ?? globalSettings.globalDeviceImageSize;
  
  // Calculate icon size: percentage of container width, but constrained by:
  // 1. Max 80px (matching DeviceNode maxWidth/maxHeight)
  // 2. Must fit in icon area (top 40% minus padding)
  // 3. Must fit in width minus padding
  const availableWidth = width - devicePadding * 2;
  const availableHeight = iconAreaHeight - devicePadding;
  const percentageSize = (iconSizePercent / 100) * availableWidth;
  const maxSizeFromConstraints = Math.min(availableWidth, availableHeight, 80); // Match maxWidth/maxHeight: 80px
  const iconSize = Math.max(40, Math.min(maxSizeFromConstraints, percentageSize));
  
  const iconX = x + width / 2 - iconSize / 2;
  const iconY = y + devicePadding + (iconAreaHeight - iconSize) / 2; // Center icon in icon area
  
  // Try to use actual device icon if available
  const hasIconPath = data.iconPath && data.iconPath.length > 0;
  const iconKey = hasIconPath ? data.iconPath : null;
  const iconDataURL = iconKey ? iconDataURLs.get(iconKey) : null;
  
  if (iconDataURL) {
    // Render actual device icon as embedded image
    svg += `<image x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" `;
    svg += `href="${iconDataURL}" preserveAspectRatio="xMidYMid meet" />\n`;
  } else {
    // Fallback to icon letter in a box
    svg += `<rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" `;
    svg += `fill="#e5e7eb" stroke="#9ca3af" stroke-width="2" rx="6" />\n`;
    
    // Device type icon text (first letter)
    const iconLetter = data.deviceType.charAt(0).toUpperCase();
    const iconFontSize = Math.max(20, iconSize * 0.5);
    svg += `<text x="${iconX + iconSize / 2}" y="${iconY + iconSize / 2 + iconFontSize * 0.35}" `;
    svg += `text-anchor="middle" dominant-baseline="middle" font-size="${iconFontSize}" font-weight="bold" fill="#6b7280">`;
    svg += iconLetter;
    svg += `</text>\n`;
  }
  
  // Device label (bottom section) - positioned in bottom 60% area (matching DeviceNode: flex-1)
  // Add gap-2 (8px) between icon area and label area (matching DeviceNode: gap-2)
  const gapBetweenAreas = 8; // gap-2 = 8px
  const fontSize = globalSettings.globalDeviceLabelSize;
  const lineHeight = fontSize * 1.2; // Standard line height
  
  // Calculate available space for labels (ensure they stay within device bounds)
  // DeviceNode uses: <div className="flex-1 flex items-start justify-center w-full overflow-auto">
  const maxLabelY = y + height - devicePadding; // Maximum Y position for labels
  const labelAreaWidth = width - devicePadding * 2; // Available width for labels
  
  // If custom label is provided, show that with background (matching DeviceLabel)
  if (data.label) {
    const padding = Math.max(4, fontSize * 0.3); // Match DeviceLabel padding calculation
    // More accurate text width estimation
    const textWidth = data.label.length * fontSize * 0.6;
    const rectWidth = Math.min(textWidth + padding * 2, labelAreaWidth);
    const rectHeight = fontSize + padding * 2;
    const rectX = x + width / 2 - rectWidth / 2;
    const rectY = labelAreaStart + gapBetweenAreas;
    
    // Ensure label stays within device bounds
    if (rectY + rectHeight <= maxLabelY && rectY >= y + devicePadding) {
      // Background with border (matching DeviceLabel: className="px-2 py-1 bg-white/95 backdrop-blur-sm border border-gray-300 rounded-md shadow-sm")
      svg += `<rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" `;
      svg += `rx="4" fill="rgba(255, 255, 255, 0.95)" stroke="#d1d5db" stroke-width="1" />\n`;
      
      svg += `<text x="${x + width / 2}" y="${rectY + rectHeight / 2 + fontSize * 0.35}" `;
      svg += `text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="500" fill="#1f2937">`;
      svg += escapeXml(data.label);
      svg += `</text>\n`;
    }
  } else {
    // Otherwise, show selected fields (matching DeviceLabel logic exactly)
    const fieldsToShow = data.labelFields || [];
    
    // Default to showing name and type if no fields specified (matching DeviceLabel)
    if (fieldsToShow.length === 0) {
      let currentY = labelAreaStart + gapBetweenAreas + fontSize * 0.35; // Start with gap and baseline offset
      
      // Name field (matching DeviceLabel: <span className="font-semibold">Name:</span>)
      const nameLabel = 'Name:';
      const nameValue = data.name || '';
      if (currentY <= maxLabelY) {
        svg += `<text x="${x + width / 2}" y="${currentY}" `;
        svg += `text-anchor="middle" font-size="${fontSize}" fill="#374151">`;
        svg += `<tspan font-weight="600">${escapeXml(nameLabel)}</tspan> `;
        svg += `<tspan fill="#111827">${escapeXml(nameValue)}</tspan>`;
        svg += `</text>\n`;
      }
      
      // Type field
      currentY += lineHeight;
      if (currentY <= maxLabelY) {
        const typeLabel = 'Type:';
        const typeValue = data.deviceSubtype || data.deviceType || '';
        svg += `<text x="${x + width / 2}" y="${currentY}" `;
        svg += `text-anchor="middle" font-size="${fontSize}" fill="#374151">`;
        svg += `<tspan font-weight="600">${escapeXml(typeLabel)}</tspan> `;
        svg += `<tspan fill="#111827">${escapeXml(typeValue)}</tspan>`;
        svg += `</text>\n`;
      }
    } else {
      // Filter and map fields that have values (matching DeviceLabel exactly)
      const displayFields = fieldsToShow
        .filter((field) => {
          const value = data[field as keyof DeviceNodeData];
          // Special handling for boolean fields
          if (field === 'missionCritical' && typeof value === 'boolean') {
            return true; // Always show boolean even if false
          }
          return value !== undefined && value !== null && value !== '';
        })
        .map((field) => {
          const value = data[field as keyof DeviceNodeData];
          // Format boolean values
          const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
          return {
            field,
            value: displayValue,
            config: FIELD_CONFIG[field] || { label: field },
          };
        });
      
      if (displayFields.length > 0) {
        let currentY = labelAreaStart + gapBetweenAreas + fontSize * 0.35;
        displayFields.forEach(({ value, config }) => {
          if (currentY <= maxLabelY) {
            // Match DeviceLabel: <span className="font-semibold">{config.label}:</span> <span className="text-gray-900">{value}</span>
            svg += `<text x="${x + width / 2}" y="${currentY}" `;
            svg += `text-anchor="middle" font-size="${fontSize}" fill="#374151">`;
            svg += `<tspan font-weight="600">${escapeXml(config.label)}:</tspan> `;
            svg += `<tspan fill="#111827">${escapeXml(value)}</tspan>`;
            svg += `</text>\n`;
          }
          currentY += lineHeight;
        });
      }
    }
  }
  
  svg += `</g>\n`;
  
  return svg;
}

/**
 * Generate SVG for an edge
 * Uses handle positions (Position.Left/Right) instead of centers, matching CustomEdge
 */
function renderEdge(
  edge: AppEdge,
  nodes: AppNode[],
  globalSettings: { globalConnectionLabelSize: number }
): string {
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);
  
  if (!sourceNode || !targetNode) {
    return '';
  }
  
  // Use measured dimensions with proper fallback
  const sourceDims = getNodeDimensions(sourceNode);
  const targetDims = getNodeDimensions(targetNode);
  
  // Calculate handle positions using ABSOLUTE positions
  // DeviceNode has handles at Position.Left (target) and Position.Right (source)
  const sourceAbsPos = getAbsolutePosition(sourceNode.id, nodes);
  const targetAbsPos = getAbsolutePosition(targetNode.id, nodes);
  
  // Source handle: right side of source node (Position.Right)
  const sourceX = sourceAbsPos.x + sourceDims.width;
  const sourceY = sourceAbsPos.y + sourceDims.height / 2;
  
  // Target handle: left side of target node (Position.Left)
  const targetX = targetAbsPos.x;
  const targetY = targetAbsPos.y + targetDims.height / 2;
  
  const edgeData = edge.data as EdgeMetadata || {};
  const edgeType = edgeData.edgeType || 'default';
  const connectionState = edgeData.connectionState || 'active';
  
  // Get path and label position
  const { path: pathData, labelX, labelY } = getEdgePath(edgeType, sourceX, sourceY, targetX, targetY);
  
  // Style based on connection state (matching CustomEdge getEdgeStyle)
  let strokeColor = '#6b7280'; // gray
  let strokeWidth = 2;
  let strokeDashArray = '';
  
  switch (connectionState) {
    case 'active':
      strokeColor = '#6b7280';
      strokeWidth = 2;
      break;
    case 'standby':
      strokeColor = '#eab308'; // yellow
      strokeWidth = 2;
      strokeDashArray = '5,5';
      break;
    case 'failed':
      strokeColor = '#ef4444'; // red
      strokeWidth = 2;
      strokeDashArray = '3,3';
      break;
  }
  
  let svg = `<path d="${pathData}" `;
  svg += `stroke="${strokeColor}" stroke-width="${strokeWidth}" `;
  svg += `fill="none" `;
  if (strokeDashArray) {
    svg += `stroke-dasharray="${strokeDashArray}" `;
  }
  svg += `marker-end="url(#arrowhead)" />\n`;
  
  // Add animated marker if needed
  if (edgeData.animated) {
    const animationSpeed = edgeData.animationSpeed || 2;
    const animationColor = edgeData.animationColor || '#ff0073';
    const markerRadius = 5;
    
    svg += `<circle r="${markerRadius}" fill="${animationColor}">\n`;
    svg += `  <animateMotion dur="${animationSpeed}s" repeatCount="indefinite" path="${pathData}" />\n`;
    svg += `</circle>\n`;
  }
  
  // Render edge label (matching EdgeLabel component)
  const fontSize = globalSettings.globalConnectionLabelSize;
  
  // If custom label is provided, show that
  if (edgeData.label) {
    const padding = Math.max(4, fontSize * 0.3);
    const textWidth = edgeData.label.length * fontSize * 0.6;
    const rectWidth = textWidth + padding * 2;
    const rectHeight = fontSize + padding * 2;
    
    // Background (matching EdgeLabel: className="px-3 py-1.5 bg-white/95 backdrop-blur-sm border border-gray-300 rounded-md shadow-md")
    svg += `<rect x="${labelX - rectWidth / 2}" y="${labelY - rectHeight / 2}" `;
    svg += `width="${rectWidth}" height="${rectHeight}" `;
    svg += `rx="4" fill="rgba(255, 255, 255, 0.95)" stroke="#d1d5db" stroke-width="1" />\n`;
    
    svg += `<text x="${labelX}" y="${labelY + fontSize * 0.35}" `;
    svg += `text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="500" fill="#1f2937">`;
    svg += escapeXml(edgeData.label);
    svg += `</text>\n`;
  } else {
    // Otherwise, show selected fields (matching EdgeLabel logic)
    const fieldsToShow = edgeData.labelFields || [];
    
    if (fieldsToShow.length > 0) {
      // Filter and map fields that have values
      const displayFields = fieldsToShow
        .filter((field) => {
          const value = edgeData[field as keyof EdgeMetadata];
          return value !== undefined && value !== null && value !== '';
        })
        .map((field) => ({
          field,
          value: edgeData[field as keyof EdgeMetadata],
          config: {
            protocol: { label: 'Protocol' },
            bandwidth: { label: 'Bandwidth' },
            latency: { label: 'Latency' },
            jitter: { label: 'Jitter' },
            packetLoss: { label: 'Packet Loss' },
            errorRate: { label: 'Error Rate' },
            linkType: { label: 'Link Type' },
            vlanId: { label: 'VLAN' },
            qosClass: { label: 'QoS' },
            redundancyType: { label: 'Redundancy' },
            connectionState: { label: 'State' },
            portSource: { label: 'Source Port' },
            portTarget: { label: 'Target Port' },
            dataFlow: { label: 'Data Flow' },
            encryptionProtocol: { label: 'Encryption' },
          }[field] || { label: field },
        }));
      
      if (displayFields.length > 0) {
        const connectionState = edgeData.connectionState || 'active';
        const stateColors = {
          active: { border: '#4ade80', bg: 'rgba(240, 253, 244, 0.95)' }, // border-green-400 bg-green-50/95
          standby: { border: '#eab308', bg: 'rgba(254, 252, 232, 0.95)' }, // border-yellow-400 bg-yellow-50/95
          failed: { border: '#f87171', bg: 'rgba(254, 242, 242, 0.95)' }, // border-red-400 bg-red-50/95
        };
        const colors = stateColors[connectionState] || stateColors.active;
        
        const padding = Math.max(4, fontSize * 0.3);
        const lineHeight = fontSize * 1.2;
        const maxTextWidth = Math.max(...displayFields.map(f => (f.config.label + ': ' + String(f.value)).length * fontSize * 0.6));
        const rectWidth = Math.max(100, maxTextWidth + padding * 2); // min-w-[100px]
        const rectHeight = displayFields.length * lineHeight + padding * 2;
        
        // Background (matching EdgeLabel styling)
        svg += `<rect x="${labelX - rectWidth / 2}" y="${labelY - rectHeight / 2}" `;
        svg += `width="${rectWidth}" height="${rectHeight}" `;
        svg += `rx="4" fill="${colors.bg}" stroke="${colors.border}" stroke-width="1" />\n`;
        
        // Field values
        let currentY = labelY - rectHeight / 2 + padding + fontSize * 0.35;
        displayFields.forEach(({ value, config }) => {
          svg += `<text x="${labelX}" y="${currentY}" `;
          svg += `text-anchor="middle" font-size="${fontSize}" fill="#374151">`;
          svg += `<tspan font-weight="600">${escapeXml(config.label)}:</tspan> `;
          svg += `<tspan fill="#111827">${escapeXml(String(value))}</tspan>`;
          svg += `</text>\n`;
          currentY += lineHeight;
        });
      }
    }
  }
  
  return svg;
}

/**
 * Calculate bounds manually from nodes if getNodesBounds fails
 * Important: Uses absolute positions to handle parent-child relationships
 * Uses measured dimensions when available
 */
function calculateNodeBoundsManually(nodes: AppNode[]): Rect {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 800, height: 600 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach(node => {
    // Get ABSOLUTE position (handles parent-child relationships)
    const absolutePos = getAbsolutePosition(node.id, nodes);
    const x = absolutePos.x;
    const y = absolutePos.y;
    
    // Use measured dimensions with proper fallback
    const { width, height } = getNodeDimensions(node);

    console.log(`[SVG Export] Node ${node.id} (${node.type}):`, { 
      relativePos: node.position, 
      absolutePos, 
      width, 
      height,
      parentId: node.parentId 
    });

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  console.log('[SVG Export] Calculated bounds:', { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Export React Flow diagram as SVG
 */
export async function exportTopologyAsSVG(
  nodes: AppNode[],
  edges: AppEdge[],
  getNodesBounds: ((nodes: Node[]) => Rect) | undefined,
  globalSettings: { globalDeviceImageSize: number; globalBoundaryLabelSize: number; globalDeviceLabelSize: number; globalConnectionLabelSize: number },
  options: SVGExportOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (!nodes || nodes.length === 0) {
    throw new Error('No nodes to export');
  }
  
  // Pre-load all device icons
  console.log('[SVG Export] Pre-loading device icons...');
  const iconDataURLs = new Map<string, string>();
  const deviceNodes = nodes.filter(n => n.type === 'device');
  
  for (const node of deviceNodes) {
    const data = node.data as DeviceNodeData;
    if (data.iconPath && data.iconPath.length > 0 && !iconDataURLs.has(data.iconPath)) {
      const iconPath = getIconPath(data.iconPath);
      console.log(`[SVG Export] Attempting to load icon: ${data.iconPath} from path: ${iconPath}`);
      const dataURL = await loadImageAsDataURL(iconPath);
      if (dataURL) {
        iconDataURLs.set(data.iconPath, dataURL);
        console.log(`[SVG Export] Successfully loaded icon: ${data.iconPath}`);
      } else {
        console.warn(`[SVG Export] Failed to load icon: ${data.iconPath} from path: ${iconPath}`);
      }
    }
  }
  console.log(`[SVG Export] Loaded ${iconDataURLs.size} device icons out of ${deviceNodes.filter(n => {
    const data = n.data as DeviceNodeData;
    return data.iconPath && data.iconPath.length > 0;
  }).length} devices with icons`);
  
  // Calculate node bounds - try getNodesBounds first, fall back to manual calculation
  let nodesBounds: Rect;
  if (getNodesBounds) {
    try {
      nodesBounds = getNodesBounds(nodes as Node[]);
      // Validate bounds
      if (!nodesBounds || nodesBounds.width === 0 || nodesBounds.height === 0) {
        console.warn('[SVG Export] getNodesBounds returned invalid bounds, calculating manually');
        nodesBounds = calculateNodeBoundsManually(nodes);
      }
    } catch (error) {
      console.warn('[SVG Export] getNodesBounds failed, calculating manually:', error);
      nodesBounds = calculateNodeBoundsManually(nodes);
    }
  } else {
    console.log('[SVG Export] No getNodesBounds provided, calculating manually');
    nodesBounds = calculateNodeBoundsManually(nodes);
  }
  
  // Final validation
  if (nodesBounds.width === 0 || nodesBounds.height === 0) {
    throw new Error('Could not calculate valid node bounds');
  }
  
  console.log('[SVG Export] Node bounds:', nodesBounds);
  
  // Calculate viewport transform
  const transform = calculateViewportTransform(
    nodesBounds,
    opts.width,
    opts.height,
    opts.minZoom,
    opts.maxZoom,
    opts.padding
  );
  
  // Start building SVG
  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" `;
  svg += `width="${opts.width}" height="${opts.height}" `;
  svg += `viewBox="${transform.viewBox}">\n`;
  
  // Add defs for markers and styles
  svg += `<defs>\n`;
  
  // Arrowhead marker
  const markerSize = 6;
  svg += `<marker id="arrowhead" markerWidth="${markerSize}" markerHeight="${markerSize}" `;
  svg += `refX="${markerSize}" refY="${markerSize / 2}" orient="auto">\n`;
  svg += `  <polygon points="0 0, ${markerSize} ${markerSize / 2}, 0 ${markerSize}" fill="#6b7280" />\n`;
  svg += `</marker>\n`;
  
  // Embedded CSS
  svg += `<style>\n`;
  svg += `  text { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }\n`;
  svg += `  .device-node { cursor: default; }\n`;
  svg += `</style>\n`;
  svg += `</defs>\n`;
  
  // Background
  svg += `<rect x="${transform.x}" y="${transform.y}" width="${nodesBounds.width * (1 + opts.padding * 2)}" height="${nodesBounds.height * (1 + opts.padding * 2)}" fill="${opts.backgroundColor}" />\n`;
  
  // Separate nodes into boundaries and devices
  const boundaries = nodes.filter(n => n.type === 'boundary');
  const devices = nodes.filter(n => n.type === 'device');
  
  // Render boundaries first (lowest z-index)
  svg += `<g class="boundaries">\n`;
  for (const boundary of boundaries) {
    svg += renderBoundary(boundary, nodes, globalSettings);
  }
  svg += `</g>\n`;
  
  // Render edges
  svg += `<g class="edges">\n`;
  for (const edge of edges) {
    svg += renderEdge(edge, nodes, globalSettings);
  }
  svg += `</g>\n`;
  
  // Render devices (highest z-index)
  svg += `<g class="devices">\n`;
  for (const device of devices) {
    svg += renderDevice(device, nodes, globalSettings, iconDataURLs);
  }
  svg += `</g>\n`;
  
  svg += `</svg>`;
  
  return svg;
}

/**
 * Export topology as base64-encoded SVG
 */
export async function exportTopologyAsSVGBase64(
  nodes: AppNode[],
  edges: AppEdge[],
  getNodesBounds: ((nodes: Node[]) => Rect) | undefined,
  globalSettings: { globalDeviceImageSize: number; globalBoundaryLabelSize: number; globalDeviceLabelSize: number; globalConnectionLabelSize: number },
  options: SVGExportOptions = {}
): Promise<string> {
  const svg = await exportTopologyAsSVG(nodes, edges, getNodesBounds, globalSettings, options);
  
  // Convert to base64
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  
  return base64;
}

