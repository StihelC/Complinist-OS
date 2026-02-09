import { describe, it, expect } from 'vitest'
import type { TerraformPlan, TerraformResourceChange } from '@/lib/terraform/terraformTypes'

describe('TerraformTypes', () => {
  it('should define TerraformPlan interface', () => {
    const plan: TerraformPlan = {
      format_version: '1.0',
      terraform_version: '1.5.0',
      resource_changes: [],
    }
    expect(plan).toBeDefined()
  })
  
  it('should define TerraformResourceChange interface', () => {
    const change: TerraformResourceChange = {
      address: 'aws_instance.web',
      type: 'aws_instance',
      name: 'web',
      provider_name: 'aws',
      mode: 'managed',
      change: {
        actions: ['create'],
        before: null,
        after: { instance_type: 't2.micro' },
      },
    }
    expect(change.address).toBe('aws_instance.web')
  })
})

