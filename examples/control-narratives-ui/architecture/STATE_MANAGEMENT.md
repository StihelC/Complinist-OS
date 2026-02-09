# State Management

The editor relies on a dedicated Zustand slice (`useControlNarrativesStore`) plus backend persistence.

## Store Shape
```ts
interface ControlNarrative {
  control_id: string
  family: string
  title: string
  default_narrative: string
  narrative: string
  implementation_status?: string
  isCustom: boolean
  wasCustom: boolean // persisted custom previously
}

interface ControlNarrativesState {
  items: Record<string, ControlNarrative>
  baseline: 'LOW' | 'MODERATE' | 'HIGH'
  loading: boolean
  dirtyIds: Set<string>
  loadControls: (baseline) => Promise<void>
  updateNarrative: (controlId, text) => void
  updateStatus: (controlId, status) => void
  resetControl: (controlId) => void
  saveNarratives: () => Promise<void>
}
```

## Workflow
1. **loadControls(baseline)**
   - Fetch catalog controls for baseline.
   - Fetch saved narratives for user/project.
   - Merge: catalog text becomes `default_narrative`; stored custom text populates `narrative` + `isCustom`.

2. **updateNarrative**
   - Replace text, mark `isCustom = true`, add controlId to `dirtyIds`.

3. **resetControl**
   - Set `narrative = default_narrative`, `isCustom = false`.
   - Remove controlId from `dirtyIds`.

4. **saveNarratives**
   - Send only dirty controls to backend via bulk API.
   - On success, clear `dirtyIds`, update `wasCustom`.

5. **getNarrativesForBaseline**
   - Utility to hand the SSP generator a map of narratives keyed by control ID.

## Persistence
- Backend stores user/project-specific narratives keyed by controlId.
- API endpoints: `GET /api/control-narratives?baseline=MODERATE`, `POST /api/control-narratives/bulk`.
- Editor expects optimistic updates with error rollback.

## Integration Hooks
- SSP generator reads from store or requests latest narratives before generating PDF.
- Export modal indicator (e.g., “3 controls customized”) subscribes to `dirtyIds.size` + `customCount` selectors.
