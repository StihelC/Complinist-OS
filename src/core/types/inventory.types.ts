// Inventory Types

export type InventoryCategory = 'Hardware' | 'Software' | 'Network' | 'Security';

export interface InventoryItem {
  /** Unique identifier for this inventory item */
  id: string;
  
  /** ID of the device this item belongs to */
  deviceId: string;
  
  /** Category of inventory item */
  category: InventoryCategory;
  
  /** Name of the item */
  name: string;
  
  /** Type of item (e.g., "Server", "Operating System", "Network Interface") */
  type: string;
  
  /** Manufacturer or vendor */
  manufacturer: string;
  
  /** Model number or identifier */
  model: string;
  
  /** Version information */
  version: string;
  
  /** Physical or logical location */
  location: string;
  
  /** Owner or administrator */
  owner: string;
  
  /** Status (e.g., "Active", "Inactive") */
  status: string;
  
  /** Criticality level */
  criticality: string;
  
  /** IP address (for network items) */
  ipAddress?: string;
  
  /** MAC address (for network items) */
  macAddress?: string;
  
  /** Last updated timestamp */
  lastUpdated: string;
  
  /** Additional notes */
  notes?: string;
}

export interface InventoryExtractionResult {
  /** All inventory items */
  items: InventoryItem[];
  
  /** Items grouped by category */
  byCategory: {
    Hardware: InventoryItem[];
    Software: InventoryItem[];
    Network: InventoryItem[];
    Security: InventoryItem[];
  };
  
  /** Statistics */
  stats: {
    totalItems: number;
    hardwareCount: number;
    softwareCount: number;
    networkCount: number;
    securityCount: number;
  };
}

