# Control Catalog Structure

The editor consumes the same NIST 800-53 control catalog used by the SSP generator.

## Schema
```json
{
  "control_id": "AC-2",
  "title": "Account Management",
  "family": "AC",
  "baseline": ["LOW","MODERATE","HIGH"],
  "default_narrative": "...",
  "enhancements": ["AC-2(1)", ...]
}
```

- Families identified by two-letter prefix.
- Baseline array indicates which baselines include the control.
- Enhancements optional; editor can show subordinate entries or collapse them.

## Storage
- Catalog can live client-side (JSON) or server-side (API). For large catalogs, prefer backend to keep bundle size reasonable.
- Hash the catalog version so the client only reloads when catalog changes.

## Usage in Editor
1. Load catalog for selected baseline (or full set, filtered client-side).
2. Merge with saved narratives to produce `ControlNarrative` records.
3. Group by family for UI rendering.

## Enhancements Handling
- Display enhancements beneath parent control or as separate entries with indentation.
- Reset should consider enhancement’s default narrative distinct from parent.
