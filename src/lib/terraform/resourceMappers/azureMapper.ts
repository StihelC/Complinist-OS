import type { ResourceMapping } from '@/lib/terraform/terraformTypes'

const AZURE_RESOURCE_MAP: Record<string, Partial<ResourceMapping>> = {
  // Compute (10 resources)
  'azurerm_virtual_machine': {
    deviceType: 'virtual-machine',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/Virtual-Machines.svg',
  },
  'azurerm_linux_virtual_machine': {
    deviceType: 'virtual-machine',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/Virtual-Machines.svg',
  },
  'azurerm_windows_virtual_machine': {
    deviceType: 'virtual-machine',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/Virtual-Machines.svg',
  },
  'azurerm_kubernetes_cluster': {
    deviceType: 'kubernetes-services',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/Aks-Automatic.svg',
  },
  'azurerm_container_group': {
    deviceType: 'container-instances',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/Container-Instances.svg',
  },
  'azurerm_container_registry': {
    deviceType: 'container-registries',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/Container-Registries.svg',
  },
  'azurerm_app_service': {
    deviceType: 'app-services',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/App-Services.svg',
  },
  'azurerm_function_app': {
    deviceType: 'function-apps',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/App-Services.svg',
  },
  'azurerm_batch_account': {
    deviceType: 'batch-accounts',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/Batch-Accounts.svg',
  },
  'azurerm_virtual_machine_scale_set': {
    deviceType: 'vm-scale-sets',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/Virtual-Machines.svg',
  },
  
  // Networking (10 resources)
  'azurerm_virtual_network': {
    deviceType: 'virtual-networks',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Virtual-Networks.svg',
  },
  'azurerm_subnet': {
    deviceType: 'virtual-networks',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Virtual-Networks.svg',
  },
  'azurerm_network_security_group': {
    deviceType: 'network-security-groups',
    category: 'Security',
    iconPath: 'src/Icons/Azure/Networking/Network-Security-Groups.svg',
  },
  'azurerm_lb': {
    deviceType: 'load-balancers',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Load-Balancers.svg',
  },
  'azurerm_load_balancer': {
    deviceType: 'load-balancers',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Load-Balancers.svg',
  },
  'azurerm_public_ip': {
    deviceType: 'public-ip-addresses',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Public-Ip-Addresses.svg',
  },
  'azurerm_network_interface': {
    deviceType: 'network-interfaces',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Network-Interfaces.svg',
  },
  'azurerm_virtual_network_gateway': {
    deviceType: 'virtual-network-gateways',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Virtual-Network-Gateways.svg',
  },
  'azurerm_vpn_gateway': {
    deviceType: 'virtual-network-gateways',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Virtual-Network-Gateways.svg',
  },
  'azurerm_application_gateway': {
    deviceType: 'application-gateways',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Application-Gateways.svg',
  },
  
  // Storage (5 resources)
  'azurerm_storage_account': {
    deviceType: 'storage-accounts',
    category: 'Storage',
    iconPath: 'src/Icons/Azure/Storage/Storage-Accounts.svg',
  },
  'azurerm_storage_container': {
    deviceType: 'blob-storage',
    category: 'Storage',
    iconPath: 'src/Icons/Azure/Storage/Storage-Accounts.svg',
  },
  'azurerm_managed_disk': {
    deviceType: 'disk-storage',
    category: 'Storage',
    iconPath: 'src/Icons/Azure/Storage/Disks.svg',
  },
  'azurerm_storage_share': {
    deviceType: 'file-storage',
    category: 'Storage',
    iconPath: 'src/Icons/Azure/Storage/Files.svg',
  },
  'azurerm_backup_vault': {
    deviceType: 'storage-accounts',
    category: 'Storage',
    iconPath: 'src/Icons/Azure/Storage/Backup-Vaults.svg',
  },
  
  // Databases (5 resources)
  'azurerm_sql_database': {
    deviceType: 'sql-database',
    category: 'Databases',
    iconPath: 'src/Icons/Azure/Databases/Sql-Databases.svg',
  },
  'azurerm_sql_server': {
    deviceType: 'sql-database',
    category: 'Databases',
    iconPath: 'src/Icons/Azure/Databases/Sql-Servers.svg',
  },
  'azurerm_cosmosdb_account': {
    deviceType: 'cosmos-db',
    category: 'Databases',
    iconPath: 'src/Icons/Azure/Databases/Azure-Cosmos-Db.svg',
  },
  'azurerm_redis_cache': {
    deviceType: 'cache-redis',
    category: 'Databases',
    iconPath: 'src/Icons/Azure/Databases/Redis-Caches.svg',
  },
  'azurerm_postgresql_server': {
    deviceType: 'azure-database-postgresql-server',
    category: 'Databases',
    iconPath: 'src/Icons/Azure/Databases/Azure-Database-For-Postgresql-Servers.svg',
  },
  'azurerm_mysql_server': {
    deviceType: 'azure-database-mysql-server',
    category: 'Databases',
    iconPath: 'src/Icons/Azure/Databases/Azure-Database-Mysql-Server.svg',
  },
  'azurerm_mariadb_server': {
    deviceType: 'azure-database-mariadb-server',
    category: 'Databases',
    iconPath: 'src/Icons/Azure/Databases/Azure-Database-Mariadb-Server.svg',
  },
  'azurerm_sql_managed_instance': {
    deviceType: 'azure-sql-managed-instance',
    category: 'Databases',
    iconPath: 'src/Icons/Azure/Databases/Sql-Managed-Instance.svg',
  },
  'azurerm_cosmosdb_sql_database': {
    deviceType: 'cosmos-db',
    category: 'Databases',
    iconPath: 'src/Icons/Azure/Databases/Azure-Cosmos-Db.svg',
  },
  'azurerm_cosmosdb_container': {
    deviceType: 'cosmos-db',
    category: 'Databases',
    iconPath: 'src/Icons/Azure/Databases/Azure-Cosmos-Db.svg',
  },
  
  // Additional Networking resources
  'azurerm_route_table': {
    deviceType: 'route-tables',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Virtual-Networks.svg',
  },
  'azurerm_route': {
    deviceType: 'route-tables',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Virtual-Networks.svg',
  },
  'azurerm_network_interface_security_group_association': {
    deviceType: 'network-security-groups',
    category: 'Security',
    iconPath: 'src/Icons/Azure/Networking/Network-Security-Groups.svg',
  },
  'azurerm_subnet_network_security_group_association': {
    deviceType: 'network-security-groups',
    category: 'Security',
    iconPath: 'src/Icons/Azure/Networking/Network-Security-Groups.svg',
  },
  'azurerm_virtual_network_peering': {
    deviceType: 'virtual-networks',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Virtual-Networks.svg',
  },
  'azurerm_firewall': {
    deviceType: 'firewalls',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Virtual-Networks.svg',
  },
  'azurerm_dns_zone': {
    deviceType: 'dns-zones',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Virtual-Networks.svg',
  },
  'azurerm_dns_a_record': {
    deviceType: 'dns-zones',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Virtual-Networks.svg',
  },
  'azurerm_dns_cname_record': {
    deviceType: 'dns-zones',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Virtual-Networks.svg',
  },
  'azurerm_traffic_manager_profile': {
    deviceType: 'load-balancers',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Load-Balancers.svg',
  },
  'azurerm_front_door': {
    deviceType: 'cdn',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Virtual-Networks.svg',
  },
  'azurerm_cdn_profile': {
    deviceType: 'cdn',
    category: 'Networking',
    iconPath: 'src/Icons/Azure/Networking/Virtual-Networks.svg',
  },
  
  // Security resources
  'azurerm_key_vault': {
    deviceType: 'key-vaults',
    category: 'Security',
    iconPath: 'src/Icons/Azure/Security-Identity/Microsoft-Defender-For-Cloud.svg',
  },
  'azurerm_key_vault_secret': {
    deviceType: 'key-vaults',
    category: 'Security',
    iconPath: 'src/Icons/Azure/Security-Identity/Microsoft-Defender-For-Cloud.svg',
  },
  'azurerm_key_vault_key': {
    deviceType: 'key-vaults',
    category: 'Security',
    iconPath: 'src/Icons/Azure/Security-Identity/Microsoft-Defender-For-Cloud.svg',
  },
  'azurerm_key_vault_certificate': {
    deviceType: 'key-vaults',
    category: 'Security',
    iconPath: 'src/Icons/Azure/Security-Identity/Microsoft-Defender-For-Cloud.svg',
  },
  'azurerm_role_assignment': {
    deviceType: 'identity-access-management',
    category: 'Security',
    iconPath: 'src/Icons/Azure/Security-Identity/Entra-Identity-Roles-And-Administrators.svg',
  },
  'azurerm_role_definition': {
    deviceType: 'identity-access-management',
    category: 'Security',
    iconPath: 'src/Icons/Azure/Security-Identity/Entra-Identity-Roles-And-Administrators.svg',
  },
  
  // Application Integration
  'azurerm_servicebus_namespace': {
    deviceType: 'service-bus',
    category: 'Integration',
    iconPath: 'src/Icons/Azure/Application-Integration/Azure-Service-Bus.svg',
  },
  'azurerm_servicebus_queue': {
    deviceType: 'service-bus',
    category: 'Integration',
    iconPath: 'src/Icons/Azure/Application-Integration/Azure-Service-Bus.svg',
  },
  'azurerm_servicebus_topic': {
    deviceType: 'service-bus',
    category: 'Integration',
    iconPath: 'src/Icons/Azure/Application-Integration/Azure-Service-Bus.svg',
  },
  'azurerm_eventgrid_domain': {
    deviceType: 'event-processing',
    category: 'Integration',
    iconPath: 'src/Icons/Azure/Management-Governance/Event-Grid-Subscriptions.svg',
  },
  'azurerm_eventgrid_topic': {
    deviceType: 'event-processing',
    category: 'Integration',
    iconPath: 'src/Icons/Azure/Management-Governance/Event-Grid-Subscriptions.svg',
  },
  'azurerm_logic_app_workflow': {
    deviceType: 'workflows',
    category: 'Integration',
    iconPath: 'src/Icons/Azure/Application-Integration/Logic-Apps.svg',
  },
  'azurerm_api_management': {
    deviceType: 'api-gateways',
    category: 'Integration',
    iconPath: 'src/Icons/Azure/Management-Governance/Api-Management-Services.svg',
  },
  
  // Additional Compute resources
  'azurerm_app_service_plan': {
    deviceType: 'app-services',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/App-Service-Plans.svg',
  },
  'azurerm_app_service_slot': {
    deviceType: 'app-services',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/App-Services.svg',
  },
  'azurerm_container_app': {
    deviceType: 'container-instances',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/Container-Instances.svg',
  },
  'azurerm_container_app_environment': {
    deviceType: 'container-instances',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/Container-Apps-Environments.svg',
  },
  'azurerm_availability_set': {
    deviceType: 'virtual-machine',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/Virtual-Machines.svg',
  },
  'azurerm_proximity_placement_group': {
    deviceType: 'virtual-machine',
    category: 'Compute',
    iconPath: 'src/Icons/Azure/Compute/Virtual-Machines.svg',
  },
  
  // Management & Monitoring
  'azurerm_log_analytics_workspace': {
    deviceType: 'monitoring',
    category: 'Management',
    iconPath: 'src/Icons/Azure/Management-Governance/Monitor.svg',
  },
  'azurerm_application_insights': {
    deviceType: 'monitoring',
    category: 'Management',
    iconPath: 'src/Icons/Azure/Management-Governance/Monitor.svg',
  },
  'azurerm_monitor_action_group': {
    deviceType: 'monitoring',
    category: 'Management',
    iconPath: 'src/Icons/Azure/Management-Governance/Monitor.svg',
  },
  'azurerm_monitor_metric_alert': {
    deviceType: 'monitoring',
    category: 'Management',
    iconPath: 'src/Icons/Azure/Management-Governance/Monitor.svg',
  },
  'azurerm_resource_group': {
    deviceType: 'resource-management',
    category: 'Management',
    iconPath: 'src/Icons/Azure/Management-Governance/Resource-Group-List.svg',
  },
}

export class AzureMapper {
  /**
   * Map Azure resource to device type
   * This now uses the intelligent device type matcher when available
   */
  async mapResourceAsync(type: string, attributes: any): Promise<ResourceMapping> {
    const mapping = AZURE_RESOURCE_MAP[type]
    const name = this.extractName(attributes, type)

    // If we have a static mapping, use device type matcher to find best match
    if (mapping && typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        const matchResult = await (window as any).electronAPI.findDeviceTypeMatch({
          deviceType: mapping.deviceType,
          category: mapping.category,
          resourceType: type,
          provider: 'azurerm',
          iconPath: mapping.iconPath
        })

        if (matchResult && matchResult.matched) {
          return {
            deviceType: matchResult.deviceType,
            deviceSubtype: matchResult.deviceSubtype || type,
            iconPath: matchResult.iconPath,
            category: mapping.category!,
            defaultName: name,
          }
        }
      } catch (error) {
        console.warn('[AzureMapper] Failed to match device type, using static mapping:', error)
      }
    }

    // Fallback to static mapping or default
    if (mapping) {
      return {
        deviceType: mapping.deviceType!,
        deviceSubtype: type,
        iconPath: mapping.iconPath!,
        category: mapping.category!,
        defaultName: name,
      }
    }

    return this.getDefaultMapping(type, attributes)
  }

  /**
   * Synchronous version for backwards compatibility
   * Will be deprecated once all callers use async version
   */
  mapResource(type: string, attributes: any): ResourceMapping {
    const mapping = AZURE_RESOURCE_MAP[type]

    if (!mapping) {
      return this.getDefaultMapping(type, attributes)
    }

    return {
      deviceType: mapping.deviceType!,
      deviceSubtype: type,
      iconPath: mapping.iconPath!,
      category: mapping.category!,
      defaultName: this.extractName(attributes, type),
    }
  }

  private extractName(attributes: any, type: string): string {
    if (attributes?.name) return attributes.name
    return type.replace('azurerm_', '').replace(/_/g, '-')
  }

  private getDefaultMapping(type: string, attributes: any): ResourceMapping {
    return {
      deviceType: 'virtual-machine',
      deviceSubtype: type,
      iconPath: 'src/Icons/Other/Miscellaneous/Generic-Resource.svg',
      category: 'Other',
      defaultName: this.extractName(attributes, type),
    }
  }
}

