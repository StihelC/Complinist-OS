/**
 * Inventory Extractor
 * 
 * Extracts Hardware/Software/Network/Security inventory items from device nodes.
 * 
 * This function processes each device and generates inventory items based on the
 * device's metadata properties.
 */

import type { AppNode, DeviceNodeData, InventoryItem, InventoryExtractionResult } from '@/lib/utils/types';

/**
 * Extract inventory items from device nodes
 * 
 * For each device, generates:
 * - 1 Hardware item (the device itself)
 * - 0+ Software items (OS + installed software)
 * - 0-1 Network items (if IP address exists)
 * - 0-1 Security items (if encryption or security fields set)
 * 
 * @param nodes Array of device nodes from ReactFlow
 * @returns Array of inventory items
 */
export function extractInventory(nodes: AppNode[]): InventoryItem[] {
  // Filter to only device nodes (exclude boundaries)
  const deviceNodes = nodes.filter(node => node.type === 'device' || !node.type);
  
  return deviceNodes.flatMap(node => {
    const items: InventoryItem[] = [];
    const data = node.data as DeviceNodeData;
    
    if (!data) return items;
    
    // Get current date for timestamps
    const today = new Date().toISOString().split('T')[0];
    
    // ============================================
    // 1. HARDWARE ITEM (always one per device)
    // ============================================
    items.push({
      id: `hw-${node.id}`,
      deviceId: node.id,
      category: 'Hardware',
      name: data.name || 'Unnamed Device',
      type: data.deviceType || 'unknown',
      manufacturer: data.manufacturer || 'Unknown',
      model: data.model || 'Unknown',
      version: data.firmwareVersion || data.osVersion || 'Unknown',
      location: data.location || 'Unknown',
      owner: data.owner || data.systemOwner || 'Unknown',
      status: data.status || 'Active',
      criticality: data.criticality || data.assetValue || 'Medium',
      ipAddress: data.ipAddress || '',
      macAddress: data.macAddress || '',
      lastUpdated: today,
      notes: data.notes || ''
    });

    // ============================================
    // 2. SOFTWARE ITEMS (OS + installed software)
    // ============================================
    
    // Operating System item
    if (data.operatingSystem) {
      items.push({
        id: `sw-os-${node.id}`,
        deviceId: node.id,
        category: 'Software',
        name: data.operatingSystem,
        type: 'Operating System',
        manufacturer: 'OS Vendor',
        model: data.osVersion || 'Unknown',
        version: data.osVersion || 'Unknown',
        location: data.name || 'Unknown',
        owner: data.owner || data.systemOwner || 'Unknown',
        status: 'Active',
        criticality: 'Critical',
        lastUpdated: today,
        notes: `Operating System on ${data.name || 'device'}`
      });
    }

    // Installed software items (from newline-separated string)
    if (data.software) {
      const softwareList = data.software.split('\n').filter(s => s.trim());
      softwareList.forEach((software, index) => {
        items.push({
          id: `sw-${index}-${node.id}`,
          deviceId: node.id,
          category: 'Software',
          name: software.trim(),
          type: 'Application',
          manufacturer: 'Third Party',
          model: 'Application',
          version: 'Unknown',
          location: data.name || 'Unknown',
          owner: data.owner || data.systemOwner || 'Unknown',
          status: 'Active',
          criticality: 'Medium',
          lastUpdated: today,
          notes: `Installed on ${data.name || 'device'}`
        });
      });
    }

    // ============================================
    // 3. NETWORK ITEMS (if IP address exists)
    // ============================================
    if (data.ipAddress) {
      items.push({
        id: `net-${node.id}`,
        deviceId: node.id,
        category: 'Network',
        name: 'Network Interface',
        type: 'Network',
        manufacturer: 'Network',
        model: data.ipAddress,
        version: data.subnetMask || 'Unknown',
        location: data.name || 'Unknown',
        owner: data.owner || data.systemOwner || 'Unknown',
        status: 'Active',
        criticality: 'High',
        ipAddress: data.ipAddress,
        macAddress: data.macAddress || '',
        lastUpdated: today,
        notes: `Gateway: ${data.defaultGateway || 'Unknown'}${data.vlanId ? `, VLAN: ${data.vlanId}` : ''}`
      });
    }

    // ============================================
    // 4. SECURITY ITEMS (if security config exists)
    // ============================================
    if (data.encryptionStatus || data.encryptionAtRest || data.encryptionInTransit) {
      const encryptionStatus = data.encryptionStatus || 
        (data.encryptionAtRest && data.encryptionInTransit ? 'Enabled' : 
         (data.encryptionAtRest || data.encryptionInTransit ? 'Partial' : 'Not Configured'));
      
      items.push({
        id: `sec-enc-${node.id}`,
        deviceId: node.id,
        category: 'Security',
        name: 'Encryption',
        type: 'Security',
        manufacturer: 'Security',
        model: encryptionStatus,
        version: 'Current',
        location: data.name || 'Unknown',
        owner: data.owner || data.systemOwner || 'Unknown',
        status: 'Active',
        criticality: 'Critical',
        lastUpdated: today,
        notes: `Encryption Status: ${encryptionStatus}${data.encryptionAtRest ? ', At Rest: Yes' : ''}${data.encryptionInTransit ? ', In Transit: Yes' : ''}`
      });
    }

    return items;
  });
}

/**
 * Extract inventory grouped by category
 */
export function extractInventoryByCategory(nodes: AppNode[]): InventoryExtractionResult {
  const items = extractInventory(nodes);
  
  return {
    items,
    byCategory: {
      Hardware: items.filter(i => i.category === 'Hardware'),
      Software: items.filter(i => i.category === 'Software'),
      Network: items.filter(i => i.category === 'Network'),
      Security: items.filter(i => i.category === 'Security')
    },
    stats: {
      totalItems: items.length,
      hardwareCount: items.filter(i => i.category === 'Hardware').length,
      softwareCount: items.filter(i => i.category === 'Software').length,
      networkCount: items.filter(i => i.category === 'Network').length,
      securityCount: items.filter(i => i.category === 'Security').length
    }
  };
}

