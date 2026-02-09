export type ChangeAction = 'no-op' | 'create' | 'read' | 'update' | 'delete'

export interface TerraformResourceChange {
  address: string
  module_address?: string
  mode: 'managed' | 'data'
  type: string
  name: string
  provider_name: string
  change: {
    actions: ChangeAction[]
    before: any | null
    after: any | null
    after_unknown?: Record<string, boolean>
  }
}

export interface TerraformPlan {
  format_version: string
  terraform_version: string
  resource_changes: TerraformResourceChange[]
  configuration?: any
  prior_state?: any
}

export interface ChangeSummary {
  create: number
  update: number
  delete: number
  noOp: number
  total: number
}

export interface ResourceMapping {
  deviceType: string
  deviceSubtype?: string
  iconPath: string
  category: string
  defaultName: string
  isContainerResource?: boolean  // Indicates VPC/VNet/Subnet
  boundaryType?: string  // Boundary type if container (e.g., 'network_segment', 'security_zone')
}

export interface ResourceReference {
  source: string
  target: string
  attributePath: string[]
  referenceValue: string
  relationshipType: 'network' | 'security' | 'dependency' | 'unknown'
  confidence: 'high' | 'medium' | 'low'
}export interface ValidationReport {
  warnings: string[]
  missingEdges: Array<{ source: string, target: string, reason: string }>
  orphanedResources: string[]
  isValid: boolean
}