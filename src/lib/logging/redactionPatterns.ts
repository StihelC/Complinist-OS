/**
 * Redaction Patterns Configuration
 *
 * Defines sensitive data patterns and their redaction rules.
 * Each pattern includes a regex, replacement strategy, and optional environment-specific behavior.
 */

export type RedactionStrategy = 'full' | 'partial' | 'hash' | 'mask';

export interface RedactionPattern {
  /** Unique identifier for the pattern */
  name: string;
  /** Regular expression to match sensitive data */
  pattern: RegExp;
  /** How to redact the matched content */
  strategy: RedactionStrategy;
  /** Replacement text (for full strategy) or mask character (for mask strategy) */
  replacement?: string;
  /** Number of characters to show at start/end (for partial strategy) */
  visibleChars?: { start?: number; end?: number };
  /** Enable/disable in development mode */
  enableInDev?: boolean;
  /** Enable/disable in production mode */
  enableInProd?: boolean;
  /** Description of what this pattern detects */
  description: string;
}

/**
 * Default redaction patterns for common sensitive data types
 */
export const DEFAULT_PATTERNS: RedactionPattern[] = [
  // Credit Card Numbers (with various separators)
  {
    name: 'credit_card',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    strategy: 'partial',
    visibleChars: { start: 0, end: 4 },
    enableInDev: true,
    enableInProd: true,
    description: 'Credit card numbers (16 digits with optional separators)',
  },

  // Credit Card Numbers (compact)
  {
    name: 'credit_card_compact',
    pattern: /\b\d{15,16}\b/g,
    strategy: 'partial',
    visibleChars: { start: 0, end: 4 },
    enableInDev: true,
    enableInProd: true,
    description: 'Credit card numbers (compact 15-16 digits)',
  },

  // Email Addresses
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    strategy: 'partial',
    visibleChars: { start: 2, end: 0 },
    enableInDev: false, // Show emails in dev for debugging
    enableInProd: true,
    description: 'Email addresses',
  },

  // API Keys (generic long alphanumeric strings)
  {
    name: 'api_key_generic',
    pattern: /\b[A-Za-z0-9]{32,}\b/g,
    strategy: 'partial',
    visibleChars: { start: 4, end: 4 },
    enableInDev: true,
    enableInProd: true,
    description: 'Generic API keys (32+ alphanumeric characters)',
  },

  // OpenAI API Keys
  {
    name: 'openai_key',
    pattern: /sk-[A-Za-z0-9]{20,}/g,
    strategy: 'partial',
    visibleChars: { start: 3, end: 4 },
    enableInDev: true,
    enableInProd: true,
    description: 'OpenAI API keys',
  },

  // AWS Access Key IDs
  {
    name: 'aws_access_key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    strategy: 'partial',
    visibleChars: { start: 4, end: 4 },
    enableInDev: true,
    enableInProd: true,
    description: 'AWS Access Key IDs',
  },

  // AWS Secret Access Keys
  {
    name: 'aws_secret_key',
    pattern: /(?<=aws_secret_access_key\s*[=:]\s*)[A-Za-z0-9/+=]{40}/gi,
    strategy: 'full',
    replacement: '[REDACTED_AWS_SECRET]',
    enableInDev: true,
    enableInProd: true,
    description: 'AWS Secret Access Keys',
  },

  // Bearer Tokens
  {
    name: 'bearer_token',
    pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    strategy: 'partial',
    visibleChars: { start: 7, end: 4 },
    enableInDev: true,
    enableInProd: true,
    description: 'Bearer authentication tokens',
  },

  // JWT Tokens
  {
    name: 'jwt_token',
    pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*/g,
    strategy: 'partial',
    visibleChars: { start: 10, end: 10 },
    enableInDev: false, // JWTs can be useful for debugging
    enableInProd: true,
    description: 'JWT tokens',
  },

  // Passwords in URLs
  {
    name: 'password_url',
    pattern: /(?<=[:/?&]password=)[^&\s]+/gi,
    strategy: 'full',
    replacement: '[REDACTED_PASSWORD]',
    enableInDev: true,
    enableInProd: true,
    description: 'Passwords in URL parameters',
  },

  // Passwords in JSON/Objects
  {
    name: 'password_json',
    pattern: /(?<="password"\s*:\s*")[^"]+/gi,
    strategy: 'full',
    replacement: '[REDACTED_PASSWORD]',
    enableInDev: true,
    enableInProd: true,
    description: 'Passwords in JSON objects',
  },

  // Password fields (key-value style)
  {
    name: 'password_field',
    pattern: /(?<=password\s*[=:]\s*)[^\s,;]+/gi,
    strategy: 'full',
    replacement: '[REDACTED_PASSWORD]',
    enableInDev: true,
    enableInProd: true,
    description: 'Passwords in key-value pairs',
  },

  // Secret fields
  {
    name: 'secret_field',
    pattern: /(?<=secret\s*[=:]\s*)[^\s,;]+/gi,
    strategy: 'full',
    replacement: '[REDACTED_SECRET]',
    enableInDev: true,
    enableInProd: true,
    description: 'Secret values in key-value pairs',
  },

  // Token fields in JSON
  {
    name: 'token_json',
    pattern: /(?<="(?:access_token|refresh_token|auth_token|api_token|token)"\s*:\s*")[^"]+/gi,
    strategy: 'partial',
    visibleChars: { start: 4, end: 4 },
    enableInDev: true,
    enableInProd: true,
    description: 'Token values in JSON',
  },

  // Private Keys (PEM format header)
  {
    name: 'private_key',
    pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
    strategy: 'full',
    replacement: '[REDACTED_PRIVATE_KEY]',
    enableInDev: true,
    enableInProd: true,
    description: 'Private keys in PEM format',
  },

  // Social Security Numbers (US)
  {
    name: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    strategy: 'partial',
    visibleChars: { start: 0, end: 4 },
    enableInDev: true,
    enableInProd: true,
    description: 'US Social Security Numbers',
  },

  // Phone Numbers (various formats)
  {
    name: 'phone_number',
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    strategy: 'partial',
    visibleChars: { start: 0, end: 4 },
    enableInDev: false, // May be useful in dev
    enableInProd: true,
    description: 'Phone numbers',
  },

  // IP Addresses (internal)
  {
    name: 'ip_address_private',
    pattern: /\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g,
    strategy: 'partial',
    visibleChars: { start: 0, end: 0 },
    enableInDev: false, // Useful for debugging
    enableInProd: true,
    description: 'Private IP addresses',
  },

  // Database Connection Strings
  {
    name: 'connection_string',
    pattern: /(?:mongodb|postgresql|mysql|redis|mssql):\/\/[^\s]+/gi,
    strategy: 'partial',
    visibleChars: { start: 15, end: 0 },
    enableInDev: false, // Useful for debugging
    enableInProd: true,
    description: 'Database connection strings',
  },
];

/**
 * Pattern categories for grouping and management
 */
export const PATTERN_CATEGORIES = {
  financial: ['credit_card', 'credit_card_compact'],
  personal: ['email', 'ssn', 'phone_number'],
  authentication: [
    'api_key_generic',
    'openai_key',
    'aws_access_key',
    'aws_secret_key',
    'bearer_token',
    'jwt_token',
    'password_url',
    'password_json',
    'password_field',
    'secret_field',
    'token_json',
    'private_key',
  ],
  infrastructure: ['ip_address_private', 'connection_string'],
} as const;

/**
 * Get patterns by category
 */
export function getPatternsByCategory(
  category: keyof typeof PATTERN_CATEGORIES
): RedactionPattern[] {
  const patternNames = PATTERN_CATEGORIES[category];
  return DEFAULT_PATTERNS.filter((p) => patternNames.includes(p.name as never));
}

/**
 * Get pattern by name
 */
export function getPatternByName(name: string): RedactionPattern | undefined {
  return DEFAULT_PATTERNS.find((p) => p.name === name);
}
