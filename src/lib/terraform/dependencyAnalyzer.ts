import type { TerraformResourceChange, TerraformPlan } from './terraformTypes'
import { extractAllResourceReferences } from './referenceScanner'

export interface TerraformDependency {
  source: string
  target: string
  type: 'explicit' | 'implicit' | 'network' | 'security'
  relationship: 'depends_on' | 'reference' | 'network' | 'security'
  metadata?: {
    protocol?: string
    ports?: string[]
    description?: string
    attributePath?: string[]
    confidence?: 'high' | 'medium' | 'low'
  }
}

/**
 * Extract resource address from a terraform reference string
 * e.g., "aws_vpc.main.id" -> "aws_vpc.main"
 * e.g., "aws_subnet.public_1.id" -> "aws_subnet.public_1"
 */
function extractResourceAddress(ref: string): string | null {
  if (typeof ref !== 'string') return null
  // Match pattern: resource_type.resource_name (with optional .property)
  const match = ref.match(/^([a-z_]+\.[a-z0-9_]+)/i)
  return match ? match[1] : null
}

/**
 * Find a resource by checking if the reference contains its address
 */
function findResourceByRef(
  resources: TerraformResourceChange[],
  ref: string | undefined | null
): TerraformResourceChange | undefined {
  if (!ref || typeof ref !== 'string') return undefined

  const address = extractResourceAddress(ref)
  if (address) {
    return resources.find(r => r.address === address)
  }

  // Fallback: check if ref includes any resource address
  return resources.find(r => ref.includes(r.address))
}

/**
 * Primary analysis: Use deep recursive scanning to find all resource references
 * Secondary: Use pattern matching as fallback/validation
 */
export function analyzeDependencies(plan: TerraformPlan): TerraformDependency[] {
  const deps: TerraformDependency[] = []
  const seen = new Set<string>() // Prevent duplicates

  const addDep = (dep: TerraformDependency) => {
    const key = `${dep.source}->${dep.target}`
    if (!seen.has(key)) {
      seen.add(key)
      deps.push(dep)
    }
  }

  // PRIMARY: Deep recursive scan of all attributes
  const deepScanReferences = extractAllResourceReferences(plan)
  for (const ref of deepScanReferences) {
    // Map relationship types to valid enum values
    const mapType = (rt: string): TerraformDependency['type'] => {
      if (rt === 'security' || rt === 'network') return rt
      if (rt === 'explicit') return 'explicit'
      return 'implicit'
    }
    const mapRelationship = (rt: string): TerraformDependency['relationship'] => {
      if (rt === 'security' || rt === 'network') return rt
      if (rt === 'depends_on') return 'depends_on'
      return 'reference'
    }
    addDep({
      source: ref.source,
      target: ref.target,
      type: mapType(ref.relationshipType),
      relationship: mapRelationship(ref.relationshipType),
      metadata: {
        attributePath: ref.attributePath,
        confidence: ref.confidence,
      },
    })
  }

  // SECONDARY: Pattern matching as fallback/validation
  // Only add if not already found by deep scan (low priority)
  const patternDeps: TerraformDependency[] = []
  extractNetworkConnections(plan.resource_changes).forEach(dep => patternDeps.push(dep))
  extractSecurityRelationships(plan.resource_changes).forEach(dep => patternDeps.push(dep))
  extractGatewayConnections(plan.resource_changes).forEach(dep => patternDeps.push(dep))
  extractLoadBalancerConnections(plan.resource_changes).forEach(dep => patternDeps.push(dep))
  extractDatabaseConnections(plan.resource_changes).forEach(dep => patternDeps.push(dep))
  extractComputeConnections(plan.resource_changes).forEach(dep => patternDeps.push(dep))
  extractStorageConnections(plan.resource_changes).forEach(dep => patternDeps.push(dep))

  // Add pattern-matching results only if not already found
  for (const dep of patternDeps) {
    const key = `${dep.source}->${dep.target}`
    if (!seen.has(key)) {
      // This is a fallback - mark with lower confidence
      addDep({
        ...dep,
        metadata: {
          ...dep.metadata,
          confidence: 'low',
        },
      })
    }
  }

  return deps
}

export function extractNetworkConnections(
  resources: TerraformResourceChange[]
): TerraformDependency[] {
  const deps: TerraformDependency[] = []

  // Find VPCs/VNets
  const vpcs = resources.filter(r =>
    r.type === 'aws_vpc' ||
    r.type === 'azurerm_virtual_network'
  )

  // Find Subnets
  const subnets = resources.filter(r =>
    r.type === 'aws_subnet' ||
    r.type === 'azurerm_subnet'
  )

  // VPC/VNet -> Subnet relationships
  for (const subnet of subnets) {
    const attrs = subnet.change.after || {}
    const vpcRef = attrs.vpc_id || attrs.virtual_network_name

    const vpc = findResourceByRef(vpcs, vpcRef)
    if (vpc) {
      deps.push({
        source: vpc.address,
        target: subnet.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  // Subnet -> Instance relationships
  const instances = resources.filter(r =>
    r.type === 'aws_instance' ||
    r.type === 'azurerm_virtual_machine' ||
    r.type === 'azurerm_linux_virtual_machine' ||
    r.type === 'azurerm_windows_virtual_machine'
  )

  for (const instance of instances) {
    const attrs = instance.change.after || {}
    const subnetRef = attrs.subnet_id

    const subnet = findResourceByRef(subnets, subnetRef)
    if (subnet) {
      deps.push({
        source: subnet.address,
        target: instance.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  return deps
}

export function extractGatewayConnections(
  resources: TerraformResourceChange[]
): TerraformDependency[] {
  const deps: TerraformDependency[] = []

  const vpcs = resources.filter(r =>
    r.type === 'aws_vpc' ||
    r.type === 'azurerm_virtual_network'
  )

  const subnets = resources.filter(r =>
    r.type === 'aws_subnet' ||
    r.type === 'azurerm_subnet'
  )

  // Internet Gateways -> VPC
  const igws = resources.filter(r => r.type === 'aws_internet_gateway')
  for (const igw of igws) {
    const vpcRef = igw.change.after?.vpc_id
    const vpc = findResourceByRef(vpcs, vpcRef)
    if (vpc) {
      deps.push({
        source: vpc.address,
        target: igw.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  // NAT Gateways -> Subnet
  const natGws = resources.filter(r => r.type === 'aws_nat_gateway')
  for (const nat of natGws) {
    const subnetRef = nat.change.after?.subnet_id
    const subnet = findResourceByRef(subnets, subnetRef)
    if (subnet) {
      deps.push({
        source: subnet.address,
        target: nat.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  // VPC Endpoints -> VPC
  const vpcEndpoints = resources.filter(r => r.type === 'aws_vpc_endpoint')
  for (const endpoint of vpcEndpoints) {
    const vpcRef = endpoint.change.after?.vpc_id
    const vpc = findResourceByRef(vpcs, vpcRef)
    if (vpc) {
      deps.push({
        source: vpc.address,
        target: endpoint.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  // Azure VPN/VNet Gateways -> VNet (via subnet)
  const azureGateways = resources.filter(r =>
    r.type === 'azurerm_virtual_network_gateway' ||
    r.type === 'azurerm_vpn_gateway'
  )
  for (const gw of azureGateways) {
    // Find the hub vnet (gateways are typically in hub)
    const hubVnet = vpcs.find(v => v.change.after?.name?.includes('hub'))
    if (hubVnet) {
      deps.push({
        source: hubVnet.address,
        target: gw.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  // Azure Application Gateway -> VNet
  const appGateways = resources.filter(r => r.type === 'azurerm_application_gateway')
  for (const gw of appGateways) {
    // Connect to first vnet found (typically app spoke)
    if (vpcs.length > 0) {
      deps.push({
        source: vpcs[0].address,
        target: gw.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  return deps
}

export function extractLoadBalancerConnections(
  resources: TerraformResourceChange[]
): TerraformDependency[] {
  const deps: TerraformDependency[] = []

  const subnets = resources.filter(r =>
    r.type === 'aws_subnet' ||
    r.type === 'azurerm_subnet'
  )

  // AWS Load Balancers -> Subnets
  const awsLbs = resources.filter(r =>
    r.type === 'aws_lb' ||
    r.type === 'aws_alb' ||
    r.type === 'aws_elb'
  )

  for (const lb of awsLbs) {
    const subnetRefs = lb.change.after?.subnets || []
    if (Array.isArray(subnetRefs)) {
      for (const subnetRef of subnetRefs) {
        const subnet = findResourceByRef(subnets, subnetRef)
        if (subnet) {
          deps.push({
            source: subnet.address,
            target: lb.address,
            type: 'network',
            relationship: 'network',
          })
        }
      }
    }
  }

  // Azure Load Balancers -> VNet (simplified)
  const azureLbs = resources.filter(r =>
    r.type === 'azurerm_lb' ||
    r.type === 'azurerm_load_balancer'
  )

  const vnets = resources.filter(r => r.type === 'azurerm_virtual_network')
  for (const lb of azureLbs) {
    // Connect to first vnet (internal LBs are typically in app spoke)
    if (vnets.length > 0) {
      deps.push({
        source: vnets[0].address,
        target: lb.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  return deps
}

export function extractDatabaseConnections(
  resources: TerraformResourceChange[]
): TerraformDependency[] {
  const deps: TerraformDependency[] = []

  const vpcs = resources.filter(r =>
    r.type === 'aws_vpc' ||
    r.type === 'azurerm_virtual_network'
  )

  // AWS RDS -> VPC (via db_subnet_group implied)
  const rdsDbs = resources.filter(r =>
    r.type === 'aws_db_instance' ||
    r.type === 'aws_rds_cluster'
  )

  for (const db of rdsDbs) {
    // RDS is typically connected to the VPC
    if (vpcs.length > 0) {
      const awsVpc = vpcs.find(v => v.type === 'aws_vpc')
      if (awsVpc) {
        deps.push({
          source: awsVpc.address,
          target: db.address,
          type: 'network',
          relationship: 'network',
        })
      }
    }
  }

  // AWS ElastiCache -> VPC
  const cacheClusters = resources.filter(r => r.type === 'aws_elasticache_cluster')
  for (const cache of cacheClusters) {
    const awsVpc = vpcs.find(v => v.type === 'aws_vpc')
    if (awsVpc) {
      deps.push({
        source: awsVpc.address,
        target: cache.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  // Link SQL databases to their servers
  const sqlServers = resources.filter(r => r.type === 'azurerm_sql_server')
  const sqlDatabases = resources.filter(r => r.type === 'azurerm_sql_database')
  for (const db of sqlDatabases) {
    const serverName = db.change.after?.server_name
    const server = sqlServers.find(s => s.change.after?.name === serverName)
    if (server) {
      deps.push({
        source: server.address,
        target: db.address,
        type: 'network',
        relationship: 'reference',
      })
    }
  }

  // Azure Cosmos DB, Redis -> connect to data vnet
  const azureData = resources.filter(r =>
    r.type === 'azurerm_cosmosdb_account' ||
    r.type === 'azurerm_redis_cache'
  )

  const dataVnet = vpcs.find(v =>
    v.type === 'azurerm_virtual_network' &&
    (v.change.after?.name?.includes('data') || v.change.after?.name?.includes('spoke'))
  )

  for (const resource of azureData) {
    if (dataVnet) {
      deps.push({
        source: dataVnet.address,
        target: resource.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  return deps
}

export function extractComputeConnections(
  resources: TerraformResourceChange[]
): TerraformDependency[] {
  const deps: TerraformDependency[] = []

  const vpcs = resources.filter(r =>
    r.type === 'aws_vpc' ||
    r.type === 'azurerm_virtual_network'
  )

  // AWS EKS -> VPC
  const eksClusters = resources.filter(r => r.type === 'aws_eks_cluster')
  for (const eks of eksClusters) {
    const awsVpc = vpcs.find(v => v.type === 'aws_vpc')
    if (awsVpc) {
      deps.push({
        source: awsVpc.address,
        target: eks.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  // Azure AKS -> VNet
  const aksClusters = resources.filter(r => r.type === 'azurerm_kubernetes_cluster')
  for (const aks of aksClusters) {
    // Connect to app spoke vnet
    const appVnet = vpcs.find(v =>
      v.type === 'azurerm_virtual_network' &&
      v.change.after?.name?.includes('app')
    ) || vpcs.find(v => v.type === 'azurerm_virtual_network')

    if (appVnet) {
      deps.push({
        source: appVnet.address,
        target: aks.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  // AWS Lambda -> VPC (if VPC config exists)
  const lambdas = resources.filter(r => r.type === 'aws_lambda_function')
  for (const lambda of lambdas) {
    const vpcConfig = lambda.change.after?.vpc_config
    if (vpcConfig) {
      const awsVpc = vpcs.find(v => v.type === 'aws_vpc')
      if (awsVpc) {
        deps.push({
          source: awsVpc.address,
          target: lambda.address,
          type: 'network',
          relationship: 'network',
        })
      }
    }
  }

  // Azure Functions -> VNet (via vnet_integration)
  const azureFuncs = resources.filter(r => r.type === 'azurerm_function_app')
  for (const func of azureFuncs) {
    const appVnet = vpcs.find(v => v.type === 'azurerm_virtual_network')
    if (appVnet) {
      deps.push({
        source: appVnet.address,
        target: func.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  // Azure Container Registry -> connect to AKS
  const acrs = resources.filter(r => r.type === 'azurerm_container_registry')
  for (const acr of acrs) {
    const aks = aksClusters[0]
    if (aks) {
      deps.push({
        source: acr.address,
        target: aks.address,
        type: 'implicit',
        relationship: 'reference',
      })
    }
  }

  return deps
}

export function extractStorageConnections(
  resources: TerraformResourceChange[]
): TerraformDependency[] {
  const deps: TerraformDependency[] = []

  // Azure Storage Account -> VNet (typically via service endpoints)
  const storageAccounts = resources.filter(r => r.type === 'azurerm_storage_account')
  const vnets = resources.filter(r => r.type === 'azurerm_virtual_network')

  for (const storage of storageAccounts) {
    // Connect to data vnet or first vnet
    const dataVnet = vnets.find(v =>
      v.change.after?.name?.includes('data')
    ) || vnets[0]

    if (dataVnet) {
      deps.push({
        source: dataVnet.address,
        target: storage.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  // AWS EFS -> VPC
  const efsFileSystems = resources.filter(r => r.type === 'aws_efs_file_system')
  const vpcs = resources.filter(r => r.type === 'aws_vpc')

  for (const efs of efsFileSystems) {
    const vpc = vpcs[0]
    if (vpc) {
      deps.push({
        source: vpc.address,
        target: efs.address,
        type: 'network',
        relationship: 'network',
      })
    }
  }

  return deps
}

export function extractSecurityRelationships(
  resources: TerraformResourceChange[]
): TerraformDependency[] {
  const deps: TerraformDependency[] = []

  // Find security groups
  const securityGroups = resources.filter(r =>
    r.type === 'aws_security_group' ||
    r.type === 'azurerm_network_security_group'
  )

  const vpcs = resources.filter(r =>
    r.type === 'aws_vpc' ||
    r.type === 'azurerm_virtual_network'
  )

  // Security Groups -> VPC
  for (const sg of securityGroups) {
    const vpcRef = sg.change.after?.vpc_id
    const vpc = findResourceByRef(vpcs, vpcRef)
    if (vpc) {
      deps.push({
        source: vpc.address,
        target: sg.address,
        type: 'security',
        relationship: 'security',
      })
    }
  }

  // Find compute resources
  const computeResources = resources.filter(r =>
    r.type === 'aws_instance' ||
    r.type === 'azurerm_virtual_machine' ||
    r.type === 'azurerm_linux_virtual_machine' ||
    r.type === 'azurerm_windows_virtual_machine'
  )

  // Security Groups -> Instances
  for (const instance of computeResources) {
    const sgIds = instance.change.after?.vpc_security_group_ids ||
                  instance.change.after?.security_group_ids || []

    if (Array.isArray(sgIds)) {
      for (const sgId of sgIds) {
        // Try to find by ID match or reference
        let sg = securityGroups.find(s => {
          const sgIdValue = s.change.after?.id
          return sgIdValue === sgId || String(sgIdValue) === String(sgId)
        })

        // Also try reference matching
        if (!sg && typeof sgId === 'string') {
          sg = findResourceByRef(securityGroups, sgId)
        }

        if (sg) {
          deps.push({
            source: sg.address,
            target: instance.address,
            type: 'security',
            relationship: 'security',
          })
        }
      }
    }
  }

  return deps
}

