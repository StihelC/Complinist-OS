/**
 * Tests for Structured Control Response Feature
 *
 * Verifies the four-section control response format:
 * 1. Purpose - Security objective
 * 2. Control Requirements - NIST mandates
 * 3. Common Implementations - Technical solutions
 * 4. Typical Evidence - Assessment artifacts
 *
 * Tests cover:
 * - Prompt template generation
 * - Section type inference
 * - Response parsing
 * - Section formatting
 */

import { describe, it, expect } from 'vitest';
import {
  buildStructuredControlPrompt,
  CONTROL_SECTION_HEADERS,
  CONTROL_SECTION_DESCRIPTIONS,
  type StructuredControlQueryContext,
  buildQuickControlPrompt,
} from '@/lib/ai/promptTemplates';
import {
  parseFourSectionControlResponse,
  formatFourSectionResponse,
  validateFourSectionResponse,
  hasFourSectionStructure,
  type FourSectionControlResponse,
} from '@/lib/ai/responseProcessor';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockRetrievedContext: StructuredControlQueryContext['retrievedContext'] = [
  {
    text: 'AC-2 Account Management requires organizations to manage system accounts, including establishing, activating, modifying, reviewing, disabling, and removing accounts.',
    documentType: 'NIST 800-53',
    score: 0.92,
  },
  {
    text: 'Organizations must implement automated account management mechanisms to support account lifecycle.',
    documentType: 'implementation_guide',
    score: 0.85,
  },
  {
    text: 'Evidence includes account management policies, procedures, and audit logs showing account lifecycle activities.',
    documentType: 'evidence_examples',
    score: 0.78,
  },
];

const mockFourSectionResponse = `## Purpose
AC-2 (Account Management) ensures proper management of system accounts throughout their lifecycle, protecting against unauthorized access and supporting accountability.

## Control Requirements
- Define and document types of accounts allowed and prohibited
- Assign account managers for each account
- Establish conditions for group and role membership
- Require approvals for account creation requests
- Monitor account usage for anomalies

## Common Implementations
- Active Directory or LDAP for centralized account management
- Privileged Access Management (PAM) solutions
- Automated provisioning/deprovisioning workflows
- Role-based access control (RBAC) systems

## Typical Evidence
- Account management policies and procedures
- Account creation/modification request forms with approvals
- Audit logs showing account lifecycle events
- Periodic account review documentation`;

const mockPartialResponse = `## Purpose
This control manages user accounts.

## Control Requirements
- Manage accounts
- Assign managers`;

// ============================================================================
// Prompt Template Tests
// ============================================================================

describe('Structured Control Prompt Templates', () => {
  describe('buildStructuredControlPrompt', () => {
    it('should build prompt with four section headers', () => {
      const prompt = buildStructuredControlPrompt({
        query: 'What is AC-2?',
        controlId: 'AC-2',
        controlName: 'Account Management',
        retrievedContext: mockRetrievedContext,
      });

      // Verify all section headers are present in the prompt
      expect(prompt).toContain(CONTROL_SECTION_HEADERS.purpose);
      expect(prompt).toContain(CONTROL_SECTION_HEADERS.control_requirements);
      expect(prompt).toContain(CONTROL_SECTION_HEADERS.common_implementations);
      expect(prompt).toContain(CONTROL_SECTION_HEADERS.typical_evidence);
    });

    it('should include section descriptions in prompt', () => {
      const prompt = buildStructuredControlPrompt({
        query: 'What is AC-2?',
        controlId: 'AC-2',
        retrievedContext: mockRetrievedContext,
      });

      // Verify section descriptions are included to guide the LLM
      expect(prompt).toContain(CONTROL_SECTION_DESCRIPTIONS.purpose);
      expect(prompt).toContain(CONTROL_SECTION_DESCRIPTIONS.control_requirements);
    });

    it('should include control ID and name in prompt header', () => {
      const prompt = buildStructuredControlPrompt({
        query: 'What is AC-2?',
        controlId: 'AC-2',
        controlName: 'Account Management',
        retrievedContext: mockRetrievedContext,
      });

      expect(prompt).toContain('Control: AC-2');
      expect(prompt).toContain('Account Management');
    });

    it('should include retrieved context WITHOUT relevance scores (removed for trust)', () => {
      const prompt = buildStructuredControlPrompt({
        query: 'What is AC-2?',
        controlId: 'AC-2',
        retrievedContext: mockRetrievedContext,
      });

      // Should include the context text
      expect(prompt).toContain('Account Management requires organizations');
      // Relevance percentages have been removed to prevent false precision claims
      // Scores are still used internally for ranking but not exposed in prompts
      expect(prompt).not.toMatch(/relevance:\s*\d+(\.\d+)?%/i);
      expect(prompt).not.toMatch(/\d+(\.\d+)?%\s*match/i);
    });

    it('should handle empty retrieved context', () => {
      const prompt = buildStructuredControlPrompt({
        query: 'What is AC-2?',
        controlId: 'AC-2',
        retrievedContext: [],
      });

      // Should still generate a valid prompt
      expect(prompt).toContain('## Purpose');
      expect(prompt).toContain('What is AC-2?');
    });

    it('should instruct LLM to separate requirements from implementation', () => {
      const prompt = buildStructuredControlPrompt({
        query: 'What is AC-2?',
        controlId: 'AC-2',
        retrievedContext: mockRetrievedContext,
      });

      expect(prompt).toContain('Separate control requirements from implementation guidance');
    });

    it('should instruct LLM to use exact section headers', () => {
      const prompt = buildStructuredControlPrompt({
        query: 'What is AC-2?',
        controlId: 'AC-2',
        retrievedContext: mockRetrievedContext,
      });

      expect(prompt).toContain('Use the EXACT section headers');
    });
  });

  describe('buildQuickControlPrompt', () => {
    it('should build concise prompt for quick responses', () => {
      const prompt = buildQuickControlPrompt(
        'What is AC-2?',
        'AC-2',
        'Account Management',
        ['Account management requires organizations to manage accounts.']
      );

      expect(prompt).toContain('What is AC-2?');
      expect(prompt).toContain('Control: AC-2');
      expect(prompt).toContain('concise answer');
    });

    it('should handle missing optional parameters', () => {
      const prompt = buildQuickControlPrompt('What is account management?');

      expect(prompt).toContain('What is account management?');
      expect(prompt).not.toContain('Control:');
    });
  });
});

// ============================================================================
// Section Headers Tests
// ============================================================================

describe('Control Section Headers', () => {
  it('should have all four required section headers', () => {
    expect(CONTROL_SECTION_HEADERS).toHaveProperty('purpose');
    expect(CONTROL_SECTION_HEADERS).toHaveProperty('control_requirements');
    expect(CONTROL_SECTION_HEADERS).toHaveProperty('common_implementations');
    expect(CONTROL_SECTION_HEADERS).toHaveProperty('typical_evidence');
  });

  it('should use markdown H2 format for headers', () => {
    expect(CONTROL_SECTION_HEADERS.purpose).toMatch(/^##/);
    expect(CONTROL_SECTION_HEADERS.control_requirements).toMatch(/^##/);
    expect(CONTROL_SECTION_HEADERS.common_implementations).toMatch(/^##/);
    expect(CONTROL_SECTION_HEADERS.typical_evidence).toMatch(/^##/);
  });

  it('should have descriptive section descriptions', () => {
    expect(CONTROL_SECTION_DESCRIPTIONS.purpose).toContain('security objective');
    expect(CONTROL_SECTION_DESCRIPTIONS.control_requirements).toContain('NIST');
    expect(CONTROL_SECTION_DESCRIPTIONS.common_implementations).toContain('technical');
    expect(CONTROL_SECTION_DESCRIPTIONS.typical_evidence).toContain('artifacts');
  });
});

// ============================================================================
// Response Parsing Tests
// ============================================================================

describe('Four Section Response Parsing', () => {
  describe('parseFourSectionControlResponse', () => {
    it('should parse complete four-section response', () => {
      const parsed = parseFourSectionControlResponse(mockFourSectionResponse);

      expect(parsed.purpose).toContain('Account Management');
      expect(parsed.controlRequirements.length).toBeGreaterThan(0);
      expect(parsed.commonImplementations.length).toBeGreaterThan(0);
      expect(parsed.typicalEvidence.length).toBeGreaterThan(0);
      expect(parsed.isValid).toBe(true);
      expect(parsed.missingSections).toHaveLength(0);
    });

    it('should extract purpose section correctly', () => {
      const parsed = parseFourSectionControlResponse(mockFourSectionResponse);

      expect(parsed.purpose).toContain('ensures proper management');
      expect(parsed.purpose).toContain('system accounts');
    });

    it('should extract control requirements as bullet points', () => {
      const parsed = parseFourSectionControlResponse(mockFourSectionResponse);

      expect(parsed.controlRequirements).toContain('Define and document types of accounts allowed and prohibited');
      expect(parsed.controlRequirements).toContain('Assign account managers for each account');
      expect(parsed.controlRequirements.length).toBeGreaterThanOrEqual(4);
    });

    it('should extract common implementations as bullet points', () => {
      const parsed = parseFourSectionControlResponse(mockFourSectionResponse);

      expect(parsed.commonImplementations.some(i => i.includes('Active Directory'))).toBe(true);
      expect(parsed.commonImplementations.some(i => i.includes('PAM'))).toBe(true);
    });

    it('should extract typical evidence as bullet points', () => {
      const parsed = parseFourSectionControlResponse(mockFourSectionResponse);

      expect(parsed.typicalEvidence.some(e => e.includes('policies'))).toBe(true);
      expect(parsed.typicalEvidence.some(e => e.includes('Audit logs'))).toBe(true);
    });

    it('should handle partial response with missing sections', () => {
      const parsed = parseFourSectionControlResponse(mockPartialResponse);

      expect(parsed.purpose).toBeTruthy();
      expect(parsed.controlRequirements.length).toBeGreaterThan(0);
      expect(parsed.commonImplementations).toHaveLength(0);
      expect(parsed.typicalEvidence).toHaveLength(0);
      expect(parsed.missingSections).toContain('common_implementations');
      expect(parsed.missingSections).toContain('typical_evidence');
    });

    it('should handle empty response', () => {
      const parsed = parseFourSectionControlResponse('');

      expect(parsed.purpose).toBe('');
      expect(parsed.controlRequirements).toHaveLength(0);
      expect(parsed.isValid).toBe(false);
      expect(parsed.missingSections).toHaveLength(4);
    });

    it('should preserve raw text', () => {
      const parsed = parseFourSectionControlResponse(mockFourSectionResponse);

      expect(parsed.rawText).toBe(mockFourSectionResponse);
    });

    it('should mark response as valid if at least 2 sections present', () => {
      const parsed = parseFourSectionControlResponse(mockPartialResponse);

      // Has purpose and control_requirements, missing 2 sections
      expect(parsed.isValid).toBe(true);
    });
  });

  describe('hasFourSectionStructure', () => {
    it('should detect four-section structure in response', () => {
      expect(hasFourSectionStructure(mockFourSectionResponse)).toBe(true);
    });

    it('should detect partial four-section structure', () => {
      expect(hasFourSectionStructure(mockPartialResponse)).toBe(true);
    });

    it('should return false for non-structured response', () => {
      const plainResponse = 'AC-2 requires organizations to manage accounts.';
      expect(hasFourSectionStructure(plainResponse)).toBe(false);
    });

    it('should return false for empty response', () => {
      expect(hasFourSectionStructure('')).toBe(false);
    });
  });
});

// ============================================================================
// Response Formatting Tests
// ============================================================================

describe('Four Section Response Formatting', () => {
  describe('formatFourSectionResponse', () => {
    it('should format parsed response back to markdown', () => {
      const parsed = parseFourSectionControlResponse(mockFourSectionResponse);
      const formatted = formatFourSectionResponse(parsed);

      expect(formatted).toContain('## Purpose');
      expect(formatted).toContain('## Control Requirements');
      expect(formatted).toContain('## Common Implementations');
      expect(formatted).toContain('## Typical Evidence');
    });

    it('should format bullet points with dashes', () => {
      const parsed = parseFourSectionControlResponse(mockFourSectionResponse);
      const formatted = formatFourSectionResponse(parsed);

      // Should have bullet points with dashes
      expect(formatted).toMatch(/^- .+$/m);
    });

    it('should handle partial response', () => {
      const parsed = parseFourSectionControlResponse(mockPartialResponse);
      const formatted = formatFourSectionResponse(parsed);

      expect(formatted).toContain('## Purpose');
      expect(formatted).toContain('## Control Requirements');
      // Should not include empty sections
      expect(formatted).not.toContain('## Common Implementations');
      expect(formatted).not.toContain('## Typical Evidence');
    });
  });

  describe('validateFourSectionResponse', () => {
    it('should add placeholder content for missing sections', () => {
      const parsed = parseFourSectionControlResponse(mockPartialResponse);
      const validated = validateFourSectionResponse(parsed, 'AC-2');

      expect(validated.commonImplementations.length).toBeGreaterThan(0);
      expect(validated.typicalEvidence.length).toBeGreaterThan(0);
      expect(validated.isValid).toBe(true);
      expect(validated.missingSections).toHaveLength(0);
    });

    it('should add purpose placeholder when missing', () => {
      const emptyParsed: FourSectionControlResponse = {
        purpose: '',
        controlRequirements: ['Test requirement'],
        commonImplementations: [],
        typicalEvidence: [],
        rawText: '',
        isValid: false,
        missingSections: ['purpose', 'common_implementations', 'typical_evidence'],
      };

      const validated = validateFourSectionResponse(emptyParsed, 'AC-2');

      expect(validated.purpose).toContain('AC-2');
    });

    it('should preserve existing content', () => {
      const parsed = parseFourSectionControlResponse(mockFourSectionResponse);
      const validated = validateFourSectionResponse(parsed, 'AC-2');

      // Original content should be preserved
      expect(validated.purpose).toBe(parsed.purpose);
      expect(validated.controlRequirements).toEqual(parsed.controlRequirements);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Structured Control Response Integration', () => {
  it('should round-trip parse and format response', () => {
    const parsed = parseFourSectionControlResponse(mockFourSectionResponse);
    const formatted = formatFourSectionResponse(parsed);
    const reparsed = parseFourSectionControlResponse(formatted);

    // Content should be preserved through round-trip
    expect(reparsed.purpose).toContain('Account Management');
    expect(reparsed.controlRequirements.length).toBe(parsed.controlRequirements.length);
    expect(reparsed.commonImplementations.length).toBe(parsed.commonImplementations.length);
    expect(reparsed.typicalEvidence.length).toBe(parsed.typicalEvidence.length);
  });

  it('should detect, parse, and validate incomplete response', () => {
    const incompleteResponse = `## Purpose
    Testing purpose section.

    ## Control Requirements
    - First requirement`;

    // Should detect structure
    expect(hasFourSectionStructure(incompleteResponse)).toBe(true);

    // Should parse
    const parsed = parseFourSectionControlResponse(incompleteResponse);
    expect(parsed.purpose).toBeTruthy();
    expect(parsed.controlRequirements.length).toBe(1);

    // Should validate and enhance
    const validated = validateFourSectionResponse(parsed, 'TEST-1');
    expect(validated.isValid).toBe(true);
    expect(validated.commonImplementations.length).toBeGreaterThan(0);
    expect(validated.typicalEvidence.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle response with alternative bullet formats', () => {
    const response = `## Purpose
    Test purpose.

    ## Control Requirements
    * Asterisk bullet
    • Unicode bullet
    - Dash bullet`;

    const parsed = parseFourSectionControlResponse(response);

    expect(parsed.controlRequirements).toContain('Asterisk bullet');
    expect(parsed.controlRequirements).toContain('Unicode bullet');
    expect(parsed.controlRequirements).toContain('Dash bullet');
  });

  it('should handle extra whitespace in sections', () => {
    const response = `## Purpose

    Lots of whitespace around this purpose text.


    ## Control Requirements

    - Requirement with whitespace

    - Another requirement
    `;

    const parsed = parseFourSectionControlResponse(response);

    expect(parsed.purpose).toBeTruthy();
    expect(parsed.controlRequirements.length).toBe(2);
  });

  it('should handle sections in wrong order', () => {
    const response = `## Typical Evidence
    - Evidence first

    ## Purpose
    Purpose comes after evidence.

    ## Control Requirements
    - Requirement`;

    const parsed = parseFourSectionControlResponse(response);

    // Should still extract all sections
    // Note: Evidence section includes both "Evidence first" and "Purpose comes after evidence."
    // because the regex captures content between section headers
    expect(parsed.typicalEvidence.length).toBeGreaterThanOrEqual(1);
    expect(parsed.purpose).toBeTruthy();
    expect(parsed.controlRequirements.length).toBe(1);
  });

  it('should handle special characters in content', () => {
    const response = `## Purpose
    Handle <special> "characters" & symbols.

    ## Control Requirements
    - Requirement with (parentheses)
    - Requirement with [brackets]`;

    const parsed = parseFourSectionControlResponse(response);

    expect(parsed.purpose).toContain('<special>');
    expect(parsed.controlRequirements.some(r => r.includes('(parentheses)'))).toBe(true);
  });
});
