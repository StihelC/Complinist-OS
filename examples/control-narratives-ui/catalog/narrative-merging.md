# Narrative Merging

When loading controls, the editor merges catalog text with user-specific narratives.

## Algorithm
1. Fetch catalog controls for baseline.
2. Fetch saved narratives for user/project (may be empty).
3. Build map of saved narratives keyed by `control_id`.
4. For each catalog control:
   - If saved narrative exists → use saved `narrative`, mark `isCustom = true`.
   - Else → use `default_narrative`, mark `isCustom = false`.
5. Track `wasCustom` when saved narrative exists so the UI can show “Custom” even if user resets locally.

## Edge Cases
- **Catalog Updated**: if default text changes, consider storing `default_hash` to detect when custom narrative might need review.
- **Deleted Custom Narrative**: if backend returns HTTP 404 for saved narrative, fall back to default and clear `wasCustom`.
- **Baseline Switch**: maintain separate caches per baseline to avoid cross-contamination.

## Data Contract
```ts
interface SavedNarrativePayload {
  control_id: string
  narrative: string
  implementation_status?: string
  is_custom: boolean
}
```

Bulk save endpoint expects `{ [control_id]: { narrative, implementation_status } }` to minimize payload size.
