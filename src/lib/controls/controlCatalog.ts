import Papa from 'papaparse';
import type { ControlFamily, ControlNarrative, NistBaseline } from '@/lib/utils/types';
import baselines from '@/assets/catalog/nist-800-53b-baselines.json';
import { FAMILY_NAMES, normalizeControlId } from './formatter';

const CATALOG_PATH = new URL('@/assets/catalog/NIST_SP-800-53_rev5_catalog_load.csv', import.meta.url).href;

interface RawCatalogRow {
  identifier?: string;
  name?: string;
  control_text?: string;
  discussion?: string;
  related?: string;
}

// Build Sets for fast baseline lookup
const LOW_SET = new Set(baselines.LOW);
const MODERATE_SET = new Set(baselines.MODERATE);
const HIGH_SET = new Set(baselines.HIGH);

let catalogCache: Promise<ControlNarrative[]> | null = null;

export async function getControlCatalog(): Promise<ControlNarrative[]> {
  if (!catalogCache) {
    catalogCache = fetchCatalogFromCsv();
  }
  return catalogCache;
}

/**
 * Get all controls regardless of baseline
 */
export async function getAllControls(): Promise<{
  items: Record<string, ControlNarrative>;
  families: ControlFamily[];
}> {
  const catalog = await getControlCatalog();
  const controls = catalog.map((control) => ({
    ...control,
    enhancements: control.enhancements ? [...control.enhancements] : undefined,
    narrative: control.default_narrative,
    system_implementation: '',
    isCustom: false,
    wasCustom: false,
    implementation_status: undefined,
  }));
  return {
    items: Object.fromEntries(controls.map((control) => [control.control_id, control])),
    families: groupControlsByFamily(controls),
  };
}

export async function getAllControlsWithBaselineFlags(
  baseline: NistBaseline,
): Promise<{
  items: Record<string, ControlNarrative>;
  families: ControlFamily[];
}> {
  const catalog = await getControlCatalog();
  const controls = catalog.map((control) => ({
    ...control,
    enhancements: control.enhancements ? [...control.enhancements] : undefined,
    narrative: control.default_narrative,
    system_implementation: '',
    isCustom: false,
    wasCustom: false,
    implementation_status: undefined,
    isApplicableToBaseline: control.baselines.includes(baseline),
  }));

  return {
    items: Object.fromEntries(controls.map((control) => [control.control_id, control])),
    families: groupControlsByFamily(controls),
  };
}

export async function getCatalogForBaseline(baseline: NistBaseline): Promise<{
  items: Record<string, ControlNarrative>;
  families: ControlFamily[];
}> {
  const catalog = await getControlCatalog();
  const controls = catalog
    .filter((control) => control.baselines.includes(baseline))
    .map((control) => ({
      ...control,
      enhancements: control.enhancements ? [...control.enhancements] : undefined,
      narrative: control.default_narrative,
      system_implementation: '',
      isCustom: false,
      wasCustom: false,
      implementation_status: undefined,
    }));
  return {
    items: Object.fromEntries(controls.map((control) => [control.control_id, control])),
    families: groupControlsByFamily(controls),
  };
}

export function groupControlsByFamily(controls: ControlNarrative[]): ControlFamily[] {
  const familyMap = new Map<string, ControlFamily>();

  controls.forEach((control) => {
    if (!familyMap.has(control.family)) {
      familyMap.set(control.family, {
        code: control.family,
        name: FAMILY_NAMES[control.family] ?? control.family,
        controls: [],
      });
    }
    familyMap.get(control.family)!.controls.push(control);
  });

  return Array.from(familyMap.values())
    .map((family) => ({
      ...family,
      controls: [...family.controls].sort((a, b) => a.control_id.localeCompare(b.control_id, 'en', { numeric: true })),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

async function fetchCatalogFromCsv(): Promise<ControlNarrative[]> {
  const response = await fetch(CATALOG_PATH);
  if (!response.ok) {
    throw new Error(`Failed to load control catalog: ${response.statusText}`);
  }

  const csvText = await response.text();
  const parsed = Papa.parse<RawCatalogRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    console.warn('CSV parsing errors detected:', parsed.errors.slice(0, 5));
  }

  const controls = parsed.data
    .filter((row: RawCatalogRow) => Boolean(row.identifier))
    .map((row: RawCatalogRow) => createControlFromRow(row as Required<RawCatalogRow>));

  attachEnhancements(controls);

  return controls;
}

function createControlFromRow(row: Required<RawCatalogRow>): ControlNarrative {
  const rawControlId = row.identifier.trim();
  const controlId = normalizeControlId(rawControlId);
  const family = controlId.split('-')[0].toUpperCase();
  const defaultNarrative = buildNarrative(row.control_text, row.discussion);

  // Clean up title - remove pipe separator for enhancement titles
  let title = sanitize(row.name) || controlId;
  if (title.includes('|')) {
    const parts = title.split('|').map(p => p.trim());
    // For enhancements, use the second part if it exists
    if (controlId.includes('(') && parts.length > 1 && parts[1]) {
      title = parts[1];
    } else {
      title = parts[0];
    }
  }

  return {
    control_id: controlId,
    family,
    title,
    default_narrative: defaultNarrative,
    narrative: defaultNarrative,
    implementation_status: undefined,
    isCustom: false,
    wasCustom: false,
    enhancements: [],
    baselines: inferBaselines(controlId),
  };
}

function buildNarrative(controlText?: string, discussion?: string): string {
  const cleanedControlText = sanitize(controlText);
  const cleanedDiscussion = sanitize(discussion);

  if (cleanedControlText && cleanedDiscussion) {
    return `${cleanedControlText}\n\nDiscussion:\n${cleanedDiscussion}`;
  }

  return cleanedControlText || cleanedDiscussion || 'No narrative provided.';
}

function sanitize(value?: string): string {
  return (value ?? '').replace(/\r\n/g, '\n').trim();
}

function inferBaselines(controlId: string): NistBaseline[] {
  const result: NistBaseline[] = [];
  if (LOW_SET.has(controlId)) result.push('LOW');
  if (MODERATE_SET.has(controlId)) result.push('MODERATE');
  if (HIGH_SET.has(controlId)) result.push('HIGH');
  return result;
}

function isEnhancement(controlId: string): boolean {
  return controlId.includes('(');
}

function extractParentControlId(controlId: string): string | null {
  if (!isEnhancement(controlId)) {
    return null;
  }
  return controlId.split('(')[0];
}

function attachEnhancements(controls: ControlNarrative[]) {
  const enhancementMap = new Map<string, string[]>();

  controls.forEach((control) => {
    const parentId = extractParentControlId(control.control_id);
    if (!parentId) return;
    if (!enhancementMap.has(parentId)) {
      enhancementMap.set(parentId, []);
    }
    enhancementMap.get(parentId)!.push(control.control_id);
  });

  controls.forEach((control) => {
    if (enhancementMap.has(control.control_id)) {
      control.enhancements = enhancementMap.get(control.control_id);
    }
  });
}

