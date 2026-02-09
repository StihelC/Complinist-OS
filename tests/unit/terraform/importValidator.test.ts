import { describe, it, expect } from 'vitest'
import { validateCompleteness } from '@/lib/terraform/importValidator'
import type { TerraformPlan, TerraformNode } from '@/lib/terraform/terraformTypes'
import type { TerraformEdge } from '@/lib/terraform/stateConverter'

describe('importValidator', () => {
  describe('validateCompleteness', () => {
    it('should validate complete import with all edges', () => {
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
              after: {},
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
              after: {
                vpc_id: 'aws_vpc.main.id',
              },
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
              after: {
                subnet_id: 'aws_subnet.public.id',
              },
            },
          },
        ],
      }

      const nodes: TerraformNode[] = [
        {
          id: 'aws_vpc.main',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            id: 'aws_vpc.main',
            name: 'aws_vpc.main',
            deviceType: 'virtual-networks',
            terraformAddress: 'aws_vpc.main',
            terraformType: 'aws_vpc',
            changeType: 'create',
          },
        },
        {
          id: 'aws_subnet.public',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            id: 'aws_subnet.public',
            name: 'aws_subnet.public',
            deviceType: 'virtual-networks',
            terraformAddress: 'aws_subnet.public',
            terraformType: 'aws_subnet',
            changeType: 'create',
          },
        },
        {
          id: 'aws_instance.web',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            id: 'aws_instance.web',
            name: 'aws_instance.web',
            deviceType: 'virtual-machine',
            terraformAddress: 'aws_instance.web',
            terraformType: 'aws_instance',
            changeType: 'create',
          },
        },
      ]

      const edges: TerraformEdge[] = [
        {
          id: 'aws_vpc.main-aws_subnet.public',
          source: 'aws_vpc.main',
          target: 'aws_subnet.public',
          type: 'default',
        },
        {
          id: 'aws_subnet.public-aws_instance.web',
          source: 'aws_subnet.public',
          target: 'aws_instance.web',
          type: 'default',
        },
      ]

      const result = validateCompleteness(nodes, edges, plan)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0)
      expect(result.missingEdges).toHaveLength(0)
    })

    it('should detect missing edges', () => {
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
              after: {},
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
              after: {
                vpc_id: 'aws_vpc.main.id',
              },
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
              after: {
                subnet_id: 'aws_subnet.public.id',
              },
            },
          },
        ],
      }

      const nodes: TerraformNode[] = [
        {
          id: 'aws_vpc.main',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            id: 'aws_vpc.main',
            name: 'aws_vpc.main',
            deviceType: 'virtual-networks',
            terraformAddress: 'aws_vpc.main',
            terraformType: 'aws_vpc',
            changeType: 'create',
          },
        },
        {
          id: 'aws_subnet.public',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            id: 'aws_subnet.public',
            name: 'aws_subnet.public',
            deviceType: 'virtual-networks',
            terraformAddress: 'aws_subnet.public',
            terraformType: 'aws_subnet',
            changeType: 'create',
          },
        },
        {
          id: 'aws_instance.web',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            id: 'aws_instance.web',
            name: 'aws_instance.web',
            deviceType: 'virtual-machine',
            terraformAddress: 'aws_instance.web',
            terraformType: 'aws_instance',
            changeType: 'create',
          },
        },
      ]

      const edges: TerraformEdge[] = [] // Missing edges

      const result = validateCompleteness(nodes, edges, plan)

      expect(result.isValid).toBe(false)
      expect(result.missingEdges.length).toBeGreaterThan(0)
    })

    it('should detect orphaned critical resources', () => {
      const plan: TerraformPlan = {
        format_version: '1.0',
        terraform_version: '1.5.0',
        resource_changes: [
          {
            address: 'aws_instance.web',
            type: 'aws_instance',
            name: 'web',
            provider_name: 'aws',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: {},
            },
          },
        ],
      }

      const nodes: TerraformNode[] = [
        {
          id: 'aws_instance.web',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            id: 'aws_instance.web',
            name: 'aws_instance.web',
            deviceType: 'virtual-machine',
            terraformAddress: 'aws_instance.web',
            terraformType: 'aws_instance',
            changeType: 'create',
          },
        },
      ]

      const edges: TerraformEdge[] = []

      const result = validateCompleteness(nodes, edges, plan)

      expect(result.isValid).toBe(false)
      expect(result.orphanedResources).toContain('aws_instance.web')
    })

    it('should detect missing security group connections', () => {
      const plan: TerraformPlan = {
        format_version: '1.0',
        terraform_version: '1.5.0',
        resource_changes: [
          {
            address: 'aws_security_group.web',
            type: 'aws_security_group',
            name: 'web',
            provider_name: 'aws',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: {},
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
              after: {
                vpc_security_group_ids: ['aws_security_group.web.id'],
              },
            },
          },
        ],
      }

      const nodes: TerraformNode[] = [
        {
          id: 'aws_security_group.web',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            id: 'aws_security_group.web',
            name: 'aws_security_group.web',
            deviceType: 'network-security-groups',
            terraformAddress: 'aws_security_group.web',
            terraformType: 'aws_security_group',
            changeType: 'create',
          },
        },
        {
          id: 'aws_instance.web',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            id: 'aws_instance.web',
            name: 'aws_instance.web',
            deviceType: 'virtual-machine',
            terraformAddress: 'aws_instance.web',
            terraformType: 'aws_instance',
            changeType: 'create',
          },
        },
      ]

      const edges: TerraformEdge[] = [] // Missing security group edge

      const result = validateCompleteness(nodes, edges, plan)

      expect(result.isValid).toBe(false)
      const missingSGEdge = result.missingEdges.find(e => 
        e.source.includes('security_group') && e.target.includes('instance')
      )
      expect(missingSGEdge).toBeDefined()
    })

    it('should handle empty nodes/edges gracefully', () => {
      const plan: TerraformPlan = {
        format_version: '1.0',
        terraform_version: '1.5.0',
        resource_changes: [],
      }

      const nodes: TerraformNode[] = []
      const edges: TerraformEdge[] = []

      const result = validateCompleteness(nodes, edges, plan)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })
  })
})