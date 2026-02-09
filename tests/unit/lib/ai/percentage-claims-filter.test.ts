/**
 * Tests for percentage claims stripping functionality
 *
 * This test verifies that the stripPercentageClaims function correctly
 * removes percentage-based relevance/match claims from AI-generated text.
 *
 * Feature: Eliminate all "relevance percentage" and "match percentage" claims
 */

import { describe, it, expect } from 'vitest';
import { stripPercentageClaims } from '@/lib/ai/responseProcessor';

describe('stripPercentageClaims', () => {
  describe('Pattern 1: X% relevant/match/similarity', () => {
    it('should remove "89.6% relevant" claims', () => {
      const input = 'This control is 89.6% relevant to NIST 800-53.';
      const output = stripPercentageClaims(input);
      expect(output).not.toContain('89.6%');
      expect(output).not.toContain('relevant');
      expect(output).toContain('NIST 800-53');
    });

    it('should remove "92% match" claims', () => {
      const input = 'The document shows a 92% match with the query.';
      const output = stripPercentageClaims(input);
      expect(output).not.toContain('92%');
      expect(output).not.toContain('match');
    });

    it('should remove "85.3% similarity" claims', () => {
      const input = 'Vector similarity: 85.3% similarity detected.';
      const output = stripPercentageClaims(input);
      expect(output).not.toContain('85.3%');
    });

    it('should handle multiple percentage claims', () => {
      const input = 'Control AC-2 is 89% relevant, AC-3 is 76% match.';
      const output = stripPercentageClaims(input);
      expect(output).not.toContain('89%');
      expect(output).not.toContain('76%');
      expect(output).toContain('AC-2');
      expect(output).toContain('AC-3');
    });
  });

  describe('Pattern 2: (relevance: X%) format', () => {
    it('should remove "(relevance: 85%)" claims', () => {
      const input = 'Reference: AC-2 Account Management (relevance: 85%)';
      const output = stripPercentageClaims(input);
      expect(output).not.toContain('(relevance: 85%)');
      expect(output).toContain('AC-2 Account Management');
    });

    it('should remove "(similarity: 92.5%)" claims', () => {
      const input = 'Document chunk (similarity: 92.5%) contains control text.';
      const output = stripPercentageClaims(input);
      expect(output).not.toContain('(similarity: 92.5%)');
      expect(output).toContain('Document chunk');
    });

    it('should remove "(match: 78%)" claims', () => {
      const input = 'Source reference (match: 78%) from 800-53.';
      const output = stripPercentageClaims(input);
      expect(output).not.toContain('(match: 78%)');
    });
  });

  describe('Pattern 3: relevance of X%', () => {
    it('should remove "relevance of 85%" claims', () => {
      const input = 'This has a relevance of 85% to the query.';
      const output = stripPercentageClaims(input);
      expect(output).not.toContain('relevance of 85%');
    });

    it('should remove "similarity: 90%" claims', () => {
      const input = 'Showing similarity: 90% between documents.';
      const output = stripPercentageClaims(input);
      expect(output).not.toContain('similarity: 90%');
    });
  });

  describe('Pattern 4: Standalone percentage with context', () => {
    it('should remove "scored 85% relevance" claims', () => {
      const input = 'This chunk scored 85% relevance.';
      const output = stripPercentageClaims(input);
      expect(output).not.toContain('85%');
    });

    it('should remove "with 92% similarity" claims', () => {
      const input = 'Found document with 92% similarity.';
      const output = stripPercentageClaims(input);
      expect(output).not.toContain('92%');
    });
  });

  describe('Should preserve valid content', () => {
    it('should preserve control IDs and text', () => {
      const input = 'AC-2 Account Management requires organizations to manage accounts.';
      const output = stripPercentageClaims(input);
      expect(output).toBe(input);
    });

    it('should preserve legitimate percentages not related to relevance', () => {
      const input = 'The organization shall ensure 99% uptime for critical systems.';
      const output = stripPercentageClaims(input);
      expect(output).toContain('99%');
    });

    it('should preserve implementation percentages', () => {
      const input = 'Multi-factor authentication is required for 100% of privileged users.';
      const output = stripPercentageClaims(input);
      expect(output).toContain('100%');
    });

    it('should not affect section headers', () => {
      const input = `## Purpose
This control establishes account management.

## Control Requirements
- Define account types
- Assign account managers`;
      const output = stripPercentageClaims(input);
      expect(output).toContain('## Purpose');
      expect(output).toContain('## Control Requirements');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(stripPercentageClaims('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(stripPercentageClaims(null as any)).toBe(null);
      expect(stripPercentageClaims(undefined as any)).toBe(undefined);
    });

    it('should clean up double spaces', () => {
      const input = 'Found  with 85% match  document.';
      const output = stripPercentageClaims(input);
      expect(output).not.toContain('  ');
    });

    it('should clean up orphaned commas', () => {
      const input = 'Control AC-2, 85% match, is related to access.';
      const output = stripPercentageClaims(input);
      expect(output).not.toMatch(/,\s*,/);
    });
  });

  describe('Real-world examples', () => {
    it('should handle typical AI response with embedded percentages', () => {
      const input = `## Purpose
AC-2 Account Management (relevance: 89%) ensures proper user account handling.

## Control Requirements
Based on 92% match with NIST 800-53:
- Organizations must define account types
- Account managers shall be assigned

## Typical Evidence
With 85.3% similarity to reference documents:
- Account management procedures
- Audit logs`;

      const output = stripPercentageClaims(input);

      // Should not contain any percentage claims
      expect(output).not.toMatch(/\d+(\.\d+)?%\s*(relevant|match|similarity)/i);
      expect(output).not.toMatch(/\(relevance:\s*\d+%\)/i);

      // Should preserve important content
      expect(output).toContain('## Purpose');
      expect(output).toContain('AC-2 Account Management');
      expect(output).toContain('## Control Requirements');
      expect(output).toContain('## Typical Evidence');
      expect(output).toContain('Organizations must define account types');
    });

    it('should handle reference section with match percentages', () => {
      const input = `References used:
- AC-2 from NIST 800-53 (85.2% match)
- Account Management guidance (78% relevant)
- Implementation guide shows 92% similarity`;

      const output = stripPercentageClaims(input);

      expect(output).toContain('AC-2 from NIST 800-53');
      expect(output).toContain('Account Management guidance');
      expect(output).not.toContain('85.2%');
      expect(output).not.toContain('78%');
      expect(output).not.toContain('92%');
    });
  });
});

describe('postProcessControlResponse integration', () => {
  it('should strip percentages as part of post-processing', async () => {
    const { postProcessControlResponse } = await import('@/lib/ai/responseProcessor');

    const input = `AC-2 Account Management (relevance: 89%) is a control that requires:
- Proper account lifecycle management
This has a 92% match with the query.`;

    const output = postProcessControlResponse(input, 'AC-2');

    expect(output).not.toMatch(/\d+%\s*(relevance|match)/i);
    expect(output).not.toMatch(/\(relevance:\s*\d+%\)/i);
    expect(output).toContain('AC-2 Account Management');
  });
});
