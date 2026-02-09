/**
 * Control Name Formatter
 *
 * Provides standardized formatting for NIST 800-53 control names across the application.
 * Ensures consistent naming conventions in UI, RAG responses, exports, and SSP generation.
 *
 * Standardized Format Rules:
 * - Base controls: `AC-3 — Access Enforcement`
 * - Enhancements: `AC-3(1) — Permitted Access Control Changes`
 * - Full path (navigation): `Access Control (AC) > AC-3 — Access Enforcement`
 * - Always use em dash (—) not hyphen (-) between ID and title
 * - Always uppercase control family abbreviations
 * - Enhancements always use parenthetical numbers
 * - No "Control:" prefix needed
 */

import { parseControlId, isEnhancement as checkIsEnhancement } from './parser';

// Em dash character for consistent use
const EM_DASH = '—';

/**
 * Control family names mapping
 * Exported for use across the application
 */
export const FAMILY_NAMES: Record<string, string> = {
  AC: 'Access Control',
  AT: 'Awareness and Training',
  AU: 'Audit and Accountability',
  CA: 'Security Assessment and Authorization',
  CM: 'Configuration Management',
  CP: 'Contingency Planning',
  IA: 'Identification and Authentication',
  IR: 'Incident Response',
  MA: 'Maintenance',
  MP: 'Media Protection',
  PE: 'Physical and Environmental Protection',
  PL: 'Planning',
  PM: 'Program Management',
  PS: 'Personnel Security',
  PT: 'PII Processing and Transparency',
  RA: 'Risk Assessment',
  SA: 'System and Services Acquisition',
  SC: 'System and Communications Protection',
  SI: 'System and Information Integrity',
  SR: 'Supply Chain Risk Management',
};

/**
 * Formatting options for control display
 */
export interface ControlFormatOptions {
  /** Include control title (default: true) */
  includeTitle?: boolean;
  /** Include full family path as breadcrumb (default: false) */
  includeFullPath?: boolean;
  /** Use compact format without em dash (default: false) */
  compact?: boolean;
  /** Include family code in parentheses after family name (default: true when showing path) */
  includeFamilyCode?: boolean;
}

/**
 * Formatted control result
 */
export interface FormattedControl {
  /** Full formatted string e.g., "AC-3 — Access Enforcement" */
  formatted: string;
  /** Control ID only, normalized e.g., "AC-3" or "AC-3(1)" */
  id: string;
  /** Control title only e.g., "Access Enforcement" */
  title: string;
  /** Family code e.g., "AC" */
  family: string;
  /** Family name e.g., "Access Control" */
  familyName: string;
  /** Whether this is an enhancement */
  isEnhancement: boolean;
  /** Base control ID (same as id for base controls) e.g., "AC-3" */
  baseControlId: string;
  /** Enhancement number if applicable */
  enhancementNumber?: number;
  /** Full path format e.g., "Access Control (AC) > AC-3 — Access Enforcement" */
  fullPath: string;
}

/**
 * Normalize a control ID to standard format
 * - Uppercase family abbreviation
 * - Proper parenthetical notation for enhancements
 *
 * @example
 * normalizeControlId('ac-3') // 'AC-3'
 * normalizeControlId('AC-3(1)') // 'AC-3(1)'
 * normalizeControlId('ac-3 (1)') // 'AC-3(1)'
 */
export function normalizeControlId(controlId: string): string {
  if (!controlId) return '';

  // Remove extra whitespace and normalize
  let normalized = controlId.trim().toUpperCase();

  // Fix common formatting issues like 'AC-3 (1)' -> 'AC-3(1)'
  normalized = normalized.replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')');

  // Parse and rebuild to ensure proper format
  const parsed = parseControlId(normalized);
  if (!parsed) return normalized;

  if (parsed.isEnhancement && parsed.enhancementNumber !== null) {
    return `${parsed.family}-${parsed.baseNumber}(${parsed.enhancementNumber})`;
  }

  return `${parsed.family}-${parsed.baseNumber}`;
}

/**
 * Format a control ID with its title using standardized format
 *
 * @param controlId - The control ID (e.g., "AC-3" or "AC-3(1)")
 * @param title - The control title (e.g., "Access Enforcement")
 * @param options - Formatting options
 *
 * @example
 * formatControlName('AC-3', 'Access Enforcement')
 * // 'AC-3 — Access Enforcement'
 *
 * formatControlName('AC-3', 'Access Enforcement', { includeFullPath: true })
 * // 'Access Control (AC) > AC-3 — Access Enforcement'
 *
 * formatControlName('AC-3', 'Access Enforcement', { compact: true })
 * // 'AC-3 Access Enforcement'
 */
export function formatControlName(
  controlId: string,
  title?: string,
  options: ControlFormatOptions = {}
): string {
  const {
    includeTitle = true,
    includeFullPath = false,
    compact = false,
  } = options;

  const normalizedId = normalizeControlId(controlId);

  if (!includeTitle || !title) {
    return normalizedId;
  }

  // Clean up the title - remove any leading family or ID prefix
  let cleanTitle = title.trim();

  // Remove patterns like "Access Enforcement | Some Enhancement" from CSV format
  if (cleanTitle.includes('|')) {
    const parts = cleanTitle.split('|').map(p => p.trim());
    // For enhancements, use the second part if it exists
    if (checkIsEnhancement(normalizedId) && parts.length > 1 && parts[1]) {
      cleanTitle = parts[1];
    } else {
      cleanTitle = parts[0];
    }
  }

  // Build the core formatted string
  const separator = compact ? ' ' : ` ${EM_DASH} `;
  const coreFormat = `${normalizedId}${separator}${cleanTitle}`;

  if (!includeFullPath) {
    return coreFormat;
  }

  // Add full path prefix
  const parsed = parseControlId(normalizedId);
  const familyCode = parsed?.family || normalizedId.split('-')[0].toUpperCase();
  const familyName = FAMILY_NAMES[familyCode] || familyCode;

  return `${familyName} (${familyCode}) > ${coreFormat}`;
}

/**
 * Format control with full information parsed
 *
 * @param controlId - The control ID
 * @param title - The control title
 * @returns FormattedControl object with all formatting variants
 */
export function formatControl(controlId: string, title?: string): FormattedControl {
  const normalizedId = normalizeControlId(controlId);
  const parsed = parseControlId(normalizedId);

  const familyCode = parsed?.family || normalizedId.split('-')[0].toUpperCase();
  const familyName = FAMILY_NAMES[familyCode] || familyCode;
  const isEnhancement = parsed?.isEnhancement || false;
  const baseControlId = parsed?.baseControlId || normalizedId.split('(')[0];

  // Clean up title
  let cleanTitle = (title || '').trim();
  if (cleanTitle.includes('|')) {
    const parts = cleanTitle.split('|').map(p => p.trim());
    if (isEnhancement && parts.length > 1 && parts[1]) {
      cleanTitle = parts[1];
    } else {
      cleanTitle = parts[0];
    }
  }

  const formatted = cleanTitle
    ? `${normalizedId} ${EM_DASH} ${cleanTitle}`
    : normalizedId;

  const fullPath = cleanTitle
    ? `${familyName} (${familyCode}) > ${formatted}`
    : `${familyName} (${familyCode}) > ${normalizedId}`;

  return {
    formatted,
    id: normalizedId,
    title: cleanTitle,
    family: familyCode,
    familyName,
    isEnhancement,
    baseControlId,
    enhancementNumber: parsed?.enhancementNumber ?? undefined,
    fullPath,
  };
}

/**
 * Get the family name for a control family code
 *
 * @param familyCode - The family code (e.g., "AC")
 * @returns The family name (e.g., "Access Control")
 */
export function getFamilyName(familyCode: string): string {
  const code = (familyCode || '').toUpperCase();
  return FAMILY_NAMES[code] || code;
}

/**
 * Format a family header for display
 *
 * @param familyCode - The family code (e.g., "AC")
 * @returns Formatted family header (e.g., "AC — Access Control")
 */
export function formatFamilyHeader(familyCode: string): string {
  const code = (familyCode || '').toUpperCase();
  const name = FAMILY_NAMES[code] || code;
  return `${code} ${EM_DASH} ${name}`;
}

/**
 * Format a family with full name and code
 *
 * @param familyCode - The family code (e.g., "AC")
 * @returns Formatted family (e.g., "Access Control (AC)")
 */
export function formatFamilyWithCode(familyCode: string): string {
  const code = (familyCode || '').toUpperCase();
  const name = FAMILY_NAMES[code] || code;
  return `${name} (${code})`;
}

/**
 * Format control for SSP documents
 * Uses hyphen instead of em dash for better PDF compatibility
 *
 * @param controlId - The control ID
 * @param title - The control title
 * @returns Formatted string for SSP (e.g., "AC-3 - Access Enforcement")
 */
export function formatControlForSSP(controlId: string, title?: string): string {
  const normalizedId = normalizeControlId(controlId);
  if (!title) return normalizedId;

  // Clean up the title
  let cleanTitle = title.trim();
  if (cleanTitle.includes('|')) {
    const parts = cleanTitle.split('|').map(p => p.trim());
    if (checkIsEnhancement(normalizedId) && parts.length > 1 && parts[1]) {
      cleanTitle = parts[1];
    } else {
      cleanTitle = parts[0];
    }
  }

  // Use regular hyphen for PDF compatibility
  return `${normalizedId} - ${cleanTitle}`;
}

/**
 * Format control for RAG responses
 * Includes control name in parentheses for semantic context
 *
 * @param controlId - The control ID
 * @param title - The control title
 * @returns Formatted string for RAG (e.g., "AC-3 (Access Enforcement)")
 */
export function formatControlForRAG(controlId: string, title?: string): string {
  const normalizedId = normalizeControlId(controlId);
  if (!title) return normalizedId;

  // Clean up the title
  let cleanTitle = title.trim();
  if (cleanTitle.includes('|')) {
    const parts = cleanTitle.split('|').map(p => p.trim());
    if (checkIsEnhancement(normalizedId) && parts.length > 1 && parts[1]) {
      cleanTitle = parts[1];
    } else {
      cleanTitle = parts[0];
    }
  }

  return `${normalizedId} (${cleanTitle})`;
}

/**
 * Format an enhancement control relative to its parent
 *
 * @param controlId - The enhancement control ID (e.g., "AC-3(1)")
 * @param title - The enhancement title
 * @returns Formatted enhancement string
 */
export function formatEnhancement(controlId: string, title?: string): string {
  const normalizedId = normalizeControlId(controlId);
  const parsed = parseControlId(normalizedId);

  if (!parsed?.isEnhancement) {
    // Not an enhancement, format normally
    return formatControlName(normalizedId, title);
  }

  // Clean up the title
  let cleanTitle = (title || '').trim();
  if (cleanTitle.includes('|')) {
    const parts = cleanTitle.split('|').map(p => p.trim());
    if (parts.length > 1 && parts[1]) {
      cleanTitle = parts[1];
    } else {
      cleanTitle = parts[0];
    }
  }

  if (!cleanTitle) {
    return normalizedId;
  }

  return `${normalizedId} ${EM_DASH} ${cleanTitle}`;
}

/**
 * Check if a string contains a valid control ID pattern
 *
 * @param text - Text to check
 * @returns True if text contains a control ID
 */
export function containsControlId(text: string): boolean {
  if (!text) return false;
  const pattern = /\b[A-Z]{2,3}-\d{1,2}(?:\(\d{1,2}\))?\b/i;
  return pattern.test(text);
}

/**
 * Extract and format all control IDs from text
 *
 * @param text - Text containing control IDs
 * @returns Array of normalized control IDs
 */
export function extractAndFormatControlIds(text: string): string[] {
  if (!text) return [];

  // First, match enhancements (they are more specific)
  const enhancementPattern = /\b([A-Z]{2,3})-(\d{1,2})\((\d{1,2})\)/gi;
  const basePattern = /\b([A-Z]{2,3})-(\d{1,2})\b/gi;

  const controlIds = new Set<string>();

  // Extract enhancements first
  let match;
  while ((match = enhancementPattern.exec(text)) !== null) {
    const family = match[1].toUpperCase();
    const baseNum = match[2];
    const enhNum = match[3];

    const baseId = `${family}-${baseNum}`;
    controlIds.add(baseId);
    controlIds.add(`${baseId}(${enhNum})`);
  }

  // Then extract base controls that weren't part of enhancements
  while ((match = basePattern.exec(text)) !== null) {
    const family = match[1].toUpperCase();
    const baseNum = match[2];
    const baseId = `${family}-${baseNum}`;
    controlIds.add(baseId);
  }

  return Array.from(controlIds);
}

/**
 * Format a list of controls for display with family grouping header shown once
 * Removes redundant family information from individual controls
 *
 * @param controls - Array of { controlId, title, family } objects
 * @returns Formatted string with family header and control list
 */
export function formatControlList(
  controls: Array<{ controlId: string; title: string; family?: string }>
): string {
  if (!controls.length) return '';

  // Group by family
  const byFamily = new Map<string, typeof controls>();

  for (const control of controls) {
    const parsed = parseControlId(control.controlId);
    const family = parsed?.family || control.family || control.controlId.split('-')[0].toUpperCase();

    if (!byFamily.has(family)) {
      byFamily.set(family, []);
    }
    byFamily.get(family)!.push(control);
  }

  // Format with family headers
  const sections: string[] = [];

  for (const [family, familyControls] of byFamily) {
    const header = formatFamilyHeader(family);
    const controlLines = familyControls.map(c => formatControlName(c.controlId, c.title));
    sections.push(`${header}\n${controlLines.join('\n')}`);
  }

  return sections.join('\n\n');
}
