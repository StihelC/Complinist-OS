/**
 * Redaction Engine
 *
 * Core logic for detecting and redacting sensitive data from log messages.
 * Supports multiple redaction strategies and environment-aware behavior.
 */

import {
  RedactionPattern,
  DEFAULT_PATTERNS,
} from './redactionPatterns';

export interface RedactionConfig {
  /** Enable redaction */
  enabled: boolean;
  /** Current environment mode */
  mode: 'development' | 'production';
  /** Custom patterns to add (merged with defaults) */
  customPatterns?: RedactionPattern[];
  /** Pattern names to disable */
  disabledPatterns?: string[];
  /** Custom replacement text for full redaction */
  defaultReplacement?: string;
  /** Character to use for masking */
  maskChar?: string;
}

export interface RedactionResult {
  /** The redacted output */
  output: string;
  /** Whether any redaction was performed */
  wasRedacted: boolean;
  /** Names of patterns that matched */
  matchedPatterns: string[];
  /** Count of redactions per pattern */
  redactionCounts: Record<string, number>;
}

const DEFAULT_CONFIG: RedactionConfig = {
  enabled: true,
  mode: 'development',
  defaultReplacement: '[REDACTED]',
  maskChar: '*',
};

/**
 * Determines if a pattern should be active based on current environment
 */
function isPatternActiveForEnvironment(
  pattern: RedactionPattern,
  mode: 'development' | 'production'
): boolean {
  if (mode === 'development') {
    return pattern.enableInDev !== false;
  }
  return pattern.enableInProd !== false;
}

/**
 * Apply partial redaction strategy
 * Shows first N and last M characters, redacts the middle
 */
function applyPartialRedaction(
  match: string,
  visibleChars: { start?: number; end?: number } = {},
  maskChar: string = '*'
): string {
  const startChars = visibleChars.start ?? 0;
  const endChars = visibleChars.end ?? 0;

  if (match.length <= startChars + endChars) {
    return maskChar.repeat(match.length);
  }

  const start = match.slice(0, startChars);
  const end = endChars > 0 ? match.slice(-endChars) : '';
  const middleLength = match.length - startChars - endChars;

  return `${start}${maskChar.repeat(Math.min(middleLength, 8))}${end}`;
}

/**
 * Apply hash redaction strategy
 * Returns a deterministic hash representation
 */
function applyHashRedaction(match: string): string {
  // Simple hash for consistent redaction
  let hash = 0;
  for (let i = 0; i < match.length; i++) {
    const char = match.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
  return `[HASH:${hashHex}]`;
}

/**
 * Apply mask redaction strategy
 * Replaces all characters with mask character
 */
function applyMaskRedaction(match: string, maskChar: string = '*'): string {
  return maskChar.repeat(Math.min(match.length, 16));
}

/**
 * Apply the appropriate redaction strategy to a match
 */
function applyRedactionStrategy(
  match: string,
  pattern: RedactionPattern,
  config: RedactionConfig
): string {
  switch (pattern.strategy) {
    case 'full':
      return pattern.replacement || config.defaultReplacement || '[REDACTED]';

    case 'partial':
      return applyPartialRedaction(
        match,
        pattern.visibleChars,
        config.maskChar
      );

    case 'hash':
      return applyHashRedaction(match);

    case 'mask':
      return applyMaskRedaction(match, config.maskChar);

    default:
      return config.defaultReplacement || '[REDACTED]';
  }
}

/**
 * Creates a new regex with the same pattern but fresh state
 * (necessary because RegExp with /g flag maintains state)
 */
function cloneRegex(regex: RegExp): RegExp {
  return new RegExp(regex.source, regex.flags);
}

/**
 * Main redaction function - processes input and redacts sensitive data
 */
export function redact(
  input: unknown,
  config: Partial<RedactionConfig> = {}
): RedactionResult {
  const fullConfig: RedactionConfig = { ...DEFAULT_CONFIG, ...config };

  const result: RedactionResult = {
    output: '',
    wasRedacted: false,
    matchedPatterns: [],
    redactionCounts: {},
  };

  // If disabled, return input as-is
  if (!fullConfig.enabled) {
    result.output = stringifyInput(input);
    return result;
  }

  // Convert input to string for processing
  let text = stringifyInput(input);

  // Build active patterns list
  const activePatterns = getActivePatterns(fullConfig);

  // Apply each pattern
  for (const pattern of activePatterns) {
    const regex = cloneRegex(pattern.pattern);
    let matchCount = 0;

    text = text.replace(regex, (match) => {
      matchCount++;
      return applyRedactionStrategy(match, pattern, fullConfig);
    });

    if (matchCount > 0) {
      result.wasRedacted = true;
      result.matchedPatterns.push(pattern.name);
      result.redactionCounts[pattern.name] = matchCount;
    }
  }

  result.output = text;
  return result;
}

/**
 * Convert any input to a string representation
 */
function stringifyInput(input: unknown): string {
  if (input === null || input === undefined) {
    return String(input);
  }

  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof Error) {
    return `${input.name}: ${input.message}\n${input.stack || ''}`;
  }

  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

/**
 * Get list of active patterns based on configuration
 */
function getActivePatterns(config: RedactionConfig): RedactionPattern[] {
  // Start with default patterns
  let patterns = [...DEFAULT_PATTERNS];

  // Add custom patterns
  if (config.customPatterns) {
    patterns = [...patterns, ...config.customPatterns];
  }

  // Filter by environment
  patterns = patterns.filter((p) =>
    isPatternActiveForEnvironment(p, config.mode)
  );

  // Remove disabled patterns
  if (config.disabledPatterns) {
    patterns = patterns.filter(
      (p) => !config.disabledPatterns!.includes(p.name)
    );
  }

  return patterns;
}

/**
 * Redact multiple arguments (for use with console.log style functions)
 */
export function redactArgs(
  args: unknown[],
  config: Partial<RedactionConfig> = {}
): unknown[] {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      return redact(arg, config).output;
    }
    if (typeof arg === 'object' && arg !== null) {
      // Stringify, redact, then parse back
      const redacted = redact(arg, config);
      try {
        return JSON.parse(redacted.output);
      } catch {
        return redacted.output;
      }
    }
    return arg;
  });
}

/**
 * Quick redaction function with default settings
 */
export function quickRedact(input: unknown): string {
  return redact(input).output;
}

/**
 * Check if a string contains sensitive data without redacting
 */
export function containsSensitiveData(
  input: string,
  config: Partial<RedactionConfig> = {}
): { hasSensitiveData: boolean; patterns: string[] } {
  const fullConfig: RedactionConfig = { ...DEFAULT_CONFIG, ...config };
  const activePatterns = getActivePatterns(fullConfig);
  const matchedPatterns: string[] = [];

  for (const pattern of activePatterns) {
    const regex = cloneRegex(pattern.pattern);
    if (regex.test(input)) {
      matchedPatterns.push(pattern.name);
    }
  }

  return {
    hasSensitiveData: matchedPatterns.length > 0,
    patterns: matchedPatterns,
  };
}

/**
 * Create a configured redaction function
 */
export function createRedactor(config: Partial<RedactionConfig> = {}) {
  const boundConfig = { ...DEFAULT_CONFIG, ...config };

  return {
    redact: (input: unknown) => redact(input, boundConfig),
    redactArgs: (args: unknown[]) => redactArgs(args, boundConfig),
    containsSensitiveData: (input: string) =>
      containsSensitiveData(input, boundConfig),
    updateConfig: (newConfig: Partial<RedactionConfig>) => {
      Object.assign(boundConfig, newConfig);
    },
  };
}

export { DEFAULT_CONFIG };
