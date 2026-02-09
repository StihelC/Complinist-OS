import { describe, it, expect } from 'vitest'
import { convertTerraformPlanToNodes } from '@/lib/terraform/stateConverter'
import type { TerraformPlan, TerraformDependency } from '@/lib/terraform/terraformTypes'
import awsSimplePlan from '../../fixtures/terraform/fixtures/aws-simple.json'

describe('stateConverter', () => {
  it('should convert plan to nodes', () => {
    const result = convertTerraformPlanToNodes({
      plan: awsSimplePlan,
      resourceMappings: new Map(),
      dependencies: [],
      layoutStrategy: 'auto',
    })
    
    expect(result.nodes.length).toBeGreaterThan(0)
    expect(result.edges).toBeInstanceOf(Array)
  })
  
  it('should create nodes with Terraform metadata', () => {
    const result = convertTerraformPlanToNodes({
      plan: awsSimplePlan,
      resourceMappings: new Map(),
      dependencies: [],
      layoutStrategy: 'auto',
    })
    
    const firstNode = result.nodes[0]
    expect(firstNode.data.terraformAddress).toBeDefined()
    expect(firstNode.data.terraformType).toBeDefined()
    expect(firstNode.data.changeType).toBeDefined()
  })

  describe('Boundary Creation', () => {
    it('should create VPC as boundary node', () => {
      const plan: TerraformPlan = {
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
              after: { cidr_block: '10.0.0.0/16' },
            },
          },
        ],
      }

      const result = convertTerraformPlanToNodes({
        plan,
        resourceMappings: new Map(),
        dependencies: [],
        layoutStrategy: 'auto',
      })

      const vpcNode = result.nodes.find(n => n.data.terraformAddress === 'aws_vpc.main')
      expect(vpcNode).toBeDefined()
      expect(vpcNode?.type).toBe('boundary')
      expect((vpcNode?.data as any).type).toBe('network_segment')
    })

    it('should create subnet as boundary node', () => {
      const plan: TerraformPlan = {
        format_version: '1.0',
        terraform_version: '1.5.0',
        resource_changes: [
          {
            address: 'aws_subnet.public',
            type: 'aws_subnet',
            name: 'public',
            provider_name: 'aws',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: { cidr_block: '10.0.1.0/24' },
            },
          },
        ],
      }

      const result = convertTerraformPlanToNodes({
        plan,
        resourceMappings: new Map(),
        dependencies: [],
        layoutStrategy: 'auto',
      })

      const subnetNode = result.nodes.find(n => n.data.terraformAddress === 'aws_subnet.public')
      expect(subnetNode).toBeDefined()
      expect(subnetNode?.type).toBe('boundary')
      expect((subnetNode?.data as any).type).toBe('security_zone')
    })

    it('should create Azure VNet as boundary node', () => {
      const plan: TerraformPlan = {
        format_version: '1.0',
        terraform_version: '1.5.0',
        resource_changes: [
          {
            address: 'azurerm_virtual_network.main',
            type: 'azurerm_virtual_network',
            name: 'main',
            provider_name: 'azurerm',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: { address_space: ['10.0.0.0/16'] },
            },
          },
        ],
      }

      const result = convertTerraformPlanToNodes({
        plan,
        resourceMappings: new Map(),
        dependencies: [],
        layoutStrategy: 'auto',
      })

      const vnetNode = result.nodes.find(n => n.data.terraformAddress === 'azurerm_virtual_network.main')
      expect(vnetNode).toBeDefined()
      expect(vnetNode?.type).toBe('boundary')
      expect((vnetNode?.data as any).type).toBe('network_segment')
    })
  })

  describe('Nesting Logic', () => {
    it('should nest subnet inside VPC', () => {
      const plan: TerraformPlan = {
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
              after: { cidr_block: '10.0.0.0/16' },
            },
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
              after: { cidr_block: '10.0.1.0/24' },
            },
          },
        ],
      }

      // Dependencies flow: child (source) references parent (target)
      // Subnet has vpc_id = aws_vpc.main.id, so subnet is SOURCE
      const dependencies: TerraformDependency[] = [
        {
          source: 'aws_subnet.public',  // Subnet references VPC
          target: 'aws_vpc.main',
          type: 'network',
          relationship: 'network',
          metadata: {},
        },
      ]

      const result = convertTerraformPlanToNodes({
        plan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto',
      })

      const subnetNode = result.nodes.find(n => n.data.terraformAddress === 'aws_subnet.public')
      expect(subnetNode?.parentId).toBe('aws_vpc.main')
      expect(subnetNode?.extent).toBe('parent')
    })

    it('should nest instance inside subnet', () => {
      const plan: TerraformPlan = {
        format_version: '1.0',
        terraform_version: '1.5.0',
        resource_changes: [
          {
            address: 'aws_subnet.public',
            type: 'aws_subnet',
            name: 'public',
            provider_name: 'aws',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: { cidr_block: '10.0.1.0/24' },
            },
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
              after: { instance_type: 't3.micro' },
            },
          },
        ],
      }

      // Dependencies flow: child (source) references parent (target)
      // Instance has subnet_id = aws_subnet.public.id, so instance is SOURCE
      const dependencies: TerraformDependency[] = [
        {
          source: 'aws_instance.web',  // Instance references Subnet
          target: 'aws_subnet.public',
          type: 'network',
          relationship: 'network',
          metadata: {},
        },
      ]

      const result = convertTerraformPlanToNodes({
        plan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto',
      })

      const instanceNode = result.nodes.find(n => n.data.terraformAddress === 'aws_instance.web')
      expect(instanceNode?.type).toBe('device')
      expect(instanceNode?.parentId).toBe('aws_subnet.public')
      expect(instanceNode?.extent).toBe('parent')
    })

    it('should create hierarchical layout: VPC > Subnet > Instance', () => {
      const plan: TerraformPlan = {
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
              after: { cidr_block: '10.0.0.0/16' },
            },
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
              after: { cidr_block: '10.0.1.0/24' },
            },
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
              after: { instance_type: 't3.micro' },
            },
          },
        ],
      }

      // Dependencies flow: child (source) references parent (target)
      // e.g., subnet has vpc_id = aws_vpc.main.id, so subnet is SOURCE, vpc is TARGET
      const dependencies: TerraformDependency[] = [
        {
          source: 'aws_subnet.public',  // Subnet references VPC
          target: 'aws_vpc.main',
          type: 'network',
          relationship: 'network',
          metadata: {},
        },
        {
          source: 'aws_instance.web',  // Instance references Subnet
          target: 'aws_subnet.public',
          type: 'network',
          relationship: 'network',
          metadata: {},
        },
      ]

      const result = convertTerraformPlanToNodes({
        plan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto',
      })

      const vpcNode = result.nodes.find(n => n.data.terraformAddress === 'aws_vpc.main')
      const subnetNode = result.nodes.find(n => n.data.terraformAddress === 'aws_subnet.public')
      const instanceNode = result.nodes.find(n => n.data.terraformAddress === 'aws_instance.web')

      expect(vpcNode?.type).toBe('boundary')
      expect(subnetNode?.type).toBe('boundary')
      expect(subnetNode?.parentId).toBe('aws_vpc.main')
      expect(instanceNode?.type).toBe('device')
      expect(instanceNode?.parentId).toBe('aws_subnet.public')

      // Positions should be relative to parent
      expect(subnetNode?.position).toBeDefined()
      expect(instanceNode?.position).toBeDefined()
    })

    it('should not create edges for containment relationships', () => {
      const plan: TerraformPlan = {
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
              after: { cidr_block: '10.0.0.0/16' },
            },
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
              after: { cidr_block: '10.0.1.0/24' },
            },
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
              after: { instance_type: 't3.micro' },
            },
          },
        ],
      }

      // Dependencies flow: child (source) references parent (target)
      // e.g., subnet has vpc_id = aws_vpc.main.id, so subnet is SOURCE, vpc is TARGET
      const dependencies: TerraformDependency[] = [
        {
          source: 'aws_subnet.public',  // Subnet references VPC
          target: 'aws_vpc.main',
          type: 'network',
          relationship: 'network',
          metadata: {},
        },
        {
          source: 'aws_instance.web',  // Instance references Subnet
          target: 'aws_subnet.public',
          type: 'network',
          relationship: 'network',
          metadata: {},
        },
      ]

      const result = convertTerraformPlanToNodes({
        plan,
        resourceMappings: new Map(),
        dependencies,
        layoutStrategy: 'auto',
      })

      // Should not create edge for Subnet -> VPC (containment - handled via parentId)
      const subnetVpcEdge = result.edges.find(
        e => e.source === 'aws_subnet.public' && e.target === 'aws_vpc.main'
      )
      expect(subnetVpcEdge).toBeUndefined()

      // Should not create edge for Instance -> Subnet (containment - handled via parentId)
      const instanceSubnetEdge = result.edges.find(
        e => e.source === 'aws_instance.web' && e.target === 'aws_subnet.public'
      )
      expect(instanceSubnetEdge).toBeUndefined()
    })
  })
})

