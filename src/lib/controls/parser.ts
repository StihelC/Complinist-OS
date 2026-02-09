/**
 * Control ID Parser
 *
 * Utilities for parsing and categorizing NIST 800-53 control identifiers.
 * Distinguishes base controls from optional control enhancements.
 *
 * Control ID Format:
 * - Base Control: XX-N (e.g., SI-4, AC-2, IA-5)
 * - Enhancement: XX-N(M) (e.g., SI-4(1), AC-2(8), IA-5(12))
 *
 * Where:
 * - XX = 2-3 letter family code (AC, AT, AU, CA, CM, CP, IA, IR, MA, MP, PE, PL, PM, PS, PT, RA, SA, SC, SI, SR)
 * - N = Base control number (1-99)
 * - M = Enhancement number (1-99), optional
 */

import type { NistBaseline } from '@/lib/utils/types';

/**
 * Control parsing result with detailed breakdown
 */
export interface ParsedControlId {
  /** Original control ID string */
  originalId: string;
  /** Family code (e.g., "SI", "AC") */
  family: string;
  /** Base control number (e.g., 4 for SI-4) */
  baseNumber: number;
  /** Enhancement number if present (e.g., 1 for SI-4(1)), null for base controls */
  enhancementNumber: number | null;
  /** Base control ID without enhancement (e.g., "SI-4" for both "SI-4" and "SI-4(1)") */
  baseControlId: string;
  /** Whether this is an enhancement */
  isEnhancement: boolean;
  /** Whether this is a base control */
  isBaseControl: boolean;
}

/**
 * Control with enhancement grouping information
 */
export interface ControlWithEnhancements {
  /** The base control */
  baseControl: ParsedControlId;
  /** List of enhancement IDs associated with this base control */
  enhancementIds: string[];
  /** Total number of enhancements */
  enhancementCount: number;
}

/**
 * Enhancement display information
 */
export interface EnhancementDisplayInfo {
  /** Enhancement control ID (e.g., "SI-4(1)") */
  controlId: string;
  /** Enhancement number (e.g., 1) */
  enhancementNumber: number;
  /** Parent base control ID (e.g., "SI-4") */
  parentControlId: string;
  /** Display label (e.g., "Enhancement 1") */
  displayLabel: string;
  /** Baselines this enhancement applies to */
  applicableBaselines: NistBaseline[];
  /** Whether this is an optional enhancement */
  isOptional: boolean;
}

// Regex pattern for parsing control IDs
// Matches: 2-3 letter family code, dash, 1-2 digit number, optional parenthetical enhancement
const CONTROL_ID_PATTERN = /^([A-Z]{2,3})-(\d{1,2})(?:\((\d{1,2})\))?$/i;

/**
 * Check if a control ID represents an enhancement
 *
 * @param controlId - Control identifier (e.g., "SI-4" or "SI-4(1)")
 * @returns true if the control is an enhancement, false if it's a base control
 *
 * @example
 * isEnhancement("SI-4")    // false
 * isEnhancement("SI-4(1)") // true
 * isEnhancement("AC-2(8)") // true
 */
export function isEnhancement(controlId: string): boolean {
  return controlId.includes('(');
}

/**
 * Check if a control ID represents a base control (not an enhancement)
 *
 * @param controlId - Control identifier
 * @returns true if the control is a base control, false if it's an enhancement
 *
 * @example
 * isBaseControl("SI-4")    // true
 * isBaseControl("SI-4(1)") // false
 */
export function isBaseControl(controlId: string): boolean {
  return !isEnhancement(controlId);
}

/**
 * Extract the parent base control ID from an enhancement
 * Returns null if the control is already a base control
 *
 * @param controlId - Control identifier
 * @returns Parent control ID or null
 *
 * @example
 * extractParentControlId("SI-4(1)") // "SI-4"
 * extractParentControlId("SI-4")    // null (already base control)
 * extractParentControlId("AC-2(8)") // "AC-2"
 */
export function extractParentControlId(controlId: string): string | null {
  if (!isEnhancement(controlId)) {
    return null;
  }
  return controlId.split('(')[0];
}

/**
 * Get the base control ID for any control (base or enhancement)
 * Unlike extractParentControlId, this always returns a base control ID
 *
 * @param controlId - Control identifier
 * @returns Base control ID
 *
 * @example
 * getBaseControlId("SI-4(1)") // "SI-4"
 * getBaseControlId("SI-4")    // "SI-4"
 */
export function getBaseControlId(controlId: string): string {
  if (isEnhancement(controlId)) {
    return controlId.split('(')[0];
  }
  return controlId;
}

/**
 * Extract the enhancement number from an enhancement control ID
 * Returns null if the control is a base control
 *
 * @param controlId - Control identifier
 * @returns Enhancement number or null
 *
 * @example
 * getEnhancementNumber("SI-4(1)")  // 1
 * getEnhancementNumber("SI-4(12)") // 12
 * getEnhancementNumber("SI-4")     // null
 */
export function getEnhancementNumber(controlId: string): number | null {
  const match = controlId.match(CONTROL_ID_PATTERN);
  if (!match || !match[3]) {
    return null;
  }
  return parseInt(match[3], 10);
}

/**
 * Parse a control ID into its component parts
 *
 * @param controlId - Control identifier
 * @returns ParsedControlId object or null if invalid
 *
 * @example
 * parseControlId("SI-4(1)")
 * // { originalId: "SI-4(1)", family: "SI", baseNumber: 4,
 * //   enhancementNumber: 1, baseControlId: "SI-4",
 * //   isEnhancement: true, isBaseControl: false }
 */
export function parseControlId(controlId: string): ParsedControlId | null {
  const normalized = controlId.trim().toUpperCase();
  const match = normalized.match(CONTROL_ID_PATTERN);

  if (!match) {
    return null;
  }

  const family = match[1].toUpperCase();
  const baseNumber = parseInt(match[2], 10);
  const enhancementNumber = match[3] ? parseInt(match[3], 10) : null;
  const baseControlId = `${family}-${baseNumber}`;
  const isEnhancementControl = enhancementNumber !== null;

  return {
    originalId: normalized,
    family,
    baseNumber,
    enhancementNumber,
    baseControlId,
    isEnhancement: isEnhancementControl,
    isBaseControl: !isEnhancementControl,
  };
}

/**
 * Build a control ID from its components
 *
 * @param family - Family code (e.g., "SI")
 * @param baseNumber - Base control number (e.g., 4)
 * @param enhancementNumber - Enhancement number (optional)
 * @returns Control ID string
 *
 * @example
 * buildControlId("SI", 4)     // "SI-4"
 * buildControlId("SI", 4, 1)  // "SI-4(1)"
 */
export function buildControlId(
  family: string,
  baseNumber: number,
  enhancementNumber?: number
): string {
  const baseId = `${family.toUpperCase()}-${baseNumber}`;
  if (enhancementNumber !== undefined && enhancementNumber !== null) {
    return `${baseId}(${enhancementNumber})`;
  }
  return baseId;
}

/**
 * Get a formatted display label for an enhancement
 *
 * @param controlId - Enhancement control ID
 * @returns Display label or null if not an enhancement
 *
 * @example
 * getEnhancementLabel("SI-4(1)")  // "SI-4 Enhancement (1)"
 * getEnhancementLabel("SI-4(12)") // "SI-4 Enhancement (12)"
 * getEnhancementLabel("SI-4")     // null
 */
export function getEnhancementLabel(controlId: string): string | null {
  const parsed = parseControlId(controlId);
  if (!parsed || !parsed.isEnhancement) {
    return null;
  }
  return `${parsed.baseControlId} Enhancement (${parsed.enhancementNumber})`;
}

/**
 * Get display information for an enhancement
 *
 * @param controlId - Enhancement control ID
 * @param applicableBaselines - Baselines this enhancement applies to
 * @returns EnhancementDisplayInfo or null if not an enhancement
 */
export function getEnhancementDisplayInfo(
  controlId: string,
  applicableBaselines: NistBaseline[] = []
): EnhancementDisplayInfo | null {
  const parsed = parseControlId(controlId);
  if (!parsed || !parsed.isEnhancement || parsed.enhancementNumber === null) {
    return null;
  }

  return {
    controlId: parsed.originalId,
    enhancementNumber: parsed.enhancementNumber,
    parentControlId: parsed.baseControlId,
    displayLabel: `Enhancement (${parsed.enhancementNumber})`,
    applicableBaselines,
    isOptional: true, // Enhancements are always optional in NIST 800-53
  };
}

/**
 * Group controls by their base control, organizing enhancements under their parent
 *
 * @param controlIds - Array of control IDs to group
 * @returns Map of base control ID to ControlWithEnhancements
 *
 * @example
 * groupControlsByBase(["SI-4", "SI-4(1)", "SI-4(8)", "AC-2"])
 * // Map {
 * //   "SI-4" => { baseControl: {...}, enhancementIds: ["SI-4(1)", "SI-4(8)"], enhancementCount: 2 },
 * //   "AC-2" => { baseControl: {...}, enhancementIds: [], enhancementCount: 0 }
 * // }
 */
export function groupControlsByBase(controlIds: string[]): Map<string, ControlWithEnhancements> {
  const groups = new Map<string, ControlWithEnhancements>();

  // First pass: identify all base controls
  for (const controlId of controlIds) {
    const baseId = getBaseControlId(controlId);

    if (!groups.has(baseId)) {
      const parsed = parseControlId(baseId);
      if (parsed) {
        groups.set(baseId, {
          baseControl: parsed,
          enhancementIds: [],
          enhancementCount: 0,
        });
      }
    }
  }

  // Second pass: attach enhancements to their base controls
  for (const controlId of controlIds) {
    if (isEnhancement(controlId)) {
      const baseId = getBaseControlId(controlId);
      const group = groups.get(baseId);
      if (group) {
        group.enhancementIds.push(controlId);
        group.enhancementCount = group.enhancementIds.length;
      }
    }
  }

  // Sort enhancement IDs by enhancement number
  for (const group of groups.values()) {
    group.enhancementIds.sort((a, b) => {
      const numA = getEnhancementNumber(a) ?? 0;
      const numB = getEnhancementNumber(b) ?? 0;
      return numA - numB;
    });
  }

  return groups;
}

/**
 * Get all enhancements for a base control from a list of control IDs
 *
 * @param baseControlId - Base control ID
 * @param allControlIds - List of all control IDs
 * @returns Array of enhancement control IDs
 */
export function getEnhancementsForBase(
  baseControlId: string,
  allControlIds: string[]
): string[] {
  const base = getBaseControlId(baseControlId);
  return allControlIds
    .filter((id) => isEnhancement(id) && getBaseControlId(id) === base)
    .sort((a, b) => {
      const numA = getEnhancementNumber(a) ?? 0;
      const numB = getEnhancementNumber(b) ?? 0;
      return numA - numB;
    });
}

/**
 * Compare two control IDs for sorting
 * Sorts by: family code, base number, enhancement number
 *
 * @param a - First control ID
 * @param b - Second control ID
 * @returns Comparison result (-1, 0, 1)
 */
export function compareControlIds(a: string, b: string): number {
  const parsedA = parseControlId(a);
  const parsedB = parseControlId(b);

  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return 1;
  if (!parsedB) return -1;

  // Compare family codes
  const familyCompare = parsedA.family.localeCompare(parsedB.family);
  if (familyCompare !== 0) return familyCompare;

  // Compare base numbers
  if (parsedA.baseNumber !== parsedB.baseNumber) {
    return parsedA.baseNumber - parsedB.baseNumber;
  }

  // Compare enhancement numbers (base controls before enhancements)
  const enhA = parsedA.enhancementNumber ?? 0;
  const enhB = parsedB.enhancementNumber ?? 0;
  return enhA - enhB;
}

/**
 * Validate if a string is a valid control ID format
 *
 * @param controlId - String to validate
 * @returns true if valid control ID format
 */
export function isValidControlId(controlId: string): boolean {
  return parseControlId(controlId) !== null;
}

/**
 * Extract all control IDs from a text string
 * Useful for parsing queries or free-form text
 *
 * @param text - Text to search for control IDs
 * @returns Array of unique control IDs found
 */
export function extractControlIdsFromText(text: string): string[] {
  // Regex that captures control IDs with optional enhancement numbers
  // Uses non-capturing group for the parenthetical, then captures just the digits
  const pattern = /([A-Z]{2,3})-(\d{1,2})(\((\d{1,2})\))?/gi;
  const matches = text.matchAll(pattern);
  const controlIds = new Set<string>();

  for (const match of matches) {
    const family = match[1].toUpperCase();
    const baseNum = match[2];
    const enhNum = match[4]; // match[3] is the full "(N)", match[4] is just "N"

    // Always add the base control ID
    const baseControlId = `${family}-${baseNum}`;
    controlIds.add(baseControlId);

    // If there's an enhancement, also add the full enhancement ID
    if (enhNum) {
      controlIds.add(`${baseControlId}(${enhNum})`);
    }
  }

  return Array.from(controlIds).sort(compareControlIds);
}
