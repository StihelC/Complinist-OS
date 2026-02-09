import { describe, it, expect } from 'vitest'
import { analyzeDependencies, extractNetworkConnections } from '@/lib/terraform/dependencyAnalyzer'
import complexNetworkPlan from '../../fixtures/terraform/fixtures/complex-network.json'

describe('dependencyAnalyzer', () => {
  it('should extract VPC to subnet relationships', () => {
    const deps = extractNetworkConnections(complexNetworkPlan.resource_changes)
    const vpcSubnet = deps.find(d => 
      d.source.includes('vpc') && d.target.includes('subnet')
    )
    expect(vpcSubnet).toBeDefined()
    expect(vpcSubnet?.relationship).toBe('network')
  })
  
  it('should extract security group to instance attachments', () => {
    const deps = analyzeDependencies(complexNetworkPlan)
    const sgInstance = deps.find(d => 
      d.source.includes('security_group') && d.target.includes('instance')
    )
    expect(sgInstance).toBeDefined()
  })
  
  it('should return empty array for plan with no relationships', () => {
    const deps = extractNetworkConnections([])
    expect(deps).toEqual([])
  })
})

