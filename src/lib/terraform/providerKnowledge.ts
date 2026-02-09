/**
 * Provider-specific knowledge for relationship classification
 * Maps resource types and attribute paths to relationship types
 */

type RelationshipType = 'network' | 'security' | 'dependency' | 'unknown'
type Provider = 'aws' | 'azurerm' | 'google' | 'unknown'

interface RelationshipRule {
  via: string | string[] // Attribute path(s) that indicate this relationship
  direction?: 'parent' | 'child' | 'bidirectional'
}

interface ResourceRules {
  networkRelationships?: Record<string, RelationshipRule>
  securityRelationships?: Record<string, RelationshipRule>
  parentAttributes?: string[]
  childAttributes?: string[]
}

type ProviderKnowledgeMap = Record<Provider, Record<string, ResourceRules>>

const PROVIDER_KNOWLEDGE: ProviderKnowledgeMap = {
  aws: {
    'aws_vpc': {
      childAttributes: ['vpc_id'],
      networkRelationships: {
        'aws_subnet': { via: 'vpc_id', direction: 'parent' },
        'aws_internet_gateway': { via: 'vpc_id', direction: 'parent' },
        'aws_security_group': { via: 'vpc_id', direction: 'parent' },
        'aws_route_table': { via: 'vpc_id', direction: 'parent' },
        'aws_vpc_endpoint': { via: 'vpc_id', direction: 'parent' },
      },
    },
    'aws_subnet': {
      parentAttributes: ['vpc_id'],
      childAttributes: ['subnet_id', 'subnets'],
      networkRelationships: {
        'aws_vpc': { via: 'vpc_id', direction: 'child' },
        'aws_instance': { via: 'subnet_id', direction: 'parent' },
        'aws_lb': { via: 'subnets', direction: 'parent' },
        'aws_alb': { via: 'subnets', direction: 'parent' },
        'aws_elb': { via: 'subnets', direction: 'parent' },
        'aws_nat_gateway': { via: 'subnet_id', direction: 'parent' },
        'aws_network_interface': { via: 'subnet_id', direction: 'parent' },
        'aws_db_subnet_group': { via: 'subnet_ids', direction: 'parent' },
      },
    },
    'aws_security_group': {
      parentAttributes: ['vpc_id'],
      childAttributes: ['vpc_security_group_ids', 'security_group_ids', 'security_groups'],
      networkRelationships: {
        'aws_vpc': { via: 'vpc_id', direction: 'child' },
      },
      securityRelationships: {
        'aws_instance': { via: ['vpc_security_group_ids', 'security_group_ids'], direction: 'child' },
        'aws_lb': { via: 'security_groups', direction: 'child' },
        'aws_alb': { via: 'security_groups', direction: 'child' },
        'aws_db_instance': { via: 'vpc_security_group_ids', direction: 'child' },
        'aws_rds_cluster': { via: 'vpc_security_group_ids', direction: 'child' },
        'aws_elasticache_cluster': { via: 'security_group_ids', direction: 'child' },
      },
    },
    'aws_instance': {
      networkRelationships: {
        'aws_subnet': { via: 'subnet_id', direction: 'child' },
      },
      securityRelationships: {
        'aws_security_group': { via: ['vpc_security_group_ids', 'security_group_ids'], direction: 'child' },
      },
    },
    'aws_lb': {
      networkRelationships: {
        'aws_subnet': { via: 'subnets', direction: 'child' },
      },
      securityRelationships: {
        'aws_security_group': { via: 'security_groups', direction: 'child' },
      },
    },
    'aws_alb': {
      networkRelationships: {
        'aws_subnet': { via: 'subnets', direction: 'child' },
      },
      securityRelationships: {
        'aws_security_group': { via: 'security_groups', direction: 'child' },
      },
    },
    'aws_nat_gateway': {
      networkRelationships: {
        'aws_subnet': { via: 'subnet_id', direction: 'child' },
      },
    },
    'aws_internet_gateway': {
      networkRelationships: {
        'aws_vpc': { via: 'vpc_id', direction: 'child' },
      },
    },
    'aws_db_instance': {
      networkRelationships: {
        'aws_db_subnet_group': { via: 'db_subnet_group_name', direction: 'child' },
      },
      securityRelationships: {
        'aws_security_group': { via: 'vpc_security_group_ids', direction: 'child' },
      },
    },
    'aws_db_subnet_group': {
      networkRelationships: {
        'aws_subnet': { via: 'subnet_ids', direction: 'child' },
      },
    },
    'aws_route_table': {
      networkRelationships: {
        'aws_vpc': { via: 'vpc_id', direction: 'child' },
        'aws_subnet': { via: 'subnet_id', direction: 'parent' }, // via route_table_association
      },
    },
    'aws_route_table_association': {
      networkRelationships: {
        'aws_route_table': { via: 'route_table_id', direction: 'child' },
        'aws_subnet': { via: 'subnet_id', direction: 'child' },
      },
    },
    'aws_lambda_function': {
      networkRelationships: {
        'aws_vpc': { via: 'vpc_config', direction: 'child' },
      },
    },
    'aws_eks_cluster': {
      networkRelationships: {
        'aws_vpc': { via: 'vpc_config', direction: 'child' },
      },
    },
  },
  azurerm: {
    'azurerm_virtual_network': {
      childAttributes: ['virtual_network_name', 'virtual_network_id'],
      networkRelationships: {
        'azurerm_subnet': { via: 'virtual_network_name', direction: 'parent' },
        'azurerm_network_security_group': { via: 'virtual_network_name', direction: 'parent' },
      },
    },
    'azurerm_subnet': {
      parentAttributes: ['virtual_network_name', 'virtual_network_id'],
      networkRelationships: {
        'azurerm_virtual_network': { via: 'virtual_network_name', direction: 'child' },
        'azurerm_virtual_machine': { via: 'subnet_id', direction: 'parent' },
        'azurerm_linux_virtual_machine': { via: 'subnet_id', direction: 'parent' },
        'azurerm_windows_virtual_machine': { via: 'subnet_id', direction: 'parent' },
        'azurerm_lb': { via: 'subnet_id', direction: 'parent' },
        'azurerm_application_gateway': { via: 'subnet_id', direction: 'parent' },
      },
    },
    'azurerm_network_security_group': {
      securityRelationships: {
        'azurerm_virtual_machine': { via: 'network_security_group_id', direction: 'child' },
        'azurerm_linux_virtual_machine': { via: 'network_security_group_id', direction: 'child' },
        'azurerm_windows_virtual_machine': { via: 'network_security_group_id', direction: 'child' },
        'azurerm_subnet': { via: 'network_security_group_id', direction: 'child' },
      },
    },
    'azurerm_virtual_machine': {
      networkRelationships: {
        'azurerm_subnet': { via: 'subnet_id', direction: 'child' },
      },
      securityRelationships: {
        'azurerm_network_security_group': { via: 'network_security_group_id', direction: 'child' },
      },
    },
    'azurerm_linux_virtual_machine': {
      networkRelationships: {
        'azurerm_subnet': { via: 'subnet_id', direction: 'child' },
      },
      securityRelationships: {
        'azurerm_network_security_group': { via: 'network_security_group_id', direction: 'child' },
      },
    },
    'azurerm_sql_server': {
      networkRelationships: {
        'azurerm_sql_database': { via: 'server_name', direction: 'parent' },
      },
    },
    'azurerm_sql_database': {
      networkRelationships: {
        'azurerm_sql_server': { via: 'server_name', direction: 'child' },
      },
    },
    'azurerm_kubernetes_cluster': {
      networkRelationships: {
        'azurerm_virtual_network': { via: 'vnet_subnet_id', direction: 'child' },
      },
    },
    'azurerm_function_app': {
      networkRelationships: {
        'azurerm_virtual_network': { via: 'virtual_network_subnet_id', direction: 'child' },
      },
    },
  },
  google: {
    // Placeholder for GCP support
  },
  unknown: {},
}

/**
 * Extract provider name from resource type
 */
export function extractProvider(resourceType: string): Provider {
  if (resourceType.startsWith('aws_')) return 'aws'
  if (resourceType.startsWith('azurerm_')) return 'azurerm'
  if (resourceType.startsWith('google_')) return 'google'
  return 'unknown'
}

/**
 * Check if an attribute path matches a pattern
 */
function pathMatches(pathStr: string, pattern: string | string[]): boolean {
  const patterns = Array.isArray(pattern) ? pattern : [pattern]
  return patterns.some(p => {
    // Exact match
    if (pathStr === p) return true
    // Array index pattern (e.g., "subnets[0]" matches "subnets")
    if (pathStr.replace(/\[\d+\]/g, '') === p) return true
    // Nested path (e.g., "vpc_config.subnet_ids[0]" matches "vpc_config")
    if (pathStr.startsWith(p + '.')) return true
    return false
  })
}

/**
 * Classify relationship type based on source/target resource types and attribute path
 */
export function classifyRelationship(
  sourceType: string,
  targetType: string,
  attributePath: string[]
): RelationshipType {
  const provider = extractProvider(sourceType)
  const rules = PROVIDER_KNOWLEDGE[provider]?.[sourceType]

  if (!rules) return 'dependency'

  const pathStr = attributePath.join('.')

  // Check network relationships
  if (rules.networkRelationships?.[targetType]) {
    const rel = rules.networkRelationships[targetType]
    if (pathMatches(pathStr, rel.via)) {
      return 'network'
    }
  }

  // Check security relationships
  if (rules.securityRelationships?.[targetType]) {
    const rel = rules.securityRelationships[targetType]
    if (pathMatches(pathStr, rel.via)) {
      return 'security'
    }
  }

  return 'dependency'
}

/**
 * Get relationship rules for a resource type
 */
export function getResourceRules(provider: Provider, resourceType: string): ResourceRules | undefined {
  return PROVIDER_KNOWLEDGE[provider]?.[resourceType]
}