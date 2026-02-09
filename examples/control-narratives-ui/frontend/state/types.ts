export interface ControlNarrative {
  control_id: string
  family: string
  title: string
  default_narrative: string
  narrative: string
  implementation_status?: string
  isCustom: boolean
  wasCustom?: boolean
}

export interface ControlFamily {
  code: string
  name: string
  controls: ControlNarrative[]
}
