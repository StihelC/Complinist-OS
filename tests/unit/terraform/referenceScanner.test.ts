import { describe, it, expect } from 'vitest'
import { extractAllResourceReferences } from '@/lib/terraform/referenceScanner'
import type { TerraformPlan } from '@/lib/terraform/terraformTypes'

describe('referenceScanner', () => {
  describe('extractAllResourceReferences', () => {
    it('should extract references from simple attributes', () => {
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
              after: {
                cidr_block: '10.0.0.0/16',
              },
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
                cidr_block: '10.0.1.0/24',
              },
            },
          },
        ],
      }

      const references = extractAllResourceReferences(plan)
      
      expect(references.length).toBeGreaterThan(0)
      const vpcRef = references.find(r => r.source === 'aws_subnet.public' && r.target === 'aws_vpc.main')
      expect(vpcRef).toBeDefined()
      expect(vpcRef?.attributePath).toContain('vpc_id')
      expect(vpcRef?.confidence).toBe('high')
    })

    it('should extract references from interpolated strings', () => {
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
              after: {
                cidr_block: '10.0.0.0/16',
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
                subnet_id: '${aws_subnet.public.id}',
              },
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
        ],
      }

      const references = extractAllResourceReferences(plan)
      
      const instanceSubnet = references.find(r => 
        r.source === 'aws_instance.web' && r.target === 'aws_subnet.public'
      )
      expect(instanceSubnet).toBeDefined()
      expect(instanceSubnet?.referenceValue).toContain('aws_subnet.public')
    })

    it('should extract references from arrays', () => {
      const plan: TerraformPlan = {
        format_version: '1.0',
        terraform_version: '1.5.0',
        resource_changes: [
          {
            address: 'aws_subnet.public_1',
            type: 'aws_subnet',
            name: 'public_1',
            provider_name: 'aws',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: {
                cidr_block: '10.0.1.0/24',
              },
            },
          },
          {
            address: 'aws_subnet.public_2',
            type: 'aws_subnet',
            name: 'public_2',
            provider_name: 'aws',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: {
                cidr_block: '10.0.2.0/24',
              },
            },
          },
          {
            address: 'aws_lb.main',
            type: 'aws_lb',
            name: 'main',
            provider_name: 'aws',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: {
                subnets: [
                  'aws_subnet.public_1.id',
                  'aws_subnet.public_2.id',
                ],
              },
            },
          },
        ],
      }

      const references = extractAllResourceReferences(plan)
      
      const lbSubnet1 = references.find(r => 
        r.source === 'aws_lb.main' && r.target === 'aws_subnet.public_1'
      )
      const lbSubnet2 = references.find(r => 
        r.source === 'aws_lb.main' && r.target === 'aws_subnet.public_2'
      )
      
      expect(lbSubnet1).toBeDefined()
      expect(lbSubnet2).toBeDefined()
      expect(lbSubnet1?.attributePath.some(p => p.includes('[0]')) || 
             lbSubnet1?.attributePath.includes('subnets')).toBeTruthy()
    })

    it('should extract references from nested objects', () => {
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
              after: {
                cidr_block: '10.0.0.0/16',
              },
            },
          },
          {
            address: 'aws_lambda_function.api',
            type: 'aws_lambda_function',
            name: 'api',
            provider_name: 'aws',
            mode: 'managed',
            change: {
              actions: ['create'],
              before: null,
              after: {
                vpc_config: {
                  subnet_ids: ['aws_subnet.public.id'],
                  security_group_ids: ['aws_security_group.lambda.id'],
                },
              },
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
              after: {},
            },
          },
          {
            address: 'aws_security_group.lambda',
            type: 'aws_security_group',
            name: 'lambda',
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

      const references = extractAllResourceReferences(plan)
      
      const lambdaSubnet = references.find(r => 
        r.source === 'aws_lambda_function.api' && r.target === 'aws_subnet.public'
      )
      const lambdaSG = references.find(r => 
        r.source === 'aws_lambda_function.api' && r.target === 'aws_security_group.lambda'
      )
      
      expect(lambdaSubnet).toBeDefined()
      expect(lambdaSG).toBeDefined()
      expect(lambdaSubnet?.attributePath).toContain('vpc_config')
      expect(lambdaSubnet?.attributePath).toContain('subnet_ids')
    })

    it('should handle empty plan', () => {
      const plan: TerraformPlan = {
        format_version: '1.0',
        terraform_version: '1.5.0',
        resource_changes: [],
      }

      const references = extractAllResourceReferences(plan)
      expect(references).toEqual([])
    })

    it('should ignore references to non-existent resources', () => {
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
              after: {
                subnet_id: 'aws_subnet.nonexistent.id',
              },
            },
          },
        ],
      }

      const references = extractAllResourceReferences(plan)
      // Should not create reference to non-existent resource
      const nonExistentRef = references.find(r => r.target === 'aws_subnet.nonexistent')
      expect(nonExistentRef).toBeUndefined()
    })

    it('should classify relationship types', () => {
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
            address: 'aws_security_group.web',
            type: 'aws_security_group',
            name: 'web',
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
                vpc_security_group_ids: ['aws_security_group.web.id'],
              },
            },
          },
        ],
      }

      const references = extractAllResourceReferences(plan)
      
      const subnetVpc = references.find(r => 
        r.source === 'aws_subnet.public' && r.target === 'aws_vpc.main'
      )
      expect(subnetVpc?.relationshipType).toBe('network')
      
      const instanceSubnet = references.find(r => 
        r.source === 'aws_instance.web' && r.target === 'aws_subnet.public'
      )
      expect(instanceSubnet?.relationshipType).toBe('network')
      
      const instanceSG = references.find(r => 
        r.source === 'aws_instance.web' && r.target === 'aws_security_group.web'
      )
      expect(instanceSG?.relationshipType).toBe('security')
    })
  })
})