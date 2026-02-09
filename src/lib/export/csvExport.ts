/**
 * CSV Export Utility
 * 
 * Converts inventory items to CSV format and triggers download.
 */

import { InventoryItem, AppNode, DeviceNodeData } from '@/lib/utils/types';
import { saveAs } from 'file-saver';
import { DEVICE_PROPERTY_FIELDS, type PropertyFieldDefinition } from '@/lib/utils/propertyRegistry';

/**
 * Convert inventory items to CSV string
 */
export function inventoryToCSV(items: InventoryItem[]): string {
  // CSV headers
  const headers = [
    'ID',
    'Device ID',
    'Category',
    'Name',
    'Type',
    'Manufacturer',
    'Model',
    'Version',
    'Location',
    'Owner',
    'Status',
    'Criticality',
    'IP Address',
    'MAC Address',
    'Last Updated',
    'Notes'
  ];
  
  // CSV rows
  const rows = items.map(item => [
    escapeCSV(item.id),
    escapeCSV(item.deviceId),
    escapeCSV(item.category),
    escapeCSV(item.name),
    escapeCSV(item.type),
    escapeCSV(item.manufacturer),
    escapeCSV(item.model),
    escapeCSV(item.version),
    escapeCSV(item.location),
    escapeCSV(item.owner),
    escapeCSV(item.status),
    escapeCSV(item.criticality),
    escapeCSV(item.ipAddress || ''),
    escapeCSV(item.macAddress || ''),
    escapeCSV(item.lastUpdated),
    escapeCSV(item.notes || '')
  ]);
  
  // Combine headers and rows
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  return csv;
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSV(value: string | undefined | null): string {
  if (value === undefined || value === null) {
    return '';
  }
  
  const str = String(value);
  
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

/**
 * Export inventory to CSV file
 */
export function exportInventoryToCSV(items: InventoryItem[], filename?: string): void {
  const csv = inventoryToCSV(items);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const defaultFilename = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
  saveAs(blob, filename || defaultFilename);
}

/**
 * Convert device metadata to CSV string
 * Exports all metadata fields in the same order as displayed in the table
 */
export function deviceMetadataToCSV(deviceNodes: AppNode[]): string {
  // Get all field definitions organized by category (same order as table)
  const allFields = Object.values(DEVICE_PROPERTY_FIELDS);
  const categories: Array<PropertyFieldDefinition['category']> = ['Basic', 'Network', 'Hardware', 'Software', 'Security', 'Compliance', 'Ownership'];
  
  // Get all fields in order (same as EditableDeviceMetadataTable)
  const orderedFields = categories.flatMap(cat => 
    allFields.filter(f => f.category === cat)
  );

  // Build headers: "Name" first, then all ordered fields
  const headers = [
    'Name',
    ...orderedFields.map(field => field.description)
  ];

  // Build rows
  const rows = deviceNodes.map(node => {
    const data = node.data as DeviceNodeData;
    
    // Start with Name
    const row: string[] = [escapeCSV(data.name || '')];
    
    // Add all ordered field values
    orderedFields.forEach(fieldDef => {
      const value = data[fieldDef.fieldName as keyof DeviceNodeData];
      row.push(formatFieldValue(value, fieldDef));
    });
    
    return row;
  });

  // Combine headers and rows
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csv;
}

/**
 * Format a field value for CSV export
 * Handles different field types appropriately
 */
function formatFieldValue(value: any, fieldDef: PropertyFieldDefinition): string {
  if (value === undefined || value === null) {
    return '';
  }

  // Handle boolean fields
  if (fieldDef.fieldType === 'boolean') {
    return value === true ? 'Yes' : (value === false ? 'No' : '');
  }

  // Handle array fields (tags, applicableControls, etc.)
  if (Array.isArray(value)) {
    return escapeCSV(value.join(', '));
  }

  // Handle date fields
  if (fieldDef.fieldType === 'date') {
    // If it's already a formatted date string, use it; otherwise format it
    if (typeof value === 'string') {
      return escapeCSV(value);
    }
    // If it's a Date object, format it
    if (value instanceof Date) {
      return escapeCSV(value.toISOString().split('T')[0]);
    }
  }

  // Handle all other types (string, number, select, textarea, etc.)
  return escapeCSV(String(value));
}

/**
 * Export device metadata to CSV file
 * Exports all metadata fields in the same order as displayed in the table
 * Uses file dialog to let user select save location
 */
export async function exportDeviceMetadataToCSV(deviceNodes: AppNode[], filename?: string): Promise<void> {
  const csv = deviceMetadataToCSV(deviceNodes);
  const defaultFilename = `device_metadata_${new Date().toISOString().split('T')[0]}.csv`;
  const finalFilename = filename || defaultFilename;
  
  // Check if running in Electron environment
  if (typeof window !== 'undefined' && (window as any).electronAPI?.exportCSV) {
    try {
      const result = await (window as any).electronAPI.exportCSV({
        csvContent: csv,
        filename: finalFilename,
      });
      
      if (result.success) {
        console.log('CSV exported successfully:', result.filePath);
        return;
      } else if (result.canceled) {
        console.log('CSV export canceled by user');
        return;
      } else {
        console.warn('CSV export failed, falling back to browser download:', result.error);
        // Fall through to browser download
      }
    } catch (electronError) {
      console.warn('Failed to export via Electron, falling back to browser download:', electronError);
      // Fall through to browser download
    }
  }
  
  // Fallback to browser download if not in Electron or if Electron export failed
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, finalFilename);
}

