#!/usr/bin/env node

/**
 * Validate SP-800-53 Controls and Baseline Assignments
 * 
 * This script:
 * 1. Parses SP_800-53_v5_1_XML.xml to extract all controls and baseline assignments
 * 2. Validates CSV catalog completeness
 * 3. Validates baseline JSON against XML
 * 4. Generates corrected baseline JSON
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// File paths
const XML_PATH = path.join(projectRoot, 'docs', 'SP_800-53_v5_1_XML.xml');
const CSV_PATH = path.join(projectRoot, 'src', 'assets', 'catalog', 'NIST_SP-800-53_rev5_catalog_load.csv');
const BASELINE_JSON_PATH = path.join(projectRoot, 'src', 'assets', 'catalog', 'nist-800-53b-baselines.json');
const OSCAL_LOW_PATH = path.join(projectRoot, 'examples', 'NIST OSCAL', 'nist.gov', 'SP800-53', 'rev5', 'json', 'NIST_SP-800-53_rev5_LOW-baseline_profile.json');
const OSCAL_MODERATE_PATH = path.join(projectRoot, 'examples', 'NIST OSCAL', 'nist.gov', 'SP800-53', 'rev5', 'json', 'NIST_SP-800-53_rev5_MODERATE-baseline_profile.json');
const OSCAL_HIGH_PATH = path.join(projectRoot, 'examples', 'NIST OSCAL', 'nist.gov', 'SP800-53', 'rev5', 'json', 'NIST_SP-800-53_rev5_HIGH-baseline_profile.json');

/**
 * Normalize control ID format
 * Converts XML format to our format (e.g., "AC-2(1)" stays as is)
 */
function normalizeControlId(controlId) {
  if (!controlId) return null;
  // Remove any whitespace and ensure uppercase
  return controlId.trim().toUpperCase();
}


/**
 * Parse XML file and extract all controls with baselines
 * Uses regex-based parsing for simplicity
 */
function parseXMLControls(xmlContent) {
  const controls = new Map(); // controlId -> { baselines: [], family: string, title: string }
  
  // Match control blocks: <controls:control>...</controls:control>
  const controlRegex = /<controls:control>([\s\S]*?)<\/controls:control>/g;
  let match;
  let controlCount = 0;
  
  while ((match = controlRegex.exec(xmlContent)) !== null) {
    const controlBlock = match[1];
    controlCount++;
    
    // Extract family
    const familyMatch = controlBlock.match(/<family>([\s\S]*?)<\/family>/);
    const family = familyMatch ? familyMatch[1].trim() : '';
    
    // Extract control number (base control)
    const numberMatch = controlBlock.match(/<number>([\s\S]*?)<\/number>/);
    if (!numberMatch) continue;
    
    const controlNumber = numberMatch[1].trim();
    const controlId = normalizeControlId(controlNumber);
    if (!controlId) continue;
    
    // Extract title
    const titleMatch = controlBlock.match(/<title>([\s\S]*?)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Extract baselines for base control
    const baselineMatches = controlBlock.matchAll(/<baseline>([\s\S]*?)<\/baseline>/g);
    const baselines = [];
    for (const baselineMatch of baselineMatches) {
      const baseline = baselineMatch[1].trim().toUpperCase();
      if (['LOW', 'MODERATE', 'HIGH'].includes(baseline)) {
        baselines.push(baseline);
      }
    }
    
    // Store base control
    controls.set(controlId, {
      controlId,
      family,
      title,
      baselines: [...baselines],
    });
    
    // Extract enhancements
    const enhancementsMatch = controlBlock.match(/<control-enhancements>([\s\S]*?)<\/control-enhancements>/);
    if (enhancementsMatch) {
      const enhancementsBlock = enhancementsMatch[1];
      const enhancementRegex = /<control-enhancement>([\s\S]*?)<\/control-enhancement>/g;
      let enhancementMatch;
      
      while ((enhancementMatch = enhancementRegex.exec(enhancementsBlock)) !== null) {
        const enhancementBlock = enhancementMatch[1];
        
        // Extract enhancement number
        const enhNumberMatch = enhancementBlock.match(/<number>([\s\S]*?)<\/number>/);
        if (!enhNumberMatch) continue;
        
        const enhancementNumber = enhNumberMatch[1].trim();
        const enhancementId = normalizeControlId(enhancementNumber);
        if (!enhancementId) continue;
        
        // Extract enhancement title
        const enhTitleMatch = enhancementBlock.match(/<title>([\s\S]*?)<\/title>/);
        const enhancementTitle = enhTitleMatch ? enhTitleMatch[1].trim() : '';
        
        // Extract baselines for enhancement (if present, otherwise inherit from parent)
        const enhBaselineMatches = enhancementBlock.matchAll(/<baseline>([\s\S]*?)<\/baseline>/g);
        let enhancementBaselines = [];
        for (const enhBaselineMatch of enhBaselineMatches) {
          const baseline = enhBaselineMatch[1].trim().toUpperCase();
          if (['LOW', 'MODERATE', 'HIGH'].includes(baseline)) {
            enhancementBaselines.push(baseline);
          }
        }
        
        // If no baselines on enhancement, inherit from parent
        if (enhancementBaselines.length === 0) {
          enhancementBaselines = [...baselines];
        }
        
        controls.set(enhancementId, {
          controlId: enhancementId,
          family,
          title: enhancementTitle,
          baselines: [...enhancementBaselines],
          isEnhancement: true,
          parentControl: controlId,
        });
      }
    }
  }
  
  console.log(`   Parsed ${controlCount} control blocks`);
  return controls;
}

/**
 * Load CSV catalog and extract control IDs
 * Handles quoted fields properly
 */
function loadCSVCatalog() {
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = csvContent.split('\n');
  const controls = new Set();
  
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // CSV format: identifier,name,control_text,discussion,related
    // Handle CSV with quoted fields that may contain commas and newlines
    // Simple approach: extract first field (identifier)
    let identifier = '';
    let inQuotes = false;
    let fieldStart = 0;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        identifier = line.substring(fieldStart, j).replace(/^"|"$/g, '').trim();
        break;
      }
    }
    
    // If no comma found, take the whole line (shouldn't happen but handle it)
    if (!identifier && fieldStart === 0) {
      identifier = line.replace(/^"|"$/g, '').trim();
    }
    
    if (identifier) {
      controls.add(normalizeControlId(identifier));
    }
  }
  
  return controls;
}

/**
 * Load existing baseline JSON
 */
function loadBaselineJSON() {
  const content = fs.readFileSync(BASELINE_JSON_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Convert OSCAL control ID format to our format
 * ac-2.1 -> AC-2(1)
 * ac-2.12 -> AC-2(12)
 */
function convertOscalId(oscalId) {
  const parts = oscalId.toLowerCase().split('.');
  const base = parts[0].toUpperCase();
  if (parts.length === 1) {
    return base;
  }
  const enhancement = parts[1];
  return `${base}(${enhancement})`;
}

/**
 * Load baseline controls from OSCAL profile files
 */
function loadOscalBaselines() {
  const baselines = { LOW: [], MODERATE: [], HIGH: [] };
  
  // Load LOW baseline
  if (fs.existsSync(OSCAL_LOW_PATH)) {
    const lowProfile = JSON.parse(fs.readFileSync(OSCAL_LOW_PATH, 'utf-8'));
    const lowIds = lowProfile.profile?.imports?.[0]?.['include-controls']?.[0]?.['with-ids'] || [];
    baselines.LOW = lowIds.map(convertOscalId).sort();
  }
  
  // Load MODERATE baseline
  if (fs.existsSync(OSCAL_MODERATE_PATH)) {
    const modProfile = JSON.parse(fs.readFileSync(OSCAL_MODERATE_PATH, 'utf-8'));
    const modIds = modProfile.profile?.imports?.[0]?.['include-controls']?.[0]?.['with-ids'] || [];
    baselines.MODERATE = modIds.map(convertOscalId).sort();
  }
  
  // Load HIGH baseline
  if (fs.existsSync(OSCAL_HIGH_PATH)) {
    const highProfile = JSON.parse(fs.readFileSync(OSCAL_HIGH_PATH, 'utf-8'));
    const highIds = highProfile.profile?.imports?.[0]?.['include-controls']?.[0]?.['with-ids'] || [];
    baselines.HIGH = highIds.map(convertOscalId).sort();
  }
  
  return baselines;
}

/**
 * Build baseline mappings from XML controls
 */
function buildBaselineMappings(xmlControls) {
  const low = [];
  const moderate = [];
  const high = [];
  
  for (const [controlId, control] of xmlControls) {
    if (control.baselines.includes('LOW')) {
      low.push(controlId);
    }
    if (control.baselines.includes('MODERATE')) {
      moderate.push(controlId);
    }
    if (control.baselines.includes('HIGH')) {
      high.push(controlId);
    }
  }
  
  // Sort for consistency
  low.sort();
  moderate.sort();
  high.sort();
  
  return {
    LOW: low,
    MODERATE: moderate,
    HIGH: high,
  };
}

/**
 * Main validation function
 */
function main() {
  console.log('=== SP-800-53 Control and Baseline Validation ===\n');
  
  // 1. Parse XML
  console.log('1. Parsing XML file...');
  const xmlContent = fs.readFileSync(XML_PATH, 'utf-8');
  const xmlControls = parseXMLControls(xmlContent);
  console.log(`   Found ${xmlControls.size} controls in XML\n`);
  
  // 2. Load CSV catalog
  console.log('2. Loading CSV catalog...');
  const csvControls = loadCSVCatalog();
  console.log(`   Found ${csvControls.size} controls in CSV\n`);
  
  // 3. Compare XML vs CSV
  console.log('3. Comparing XML vs CSV...');
  const missingInCSV = [];
  const extraInCSV = [];
  
  for (const [controlId] of xmlControls) {
    if (!csvControls.has(controlId)) {
      missingInCSV.push(controlId);
    }
  }
  
  for (const controlId of csvControls) {
    if (!xmlControls.has(controlId)) {
      extraInCSV.push(controlId);
    }
  }
  
  console.log(`   Missing in CSV: ${missingInCSV.length}`);
  if (missingInCSV.length > 0 && missingInCSV.length <= 20) {
    console.log(`   Examples: ${missingInCSV.slice(0, 10).join(', ')}`);
  }
  console.log(`   Extra in CSV: ${extraInCSV.length}`);
  if (extraInCSV.length > 0 && extraInCSV.length <= 20) {
    console.log(`   Examples: ${extraInCSV.slice(0, 10).join(', ')}`);
  }
  console.log();
  
  // 4. Load OSCAL baseline profiles (official source)
  console.log('4. Loading OSCAL baseline profiles...');
  const oscalBaselines = loadOscalBaselines();
  const oscalLow = new Set(oscalBaselines.LOW);
  const oscalModerate = new Set(oscalBaselines.MODERATE);
  const oscalHigh = new Set(oscalBaselines.HIGH);
  console.log(`   LOW: ${oscalLow.size} controls`);
  console.log(`   MODERATE: ${oscalModerate.size} controls`);
  console.log(`   HIGH: ${oscalHigh.size} controls\n`);
  
  // 4b. Load existing baseline JSON
  console.log('4b. Loading existing baseline JSON...');
  const existingBaselines = loadBaselineJSON();
  const existingLow = new Set(existingBaselines.LOW || []);
  const existingModerate = new Set(existingBaselines.MODERATE || []);
  const existingHigh = new Set(existingBaselines.HIGH || []);
  console.log(`   LOW: ${existingLow.size} controls`);
  console.log(`   MODERATE: ${existingModerate.size} controls`);
  console.log(`   HIGH: ${existingHigh.size} controls\n`);
  
  // 5. Build baseline mappings from XML (for comparison)
  console.log('5. Building baseline mappings from XML...');
  const xmlBaselines = buildBaselineMappings(xmlControls);
  console.log(`   LOW: ${xmlBaselines.LOW.length} controls`);
  console.log(`   MODERATE: ${xmlBaselines.MODERATE.length} controls`);
  console.log(`   HIGH: ${xmlBaselines.HIGH.length} controls\n`);
  
  // 6. Compare XML baselines vs OSCAL baselines (official source)
  console.log('6. Comparing XML baselines vs OSCAL baselines (official source)...');
  const xmlLow = new Set(xmlBaselines.LOW);
  const xmlModerate = new Set(xmlBaselines.MODERATE);
  const xmlHigh = new Set(xmlBaselines.HIGH);
  
  // Find controls in OSCAL but not in XML baselines
  const lowInOscalNotXml = oscalBaselines.LOW.filter(id => !xmlLow.has(id));
  const moderateInOscalNotXml = oscalBaselines.MODERATE.filter(id => !xmlModerate.has(id));
  const highInOscalNotXml = oscalBaselines.HIGH.filter(id => !xmlHigh.has(id));
  
  // Find controls in XML baselines but not in OSCAL
  const lowInXmlNotOscal = xmlBaselines.LOW.filter(id => !oscalLow.has(id));
  const moderateInXmlNotOscal = xmlBaselines.MODERATE.filter(id => !oscalModerate.has(id));
  const highInXmlNotOscal = xmlBaselines.HIGH.filter(id => !oscalHigh.has(id));
  
  console.log(`   LOW - In OSCAL but not XML: ${lowInOscalNotXml.length}, In XML but not OSCAL: ${lowInXmlNotOscal.length}`);
  if (lowInOscalNotXml.length > 0 && lowInOscalNotXml.length <= 10) {
    console.log(`     OSCAL only: ${lowInOscalNotXml.slice(0, 5).join(', ')}`);
  }
  if (lowInXmlNotOscal.length > 0 && lowInXmlNotOscal.length <= 10) {
    console.log(`     XML only: ${lowInXmlNotOscal.slice(0, 5).join(', ')}`);
  }
  
  console.log(`   MODERATE - In OSCAL but not XML: ${moderateInOscalNotXml.length}, In XML but not OSCAL: ${moderateInXmlNotOscal.length}`);
  if (moderateInOscalNotXml.length > 0 && moderateInOscalNotXml.length <= 10) {
    console.log(`     OSCAL only: ${moderateInOscalNotXml.slice(0, 5).join(', ')}`);
  }
  if (moderateInXmlNotOscal.length > 0 && moderateInXmlNotOscal.length <= 10) {
    console.log(`     XML only: ${moderateInXmlNotOscal.slice(0, 5).join(', ')}`);
  }
  
  console.log(`   HIGH - In OSCAL but not XML: ${highInOscalNotXml.length}, In XML but not OSCAL: ${highInXmlNotOscal.length}`);
  if (highInOscalNotXml.length > 0 && highInOscalNotXml.length <= 10) {
    console.log(`     OSCAL only: ${highInOscalNotXml.slice(0, 5).join(', ')}`);
  }
  if (highInXmlNotOscal.length > 0 && highInXmlNotOscal.length <= 10) {
    console.log(`     XML only: ${highInXmlNotOscal.slice(0, 5).join(', ')}`);
  }
  console.log();
  
  // 7. Compare existing JSON vs OSCAL (the official source)
  console.log('7. Comparing existing baseline JSON vs OSCAL baselines...');
  const lowMissing = oscalBaselines.LOW.filter(id => !existingLow.has(id));
  const lowExtra = Array.from(existingLow).filter(id => !oscalLow.has(id));
  
  const moderateMissing = oscalBaselines.MODERATE.filter(id => !existingModerate.has(id));
  const moderateExtra = Array.from(existingModerate).filter(id => !oscalModerate.has(id));
  
  const highMissing = oscalBaselines.HIGH.filter(id => !existingHigh.has(id));
  const highExtra = Array.from(existingHigh).filter(id => !oscalHigh.has(id));
  
  console.log(`   LOW - Missing: ${lowMissing.length}, Extra: ${lowExtra.length}`);
  if (lowMissing.length > 0 && lowMissing.length <= 10) {
    console.log(`     Missing: ${lowMissing.join(', ')}`);
  }
  if (lowExtra.length > 0 && lowExtra.length <= 10) {
    console.log(`     Extra: ${lowExtra.join(', ')}`);
  }
  
  console.log(`   MODERATE - Missing: ${moderateMissing.length}, Extra: ${moderateExtra.length}`);
  if (moderateMissing.length > 0 && moderateMissing.length <= 10) {
    console.log(`     Missing: ${moderateMissing.join(', ')}`);
  }
  if (moderateExtra.length > 0 && moderateExtra.length <= 10) {
    console.log(`     Extra: ${moderateExtra.join(', ')}`);
  }
  
  console.log(`   HIGH - Missing: ${highMissing.length}, Extra: ${highExtra.length}`);
  if (highMissing.length > 0 && highMissing.length <= 10) {
    console.log(`     Missing: ${highMissing.join(', ')}`);
  }
  if (highExtra.length > 0 && highExtra.length <= 10) {
    console.log(`     Extra: ${highExtra.join(', ')}`);
  }
  console.log();
  
  // 8. Generate corrected baseline JSON (use OSCAL as source of truth)
  console.log('8. Generating corrected baseline JSON (using OSCAL as source of truth)...');
  const correctedBaselines = {
    version: existingBaselines.version || '5.2.0',
    LOW: oscalBaselines.LOW,
    MODERATE: oscalBaselines.MODERATE,
    HIGH: oscalBaselines.HIGH,
  };
  
  const outputPath = path.join(projectRoot, 'src', 'assets', 'catalog', 'nist-800-53b-baselines.json');
  fs.writeFileSync(outputPath, JSON.stringify(correctedBaselines, null, 2) + '\n');
  console.log(`   Updated: ${outputPath}\n`);
  
  // 9. Summary
  console.log('=== Summary ===');
  console.log(`Total controls in XML: ${xmlControls.size}`);
  console.log(`Total controls in CSV: ${csvControls.size}`);
  console.log(`Missing in CSV: ${missingInCSV.length}`);
  console.log(`Extra in CSV: ${extraInCSV.length}`);
  console.log(`\nBaseline counts (OSCAL - official source):`);
  console.log(`  LOW: ${oscalBaselines.LOW.length} controls`);
  console.log(`  MODERATE: ${oscalBaselines.MODERATE.length} controls`);
  console.log(`  HIGH: ${oscalBaselines.HIGH.length} controls`);
  console.log(`\nBaseline counts (XML):`);
  console.log(`  LOW: ${xmlBaselines.LOW.length} controls`);
  console.log(`  MODERATE: ${xmlBaselines.MODERATE.length} controls`);
  console.log(`  HIGH: ${xmlBaselines.HIGH.length} controls`);
  console.log();
  
  const hasIssues = missingInCSV.length > 0 || lowMissing.length > 0 || moderateMissing.length > 0 || highMissing.length > 0;
  
  if (hasIssues) {
    console.log('⚠️  Warnings: Some controls are missing or mismatched. Review the output above.');
    console.log('\nNote: Using OSCAL baseline profiles as the official source of truth.');
    process.exit(1);
  } else {
    console.log('✅ All controls validated successfully!');
    console.log('✅ Baseline JSON updated to match OSCAL profiles.');
    process.exit(0);
  }
}

// Run the script
try {
  main();
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}

