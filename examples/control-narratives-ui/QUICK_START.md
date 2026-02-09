# Quick Start: Control Narratives Editor

## 1. Mount the Editor
```tsx
import ControlNarrativeEditor from './frontend/components/ControlNarrativeEditor'

<ControlNarrativeEditor
  isOpen={showEditor}
  baseline="MODERATE"
  systemName="Production Network"
  onClose={() => setShowEditor(false)}
/>
```
- Place it inside your Export modal or a dedicated route.
- Pass baseline/system name to populate headers (or read from projects store).

## 2. Load Controls + Narratives
```ts
await useControlNarrativesStore.getState().loadControls({ baseline: 'MODERATE' })
```
This fetches the catalog controls and merges any saved custom narratives for the current user/project.

## 3. Edit a Narrative
- Click the edit icon on a control card → textarea appears → type changes.
- `useControlNarrativesStore.updateNarrative(controlId, newText)` marks it as custom and tracks timestamps.

## 4. Save Changes
```ts
await useControlNarrativesStore.getState().saveNarratives()
```
Sends changed controls to the backend. Success updates the “Modified” badges; errors keep local state so users can retry.

## 5. Reset to Default
```ts
useControlNarrativesStore.getState().resetControl(controlId)
```
Restores the catalog narrative and clears custom flags.

## 6. Feed SSP Generation
When the user generates an SSP, call:
```ts
const narratives = useControlNarrativesStore.getState().getNarrativesForBaseline('MODERATE')
```
Pass those narratives to the SSP PDF endpoint so the exported document reflects the user edits.

That’s it—connect the store, mount the editor, and wire save/reset actions to existing APIs.
