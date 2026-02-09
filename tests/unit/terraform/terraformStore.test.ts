import { describe, it, expect, beforeEach } from 'vitest'
import { useTerraformStore } from '@/core/stores/useTerraformStore'
import awsSimplePlan from '../../fixtures/terraform/fixtures/aws-simple.json'

describe('useTerraformStore', () => {
  beforeEach(() => {
    useTerraformStore.setState({
      currentPlan: null,
      beforeState: null,
      afterState: null,
      viewMode: 'diff',
    })
  })
  
  it('should load Terraform plan', async () => {
    await useTerraformStore.getState().loadTerraformPlan(JSON.stringify(awsSimplePlan))
    
    const state = useTerraformStore.getState()
    expect(state.currentPlan).toBeDefined()
    expect(state.afterState?.nodes.length).toBeGreaterThan(0)
  })
  
  it('should change view mode', () => {
    useTerraformStore.getState().setViewMode('before')
    expect(useTerraformStore.getState().viewMode).toBe('before')
  })
})

