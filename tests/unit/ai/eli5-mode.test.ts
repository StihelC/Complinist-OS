/**
 * ELI5 (Explain Like I'm 5) Mode Tests
 *
 * Tests the ELI5 mode feature including:
 * - ELI5 prompt template generation
 * - Control family analogies
 * - Specific control analogies
 * - Response parsing
 * - Integration with NIST Query types
 */

import { describe, it, expect } from 'vitest';
import {
  buildELI5ControlPrompt,
  parseELI5Response,
  CONTROL_FAMILY_ANALOGIES,
  SPECIFIC_CONTROL_ANALOGIES,
  ELI5_SECTION_HEADERS,
} from '@/lib/ai/prompts/eli5';
import type { ExplanationMode } from '@/lib/ai/types';

describe('ELI5 Mode Feature', () => {
  describe('Control Family Analogies', () => {
    it('should have analogies for common control families', () => {
      const requiredFamilies = ['AC', 'AU', 'CM', 'IA', 'SC', 'SI'];

      for (const family of requiredFamilies) {
        expect(CONTROL_FAMILY_ANALOGIES[family]).toBeDefined();
        expect(typeof CONTROL_FAMILY_ANALOGIES[family]).toBe('string');
        expect(CONTROL_FAMILY_ANALOGIES[family].length).toBeGreaterThan(10);
      }
    });

    it('should have relatable, non-technical analogies', () => {
      // Check that analogies use everyday language
      const technicalTerms = ['API', 'TCP', 'firewall', 'encryption', 'authentication'];

      for (const [family, analogy] of Object.entries(CONTROL_FAMILY_ANALOGIES)) {
        const hasNoTechnicalTerms = technicalTerms.every(
          term => !analogy.toLowerCase().includes(term.toLowerCase())
        );
        expect(hasNoTechnicalTerms).toBe(true);
      }
    });
  });

  describe('Specific Control Analogies', () => {
    it('should have analogies for key controls', () => {
      const keyControls = ['AC-2', 'SI-4', 'IA-2', 'SC-7'];

      for (const controlId of keyControls) {
        expect(SPECIFIC_CONTROL_ANALOGIES[controlId]).toBeDefined();
        expect(SPECIFIC_CONTROL_ANALOGIES[controlId].analogy).toBeDefined();
        expect(SPECIFIC_CONTROL_ANALOGIES[controlId].technicalMapping).toBeDefined();
      }
    });

    it('should have SI-4 analogy matching the feature requirement', () => {
      const si4 = SPECIFIC_CONTROL_ANALOGIES['SI-4'];

      expect(si4).toBeDefined();
      // Should mention security cameras/alarm sensors as per the feature request
      expect(si4.analogy.toLowerCase()).toContain('security');
      expect(si4.technicalMapping.toLowerCase()).toContain('monitoring');
    });

    it('should follow the three-part structure', () => {
      for (const [controlId, analogy] of Object.entries(SPECIFIC_CONTROL_ANALOGIES)) {
        expect(analogy.analogy).toBeDefined();
        expect(analogy.analogy.length).toBeGreaterThan(20);
        expect(analogy.technicalMapping).toBeDefined();
        expect(analogy.technicalMapping.length).toBeGreaterThan(10);
        // simpleExample is optional
      }
    });
  });

  describe('buildELI5ControlPrompt', () => {
    it('should generate a prompt with analogy-first structure', () => {
      const prompt = buildELI5ControlPrompt({
        query: 'What is SI-4?',
        controlId: 'SI-4',
        controlName: 'System Monitoring',
        retrievedContext: [
          {
            text: 'SI-4 requires organizations to monitor information systems.',
            sectionType: 'control_requirements',
            documentType: '800-53_catalog',
            score: 0.95,
          },
        ],
      });

      // Prompt should mention analogy
      expect(prompt.toLowerCase()).toContain('analogy');
      // Prompt should mention ELI5
      expect(prompt.toLowerCase()).toContain('eli5');
      // Should include the control ID
      expect(prompt).toContain('SI-4');
      // Should include the control name
      expect(prompt).toContain('System Monitoring');
    });

    it('should include few-shot examples', () => {
      const prompt = buildELI5ControlPrompt({
        query: 'Explain AC-2',
        controlId: 'AC-2',
        controlName: 'Account Management',
        retrievedContext: [],
      });

      // Should include example responses
      expect(prompt).toContain('EXAMPLE 1');
      expect(prompt).toContain('EXAMPLE 2');
    });

    it('should include predefined analogy for known controls', () => {
      const prompt = buildELI5ControlPrompt({
        query: 'What is SI-4?',
        controlId: 'SI-4',
        controlName: 'System Monitoring',
        retrievedContext: [],
      });

      // Should include the suggested analogy section
      expect(prompt).toContain('SUGGESTED ANALOGY');
    });

    it('should work without a control ID', () => {
      const prompt = buildELI5ControlPrompt({
        query: 'What is network segmentation?',
        retrievedContext: [
          {
            text: 'Network segmentation divides a network into multiple segments.',
            documentType: 'security_pattern',
            score: 0.8,
          },
        ],
      });

      expect(prompt.toLowerCase()).toContain('analogy');
      expect(prompt).toContain('network segmentation');
    });

    it('should include retrieved context', () => {
      const contextText = 'This is specific context about the control requirements.';
      const prompt = buildELI5ControlPrompt({
        query: 'Explain this control',
        controlId: 'AC-1',
        retrievedContext: [
          {
            text: contextText,
            score: 0.9,
          },
        ],
      });

      expect(prompt).toContain(contextText);
    });
  });

  describe('parseELI5Response', () => {
    it('should parse a well-formed ELI5 response', () => {
      const response = `## Simple Explanation

**Analogy:** Think of this like having security cameras in your house. They watch everything that happens.

**In IT Terms:** This means using monitoring tools to detect suspicious activity on your systems.

**Real Example:** Just like a doorbell camera alerts you when someone approaches, SI-4 alerts IT when something unusual happens.`;

      const parsed = parseELI5Response(response);

      expect(parsed).not.toBeNull();
      expect(parsed?.analogy).toContain('security cameras');
      expect(parsed?.technicalMapping).toContain('monitoring tools');
      expect(parsed?.realExample).toContain('doorbell camera');
    });

    it('should handle response without real example', () => {
      const response = `## Simple Explanation

**Analogy:** This is like having a guest list for your house.

**In IT Terms:** This means managing user accounts in your systems.`;

      const parsed = parseELI5Response(response);

      expect(parsed).not.toBeNull();
      expect(parsed?.analogy).toContain('guest list');
      expect(parsed?.technicalMapping).toContain('user accounts');
      expect(parsed?.realExample).toBeUndefined();
    });

    it('should return null for malformed responses', () => {
      const response = 'This is just plain text without proper sections.';

      const parsed = parseELI5Response(response);

      // Should return null or have empty sections
      expect(parsed === null || (!parsed.analogy && !parsed.technicalMapping)).toBe(true);
    });
  });

  describe('ELI5 Section Headers', () => {
    it('should have proper section headers defined', () => {
      expect(ELI5_SECTION_HEADERS.simple_explanation).toBe('## Simple Explanation');
      expect(ELI5_SECTION_HEADERS.analogy).toBe('**Analogy:**');
      expect(ELI5_SECTION_HEADERS.in_it_terms).toBe('**In IT Terms:**');
      expect(ELI5_SECTION_HEADERS.real_example).toBe('**Real Example:**');
    });
  });

  describe('ExplanationMode Type', () => {
    it('should support standard and eli5 modes', () => {
      const standardMode: ExplanationMode = 'standard';
      const eli5Mode: ExplanationMode = 'eli5';

      expect(standardMode).toBe('standard');
      expect(eli5Mode).toBe('eli5');
    });
  });
});

describe('ELI5 Mode Integration', () => {
  describe('Feature Requirements', () => {
    it('should follow the new ELI5 pattern from the feature request', () => {
      // The feature request specified:
      // 1. Analogy (2-3 sentences): Relatable real-world comparison
      // 2. Technical Mapping (1-2 sentences): How the analogy maps to IT/security
      // 3. Simple Example (optional): Concrete scenario

      const si4Analogy = SPECIFIC_CONTROL_ANALOGIES['SI-4'];

      // Check analogy part
      expect(si4Analogy.analogy).toBeDefined();
      expect(si4Analogy.analogy.split('.').length).toBeGreaterThanOrEqual(2); // At least 2 sentences

      // Check technical mapping
      expect(si4Analogy.technicalMapping).toBeDefined();

      // Simple example is optional but should exist for SI-4 per the feature request
      expect(si4Analogy.simpleExample).toBeDefined();
    });

    it('should transform technical explanations to analogy-first format', () => {
      // Example from feature request:
      // Before: "SI-4 requires continuous monitoring of information systems..."
      // After: "SI-4 is like having security cameras and alarm sensors..."

      const si4 = SPECIFIC_CONTROL_ANALOGIES['SI-4'];

      // Should NOT start with technical language
      expect(si4.analogy.toLowerCase()).not.toMatch(/^si-4 requires/);

      // Should use everyday comparisons
      const everydayTerms = ['house', 'camera', 'alarm', 'sensor', 'watch', 'bad guys', 'security'];
      const hasEverydayTerms = everydayTerms.some(term =>
        si4.analogy.toLowerCase().includes(term)
      );
      expect(hasEverydayTerms).toBe(true);
    });
  });
});
