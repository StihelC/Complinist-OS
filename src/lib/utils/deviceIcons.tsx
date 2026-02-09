import {
  Server,
  Shield,
  Database,
  Network,
  Key,
  Globe,
  Cloud,
  Brain,
  BarChart3,
  Users,
  Cpu,
  HardDrive,
  Container,
  Code,
} from 'lucide-react';
import { DeviceType } from './types';
import { LucideIcon } from 'lucide-react';

// Map Azure device types to fallback icons (for when actual icon fails to load)
// Uses category-based fallbacks since Azure has 600+ service types
export const deviceIconFallbacks: Partial<Record<DeviceType, LucideIcon>> = {
  // Compute
  'virtual-machine': Server,
  'vm-scale-sets': Server,
  'app-services': Globe,
  'function-apps': Code,
  'container-instances': Container,
  'kubernetes-services': Container,
  'batch-accounts': Cpu,
  'service-fabric-clusters': Server,
  
  // Networking
  'virtual-networks': Network,
  'load-balancers': Network,
  'virtual-network-gateways': Network,
  'application-gateways': Network,
  'firewalls': Shield,
  'dns-zones': Globe,
  'network-security-groups': Shield,
  'public-ip-addresses': Network,
  'route-tables': Network,
  'expressroute-circuits': Network,
  'virtual-wan-hub': Network,
  'bastions': Shield,
  
  // Storage
  'storage-accounts': HardDrive,
  'disk-storage': HardDrive,
  'blob-storage': HardDrive,
  'file-storage': HardDrive,
  'azure-netapp-files': HardDrive,
  'storage-sync-services': HardDrive,
  
  // Databases
  'sql-database': Database,
  'cosmos-db': Database,
  'azure-database-mysql-server': Database,
  'azure-database-postgresql-server': Database,
  'cache-redis': Database,
  'azure-sql': Database,
  'azure-sql-managed-instance': Database,
  
  // Security
  'key-vaults': Key,
  'microsoft-defender-for-cloud': Shield,
  'azure-sentinel': Shield,
  'azure-firewall': Shield,
  'ddos-protection-plans': Shield,
  'application-security-groups': Shield,
  
  // AI & Machine Learning
  'cognitive-services': Brain,
  'machine-learning': Brain,
  'azure-openai': Brain,
  'bot-services': Brain,
  'ai-studio': Brain,
  
  // Analytics
  'synapse-analytics': BarChart3,
  'data-factories': BarChart3,
  'stream-analytics-jobs': BarChart3,
  'event-hubs': BarChart3,
  'azure-databricks': BarChart3,
  
  // Identity
  'azure-ad': Users,
  'azure-ad-b2c': Users,
  'managed-identities': Key,
  'entra-id': Users,
  
  // IoT
  'iot-hub': Network,
  'iot-central-applications': Network,
  'digital-twins': Network,
  
  // Integration
  'logic-apps': Code,
  'service-bus': Network,
  'api-management-services': Globe,
  'event-grid-topics': Network,
  
  // DevOps
  'azure-devops': Code,
  'devops-starter': Code,
  
  // Management & Governance
  'monitor': BarChart3,
  'cost-management': BarChart3,
  'policy': Shield,
  'resource-groups': Cloud,
  'log-analytics-workspaces': BarChart3,
  'application-insights': BarChart3,
  
  // Web
  'static-apps': Globe,
  'cdn-profiles': Globe,
  'front-door': Globe,
  
  // Containers
  'container-registries': Container,
  'azure-spring-apps': Container,
  
  // Hybrid
  'azure-arc': Cloud,
  'azure-stack': Cloud,
  'azure-stack-edge': Cloud,
};

// Helper to determine icon based on device type pattern
function getIconByPattern(deviceType: DeviceType): LucideIcon {
  const type = deviceType.toLowerCase();
  
  // Pattern matching for better coverage
  if (type.includes('database') || type.includes('sql') || type.includes('cosmos') || type.includes('redis')) {
    return Database;
  }
  if (type.includes('network') || type.includes('gateway') || type.includes('vnet') || type.includes('wan')) {
    return Network;
  }
  if (type.includes('security') || type.includes('defender') || type.includes('firewall') || type.includes('vault')) {
    return Shield;
  }
  if (type.includes('storage') || type.includes('disk') || type.includes('blob') || type.includes('file')) {
    return HardDrive;
  }
  if (type.includes('ai') || type.includes('machine-learning') || type.includes('cognitive') || type.includes('bot')) {
    return Brain;
  }
  if (type.includes('analytics') || type.includes('data-factory') || type.includes('databricks') || type.includes('synapse')) {
    return BarChart3;
  }
  if (type.includes('identity') || type.includes('entra') || type.includes('active-directory')) {
    return Users;
  }
  if (type.includes('container') || type.includes('kubernetes') || type.includes('aks')) {
    return Container;
  }
  if (type.includes('function') || type.includes('logic') || type.includes('devops') || type.includes('api')) {
    return Code;
  }
  if (type.includes('iot') || type.includes('digital-twin')) {
    return Network;
  }
  if (type.includes('compute') || type.includes('vm') || type.includes('server')) {
    return Server;
  }
  if (type.includes('web') || type.includes('app-service') || type.includes('static')) {
    return Globe;
  }
  if (type.includes('monitor') || type.includes('insights') || type.includes('analytics')) {
    return BarChart3;
  }
  if (type.includes('arc') || type.includes('stack') || type.includes('hybrid')) {
    return Cloud;
  }
  
  return Cloud; // Default fallback
}

export const getDeviceIcon = (deviceType: DeviceType): LucideIcon => {
  return deviceIconFallbacks[deviceType] || getIconByPattern(deviceType);
};

