# Search & Filter Pattern

## Search Box
- Matches control ID, title, or narrative text.
- Debounce input to avoid re-rendering hundreds of controls per keystroke.
- Show “No controls found” message when result set empty.

## Family Filter
- Dropdown with “All Families” + individual families (AC, AU, etc.).
- Optionally show counts (AC (24)).

## Status Filter (optional)
- Tabs: All | Modified | Not Modified.
- Derived from `control.isCustom`.

## Implementation Notes
```ts
const filteredControls = controls
  .filter(matchesFamily)
  .filter(matchesStatus)
  .filter(matchesSearch)
```
- Precompute `matchesSearch` using `searchTerm.toLowerCase()`.
- Collapse families with zero matching controls to reduce noise.
