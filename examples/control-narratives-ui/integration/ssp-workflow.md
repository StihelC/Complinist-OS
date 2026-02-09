# SSP Workflow Integration

1. **User Customizes Narratives**
   - ControlNarrativeEditor updates `useControlNarrativesStore` and saves to backend.

2. **Export Modal**
   - Before generating SSP, fetch `store.getNarrativesForBaseline(baseline)`.
   - Attach to SSP generation request:
     ```ts
     await generateSSPPDF({
       ...sspConfig,
       custom_narratives: narrativesMap,
     })
     ```

3. **Backend Merge**
   - `/api/ssp/generate-pdf` merges custom narratives with defaults; custom ones override catalog text for matching control IDs.

4. **Audit Trail**
   - Store indicates which controls were customized (used in PDF appendix or change log).

5. **Regeneration**
   - If user regenerates SSP after edits, re-fetch narratives to ensure PDF reflects current text.
