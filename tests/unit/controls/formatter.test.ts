/**
 * Control Name Formatter Unit Tests
 *
 * Tests the control name formatting utility to ensure:
 * 1. Control IDs are normalized correctly
 * 2. Control names use standardized format with em dash
 * 3. Family names are correctly resolved
 * 4. SSP and RAG-specific formats work correctly
 * 5. Enhancement titles are properly cleaned
 *
 * This is a verification test for feature-1768177363326-n3l3vhjf0:
 * "Normalize control naming and formatting for consistency across the application"
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeControlId,
  formatControlName,
  formatControl,
  getFamilyName,
  formatFamilyHeader,
  formatFamilyWithCode,
  formatControlForSSP,
  formatControlForRAG,
  formatEnhancement,
  containsControlId,
  extractAndFormatControlIds,
  formatControlList,
  FAMILY_NAMES,
} from '@/lib/controls/formatter';

describe('formatter', () => {
  describe('normalizeControlId', () => {
    it('should normalize lowercase control IDs to uppercase', () => {
      expect(normalizeControlId('ac-3')).toBe('AC-3');
      expect(normalizeControlId('si-4')).toBe('SI-4');
    });

    it('should normalize mixed case control IDs', () => {
      expect(normalizeControlId('Ac-3')).toBe('AC-3');
      expect(normalizeControlId('sI-4(1)')).toBe('SI-4(1)');
    });

    it('should fix spacing in enhancement notation', () => {
      expect(normalizeControlId('AC-3 (1)')).toBe('AC-3(1)');
      expect(normalizeControlId('AC-3( 1 )')).toBe('AC-3(1)');
    });

    it('should handle already normalized IDs', () => {
      expect(normalizeControlId('AC-3')).toBe('AC-3');
      expect(normalizeControlId('AC-3(1)')).toBe('AC-3(1)');
    });

    it('should handle empty string', () => {
      expect(normalizeControlId('')).toBe('');
    });

    it('should trim whitespace', () => {
      expect(normalizeControlId('  AC-3  ')).toBe('AC-3');
    });
  });

  describe('formatControlName', () => {
    it('should format base control with em dash', () => {
      const result = formatControlName('AC-3', 'Access Enforcement');
      expect(result).toBe('AC-3 — Access Enforcement');
    });

    it('should format enhancement with em dash', () => {
      const result = formatControlName('AC-3(1)', 'Permitted Access Control Changes');
      expect(result).toBe('AC-3(1) — Permitted Access Control Changes');
    });

    it('should handle missing title', () => {
      expect(formatControlName('AC-3')).toBe('AC-3');
      expect(formatControlName('AC-3', '')).toBe('AC-3');
      expect(formatControlName('AC-3', undefined)).toBe('AC-3');
    });

    it('should use compact format when specified', () => {
      const result = formatControlName('AC-3', 'Access Enforcement', { compact: true });
      expect(result).toBe('AC-3 Access Enforcement');
    });

    it('should include full path when specified', () => {
      const result = formatControlName('AC-3', 'Access Enforcement', { includeFullPath: true });
      expect(result).toBe('Access Control (AC) > AC-3 — Access Enforcement');
    });

    it('should clean pipe-separated enhancement titles', () => {
      const result = formatControlName('AC-2(1)', 'Account Management | Automated System Account Management');
      expect(result).toBe('AC-2(1) — Automated System Account Management');
    });

    it('should use first part of pipe-separated title for base controls', () => {
      const result = formatControlName('AC-2', 'Account Management | Some Suffix');
      expect(result).toBe('AC-2 — Account Management');
    });

    it('should normalize control ID in output', () => {
      const result = formatControlName('ac-3', 'Access Enforcement');
      expect(result).toBe('AC-3 — Access Enforcement');
    });
  });

  describe('formatControl', () => {
    it('should return full FormattedControl object for base control', () => {
      const result = formatControl('AC-3', 'Access Enforcement');

      expect(result.id).toBe('AC-3');
      expect(result.title).toBe('Access Enforcement');
      expect(result.family).toBe('AC');
      expect(result.familyName).toBe('Access Control');
      expect(result.isEnhancement).toBe(false);
      expect(result.baseControlId).toBe('AC-3');
      expect(result.formatted).toBe('AC-3 — Access Enforcement');
      expect(result.fullPath).toBe('Access Control (AC) > AC-3 — Access Enforcement');
    });

    it('should return full FormattedControl object for enhancement', () => {
      const result = formatControl('AC-3(1)', 'Permitted Access Control Changes');

      expect(result.id).toBe('AC-3(1)');
      expect(result.isEnhancement).toBe(true);
      expect(result.baseControlId).toBe('AC-3');
      expect(result.enhancementNumber).toBe(1);
    });
  });

  describe('getFamilyName', () => {
    it('should return correct family names', () => {
      expect(getFamilyName('AC')).toBe('Access Control');
      expect(getFamilyName('SI')).toBe('System and Information Integrity');
      expect(getFamilyName('SC')).toBe('System and Communications Protection');
    });

    it('should handle lowercase input', () => {
      expect(getFamilyName('ac')).toBe('Access Control');
    });

    it('should return code for unknown families', () => {
      expect(getFamilyName('XX')).toBe('XX');
    });

    it('should handle empty string', () => {
      expect(getFamilyName('')).toBe('');
    });
  });

  describe('formatFamilyHeader', () => {
    it('should format family header with em dash', () => {
      expect(formatFamilyHeader('AC')).toBe('AC — Access Control');
      expect(formatFamilyHeader('SI')).toBe('SI — System and Information Integrity');
    });

    it('should handle lowercase input', () => {
      expect(formatFamilyHeader('ac')).toBe('AC — Access Control');
    });
  });

  describe('formatFamilyWithCode', () => {
    it('should format family with code in parentheses', () => {
      expect(formatFamilyWithCode('AC')).toBe('Access Control (AC)');
      expect(formatFamilyWithCode('SI')).toBe('System and Information Integrity (SI)');
    });
  });

  describe('formatControlForSSP', () => {
    it('should use hyphen for SSP format (PDF compatibility)', () => {
      const result = formatControlForSSP('AC-3', 'Access Enforcement');
      expect(result).toBe('AC-3 - Access Enforcement');
    });

    it('should handle missing title', () => {
      expect(formatControlForSSP('AC-3')).toBe('AC-3');
    });

    it('should clean pipe-separated titles', () => {
      const result = formatControlForSSP('AC-2(1)', 'Account Management | Automated System Account Management');
      expect(result).toBe('AC-2(1) - Automated System Account Management');
    });
  });

  describe('formatControlForRAG', () => {
    it('should use parentheses format for RAG', () => {
      const result = formatControlForRAG('AC-3', 'Access Enforcement');
      expect(result).toBe('AC-3 (Access Enforcement)');
    });

    it('should handle missing title', () => {
      expect(formatControlForRAG('AC-3')).toBe('AC-3');
    });

    it('should clean pipe-separated titles', () => {
      const result = formatControlForRAG('AC-2(1)', 'Account Management | Automated System Account Management');
      expect(result).toBe('AC-2(1) (Automated System Account Management)');
    });
  });

  describe('formatEnhancement', () => {
    it('should format enhancement with em dash', () => {
      const result = formatEnhancement('AC-3(1)', 'Permitted Access Control Changes');
      expect(result).toBe('AC-3(1) — Permitted Access Control Changes');
    });

    it('should handle base control input (non-enhancement)', () => {
      const result = formatEnhancement('AC-3', 'Access Enforcement');
      expect(result).toBe('AC-3 — Access Enforcement');
    });

    it('should clean pipe-separated titles', () => {
      const result = formatEnhancement('AC-2(1)', 'Account Management | Automated System Account Management');
      expect(result).toBe('AC-2(1) — Automated System Account Management');
    });
  });

  describe('containsControlId', () => {
    it('should detect control IDs in text', () => {
      expect(containsControlId('This implements AC-3 requirements')).toBe(true);
      expect(containsControlId('Control AC-3(1) is required')).toBe(true);
    });

    it('should return false for text without control IDs', () => {
      expect(containsControlId('No controls here')).toBe(false);
      expect(containsControlId('')).toBe(false);
    });
  });

  describe('extractAndFormatControlIds', () => {
    it('should extract and normalize control IDs from text', () => {
      const ids = extractAndFormatControlIds('This implements ac-3 and SI-4(1) requirements.');
      expect(ids).toContain('AC-3');
      expect(ids).toContain('SI-4');
      expect(ids).toContain('SI-4(1)');
    });

    it('should handle multiple families', () => {
      const ids = extractAndFormatControlIds('Controls AC-2, SC-7, and IA-5(1) are required.');
      expect(ids).toContain('AC-2');
      expect(ids).toContain('SC-7');
      expect(ids).toContain('IA-5');
      expect(ids).toContain('IA-5(1)');
    });

    it('should return unique IDs', () => {
      const ids = extractAndFormatControlIds('AC-3 and AC-3 and AC-3 again');
      expect(ids.filter(id => id === 'AC-3').length).toBe(1);
    });

    it('should handle empty text', () => {
      expect(extractAndFormatControlIds('')).toEqual([]);
    });
  });

  describe('formatControlList', () => {
    it('should format controls with family headers', () => {
      const controls = [
        { controlId: 'AC-2', title: 'Account Management' },
        { controlId: 'AC-3', title: 'Access Enforcement' },
        { controlId: 'SI-4', title: 'System Monitoring' },
      ];
      const result = formatControlList(controls);

      // Should contain family headers
      expect(result).toContain('AC — Access Control');
      expect(result).toContain('SI — System and Information Integrity');

      // Should contain formatted control names
      expect(result).toContain('AC-2 — Account Management');
      expect(result).toContain('AC-3 — Access Enforcement');
      expect(result).toContain('SI-4 — System Monitoring');
    });

    it('should handle empty list', () => {
      expect(formatControlList([])).toBe('');
    });
  });

  describe('FAMILY_NAMES constant', () => {
    it('should contain all 20 control families', () => {
      expect(Object.keys(FAMILY_NAMES).length).toBe(20);
    });

    it('should contain all required families', () => {
      const requiredFamilies = [
        'AC', 'AT', 'AU', 'CA', 'CM', 'CP', 'IA', 'IR', 'MA', 'MP',
        'PE', 'PL', 'PM', 'PS', 'PT', 'RA', 'SA', 'SC', 'SI', 'SR'
      ];
      requiredFamilies.forEach(family => {
        expect(FAMILY_NAMES[family]).toBeDefined();
        expect(typeof FAMILY_NAMES[family]).toBe('string');
      });
    });
  });

  describe('Standardized Format Verification', () => {
    it('should use em dash (—) not hyphen (-) between ID and title', () => {
      const result = formatControlName('AC-3', 'Access Enforcement');
      expect(result).toContain('—'); // Em dash
      expect(result).toBe('AC-3 — Access Enforcement');
      // The hyphen in AC-3 is still present (that's part of the ID)
    });

    it('should always uppercase control family abbreviations', () => {
      expect(formatControlName('ac-3', 'Test')).toMatch(/^AC-/);
      expect(formatControl('si-4', 'Test').family).toBe('SI');
      expect(normalizeControlId('ca-1')).toBe('CA-1');
    });

    it('should always use parenthetical numbers for enhancements', () => {
      expect(normalizeControlId('AC-3(1)')).toBe('AC-3(1)');
      expect(normalizeControlId('SI-4(12)')).toBe('SI-4(12)');
    });

    it('should not include "Control:" prefix', () => {
      const result = formatControlName('AC-3', 'Access Enforcement');
      expect(result).not.toContain('Control:');
    });

    it('should not repeat family labels unnecessarily', () => {
      // formatControlName without full path should not include family
      const result = formatControlName('AC-3', 'Access Enforcement');
      expect(result).not.toContain('Families:');
      expect(result).not.toContain('Access Control');
    });
  });

  describe('Real-world examples from feature requirements', () => {
    it('should handle AC-3 Access Enforcement', () => {
      const result = formatControlName('AC-3', 'Access Enforcement');
      expect(result).toBe('AC-3 — Access Enforcement');
    });

    it('should handle AC-3(1) enhancement', () => {
      const result = formatControlName('AC-3(1)', 'Permitted Access Control Changes');
      expect(result).toBe('AC-3(1) — Permitted Access Control Changes');
    });

    it('should provide full path when needed', () => {
      const result = formatControlName('AC-3', 'Access Enforcement', { includeFullPath: true });
      expect(result).toBe('Access Control (AC) > AC-3 — Access Enforcement');
    });
  });
});
