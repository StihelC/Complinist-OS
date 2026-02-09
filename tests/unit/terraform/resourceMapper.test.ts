import { describe, it, expect } from 'vitest'
import { getProviderMapper, mapTerraformResource } from '@/lib/terraform/resourceMapper'

describe('resourceMapper', () => {
  it('should detect AWS provider from aws_ prefix', () => {
    const mapper = getProviderMapper('aws')
    expect(mapper).toBeDefined()
  })
  
  it('should detect Azure provider from azurerm_ prefix', () => {
    const mapper = getProviderMapper('azurerm')
    expect(mapper).toBeDefined()
  })
  
  it('should map AWS resource', () => {
    const result = mapTerraformResource({
      provider: 'aws',
      resourceType: 'aws_instance',
      resourceAttributes: { tags: { Name: 'test' } }
    })
    
    expect(result.deviceType).toBe('virtual-machine')
  })
  
  it('should map Azure resource', () => {
    const result = mapTerraformResource({
      provider: 'azurerm',
      resourceType: 'azurerm_virtual_machine',
      resourceAttributes: { name: 'test-vm' }
    })
    
    expect(result.deviceType).toBe('virtual-machine')
  })
})

