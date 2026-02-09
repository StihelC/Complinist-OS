import type { TerraformPlan, ChangeSummary } from './terraformTypes'

export function parseTerraformPlan(jsonString: string): TerraformPlan {
  let parsed: any
  
  try {
    parsed = JSON.parse(jsonString)
  } catch (error) {
    throw new Error('Invalid JSON: ' + (error as Error).message)
  }
  
  if (!validateTerraformPlan(parsed)) {
    throw new Error('Invalid Terraform plan: missing required fields')
  }
  
  return parsed as TerraformPlan
}

export function validateTerraformPlan(plan: any): boolean {
  if (!plan || typeof plan !== 'object') return false
  if (!plan.format_version) return false
  if (!Array.isArray(plan.resource_changes)) return false
  return true
}

export function extractChangeSummary(plan: TerraformPlan): ChangeSummary {
  const summary: ChangeSummary = {
    create: 0,
    update: 0,
    delete: 0,
    noOp: 0,
    total: 0,
  }
  
  for (const change of plan.resource_changes) {
    const actions = change.change.actions
    
    if (actions.includes('create')) summary.create++
    else if (actions.includes('update')) summary.update++
    else if (actions.includes('delete')) summary.delete++
    else if (actions.includes('no-op')) summary.noOp++
    
    summary.total++
  }
  
  return summary
}

