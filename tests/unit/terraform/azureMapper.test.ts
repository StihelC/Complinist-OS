import { describe, it, expect } from 'vitest'
import { AzureMapper } from '@/lib/terraform/resourceMappers/azureMapper'

describe('AzureMapper', () => {
  const mapper = new AzureMapper()
  
  it('should map azurerm_virtual_machine to virtual-machine', () => {
    const result = mapper.mapResource('azurerm_virtual_machine', {
      name: 'web-vm'
    })
    
    expect(result.deviceType).toBe('virtual-machine')
    expect(result.category).toBe('Compute')
    expect(result.iconPath).toContain('Azure/Compute')
  })
  
  it('should map azurerm_virtual_network to virtual-networks', () => {
    const result = mapper.mapResource('azurerm_virtual_network', {
      name: 'main-vnet'
    })
    
    expect(result.deviceType).toBe('virtual-networks')
    expect(result.defaultName).toBe('main-vnet')
  })
  
  it('should map azurerm_network_security_group', () => {
    const result = mapper.mapResource('azurerm_network_security_group', {})
    expect(result.deviceType).toBe('network-security-groups')
  })
})

