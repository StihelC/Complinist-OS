# Editor Flow

```
User opens Export modal
    ↓
Click “Edit Control Narratives”
    ↓
ControlNarrativeEditor mounts
    ↓
Baseline dropdown → load catalog + narratives
    ↓
User searches / filters families
    ↓
Opens control card → edits text
    ↓
Changes tracked locally (dirty state)
    ↓
Save button → POST to backend
    ↓
Badges update → return to export workflow
```

## Steps in Detail
1. **Launch**
   - Modal receives `baseline`, `systemName`, `projectId`.
   - Store loads controls for baseline, merges saved narratives, sets default expanded family.

2. **Browse Controls**
   - Families grouped by 2-letter prefix (AC, AU, etc.).
   - Search box filters by ID/title/content.
   - Family dropdown filters to a single family when needed.

3. **Edit Workflow**
   - Clicking Edit toggles textarea + status dropdown.
   - `updateNarrative(controlId, text)` saves to store; dirty flag increments.
   - `implementation_status` dropdown optional (Implemented, Planned, etc.).

4. **Change Indicators**
   - Modified controls show “Custom” badge + blue border.
   - Unsaved changes counter visible in footer.

5. **Save + Reset**
   - Save button only enabled when there are dirty controls.
   - Reset restores original catalog text and clears custom flags.

6. **Exit**
   - On close, if dirty changes exist, confirm discard or stay in editor.
   - On success, store notifies SSP workflow so latest narratives are available.
