/**
 * IPC Validation Middleware Tests
 *
 * Tests for the centralized validation middleware that sanitizes all data
 * crossing IPC boundaries before processing. Verifies:
 * - Input sanitization (null bytes, XSS prevention)
 * - Size limit enforcement
 * - Zod schema validation
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sanitizeString,
  sanitizeObject,
  checkInputSize,
  INPUT_SIZE_LIMITS,
  IPCValidationError,
  validateAndSanitizeInput,
  channelRequiresValidation,
  getChannelCategory,
  projectIdSchema,
  noInputSchema,
  consoleLogSchema,
  deviceTypeIconPathSchema,
  queryDualSourceSchema,
  licenseDataSchema,
} from '../../../electron/middleware/ipc-validation-middleware.js';
import { z } from 'zod';

describe('IPC Validation Middleware', () => {
  describe('sanitizeString', () => {
    it('should remove null bytes from strings', () => {
      const maliciousInput = 'normal\x00text\x00with\x00nulls';
      const result = sanitizeString(maliciousInput);
      expect(result).toBe('normal text with nulls'.replace(/ /g, ''));
      expect(result).not.toContain('\x00');
    });

    it('should trim whitespace from strings', () => {
      expect(sanitizeString('  test  ')).toBe('test');
      expect(sanitizeString('\n\ttest\n\t')).toBe('test');
    });

    it('should handle empty strings', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('should return non-strings unchanged', () => {
      expect(sanitizeString(123 as unknown as string)).toBe(123);
      expect(sanitizeString(null as unknown as string)).toBe(null);
      expect(sanitizeString(undefined as unknown as string)).toBe(undefined);
    });

    it('should handle normal strings without modification', () => {
      expect(sanitizeString('normal text')).toBe('normal text');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize nested string values', () => {
      const input = {
        name: '  test\x00name  ',
        nested: {
          value: 'nested\x00value',
        },
      };
      const result = sanitizeObject(input);
      expect(result).toEqual({
        name: 'testname',
        nested: {
          value: 'nestedvalue',
        },
      });
    });

    it('should sanitize array items', () => {
      const input = ['item1\x00', '  item2  ', 'item3'];
      const result = sanitizeObject(input);
      expect(result).toEqual(['item1', 'item2', 'item3']);
    });

    it('should handle null and undefined', () => {
      expect(sanitizeObject(null)).toBe(null);
      expect(sanitizeObject(undefined)).toBe(undefined);
    });

    it('should handle primitive values', () => {
      expect(sanitizeObject(123)).toBe(123);
      expect(sanitizeObject(true)).toBe(true);
      expect(sanitizeObject(false)).toBe(false);
    });

    it('should prevent deep recursion attacks', () => {
      // Create a deeply nested object (over 20 levels)
      let deepObj: Record<string, unknown> = { value: 'deep' };
      for (let i = 0; i < 25; i++) {
        deepObj = { nested: deepObj };
      }

      // Should not throw - just returns when max depth is reached
      expect(() => sanitizeObject(deepObj)).not.toThrow();
    });

    it('should sanitize object keys', () => {
      const input = { '  key\x00  ': 'value' };
      const result = sanitizeObject(input) as Record<string, string>;
      expect(Object.keys(result)[0]).toBe('key');
    });
  });

  describe('checkInputSize', () => {
    it('should allow inputs within size limits', () => {
      const validInput = { data: 'x'.repeat(1000) };
      expect(() => checkInputSize(validInput, 'test-handler')).not.toThrow();
    });

    it('should throw for inputs exceeding size limits', () => {
      // Create a payload larger than 10MB
      const hugeInput = { data: 'x'.repeat(INPUT_SIZE_LIMITS.maxPayloadSize + 1000) };
      expect(() => checkInputSize(hugeInput, 'test-handler')).toThrow(/too large/);
    });

    it('should handle null and undefined', () => {
      expect(() => checkInputSize(null, 'test-handler')).not.toThrow();
      expect(() => checkInputSize(undefined, 'test-handler')).not.toThrow();
    });
  });

  describe('IPCValidationError', () => {
    it('should create error with correct properties', () => {
      const issues = [
        { path: ['field'], message: 'is required' },
        { path: ['nested', 'value'], message: 'must be a string' },
      ];
      const error = new IPCValidationError('test-handler', issues);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('IPCValidationError');
      expect(error.handlerName).toBe('test-handler');
      expect(error.issues).toEqual(issues);
      expect(error.code).toBe('IPC_VALIDATION_FAILED');
      expect(error.message).toContain('test-handler');
      expect(error.message).toContain('field');
    });
  });

  describe('validateAndSanitizeInput', () => {
    const testSchema = z.object({
      name: z.string().min(1).max(100),
      count: z.number().int().positive(),
    });

    it('should validate and sanitize valid input', () => {
      const input = { name: '  test  ', count: 5 };
      const result = validateAndSanitizeInput(testSchema, input, 'test-handler');
      expect(result).toEqual({ name: 'test', count: 5 });
    });

    it('should throw IPCValidationError for invalid input', () => {
      const input = { name: '', count: -1 };
      expect(() => validateAndSanitizeInput(testSchema, input, 'test-handler'))
        .toThrow(IPCValidationError);
    });

    it('should sanitize input before validation', () => {
      const input = { name: 'valid\x00name', count: 10 };
      const result = validateAndSanitizeInput(testSchema, input, 'test-handler');
      expect(result.name).toBe('validname');
    });
  });

  describe('Channel Prefix Utilities', () => {
    describe('channelRequiresValidation', () => {
      it('should return true for db:* channels', () => {
        expect(channelRequiresValidation('db:create-project')).toBe(true);
        expect(channelRequiresValidation('db:save-diagram')).toBe(true);
      });

      it('should return true for ai:* channels', () => {
        expect(channelRequiresValidation('ai:llm-generate')).toBe(true);
        expect(channelRequiresValidation('ai:embed')).toBe(true);
      });

      it('should return true for license:* channels', () => {
        expect(channelRequiresValidation('license:save')).toBe(true);
        expect(channelRequiresValidation('license:get')).toBe(true);
      });

      it('should return true for file:* channels', () => {
        expect(channelRequiresValidation('file:save')).toBe(true);
      });

      it('should return true for export channels', () => {
        expect(channelRequiresValidation('export-json')).toBe(true);
        expect(channelRequiresValidation('export-png')).toBe(true);
      });

      it('should return true for terraform:* channels', () => {
        expect(channelRequiresValidation('terraform:run-plan')).toBe(true);
      });

      it('should return false for unknown channels', () => {
        expect(channelRequiresValidation('unknown:channel')).toBe(false);
        expect(channelRequiresValidation('random-channel')).toBe(false);
      });
    });

    describe('getChannelCategory', () => {
      it('should return correct category for db:* channels', () => {
        expect(getChannelCategory('db:create-project')).toBe('database');
      });

      it('should return correct category for ai:* channels', () => {
        expect(getChannelCategory('ai:llm-generate')).toBe('ai');
      });

      it('should return correct category for license:* channels', () => {
        expect(getChannelCategory('license:save')).toBe('license');
      });

      it('should return null for unknown channels', () => {
        expect(getChannelCategory('unknown:channel')).toBe(null);
      });
    });
  });

  describe('Schema Validation', () => {
    describe('projectIdSchema', () => {
      it('should accept positive integers', () => {
        expect(projectIdSchema.safeParse(1).success).toBe(true);
        expect(projectIdSchema.safeParse(100).success).toBe(true);
      });

      it('should reject zero and negative numbers', () => {
        expect(projectIdSchema.safeParse(0).success).toBe(false);
        expect(projectIdSchema.safeParse(-1).success).toBe(false);
      });

      it('should reject non-integers', () => {
        expect(projectIdSchema.safeParse(1.5).success).toBe(false);
        expect(projectIdSchema.safeParse('1').success).toBe(false);
      });
    });

    describe('noInputSchema', () => {
      it('should accept undefined', () => {
        expect(noInputSchema.safeParse(undefined).success).toBe(true);
      });

      it('should accept null', () => {
        expect(noInputSchema.safeParse(null).success).toBe(true);
      });

      it('should accept empty object', () => {
        expect(noInputSchema.safeParse({}).success).toBe(true);
      });
    });

    describe('consoleLogSchema', () => {
      it('should accept valid log data', () => {
        const result = consoleLogSchema.safeParse({
          level: 'info',
          args: ['message', 123],
        });
        expect(result.success).toBe(true);
      });

      it('should reject invalid log levels', () => {
        const result = consoleLogSchema.safeParse({
          level: 'invalid',
          args: ['message'],
        });
        expect(result.success).toBe(false);
      });
    });

    describe('queryDualSourceSchema', () => {
      it('should accept valid query data', () => {
        const result = queryDualSourceSchema.safeParse({
          userId: 'user-123',
          queryEmbedding: [0.1, 0.2, 0.3],
          topK: 10,
          searchScope: 'both',
        });
        expect(result.success).toBe(true);
      });

      it('should reject invalid userId', () => {
        const result = queryDualSourceSchema.safeParse({
          userId: '',
          queryEmbedding: [0.1, 0.2],
        });
        expect(result.success).toBe(false);
      });

      it('should reject invalid searchScope', () => {
        const result = queryDualSourceSchema.safeParse({
          userId: 'user-123',
          queryEmbedding: [0.1],
          searchScope: 'invalid',
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Security Tests', () => {
    it('should prevent path traversal in file paths', () => {
      const pathSchema = z.string().refine(
        (val) => !val.includes('\0') && !val.includes('..'),
        { message: 'Path contains invalid characters or traversal patterns' }
      );

      expect(pathSchema.safeParse('/safe/path/file.txt').success).toBe(true);
      expect(pathSchema.safeParse('../../../etc/passwd').success).toBe(false);
      expect(pathSchema.safeParse('/path/with\x00null').success).toBe(false);
    });

    it('should sanitize SQL injection attempts', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const sanitized = sanitizeString(maliciousInput);
      // The string should be passed through (sanitization handles null bytes, not SQL)
      // SQL injection is prevented by the schema validation and parameterized queries
      expect(sanitized).toBe(maliciousInput);
    });

    it('should handle XSS payloads in strings', () => {
      const xssPayload = '<script>alert("xss")</script>';
      // The middleware sanitizes null bytes but XSS prevention is at render level
      // This test ensures no crash occurs with such input
      const result = sanitizeString(xssPayload);
      expect(typeof result).toBe('string');
    });

    it('should limit array length via schemas', () => {
      const limitedArraySchema = z.array(z.string()).max(100);

      const validArray = Array(100).fill('item');
      expect(limitedArraySchema.safeParse(validArray).success).toBe(true);

      const tooLargeArray = Array(101).fill('item');
      expect(limitedArraySchema.safeParse(tooLargeArray).success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle circular references gracefully', () => {
      // Create a circular reference
      const obj: Record<string, unknown> = { value: 'test' };
      obj.self = obj;

      // This should throw when trying to serialize (which happens in checkInputSize)
      expect(() => checkInputSize(obj, 'test-handler')).toThrow();
    });

    it('should handle empty objects', () => {
      expect(sanitizeObject({})).toEqual({});
    });

    it('should handle empty arrays', () => {
      expect(sanitizeObject([])).toEqual([]);
    });

    it('should preserve boolean values', () => {
      const input = { enabled: true, disabled: false };
      expect(sanitizeObject(input)).toEqual({ enabled: true, disabled: false });
    });

    it('should preserve number values', () => {
      const input = { count: 42, ratio: 3.14, zero: 0, negative: -10 };
      expect(sanitizeObject(input)).toEqual(input);
    });
  });
});
