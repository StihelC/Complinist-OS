# Edit Workflow

1. **Enter Edit Mode**
   - User clicks Edit icon → card expands with textarea + status dropdown.
   - Focus the textarea and place cursor at end of text.

2. **Autosave vs Manual Save**
   - Store updates happen instantly (optimistic), but backend save triggered via Save button.
   - Optionally show “Draft saved locally” message.

3. **Change Indicators**
   - Blue border + “Custom” badge for controls with `isCustom`.
   - Footer shows dirty count and Save button.

4. **Validation**
   - Enforce minimum narrative length (e.g., 50 chars) before enabling Save.
   - Trim whitespace on blur.

5. **Implementation Status**
   - Dropdown with statuses; default to `Not Implemented` if unset.
   - Changing status also marks control as dirty.

6. **Keyboard Shortcuts**
   - `Ctrl+Enter` saves the current control (optional).
   - `Esc` exits edit mode without clearing text.

7. **Reset**
   - Reset button only enabled when `isCustom` true.
   - Confirm if user typed unsaved text and attempts to close editor.
