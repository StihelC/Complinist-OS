# NIST 800-53B Baseline Catalog

This directory contains the NIST 800-53 Rev 5 control catalog and baseline mappings.

## Files

- `NIST_SP-800-53_rev5_catalog_load.csv` - Full control catalog with control text and descriptions
- `nist-800-53b-baselines.json` - Official baseline mappings (LOW, MODERATE, HIGH) extracted from NIST OSCAL profiles

## Baseline Data Source

The baseline mappings in `nist-800-53b-baselines.json` are extracted from the official NIST OSCAL baseline profile JSON files:

- **LOW Baseline**: `examples/NIST OSCAL/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_LOW-baseline_profile.json`
- **MODERATE Baseline**: `examples/NIST OSCAL/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_MODERATE-baseline_profile.json`
- **HIGH Baseline**: `examples/NIST OSCAL/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_HIGH-baseline_profile.json`

The control IDs are extracted from `profile.imports[0].include-controls[0].with-ids` arrays in each profile file.

## ID Format Conversion

The OSCAL profiles use lowercase IDs with dots for enhancements (e.g., `ac-2.1`, `ac-2.12`), while CompliNist uses uppercase IDs with parentheses (e.g., `AC-2(1)`, `AC-2(12)`).

**Conversion rules:**
- Base controls: `ac-1` → `AC-1`
- Enhancements: `ac-2.1` → `AC-2(1)`, `ac-2.12` → `AC-2(12)`

## Updating Baseline Data

When NIST releases updated baseline profiles:

1. Download the latest OSCAL baseline profile JSON files from the [NIST OSCAL repository](https://github.com/usnistgov/oscal-content/tree/master/nist.gov/SP800-53/rev5/json)

2. Place them in `examples/NIST OSCAL/nist.gov/SP800-53/rev5/json/`

3. Run the conversion script to regenerate `nist-800-53b-baselines.json`:

```bash
cd /home/cam/Desktop/CompliNist
node -e "
const fs = require('fs');

const lowPath = 'examples/NIST OSCAL/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_LOW-baseline_profile.json';
const modPath = 'examples/NIST OSCAL/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_MODERATE-baseline_profile.json';
const highPath = 'examples/NIST OSCAL/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_HIGH-baseline_profile.json';

const low = JSON.parse(fs.readFileSync(lowPath, 'utf8'));
const mod = JSON.parse(fs.readFileSync(modPath, 'utf8'));
const high = JSON.parse(fs.readFileSync(highPath, 'utf8'));

const lowIds = low.profile.imports[0]['include-controls'][0]['with-ids'];
const modIds = mod.profile.imports[0]['include-controls'][0]['with-ids'];
const highIds = high.profile.imports[0]['include-controls'][0]['with-ids'];

function convertId(oscalId) {
  const parts = oscalId.split('.');
  const base = parts[0].toUpperCase().split('-').map(p => p.toUpperCase()).join('-');
  if (parts.length === 1) {
    return base;
  }
  const enhancement = parts[1];
  return base.replace(/([A-Z]+-\d+)$/, '\$1(' + enhancement + ')');
}

const lowConverted = lowIds.map(convertId).sort();
const modConverted = modIds.map(convertId).sort();
const highConverted = highIds.map(convertId).sort();

const output = {
  version: low.profile.metadata.version,
  LOW: lowConverted,
  MODERATE: modConverted,
  HIGH: highConverted
};

fs.writeFileSync('src/assets/catalog/nist-800-53b-baselines.json', JSON.stringify(output, null, 2));
console.log('Updated baseline JSON with', lowConverted.length, 'LOW,', modConverted.length, 'MODERATE,', highConverted.length, 'HIGH controls');
"
```

4. Verify the changes and test that baseline filtering works correctly in the application.

## Current Version

- **NIST 800-53 Rev**: 5.2.0
- **LOW Controls**: 149
- **MODERATE Controls**: 287
- **HIGH Controls**: 370

## Usage in Code

The baseline JSON is imported in `src/lib/controlCatalog.ts` and used to determine which controls are applicable to each baseline. The `inferBaselines()` function returns an empty array for controls not in any baseline, ensuring proper filtering.



























