/**
 * Control ID Parser Unit Tests
 *
 * Tests the control ID parsing functionality to ensure:
 * 1. Base controls are correctly identified
 * 2. Enhancements are correctly detected and parsed
 * 3. Parent control IDs are correctly extracted
 * 4. Controls are properly grouped by base
 */

import { describe, it, expect } from 'vitest';
import {
  isEnhancement,
  isBaseControl,
  extractParentControlId,
  getBaseControlId,
  getEnhancementNumber,
  parseControlId,
  buildControlId,
  getEnhancementLabel,
  getEnhancementDisplayInfo,
  groupControlsByBase,
  getEnhancementsForBase,
  compareControlIds,
  isValidControlId,
  extractControlIdsFromText,
} from '@/lib/controls/parser';

describe('parser', () => {
  describe('isEnhancement', () => {
    it('should return false for base controls', () => {
      expect(isEnhancement('SI-4')).toBe(false);
      expect(isEnhancement('AC-2')).toBe(false);
      expect(isEnhancement('IA-5')).toBe(false);
      expect(isEnhancement('SC-7')).toBe(false);
    });

    it('should return true for enhancements', () => {
      expect(isEnhancement('SI-4(1)')).toBe(true);
      expect(isEnhancement('SI-4(8)')).toBe(true);
      expect(isEnhancement('AC-2(1)')).toBe(true);
      expect(isEnhancement('IA-2(12)')).toBe(true);
    });
  });

  describe('isBaseControl', () => {
    it('should return true for base controls', () => {
      expect(isBaseControl('SI-4')).toBe(true);
      expect(isBaseControl('AC-2')).toBe(true);
    });

    it('should return false for enhancements', () => {
      expect(isBaseControl('SI-4(1)')).toBe(false);
      expect(isBaseControl('AC-2(8)')).toBe(false);
    });
  });

  describe('extractParentControlId', () => {
    it('should return null for base controls', () => {
      expect(extractParentControlId('SI-4')).toBeNull();
      expect(extractParentControlId('AC-2')).toBeNull();
    });

    it('should return parent ID for enhancements', () => {
      expect(extractParentControlId('SI-4(1)')).toBe('SI-4');
      expect(extractParentControlId('SI-4(8)')).toBe('SI-4');
      expect(extractParentControlId('AC-2(1)')).toBe('AC-2');
      expect(extractParentControlId('IA-2(12)')).toBe('IA-2');
    });
  });

  describe('getBaseControlId', () => {
    it('should return the same ID for base controls', () => {
      expect(getBaseControlId('SI-4')).toBe('SI-4');
      expect(getBaseControlId('AC-2')).toBe('AC-2');
    });

    it('should return parent ID for enhancements', () => {
      expect(getBaseControlId('SI-4(1)')).toBe('SI-4');
      expect(getBaseControlId('AC-2(8)')).toBe('AC-2');
    });
  });

  describe('getEnhancementNumber', () => {
    it('should return null for base controls', () => {
      expect(getEnhancementNumber('SI-4')).toBeNull();
      expect(getEnhancementNumber('AC-2')).toBeNull();
    });

    it('should return enhancement number for enhancements', () => {
      expect(getEnhancementNumber('SI-4(1)')).toBe(1);
      expect(getEnhancementNumber('SI-4(8)')).toBe(8);
      expect(getEnhancementNumber('IA-2(12)')).toBe(12);
    });
  });

  describe('parseControlId', () => {
    it('should parse base controls correctly', () => {
      const parsed = parseControlId('SI-4');
      expect(parsed).not.toBeNull();
      expect(parsed!.family).toBe('SI');
      expect(parsed!.baseNumber).toBe(4);
      expect(parsed!.enhancementNumber).toBeNull();
      expect(parsed!.baseControlId).toBe('SI-4');
      expect(parsed!.isEnhancement).toBe(false);
      expect(parsed!.isBaseControl).toBe(true);
    });

    it('should parse enhancements correctly', () => {
      const parsed = parseControlId('SI-4(1)');
      expect(parsed).not.toBeNull();
      expect(parsed!.family).toBe('SI');
      expect(parsed!.baseNumber).toBe(4);
      expect(parsed!.enhancementNumber).toBe(1);
      expect(parsed!.baseControlId).toBe('SI-4');
      expect(parsed!.isEnhancement).toBe(true);
      expect(parsed!.isBaseControl).toBe(false);
    });

    it('should handle case-insensitive input', () => {
      const parsed = parseControlId('si-4(1)');
      expect(parsed).not.toBeNull();
      expect(parsed!.family).toBe('SI');
    });

    it('should return null for invalid IDs', () => {
      expect(parseControlId('INVALID')).toBeNull();
      expect(parseControlId('SI4')).toBeNull();
      expect(parseControlId('')).toBeNull();
    });
  });

  describe('buildControlId', () => {
    it('should build base control IDs', () => {
      expect(buildControlId('SI', 4)).toBe('SI-4');
      expect(buildControlId('AC', 2)).toBe('AC-2');
    });

    it('should build enhancement IDs', () => {
      expect(buildControlId('SI', 4, 1)).toBe('SI-4(1)');
      expect(buildControlId('AC', 2, 8)).toBe('AC-2(8)');
    });
  });

  describe('getEnhancementLabel', () => {
    it('should return null for base controls', () => {
      expect(getEnhancementLabel('SI-4')).toBeNull();
    });

    it('should return label for enhancements', () => {
      expect(getEnhancementLabel('SI-4(1)')).toBe('SI-4 Enhancement (1)');
      expect(getEnhancementLabel('SI-4(12)')).toBe('SI-4 Enhancement (12)');
    });
  });

  describe('getEnhancementDisplayInfo', () => {
    it('should return null for base controls', () => {
      expect(getEnhancementDisplayInfo('SI-4')).toBeNull();
    });

    it('should return display info for enhancements', () => {
      const info = getEnhancementDisplayInfo('SI-4(1)', ['LOW', 'MODERATE']);
      expect(info).not.toBeNull();
      expect(info!.controlId).toBe('SI-4(1)');
      expect(info!.enhancementNumber).toBe(1);
      expect(info!.parentControlId).toBe('SI-4');
      expect(info!.isOptional).toBe(true);
      expect(info!.applicableBaselines).toEqual(['LOW', 'MODERATE']);
    });
  });

  describe('groupControlsByBase', () => {
    it('should group controls correctly', () => {
      const controlIds = ['SI-4', 'SI-4(1)', 'SI-4(8)', 'AC-2'];
      const groups = groupControlsByBase(controlIds);

      expect(groups.size).toBe(2);

      const si4Group = groups.get('SI-4');
      expect(si4Group).not.toBeUndefined();
      expect(si4Group!.enhancementIds).toContain('SI-4(1)');
      expect(si4Group!.enhancementIds).toContain('SI-4(8)');
      expect(si4Group!.enhancementCount).toBe(2);

      const ac2Group = groups.get('AC-2');
      expect(ac2Group).not.toBeUndefined();
      expect(ac2Group!.enhancementCount).toBe(0);
    });

    it('should sort enhancements by number', () => {
      const controlIds = ['SI-4(8)', 'SI-4(1)', 'SI-4(12)', 'SI-4'];
      const groups = groupControlsByBase(controlIds);

      const si4Group = groups.get('SI-4');
      expect(si4Group!.enhancementIds).toEqual(['SI-4(1)', 'SI-4(8)', 'SI-4(12)']);
    });
  });

  describe('getEnhancementsForBase', () => {
    it('should return all enhancements for a base control', () => {
      const allControlIds = ['SI-4', 'SI-4(1)', 'SI-4(8)', 'AC-2', 'AC-2(1)'];
      const enhancements = getEnhancementsForBase('SI-4', allControlIds);

      expect(enhancements).toContain('SI-4(1)');
      expect(enhancements).toContain('SI-4(8)');
      expect(enhancements).not.toContain('AC-2(1)');
    });
  });

  describe('compareControlIds', () => {
    it('should sort by family first', () => {
      expect(compareControlIds('AC-1', 'SI-1')).toBeLessThan(0);
      expect(compareControlIds('SI-1', 'AC-1')).toBeGreaterThan(0);
    });

    it('should sort by base number second', () => {
      expect(compareControlIds('AC-1', 'AC-2')).toBeLessThan(0);
      expect(compareControlIds('AC-10', 'AC-2')).toBeGreaterThan(0);
    });

    it('should put base controls before enhancements', () => {
      expect(compareControlIds('AC-2', 'AC-2(1)')).toBeLessThan(0);
    });

    it('should sort enhancements by number', () => {
      expect(compareControlIds('AC-2(1)', 'AC-2(8)')).toBeLessThan(0);
    });
  });

  describe('isValidControlId', () => {
    it('should return true for valid control IDs', () => {
      expect(isValidControlId('SI-4')).toBe(true);
      expect(isValidControlId('SI-4(1)')).toBe(true);
      expect(isValidControlId('AC-2')).toBe(true);
    });

    it('should return false for invalid control IDs', () => {
      expect(isValidControlId('INVALID')).toBe(false);
      expect(isValidControlId('')).toBe(false);
      expect(isValidControlId('SI4')).toBe(false);
    });
  });

  describe('extractControlIdsFromText', () => {
    it('should extract control IDs from text', () => {
      const text = 'This implements SI-4 and SI-4(1) requirements.';
      const ids = extractControlIdsFromText(text);

      expect(ids).toContain('SI-4');
      expect(ids).toContain('SI-4(1)');
    });

    it('should handle multiple control families', () => {
      const text = 'Controls AC-2, SC-7, and IA-5(1) are required.';
      const ids = extractControlIdsFromText(text);

      expect(ids).toContain('AC-2');
      expect(ids).toContain('SC-7');
      expect(ids).toContain('IA-5');
      expect(ids).toContain('IA-5(1)');
    });

    it('should return unique IDs', () => {
      const text = 'SI-4 and SI-4 again and SI-4';
      const ids = extractControlIdsFromText(text);

      expect(ids.filter(id => id === 'SI-4').length).toBe(1);
    });
  });

  describe('Real-world control examples', () => {
    it('should correctly identify SI-4 System Monitoring controls', () => {
      expect(isEnhancement('SI-4')).toBe(false);
      expect(isEnhancement('SI-4(1)')).toBe(true);  // System-Wide Intrusion Detection
      expect(isEnhancement('SI-4(2)')).toBe(true);  // Automated Tools for Real-Time Analysis
      expect(isEnhancement('SI-4(8)')).toBe(true);  // Protection of Monitoring Information

      expect(getBaseControlId('SI-4(1)')).toBe('SI-4');
      expect(getBaseControlId('SI-4(8)')).toBe('SI-4');
    });

    it('should correctly identify IA-2 Identification and Authentication controls', () => {
      expect(isEnhancement('IA-2')).toBe(false);
      expect(isEnhancement('IA-2(1)')).toBe(true);
      expect(isEnhancement('IA-2(8)')).toBe(true);
      expect(isEnhancement('IA-2(12)')).toBe(true);

      const parsed = parseControlId('IA-2(12)');
      expect(parsed!.enhancementNumber).toBe(12);
    });
  });
});
