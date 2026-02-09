import type { ControlNarrative } from './types'

export function mergeCatalogWithCustom(catalog: ControlNarrative[], custom: ControlNarrative[]): ControlNarrative[] {
  const customMap = new Map(custom.map((c) => [c.control_id, c]))
  return catalog.map((control) => {
    const saved = customMap.get(control.control_id)
    return saved
      ? { ...control, narrative: saved.narrative, isCustom: true, wasCustom: true }
      : { ...control, narrative: control.default_narrative, isCustom: false, wasCustom: false }
  })
}

export function groupByFamily(controls: ControlNarrative[]) {
  const familyMap: Record<string, ControlNarrative[]> = {}
  controls.forEach((control) => {
    if (!familyMap[control.family]) {
      familyMap[control.family] = []
    }
    familyMap[control.family].push(control)
  })
  return Object.entries(familyMap).map(([code, controls]) => ({
    code,
    name: FAMILY_NAMES[code] || code,
    controls,
  }))
}

const FAMILY_NAMES: Record<string, string> = {
  AC: 'Access Control',
  AU: 'Audit and Accountability',
  SC: 'System and Communications Protection',
  // ... fill the rest as needed
}
