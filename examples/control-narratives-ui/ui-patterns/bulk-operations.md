# Bulk Operations

## Expand/Collapse All
- Buttons in toolbar call `setFamilyExpanded(familyId, boolean)` for each family.
- Useful when reviewing entire baseline quickly.

## Export Narratives
- Generate plaintext or CSV with `control_id`, `title`, `status`, `narrative`.
- Optionally include timestamp + system metadata.

## Baseline Switch
- Dropdown to switch baselines; prompt to save before switching to avoid losing edits.

## Status Summary
- Display counts per status (Implemented, Planned, etc.) to help readiness assessments.

## Selective Reset
- Provide “Reset Modified Controls” action to restore all custom narratives to defaults.
- Confirm via modal (list affected controls).

## Implementation Tips
- Keep operations idempotent; UI should reflect store state after completion.
- Disable buttons while `loading` or `saving` flags true to avoid conflicts.
