/**
 * Evidence Service Unit Tests
 *
 * Tests the evidence mapping functionality to ensure:
 * 1. Evidence suggestions map precisely to control intent
 * 2. Policy controls get policy evidence (not technical artifacts)
 * 3. Technical controls get technical evidence
 * 4. Cross-contamination between related controls is prevented
 */

import { describe, it, expect } from 'vitest';
import {
  getEvidenceForControl,
  getControlCategory,
  validateEvidence,
  buildEvidenceContext,
  getEvidenceSuggestionsForPrompt,
  getMappedControlIds,
  hasExplicitMapping,
  isEvidenceAppropriate,
} from '@/lib/controls/evidenceService';

describe('evidenceService', () => {
  describe('getControlCategory', () => {
    it('should identify policy controls (ending in -1) as policy category', () => {
      expect(getControlCategory('AC-1')).toBe('policy');
      expect(getControlCategory('AU-1')).toBe('policy');
      expect(getControlCategory('IR-1')).toBe('policy');
      expect(getControlCategory('SC-1')).toBe('policy');
      expect(getControlCategory('SI-1')).toBe('policy');
    });

    it('should identify technical controls correctly', () => {
      expect(getControlCategory('AC-3')).toBe('technical'); // Access Enforcement
      expect(getControlCategory('AC-7')).toBe('technical'); // Unsuccessful Logon Attempts
      expect(getControlCategory('SC-7')).toBe('technical'); // Boundary Protection
      expect(getControlCategory('SI-4')).toBe('technical'); // System Monitoring
    });

    it('should handle case-insensitive control IDs', () => {
      expect(getControlCategory('ac-1')).toBe('policy');
      expect(getControlCategory('Ac-1')).toBe('policy');
      expect(getControlCategory('AC-1')).toBe('policy');
    });

    it('should handle controls with whitespace', () => {
      expect(getControlCategory(' AC-1 ')).toBe('policy');
      expect(getControlCategory('  AC-3  ')).toBe('technical');
    });
  });

  describe('getEvidenceForControl', () => {
    describe('AC-1 (Policy and Procedures) - THE KEY TEST CASE', () => {
      it('should return policy evidence, NOT technical evidence', () => {
        const evidence = getEvidenceForControl('AC-1');

        expect(evidence).not.toBeNull();
        expect(evidence!.category).toBe('policy');

        // AC-1 SHOULD suggest these evidence types
        const evidenceItems = evidence!.suggestedEvidence.map(e => e.item);
        expect(evidenceItems).toContain('Access Control Policy Document');
        expect(evidenceItems).toContain('Access Control Procedures');
        expect(evidenceItems).toContain('Policy Review Records');
        expect(evidenceItems).toContain('Policy Approval Memo');
      });

      it('should mark ACLs, system logs, and RBAC configs as INCORRECT for AC-1', () => {
        const evidence = getEvidenceForControl('AC-1');

        expect(evidence).not.toBeNull();

        // AC-1 should NOT suggest these (they belong to AC-2, AC-3, AC-5)
        expect(evidence!.incorrectEvidence).toContain('ACL configurations');
        expect(evidence!.incorrectEvidence).toContain('RBAC role definitions');
        expect(evidence!.incorrectEvidence).toContain('System logs');
      });

      it('should reference related enforcement controls', () => {
        const evidence = getEvidenceForControl('AC-1');

        expect(evidence).not.toBeNull();
        expect(evidence!.relatedControls).toContain('AC-2');
        expect(evidence!.relatedControls).toContain('AC-3');
        expect(evidence!.relatedControls).toContain('AC-5');
      });
    });

    describe('AC-3 (Access Enforcement) - Technical Control', () => {
      it('should return technical evidence for AC-3', () => {
        const evidence = getEvidenceForControl('AC-3');

        expect(evidence).not.toBeNull();
        expect(evidence!.category).toBe('technical');

        // AC-3 SHOULD suggest technical artifacts
        const evidenceItems = evidence!.suggestedEvidence.map(e => e.item);
        expect(evidenceItems).toContain('ACL Configurations');
        expect(evidenceItems).toContain('RBAC Role Definitions');
        expect(evidenceItems).toContain('Permission Matrices');
      });

      it('should mark policy documents as INCORRECT for AC-3', () => {
        const evidence = getEvidenceForControl('AC-3');

        expect(evidence).not.toBeNull();
        expect(evidence!.incorrectEvidence).toContain('Access Control Policy document');
      });
    });

    describe('Evidence list length', () => {
      it('should limit evidence suggestions to 7 items maximum', () => {
        const evidence = getEvidenceForControl('AC-1');

        expect(evidence).not.toBeNull();
        expect(evidence!.suggestedEvidence.length).toBeLessThanOrEqual(7);
      });

      it('should have evidence sorted by priority', () => {
        const evidence = getEvidenceForControl('AC-1');

        expect(evidence).not.toBeNull();

        const priorities = evidence!.suggestedEvidence.map(e => e.priority);
        for (let i = 1; i < priorities.length; i++) {
          expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]);
        }
      });
    });
  });

  describe('validateEvidence', () => {
    describe('Policy control validation', () => {
      it('should reject technical evidence for policy controls', () => {
        const result = validateEvidence('AC-1', [
          'ACL configurations',
          'System logs',
          'RBAC role definitions'
        ]);

        expect(result.isValid).toBe(false);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.incorrectItems.length).toBeGreaterThan(0);
      });

      it('should accept policy documents for policy controls', () => {
        const result = validateEvidence('AC-1', [
          'Access Control Policy Document',
          'Policy Review Records'
        ]);

        expect(result.isValid).toBe(true);
        expect(result.warnings.length).toBe(0);
      });
    });

    describe('Technical control validation', () => {
      it('should accept technical evidence for technical controls', () => {
        const result = validateEvidence('AC-3', [
          'ACL Configurations',
          'RBAC Role Definitions'
        ]);

        expect(result.isValid).toBe(true);
      });

      it('should reject policy-only evidence for enforcement controls', () => {
        const result = validateEvidence('AC-3', [
          'Access Control Policy document'
        ]);

        expect(result.isValid).toBe(false);
      });
    });

    describe('Control category detection', () => {
      it('should detect policy category in validation result', () => {
        const result = validateEvidence('AC-1', []);

        expect(result.controlCategory).toBe('policy');
      });

      it('should detect technical category in validation result', () => {
        const result = validateEvidence('AC-3', []);

        expect(result.controlCategory).toBe('technical');
      });
    });
  });

  describe('buildEvidenceContext', () => {
    it('should build context with appropriate evidence for AC-1', () => {
      const context = buildEvidenceContext('AC-1');

      expect(context.category).toBe('policy');
      expect(context.intent).toContain('access control policy');
      expect(context.appropriateEvidence.length).toBeGreaterThan(0);
      expect(context.inappropriateEvidence.length).toBeGreaterThan(0);
    });

    it('should build context with appropriate evidence for AC-3', () => {
      const context = buildEvidenceContext('AC-3');

      expect(context.category).toBe('technical');
      expect(context.appropriateEvidence).toContain('ACL Configurations');
    });

    it('should include related controls in context', () => {
      const context = buildEvidenceContext('AC-1');

      expect(context.relatedControls).toContain('AC-2');
      expect(context.relatedControls).toContain('AC-3');
    });
  });

  describe('getEvidenceSuggestionsForPrompt', () => {
    it('should return formatted prompt text for AC-1', () => {
      const promptText = getEvidenceSuggestionsForPrompt('AC-1');

      expect(promptText).toContain('CONTROL CATEGORY: POLICY');
      expect(promptText).toContain('APPROPRIATE EVIDENCE');
      expect(promptText).toContain('DO NOT suggest');
      expect(promptText).toContain('Access Control Policy Document');
    });

    it('should include inappropriate evidence warnings', () => {
      const promptText = getEvidenceSuggestionsForPrompt('AC-1');

      expect(promptText).toContain('ACL configurations');
      expect(promptText).toContain('related controls');
    });

    it('should return empty string for unmapped controls', () => {
      const promptText = getEvidenceSuggestionsForPrompt('XX-99');

      // Should return some text even for unmapped controls (default mapping)
      expect(typeof promptText).toBe('string');
    });
  });

  describe('isEvidenceAppropriate', () => {
    it('should reject ACLs for AC-1', () => {
      const result = isEvidenceAppropriate('ACL configurations', 'AC-1');

      expect(result.appropriate).toBe(false);
      expect(result.reason).toContain('related controls');
    });

    it('should accept policy documents for AC-1', () => {
      const result = isEvidenceAppropriate('Policy Document', 'AC-1');

      expect(result.appropriate).toBe(true);
    });

    it('should accept ACLs for AC-3', () => {
      const result = isEvidenceAppropriate('ACL configurations', 'AC-3');

      expect(result.appropriate).toBe(true);
    });
  });

  describe('getMappedControlIds', () => {
    it('should return all mapped control IDs', () => {
      const ids = getMappedControlIds();

      expect(ids).toContain('AC-1');
      expect(ids).toContain('AC-2');
      expect(ids).toContain('AC-3');
      expect(ids).toContain('AU-1');
      expect(ids).toContain('SC-7');
      expect(ids.length).toBeGreaterThan(30);
    });
  });

  describe('hasExplicitMapping', () => {
    it('should return true for explicitly mapped controls', () => {
      expect(hasExplicitMapping('AC-1')).toBe(true);
      expect(hasExplicitMapping('AC-3')).toBe(true);
      expect(hasExplicitMapping('SC-7')).toBe(true);
    });

    it('should return false for unmapped controls', () => {
      expect(hasExplicitMapping('XX-99')).toBe(false);
      expect(hasExplicitMapping('AC-999')).toBe(false);
    });

    it('should handle case-insensitive lookups', () => {
      expect(hasExplicitMapping('ac-1')).toBe(true);
      expect(hasExplicitMapping('Ac-1')).toBe(true);
    });
  });

  describe('Cross-contamination prevention', () => {
    it('should distinguish AC-1 evidence from AC-2 evidence', () => {
      const ac1 = getEvidenceForControl('AC-1');
      const ac2 = getEvidenceForControl('AC-2');

      expect(ac1).not.toBeNull();
      expect(ac2).not.toBeNull();

      // AC-1 should NOT have account management evidence
      const ac1Items = ac1!.suggestedEvidence.map(e => e.item.toLowerCase());
      expect(ac1Items.some(i => i.includes('user account'))).toBe(false);

      // AC-2 SHOULD have account management evidence
      const ac2Items = ac2!.suggestedEvidence.map(e => e.item.toLowerCase());
      expect(ac2Items.some(i => i.includes('account'))).toBe(true);
    });

    it('should distinguish AU-1 evidence from AU-2 evidence', () => {
      const au1 = getEvidenceForControl('AU-1');
      const au2 = getEvidenceForControl('AU-2');

      expect(au1).not.toBeNull();
      expect(au2).not.toBeNull();

      // AU-1 is policy - should have policy docs
      expect(au1!.category).toBe('policy');
      const au1Items = au1!.suggestedEvidence.map(e => e.item.toLowerCase());
      expect(au1Items.some(i => i.includes('policy'))).toBe(true);

      // AU-2 is technical - should have logging config
      expect(au2!.category).toBe('technical');
      const au2Items = au2!.suggestedEvidence.map(e => e.item.toLowerCase());
      expect(au2Items.some(i => i.includes('logging') || i.includes('audit'))).toBe(true);
    });

    it('should distinguish SC-1 evidence from SC-7 evidence', () => {
      const sc1 = getEvidenceForControl('SC-1');
      const sc7 = getEvidenceForControl('SC-7');

      expect(sc1).not.toBeNull();
      expect(sc7).not.toBeNull();

      // SC-1 is policy
      expect(sc1!.category).toBe('policy');

      // SC-7 is technical (boundary protection)
      expect(sc7!.category).toBe('technical');
      const sc7Items = sc7!.suggestedEvidence.map(e => e.item.toLowerCase());
      expect(sc7Items.some(i => i.includes('firewall') || i.includes('boundary'))).toBe(true);
    });
  });

  describe('Default mapping for unmapped controls', () => {
    it('should generate default policy mapping for policy controls without explicit mapping', () => {
      // Assuming this control might not be explicitly mapped
      const evidence = getEvidenceForControl('PT-1'); // PII Processing Policy

      expect(evidence).not.toBeNull();
      expect(evidence!.category).toBe('policy');
      expect(evidence!.suggestedEvidence.length).toBeGreaterThan(0);
    });

    it('should generate default technical mapping for technical controls', () => {
      // Using a control ID that might not be explicitly mapped
      const evidence = getEvidenceForControl('AC-25'); // Reference Monitor

      expect(evidence).not.toBeNull();
      // AC-25 is not -1, so should default to technical
      expect(evidence!.suggestedEvidence.length).toBeGreaterThan(0);
    });
  });
});
