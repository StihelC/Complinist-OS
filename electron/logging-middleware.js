/**
 * Logging Middleware for Electron Main Process
 *
 * Provides automatic redaction of sensitive data from logs.
 * JavaScript version for Node.js/Electron main process compatibility.
 */

/**
 * Default redaction patterns for common sensitive data types
 */
const DEFAULT_PATTERNS = [
  // Credit Card Numbers (with various separators)
  {
    name: 'credit_card',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    strategy: 'partial',
    visibleChars: { start: 0, end: 4 },
    enableInDev: true,
    enableInProd: true,
    description: 'Credit card numbers',
  },

  // Credit Card Numbers (compact)
  {
    name: 'credit_card_compact',
    pattern: /\b\d{15,16}\b/g,
    strategy: 'partial',
    visibleChars: { start: 0, end: 4 },
    enableInDev: true,
    enableInProd: true,
    description: 'Credit card numbers (compact)',
  },

  // Email Addresses
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    strategy: 'partial',
    visibleChars: { start: 2, end: 0 },
    enableInDev: false,
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
    description: 'Generic API keys',
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
    enableInDev: false,
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

  // Secret fields
  {
    name: 'secret_field',
    pattern: /(?<=secret\s*[=:]\s*)[^\s,;]+/gi,
    strategy: 'full',
    replacement: '[REDACTED_SECRET]',
    enableInDev: true,
    enableInProd: true,
    description: 'Secret values',
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

  // Private Keys (PEM format)
  {
    name: 'private_key',
    pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
    strategy: 'full',
    replacement: '[REDACTED_PRIVATE_KEY]',
    enableInDev: true,
    enableInProd: true,
    description: 'Private keys',
  },

  // Social Security Numbers
  {
    name: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    strategy: 'partial',
    visibleChars: { start: 0, end: 4 },
    enableInDev: true,
    enableInProd: true,
    description: 'US Social Security Numbers',
  },

  // Private IP Addresses
  {
    name: 'ip_address_private',
    pattern: /\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g,
    strategy: 'partial',
    visibleChars: { start: 0, end: 0 },
    enableInDev: false,
    enableInProd: true,
    description: 'Private IP addresses',
  },
];

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  enabled: true,
  mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
  defaultReplacement: '[REDACTED]',
  maskChar: '*',
  customPatterns: [],
  disabledPatterns: [],
};

/**
 * Check if pattern is active for the current environment
 */
function isPatternActive(pattern, mode) {
  if (mode === 'development') {
    return pattern.enableInDev !== false;
  }
  return pattern.enableInProd !== false;
}

/**
 * Apply partial redaction
 */
function applyPartialRedaction(match, visibleChars = {}, maskChar = '*') {
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
 * Apply redaction strategy
 */
function applyRedactionStrategy(match, pattern, config) {
  switch (pattern.strategy) {
    case 'full':
      return pattern.replacement || config.defaultReplacement || '[REDACTED]';
    case 'partial':
      return applyPartialRedaction(match, pattern.visibleChars, config.maskChar);
    case 'mask':
      return config.maskChar.repeat(Math.min(match.length, 16));
    default:
      return config.defaultReplacement || '[REDACTED]';
  }
}

/**
 * Clone regex to reset state
 */
function cloneRegex(regex) {
  return new RegExp(regex.source, regex.flags);
}

/**
 * Convert input to string
 */
function stringifyInput(input) {
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
 * Get active patterns based on config
 */
function getActivePatterns(config) {
  let patterns = [...DEFAULT_PATTERNS];

  if (config.customPatterns) {
    patterns = [...patterns, ...config.customPatterns];
  }

  patterns = patterns.filter((p) => isPatternActive(p, config.mode));

  if (config.disabledPatterns) {
    patterns = patterns.filter((p) => !config.disabledPatterns.includes(p.name));
  }

  return patterns;
}

/**
 * Main redaction function
 */
function redact(input, config = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  const result = {
    output: '',
    wasRedacted: false,
    matchedPatterns: [],
    redactionCounts: {},
  };

  if (!fullConfig.enabled) {
    result.output = stringifyInput(input);
    return result;
  }

  let text = stringifyInput(input);
  const activePatterns = getActivePatterns(fullConfig);

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
 * Redact multiple arguments
 */
function redactArgs(args, config = {}) {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      return redact(arg, config).output;
    }
    if (typeof arg === 'object' && arg !== null) {
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
 * Check if data contains sensitive patterns
 */
function containsSensitiveData(input, config = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const activePatterns = getActivePatterns(fullConfig);
  const matchedPatterns = [];

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
 * LoggingMiddleware class for Electron main process
 */
class LoggingMiddleware {
  constructor(config = {}) {
    const defaultConfig = {
      enabled: true,
      minLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      redactionEnabled: true,
      mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
      includeTimestamps: process.env.NODE_ENV !== 'development',
      prefix: undefined,
    };

    this.config = { ...defaultConfig, ...config };
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.logLevelPriority = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
  }

  configure(config) {
    this.config = { ...this.config, ...config };
  }

  shouldLog(level) {
    if (!this.config.enabled) return false;
    return this.logLevelPriority[level] >= this.logLevelPriority[this.config.minLevel];
  }

  createLogEntry(level, message, args) {
    const redactedMessage = this.config.redactionEnabled
      ? redact(message, { mode: this.config.mode })
      : { output: message, wasRedacted: false, matchedPatterns: [] };

    const redactedArgs = this.config.redactionEnabled
      ? redactArgs(args, { mode: this.config.mode })
      : args;

    return {
      timestamp: new Date().toISOString(),
      level,
      message: redactedMessage.output,
      args: redactedArgs,
      wasRedacted: redactedMessage.wasRedacted,
      matchedPatterns: redactedMessage.matchedPatterns,
    };
  }

  formatOutput(entry) {
    const parts = [];

    if (this.config.includeTimestamps) {
      parts.push(`[${entry.timestamp}]`);
    }

    parts.push(`[${entry.level.toUpperCase()}]`);

    if (this.config.prefix) {
      parts.push(`[${this.config.prefix}]`);
    }

    parts.push(entry.message);

    return parts.join(' ');
  }

  processLog(level, message, args) {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, args);

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    const output = this.formatOutput(entry);
    const consoleFn = console[level] || console.log;

    if (entry.args.length > 0) {
      consoleFn(output, ...entry.args);
    } else {
      consoleFn(output);
    }

    return entry;
  }

  debug(message, ...args) {
    return this.processLog('debug', message, args);
  }

  info(message, ...args) {
    return this.processLog('info', message, args);
  }

  warn(message, ...args) {
    return this.processLog('warn', message, args);
  }

  error(message, ...args) {
    return this.processLog('error', message, args);
  }

  log(level, message, ...args) {
    return this.processLog(level, message, args);
  }

  getRecentLogs(count = 100) {
    return this.logBuffer.slice(-count);
  }

  clearLogs() {
    this.logBuffer = [];
  }

  /**
   * Wrap console methods to add redaction
   */
  wrapConsole() {
    const originalConsole = {
      log: console.log.bind(console),
      debug: console.debug.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    console.log = (...args) => {
      const redactedArgs = this.config.redactionEnabled
        ? redactArgs(args, { mode: this.config.mode })
        : args;
      originalConsole.log(...redactedArgs);
    };

    console.debug = (...args) => {
      const redactedArgs = this.config.redactionEnabled
        ? redactArgs(args, { mode: this.config.mode })
        : args;
      originalConsole.debug(...redactedArgs);
    };

    console.info = (...args) => {
      const redactedArgs = this.config.redactionEnabled
        ? redactArgs(args, { mode: this.config.mode })
        : args;
      originalConsole.info(...redactedArgs);
    };

    console.warn = (...args) => {
      const redactedArgs = this.config.redactionEnabled
        ? redactArgs(args, { mode: this.config.mode })
        : args;
      originalConsole.warn(...redactedArgs);
    };

    console.error = (...args) => {
      const redactedArgs = this.config.redactionEnabled
        ? redactArgs(args, { mode: this.config.mode })
        : args;
      originalConsole.error(...redactedArgs);
    };

    return () => {
      // Restore original console
      console.log = originalConsole.log;
      console.debug = originalConsole.debug;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    };
  }
}

/**
 * Create a new logger instance
 */
function createLogger(config = {}) {
  return new LoggingMiddleware(config);
}

/**
 * Create a development logger
 */
function createDevLogger(config = {}) {
  return new LoggingMiddleware({
    mode: 'development',
    minLevel: 'debug',
    includeTimestamps: false,
    ...config,
  });
}

/**
 * Create a production logger
 */
function createProdLogger(config = {}) {
  return new LoggingMiddleware({
    mode: 'production',
    minLevel: 'info',
    includeTimestamps: true,
    ...config,
  });
}

// Default logger instance
const logger = new LoggingMiddleware();

// Exports
export {
  LoggingMiddleware,
  createLogger,
  createDevLogger,
  createProdLogger,
  logger,
  redact,
  redactArgs,
  containsSensitiveData,
  DEFAULT_PATTERNS,
  DEFAULT_CONFIG,
};

export default logger;
