/**
 * End-to-End Test: Terraform to Topology Conversion
 *
 * This test verifies that Terraform plan JSON can be:
 * 1. Parsed correctly
 * 2. Converted to topology nodes and edges
 * 3. Dependencies are correctly identified
 * 4. Resources are mapped to correct device types
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { parseTerraformPlan, extractChangeSummary } from '@/lib/terraform/planParser'
import { analyzeDependencies } from '@/lib/terraform/dependencyAnalyzer'
import { convertTerraformPlanToNodes } from '@/lib/terraform/stateConverter'
import { useTerraformStore } from '@/core/stores/useTerraformStore'

// Test fixture: Comprehensive AWS infrastructure
const comprehensiveAwsPlan = {
  "format_version": "1.0",
  "terraform_version": "1.5.0",
  "resource_changes": [
    // Network Infrastructure
    {
      "address": "aws_vpc.main",
      "type": "aws_vpc",
      "name": "main",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "cidr_block": "10.0.0.0/16",
          "enable_dns_hostnames": true,
          "enable_dns_support": true,
          "tags": {
            "Name": "production-vpc",
            "Environment": "production"
          }
        }
      }
    },
    {
      "address": "aws_subnet.public_a",
      "type": "aws_subnet",
      "name": "public_a",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "vpc_id": "aws_vpc.main.id",
          "cidr_block": "10.0.1.0/24",
          "availability_zone": "us-east-1a",
          "map_public_ip_on_launch": true,
          "tags": {
            "Name": "public-subnet-a"
          }
        }
      }
    },
    {
      "address": "aws_subnet.public_b",
      "type": "aws_subnet",
      "name": "public_b",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "vpc_id": "aws_vpc.main.id",
          "cidr_block": "10.0.2.0/24",
          "availability_zone": "us-east-1b",
          "map_public_ip_on_launch": true,
          "tags": {
            "Name": "public-subnet-b"
          }
        }
      }
    },
    {
      "address": "aws_subnet.private_a",
      "type": "aws_subnet",
      "name": "private_a",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "vpc_id": "aws_vpc.main.id",
          "cidr_block": "10.0.10.0/24",
          "availability_zone": "us-east-1a",
          "tags": {
            "Name": "private-subnet-a"
          }
        }
      }
    },
    {
      "address": "aws_internet_gateway.main",
      "type": "aws_internet_gateway",
      "name": "main",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "vpc_id": "aws_vpc.main.id",
          "tags": {
            "Name": "main-igw"
          }
        }
      }
    },
    {
      "address": "aws_nat_gateway.main",
      "type": "aws_nat_gateway",
      "name": "main",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "subnet_id": "aws_subnet.public_a.id",
          "tags": {
            "Name": "main-nat-gateway"
          }
        }
      }
    },
    // Security
    {
      "address": "aws_security_group.web",
      "type": "aws_security_group",
      "name": "web",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "vpc_id": "aws_vpc.main.id",
          "id": "sg-web-12345",
          "name": "web-security-group",
          "description": "Security group for web servers",
          "tags": {
            "Name": "web-sg"
          }
        }
      }
    },
    {
      "address": "aws_security_group.db",
      "type": "aws_security_group",
      "name": "db",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "vpc_id": "aws_vpc.main.id",
          "id": "sg-db-67890",
          "name": "database-security-group",
          "description": "Security group for database servers",
          "tags": {
            "Name": "db-sg"
          }
        }
      }
    },
    // Compute
    {
      "address": "aws_instance.web_1",
      "type": "aws_instance",
      "name": "web_1",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "instance_type": "t3.medium",
          "ami": "ami-0c55b159cbfafe1f0",
          "subnet_id": "aws_subnet.public_a.id",
          "vpc_security_group_ids": ["sg-web-12345"],
          "tags": {
            "Name": "web-server-1",
            "Role": "web"
          }
        }
      }
    },
    {
      "address": "aws_instance.web_2",
      "type": "aws_instance",
      "name": "web_2",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "instance_type": "t3.medium",
          "ami": "ami-0c55b159cbfafe1f0",
          "subnet_id": "aws_subnet.public_b.id",
          "vpc_security_group_ids": ["sg-web-12345"],
          "tags": {
            "Name": "web-server-2",
            "Role": "web"
          }
        }
      }
    },
    {
      "address": "aws_lb.main",
      "type": "aws_lb",
      "name": "main",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "load_balancer_type": "application",
          "subnets": ["aws_subnet.public_a.id", "aws_subnet.public_b.id"],
          "tags": {
            "Name": "main-alb"
          }
        }
      }
    },
    // Databases
    {
      "address": "aws_db_instance.main",
      "type": "aws_db_instance",
      "name": "main",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "engine": "postgres",
          "engine_version": "14.7",
          "instance_class": "db.t3.medium",
          "allocated_storage": 100,
          "storage_type": "gp3",
          "tags": {
            "Name": "production-postgres"
          }
        }
      }
    },
    {
      "address": "aws_dynamodb_table.sessions",
      "type": "aws_dynamodb_table",
      "name": "sessions",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "name": "user-sessions",
          "billing_mode": "PAY_PER_REQUEST",
          "hash_key": "userId",
          "tags": {
            "Name": "session-table"
          }
        }
      }
    },
    // Storage
    {
      "address": "aws_s3_bucket.assets",
      "type": "aws_s3_bucket",
      "name": "assets",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "bucket": "production-assets-bucket",
          "acl": "private",
          "tags": {
            "Name": "assets-bucket"
          }
        }
      }
    },
    // Serverless
    {
      "address": "aws_lambda_function.api_handler",
      "type": "aws_lambda_function",
      "name": "api_handler",
      "provider_name": "aws",
      "mode": "managed",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "function_name": "api-handler",
          "runtime": "nodejs18.x",
          "handler": "index.handler",
          "memory_size": 512,
          "timeout": 30,
          "tags": {
            "Name": "api-lambda"
          }
        }
      }
    }
  ]
}

describe('Terraform to Topology E2E', () => {
  beforeEach(() => {
    // Reset store state
    useTerraformStore.setState({
      currentPlan: null,
      beforeState: null,
      afterState: null,
      viewMode: 'diff'
    })
  })

  describe('Plan Parsing', () => {
    it('should parse a comprehensive Terraform plan', () => {
      const planString = JSON.stringify(comprehensiveAwsPlan)
      const plan = parseTerraformPlan(planString)

      expect(plan).toBeDefined()
      expect(plan.format_version).toBe('1.0')
      expect(plan.terraform_version).toBe('1.5.0')
      expect(plan.resource_changes).toHaveLength(15)
    })

    it('should extract correct change summary', () => {
      const summary = extractChangeSummary(comprehensiveAwsPlan)

      expect(summary.create).toBe(15)
      expect(summary.update).toBe(0)
      expect(summary.delete).toBe(0)
      expect(summary.total).toBe(15)
    })

    it('should handle all resource types', () => {
      const resourceTypes = comprehensiveAwsPlan.resource_changes.map(r => r.type)
      const uniqueTypes = new Set(resourceTypes)

      expect(uniqueTypes.size).toBe(11) // 11 unique resource types
      expect(uniqueTypes).toContain('aws_vpc')
      expect(uniqueTypes).toContain('aws_subnet')
      expect(uniqueTypes).toContain('aws_instance')
      expect(uniqueTypes).toContain('aws_security_group')
      expect(uniqueTypes).toContain('aws_lb')
      expect(uniqueTypes).toContain('aws_db_instance')
      expect(uniqueTypes).toContain('aws_lambda_function')
    })
  })

  describe('Dependency Analysis', () => {
    it('should identify network dependencies', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)

      // Should find VPC -> Subnet relationships
      const vpcSubnetDeps = dependencies.filter(
        d => d.source === 'aws_vpc.main' && d.target.startsWith('aws_subnet.')
      )
      expect(vpcSubnetDeps.length).toBeGreaterThan(0)
    })

    it('should identify subnet to instance relationships', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)

      // Should find Subnet -> Instance relationships
      const subnetInstanceDeps = dependencies.filter(
        d => d.source.startsWith('aws_subnet.') && d.target.startsWith('aws_instance.')
      )
      expect(subnetInstanceDeps.length).toBeGreaterThan(0)
    })

    it('should identify security group relationships', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)

      // Should find SecurityGroup -> Instance relationships
      const securityDeps = dependencies.filter(
        d => d.source.startsWith('aws_security_group.') && d.type === 'security'
      )
      expect(securityDeps.length).toBeGreaterThan(0)
    })
  })

  describe('Topology Conversion', () => {
    it('should convert all resources to nodes', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      expect(result.nodes).toHaveLength(15)
      expect(result.edges.length).toBeGreaterThan(0)
    })

    it('should correctly map AWS resources to device types', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      // Check VPC mapping (boundary node with label, not device with name)
      const vpc = result.nodes.find(n => n.data.terraformAddress === 'aws_vpc.main')
      expect(vpc).toBeDefined()
      expect(vpc?.type).toBe('boundary')
      expect(vpc?.data.label).toBe('production-vpc')
      expect(vpc?.data.type).toBe('network_segment')

      // Check EC2 instance mapping (device node)
      const instance = result.nodes.find(n => n.data.terraformAddress === 'aws_instance.web_1')
      expect(instance).toBeDefined()
      expect(instance?.data.deviceType).toBe('virtual-machine')
      expect(instance?.data.name).toBe('web-server-1')

      // Check RDS mapping
      const rds = result.nodes.find(n => n.data.terraformAddress === 'aws_db_instance.main')
      expect(rds).toBeDefined()
      expect(rds?.data.deviceType).toBe('sql-database')
      expect(rds?.data.name).toBe('production-postgres')

      // Check Lambda mapping
      const lambda = result.nodes.find(n => n.data.terraformAddress === 'aws_lambda_function.api_handler')
      expect(lambda).toBeDefined()
      expect(lambda?.data.deviceType).toBe('function-apps')
      expect(lambda?.data.name).toBe('api-lambda')

      // Check Load Balancer mapping
      const lb = result.nodes.find(n => n.data.terraformAddress === 'aws_lb.main')
      expect(lb).toBeDefined()
      expect(lb?.data.deviceType).toBe('load-balancers')

      // Check S3 mapping
      const s3 = result.nodes.find(n => n.data.terraformAddress === 'aws_s3_bucket.assets')
      expect(s3).toBeDefined()
      expect(s3?.data.deviceType).toBe('storage-accounts')
    })

    it('should create edges between related nodes', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      expect(result.edges.length).toBeGreaterThan(0)

      // Each edge should have valid source and target
      result.edges.forEach(edge => {
        const sourceNode = result.nodes.find(n => n.id === edge.source)
        const targetNode = result.nodes.find(n => n.id === edge.target)

        expect(sourceNode).toBeDefined()
        expect(targetNode).toBeDefined()
      })
    })

    it('should apply auto-layout positions', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      // All nodes should have position
      result.nodes.forEach(node => {
        expect(node.position).toBeDefined()
        expect(typeof node.position.x).toBe('number')
        expect(typeof node.position.y).toBe('number')
      })
    })

    it('should preserve Terraform metadata in nodes', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      result.nodes.forEach(node => {
        expect(node.data.terraformAddress).toBeDefined()
        expect(node.data.terraformType).toBeDefined()
        expect(node.data.changeType).toBe('create')
      })
    })

    it('should use terraform address as node ID with exact mapping', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      // Verify 1:1 mapping
      expect(result.nodes.length).toBe(comprehensiveAwsPlan.resource_changes.length)

      // Verify every resource's address becomes a node with matching id
      comprehensiveAwsPlan.resource_changes.forEach(resource => {
        const node = result.nodes.find(n => n.id === resource.address)
        expect(node).toBeDefined()
        expect(node?.data.terraformAddress).toBe(resource.address)
        expect(node?.id).toBe(resource.address)
      })
    })

    it('should create nodes with all required properties', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      result.nodes.forEach(node => {
        expect(node.id).toBeDefined()
        // Nodes can be either 'device' or 'boundary' (VPCs, Subnets become boundaries)
        expect(['device', 'boundary']).toContain(node.type)
        expect(node.position).toBeDefined()
        expect(node.data.terraformAddress).toBeDefined()
        expect(node.data.terraformType).toBeDefined()

        // Device nodes have deviceType, boundary nodes have type (boundaryType)
        if (node.type === 'device') {
          expect(node.data.deviceType).toBeDefined()
        } else {
          expect(node.data.type).toBeDefined() // boundaryType like 'network_segment', 'security_zone'
        }
      })
    })

    it('should create edge count matching valid non-containment dependencies', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      // Helper functions matching the converter's logic
      const isVpcAddress = (addr: string) =>
        ['aws_vpc', 'azurerm_virtual_network', 'google_compute_network'].some(t => addr.includes(t))
      const isSubnetAddress = (addr: string) =>
        ['aws_subnet', 'azurerm_subnet', 'google_compute_subnetwork'].some(t => addr.includes(t))

      // Calculate valid dependencies (those where both source and target nodes exist)
      // Also filter out containment relationships which don't create edges
      const validDeps = dependencies.filter(dep => {
        const sourceNode = result.nodes.find(n => n.data.terraformAddress === dep.source)
        const targetNode = result.nodes.find(n => n.data.terraformAddress === dep.target)
        if (!sourceNode || !targetNode) return false

        // Filter out containment relationships (both directions):
        // VPC ↔ Subnet
        const isVpcSubnetContainment =
          (isVpcAddress(dep.target) && isSubnetAddress(dep.source)) ||
          (isVpcAddress(dep.source) && isSubnetAddress(dep.target))

        // Subnet ↔ Device
        const isSubnetDeviceContainment =
          (isSubnetAddress(dep.target) && sourceNode.type === 'device') ||
          (isSubnetAddress(dep.source) && targetNode.type === 'device')

        // VPC ↔ Device
        const isVpcDeviceContainment =
          (isVpcAddress(dep.target) && sourceNode.type === 'device') ||
          (isVpcAddress(dep.source) && targetNode.type === 'device')

        // Any boundary ↔ device edge
        const isBoundaryDeviceEdge =
          (sourceNode.type === 'boundary' && targetNode.type === 'device') ||
          (sourceNode.type === 'device' && targetNode.type === 'boundary')

        return !isVpcSubnetContainment && !isSubnetDeviceContainment &&
               !isVpcDeviceContainment && !isBoundaryDeviceEdge
      })

      expect(result.edges.length).toBe(validDeps.length)
    })

    it('should create edges for all valid non-containment dependencies', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      // Helper functions matching the converter's logic
      const isVpcAddress = (addr: string) =>
        ['aws_vpc', 'azurerm_virtual_network', 'google_compute_network'].some(t => addr.includes(t))
      const isSubnetAddress = (addr: string) =>
        ['aws_subnet', 'azurerm_subnet', 'google_compute_subnetwork'].some(t => addr.includes(t))

      // Filter valid dependencies, excluding containment relationships (both directions)
      const validDeps = dependencies.filter(dep => {
        const sourceNode = result.nodes.find(n => n.data.terraformAddress === dep.source)
        const targetNode = result.nodes.find(n => n.data.terraformAddress === dep.target)
        if (!sourceNode || !targetNode) return false

        // Filter out containment relationships (both directions):
        // VPC ↔ Subnet
        const isVpcSubnetContainment =
          (isVpcAddress(dep.target) && isSubnetAddress(dep.source)) ||
          (isVpcAddress(dep.source) && isSubnetAddress(dep.target))

        // Subnet ↔ Device
        const isSubnetDeviceContainment =
          (isSubnetAddress(dep.target) && sourceNode.type === 'device') ||
          (isSubnetAddress(dep.source) && targetNode.type === 'device')

        // VPC ↔ Device
        const isVpcDeviceContainment =
          (isVpcAddress(dep.target) && sourceNode.type === 'device') ||
          (isVpcAddress(dep.source) && targetNode.type === 'device')

        // Any boundary ↔ device edge
        const isBoundaryDeviceEdge =
          (sourceNode.type === 'boundary' && targetNode.type === 'device') ||
          (sourceNode.type === 'device' && targetNode.type === 'boundary')

        return !isVpcSubnetContainment && !isSubnetDeviceContainment &&
               !isVpcDeviceContainment && !isBoundaryDeviceEdge
      })

      // For each valid non-containment dependency, verify corresponding edge exists
      validDeps.forEach(dep => {
        const expectedEdgeId = `${dep.source}-${dep.target}`
        const edge = result.edges.find(e => e.id === expectedEdgeId)
        expect(edge).toBeDefined()
      })
    })
  })

  describe('Edge Validation', () => {
    it('should generate unique edge IDs', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      const edgeIds = result.edges.map(e => e.id)
      const uniqueIds = new Set(edgeIds)

      expect(edgeIds.length).toBe(uniqueIds.size)
    })

    it('should reference actual node IDs in edge source and target', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      const nodeIds = new Set(result.nodes.map(n => n.id))

      result.edges.forEach(edge => {
        expect(nodeIds.has(edge.source)).toBe(true)
        expect(nodeIds.has(edge.target)).toBe(true)
      })
    })

    it('should preserve dependency relationship in edge metadata', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      result.edges.forEach(edge => {
        const dep = dependencies.find(d => 
          `${d.source}-${d.target}` === edge.id
        )

        expect(dep).toBeDefined()
        expect(edge.data?.terraformRelationship).toBe(dep?.relationship)
      })
    })

    it('should set edge type to default', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      result.edges.forEach(edge => {
        expect(edge.type).toBe('default')
      })
    })
  })

  describe('Store Integration', () => {
    it('should load plan into store', async () => {
      const planString = JSON.stringify(comprehensiveAwsPlan)

      await useTerraformStore.getState().loadTerraformPlan(planString)

      const state = useTerraformStore.getState()
      expect(state.currentPlan).toBeDefined()
      expect(state.afterState).toBeDefined()
      expect(state.afterState?.nodes.length).toBe(15)
    })

    it('should handle view mode changes', () => {
      useTerraformStore.getState().setViewMode('after')
      expect(useTerraformStore.getState().viewMode).toBe('after')

      useTerraformStore.getState().setViewMode('side-by-side')
      expect(useTerraformStore.getState().viewMode).toBe('side-by-side')
    })
  })

  describe('Complex Network Scenarios', () => {
    it('should handle multi-tier architecture', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      // Should have web tier
      const webInstances = result.nodes.filter(n =>
        n.data.terraformType === 'aws_instance' &&
        n.data.name?.includes('web-server')
      )
      expect(webInstances.length).toBe(2)

      // Should have database tier
      const databases = result.nodes.filter(n =>
        n.data.terraformType === 'aws_db_instance' ||
        n.data.terraformType === 'aws_dynamodb_table'
      )
      expect(databases.length).toBe(2)

      // Should have load balancer
      const loadBalancers = result.nodes.filter(n =>
        n.data.terraformType === 'aws_lb'
      )
      expect(loadBalancers.length).toBe(1)
    })

    it('should handle multiple subnets', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      const subnets = result.nodes.filter(n => n.data.terraformType === 'aws_subnet')
      expect(subnets.length).toBe(3) // 2 public, 1 private
    })

    it('should handle network gateways', () => {
      const dependencies = analyzeDependencies(comprehensiveAwsPlan)
      const result = convertTerraformPlanToNodes({
        plan: comprehensiveAwsPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      const igw = result.nodes.find(n => n.data.terraformType === 'aws_internet_gateway')
      expect(igw).toBeDefined()
      expect(igw?.data.deviceType).toBe('virtual-network-gateways')

      const nat = result.nodes.find(n => n.data.terraformType === 'aws_nat_gateway')
      expect(nat).toBeDefined()
      expect(nat?.data.deviceType).toBe('virtual-network-gateways')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty plan', () => {
      const emptyPlan = {
        format_version: '1.0',
        terraform_version: '1.5.0',
        resource_changes: []
      }

      const dependencies = analyzeDependencies(emptyPlan)
      const result = convertTerraformPlanToNodes({
        plan: emptyPlan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      expect(result.nodes).toHaveLength(0)
      expect(result.edges).toHaveLength(0)
    })

    it('should handle resources without tags', () => {
      // Use aws_instance (device node) instead of aws_vpc (boundary node)
      // because device nodes have data.name while boundary nodes have data.label
      const planWithoutTags = {
        format_version: '1.0',
        terraform_version: '1.5.0',
        resource_changes: [
          {
            address: 'aws_instance.test',
            type: 'aws_instance',
            name: 'test',
            provider_name: 'aws',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: {
                instance_type: 't2.micro'
              }
            }
          }
        ]
      }

      const dependencies = analyzeDependencies(planWithoutTags)
      const result = convertTerraformPlanToNodes({
        plan: planWithoutTags,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      expect(result.nodes).toHaveLength(1)
      // Device node should have a name (falls back to resource type formatted)
      expect(result.nodes[0].data.name).toBeTruthy()
    })

    it('should handle unknown resource types', () => {
      const planWithUnknown = {
        format_version: '1.0',
        terraform_version: '1.5.0',
        resource_changes: [
          {
            address: 'aws_unknown_resource.test',
            type: 'aws_unknown_resource',
            name: 'test',
            provider_name: 'aws',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: {
                name: 'test-resource'
              }
            }
          }
        ]
      }

      const dependencies = analyzeDependencies(planWithUnknown)
      const result = convertTerraformPlanToNodes({
        plan: planWithUnknown,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      expect(result.nodes).toHaveLength(1)
      // Should fall back to default mapping
      expect(result.nodes[0].data.deviceType).toBeTruthy()
    })

    it('should not create edges for orphaned dependencies', () => {
      // Plan with only target resource (source is missing)
      const planWithOrphanedDep = {
        format_version: '1.0',
        terraform_version: '1.5.0',
        resource_changes: [
          {
            address: 'aws_subnet.existing',
            type: 'aws_subnet',
            name: 'existing',
            provider_name: 'aws',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: {
                vpc_id: 'aws_vpc.missing.id',
                cidr_block: '10.0.1.0/24',
                tags: {
                  Name: 'existing-subnet'
                }
              }
            }
          }
        ]
      }

      const dependencies = analyzeDependencies(planWithOrphanedDep)
      const result = convertTerraformPlanToNodes({
        plan: planWithOrphanedDep,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      // Should create node for existing subnet
      expect(result.nodes).toHaveLength(1)

      // Should not create edge if source node doesn't exist
      const orphanedEdges = result.edges.filter(e => {
        const sourceNode = result.nodes.find(n => n.id === e.source)
        return !sourceNode || sourceNode.data.terraformAddress === 'aws_vpc.missing'
      })
      expect(orphanedEdges).toHaveLength(0)
    })

    it('should handle multiple dependencies with same source/target', () => {
      // Create a plan that might generate duplicate dependencies
      const planWithMultipleDeps = {
        format_version: '1.0',
        terraform_version: '1.5.0',
        resource_changes: [
          {
            address: 'aws_vpc.main',
            type: 'aws_vpc',
            name: 'main',
            provider_name: 'aws',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: {
                cidr_block: '10.0.0.0/16',
                tags: { Name: 'main-vpc' }
              }
            }
          },
          {
            address: 'aws_subnet.public',
            type: 'aws_subnet',
            name: 'public',
            provider_name: 'aws',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: {
                vpc_id: 'aws_vpc.main.id',
                cidr_block: '10.0.1.0/24',
                tags: { Name: 'public-subnet' }
              }
            }
          },
          {
            address: 'aws_instance.web',
            type: 'aws_instance',
            name: 'web',
            provider_name: 'aws',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: {
                subnet_id: 'aws_subnet.public.id',
                instance_type: 't3.micro',
                tags: { Name: 'web-instance' }
              }
            }
          }
        ]
      }

      const dependencies = analyzeDependencies(planWithMultipleDeps)
      const result = convertTerraformPlanToNodes({
        plan: planWithMultipleDeps,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto'
      })

      // Verify edge IDs are unique even if dependencies share source/target
      const edgeIds = result.edges.map(e => e.id)
      const uniqueIds = new Set(edgeIds)
      expect(edgeIds.length).toBe(uniqueIds.size)

      // Each dependency should create at most one edge
      const validDeps = dependencies.filter(dep => {
        const sourceExists = result.nodes.some(n => n.data.terraformAddress === dep.source)
        const targetExists = result.nodes.some(n => n.data.terraformAddress === dep.target)
        return sourceExists && targetExists
      })
      expect(result.edges.length).toBeLessThanOrEqual(validDeps.length)
    })
  })
})
