/**
 * Test: Production AWS Infrastructure Topology
 *
 * Tests a realistic production AWS infrastructure with:
 * - Multi-AZ deployment across 2 availability zones
 * - 3-tier architecture (web, application, database)
 * - Load balancer with proper subnet placement
 * - Multiple databases (RDS PostgreSQL, ElastiCache Redis, DynamoDB)
 * - Serverless functions (Lambda with VPC config)
 * - Storage (S3 buckets)
 * - Proper security group assignments
 *
 * This fixture uses realistic AWS resource IDs (not Terraform references)
 * to test the boundaryIdMap parent matching functionality.
 */

import { describe, it, expect } from 'vitest'
import { parseTerraformPlan, extractChangeSummary } from '@/lib/terraform/planParser'
import { analyzeDependencies } from '@/lib/terraform/dependencyAnalyzer'
import { convertTerraformPlanToNodes } from '@/lib/terraform/stateConverter'
import productionInfra from '../../fixtures/terraform/fixtures/production-aws-infrastructure.json'

describe('Production AWS Infrastructure Topology', () => {
  it('should parse production infrastructure plan', () => {
    const plan = parseTerraformPlan(JSON.stringify(productionInfra))

    expect(plan).toBeDefined()
    expect(plan.resource_changes).toHaveLength(21) // Total resources
  })

  it('should identify correct resource counts by category', () => {
    const summary = extractChangeSummary(productionInfra)

    expect(summary.create).toBe(21)
    expect(summary.total).toBe(21)

    // Count resource types
    const resourceTypes = productionInfra.resource_changes.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    expect(resourceTypes['aws_vpc']).toBe(1)
    expect(resourceTypes['aws_subnet']).toBe(5) // 2 public web + 2 private app + 1 private data
    expect(resourceTypes['aws_security_group']).toBe(4) // ALB, web, app, database
    expect(resourceTypes['aws_instance']).toBe(4) // 2 web + 2 app servers
    expect(resourceTypes['aws_lambda_function']).toBe(1) // API gateway
    expect(resourceTypes['aws_s3_bucket']).toBe(2) // Assets + backups
    expect(resourceTypes['aws_dynamodb_table']).toBe(1) // Sessions
  })

  it('should convert all resources to topology nodes', () => {
    const dependencies = analyzeDependencies(productionInfra)
    const result = convertTerraformPlanToNodes({
      plan: productionInfra,
      resourceMappings: new Map(),
      dependencies,
      layoutStrategy: 'auto'
    })

    expect(result.nodes).toHaveLength(21)
    // Edges may be 0 since containment is via parentId, not edges
  })

  it('should correctly identify 3-tier architecture', () => {
    const dependencies = analyzeDependencies(productionInfra)
    const result = convertTerraformPlanToNodes({
      plan: productionInfra,
      resourceMappings: new Map(),
      dependencies,
      layoutStrategy: 'auto'
    })

    // Web tier
    const webServers = result.nodes.filter(n =>
      n.data.terraformType === 'aws_instance' &&
      n.data.afterAttributes?.tags?.Tier === 'web'
    )
    expect(webServers).toHaveLength(2)

    // Application tier
    const appServers = result.nodes.filter(n =>
      n.data.terraformType === 'aws_instance' &&
      n.data.afterAttributes?.tags?.Tier === 'application'
    )
    expect(appServers).toHaveLength(2)

    // Database tier
    const databases = result.nodes.filter(n =>
      n.data.terraformType === 'aws_db_instance' ||
      n.data.afterAttributes?.tags?.Tier === 'database'
    )
    expect(databases.length).toBeGreaterThan(0)
  })

  it('should map load balancer correctly', () => {
    const dependencies = analyzeDependencies(productionInfra)
    const result = convertTerraformPlanToNodes({
      plan: productionInfra,
      resourceMappings: new Map(),
      dependencies,
      layoutStrategy: 'auto'
    })

    const loadBalancer = result.nodes.find(n =>
      n.data.terraformAddress === 'aws_lb.main'
    )

    expect(loadBalancer).toBeDefined()
    expect(loadBalancer?.data.deviceType).toBe('load-balancers')
    expect(loadBalancer?.data.name).toBe('Production Application Load Balancer')
  })

  it('should map all database resources correctly', () => {
    const dependencies = analyzeDependencies(productionInfra)
    const result = convertTerraformPlanToNodes({
      plan: productionInfra,
      resourceMappings: new Map(),
      dependencies,
      layoutStrategy: 'auto'
    })

    // PostgreSQL RDS
    const rds = result.nodes.find(n => n.data.terraformAddress === 'aws_db_instance.primary')
    expect(rds).toBeDefined()
    expect(rds?.data.deviceType).toBe('sql-database')
    expect(rds?.data.name).toBe('Production PostgreSQL Primary')

    // Redis ElastiCache
    const redis = result.nodes.find(n => n.data.terraformAddress === 'aws_elasticache_cluster.redis')
    expect(redis).toBeDefined()
    expect(redis?.data.deviceType).toBe('cache-redis')

    // DynamoDB tables
    const dynamoTables = result.nodes.filter(n =>
      n.data.terraformType === 'aws_dynamodb_table'
    )
    expect(dynamoTables).toHaveLength(1)
  })

  it('should map Lambda functions correctly', () => {
    const dependencies = analyzeDependencies(productionInfra)
    const result = convertTerraformPlanToNodes({
      plan: productionInfra,
      resourceMappings: new Map(),
      dependencies,
      layoutStrategy: 'auto'
    })

    const lambdaFunctions = result.nodes.filter(n =>
      n.data.terraformType === 'aws_lambda_function'
    )

    expect(lambdaFunctions).toHaveLength(1)

    const apiLambda = result.nodes.find(n =>
      n.data.terraformAddress === 'aws_lambda_function.api_gateway'
    )
    expect(apiLambda?.data.deviceType).toBe('function-apps')
    expect(apiLambda?.data.name).toBe('API Gateway Lambda')

    // Lambda with VPC config should have parent boundary
    expect(apiLambda?.parentId).toBeDefined()
  })

  it('should map S3 buckets correctly', () => {
    const dependencies = analyzeDependencies(productionInfra)
    const result = convertTerraformPlanToNodes({
      plan: productionInfra,
      resourceMappings: new Map(),
      dependencies,
      layoutStrategy: 'auto'
    })

    const s3Buckets = result.nodes.filter(n =>
      n.data.terraformType === 'aws_s3_bucket'
    )

    expect(s3Buckets).toHaveLength(2)
    expect(s3Buckets[0].data.deviceType).toBe('storage-accounts')
  })

  it('should nest subnets inside VPC via parentId', () => {
    const dependencies = analyzeDependencies(productionInfra)
    const result = convertTerraformPlanToNodes({
      plan: productionInfra,
      resourceMappings: new Map(),
      dependencies,
      layoutStrategy: 'auto'
    })

    // All subnets should have the VPC as parent
    const subnets = result.nodes.filter(n => n.data.terraformType === 'aws_subnet')
    expect(subnets.length).toBe(5)

    subnets.forEach(subnet => {
      expect(subnet.parentId).toBe('aws_vpc.production')
    })
  })

  it('should nest instances inside subnets via parentId', () => {
    const dependencies = analyzeDependencies(productionInfra)
    const result = convertTerraformPlanToNodes({
      plan: productionInfra,
      resourceMappings: new Map(),
      dependencies,
      layoutStrategy: 'auto'
    })

    // All instances should have a subnet as parent
    const instances = result.nodes.filter(n => n.data.terraformType === 'aws_instance')
    expect(instances.length).toBe(4)

    instances.forEach(instance => {
      expect(instance.parentId).toBeDefined()
      expect(instance.parentId?.startsWith('aws_subnet.')).toBe(true)
    })
  })

  it('should handle multi-AZ deployment', () => {
    const dependencies = analyzeDependencies(productionInfra)
    const result = convertTerraformPlanToNodes({
      plan: productionInfra,
      resourceMappings: new Map(),
      dependencies,
      layoutStrategy: 'auto'
    })

    // Check for resources in different AZs
    const az1Resources = result.nodes.filter(n =>
      n.data.afterAttributes?.availability_zone === 'us-east-1a'
    )

    const az2Resources = result.nodes.filter(n =>
      n.data.afterAttributes?.availability_zone === 'us-east-1b'
    )

    expect(az1Resources.length).toBeGreaterThan(0)
    expect(az2Resources.length).toBeGreaterThan(0)
  })

  it('should preserve all Terraform attributes', () => {
    const dependencies = analyzeDependencies(productionInfra)
    const result = convertTerraformPlanToNodes({
      plan: productionInfra,
      resourceMappings: new Map(),
      dependencies,
      layoutStrategy: 'auto'
    })

    result.nodes.forEach(node => {
      // Every node should have Terraform metadata
      expect(node.data.terraformAddress).toBeDefined()
      expect(node.data.terraformType).toBeDefined()
      expect(node.data.changeType).toBe('create')

      // Should have attributes
      expect(node.data.afterAttributes).toBeDefined()
    })
  })

  it('should generate a complete topology summary', () => {
    const dependencies = analyzeDependencies(productionInfra)
    const result = convertTerraformPlanToNodes({
      plan: productionInfra,
      resourceMappings: new Map(),
      dependencies,
      layoutStrategy: 'auto'
    })

    // Summary of topology
    const summary = {
      totalNodes: result.nodes.length,
      totalEdges: result.edges.length,
      nodesWithParent: result.nodes.filter(n => n.parentId).length,
      nodesByType: result.nodes.reduce((acc, n) => {
        const type = n.type === 'boundary' ? 'boundary' : (n.data.deviceType || 'unknown')
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }

    expect(summary.totalNodes).toBe(21)
    expect(summary.nodesWithParent).toBeGreaterThan(0) // Devices should be nested in boundaries
    expect(Object.keys(summary.nodesByType).length).toBeGreaterThan(5) // Multiple device types

    console.log('Production Infrastructure Topology Summary:')
    console.log(`  Total Nodes: ${summary.totalNodes}`)
    console.log(`  Total Edges: ${summary.totalEdges}`)
    console.log(`  Nodes with Parent: ${summary.nodesWithParent}`)
    console.log('  Nodes by Type:')
    Object.entries(summary.nodesByType).forEach(([type, count]) => {
      console.log(`    - ${type}: ${count}`)
    })
  })
})
