/**
 * Path Security Utilities
 *
 * Provides path traversal protection for IPC handlers that accept file paths.
 * Prevents directory traversal attacks (../../etc/passwd) by validating that
 * resolved paths stay within allowed directories.
 */

import path from 'path';
import fs from 'fs';
import { app } from 'electron';

/**
 * List of allowed base directories for file operations
 * @returns {string[]} Array of allowed directory paths
 */
export function getAllowedDirectories() {
  const allowed = [
    app.getPath('downloads'),
    app.getPath('documents'),
    app.getPath('desktop'),
    app.getPath('home'),
    app.getPath('userData'),
    app.getPath('temp'),
  ];

  // Filter out any empty or undefined paths
  return allowed.filter(dir => dir && typeof dir === 'string');
}

/**
 * Error class for path security violations
 */
export class PathSecurityError extends Error {
  constructor(message, code = 'PATH_SECURITY_VIOLATION') {
    super(message);
    this.name = 'PathSecurityError';
    this.code = code;
  }
}

/**
 * Validates a file path to prevent path traversal attacks
 *
 * @param {string} inputPath - The path to validate
 * @param {Object} options - Validation options
 * @param {string[]} options.allowedDirectories - Custom allowed base directories (defaults to getAllowedDirectories())
 * @param {boolean} options.allowAbsolute - Whether to allow absolute paths (default: true)
 * @param {boolean} options.checkParentExists - Whether to check if parent directory exists (default: false)
 * @returns {string} The validated and normalized absolute path
 * @throws {PathSecurityError} If the path fails validation
 */
export function validatePath(inputPath, options = {}) {
  const {
    allowedDirectories = getAllowedDirectories(),
    allowAbsolute = true,
    checkParentExists = false,
  } = options;

  // Basic input validation
  if (!inputPath || typeof inputPath !== 'string') {
    throw new PathSecurityError('Path must be a non-empty string', 'INVALID_PATH_TYPE');
  }

  // Check for null bytes (common attack vector)
  if (inputPath.includes('\0')) {
    throw new PathSecurityError('Path contains null bytes', 'NULL_BYTE_INJECTION');
  }

  // Check for common traversal patterns before resolving
  const traversalPatterns = ['../', '..\\', '%2e%2e', '%252e%252e'];
  const lowerPath = inputPath.toLowerCase();
  for (const pattern of traversalPatterns) {
    if (lowerPath.includes(pattern)) {
      throw new PathSecurityError(
        `Path contains suspicious traversal pattern: ${pattern}`,
        'TRAVERSAL_PATTERN_DETECTED'
      );
    }
  }

  // Resolve to absolute path
  const resolvedPath = path.resolve(inputPath);

  // If absolute paths are not allowed and input was absolute, reject
  if (!allowAbsolute && path.isAbsolute(inputPath)) {
    throw new PathSecurityError('Absolute paths are not allowed', 'ABSOLUTE_PATH_NOT_ALLOWED');
  }

  // Check if resolved path is within any allowed directory
  const isWithinAllowed = allowedDirectories.some(allowedDir => {
    const normalizedAllowed = path.resolve(allowedDir);
    // Ensure the resolved path starts with the allowed directory
    // Adding path.sep ensures we don't match partial directory names
    // e.g., /home/user should not match /home/username
    return resolvedPath === normalizedAllowed ||
           resolvedPath.startsWith(normalizedAllowed + path.sep);
  });

  if (!isWithinAllowed) {
    throw new PathSecurityError(
      `Path "${resolvedPath}" is not within any allowed directory`,
      'PATH_OUTSIDE_ALLOWED_DIRECTORIES'
    );
  }

  // Optionally check if parent directory exists
  if (checkParentExists) {
    const parentDir = path.dirname(resolvedPath);
    if (!fs.existsSync(parentDir)) {
      throw new PathSecurityError(
        `Parent directory does not exist: ${parentDir}`,
        'PARENT_DIRECTORY_NOT_FOUND'
      );
    }
  }

  return resolvedPath;
}

/**
 * Validates a directory path for Terraform operations
 * More restrictive than validatePath - requires directory to exist
 *
 * @param {string} inputPath - The directory path to validate
 * @param {Object} options - Validation options
 * @returns {string} The validated and normalized absolute path
 * @throws {PathSecurityError} If the path fails validation
 */
export function validateDirectoryPath(inputPath, options = {}) {
  const validatedPath = validatePath(inputPath, options);

  // Check if path exists and is a directory
  if (!fs.existsSync(validatedPath)) {
    throw new PathSecurityError(
      `Directory does not exist: ${validatedPath}`,
      'DIRECTORY_NOT_FOUND'
    );
  }

  const stats = fs.statSync(validatedPath);
  if (!stats.isDirectory()) {
    throw new PathSecurityError(
      `Path is not a directory: ${validatedPath}`,
      'NOT_A_DIRECTORY'
    );
  }

  return validatedPath;
}

/**
 * Validates a file path that will be written to
 * Creates parent directories if they don't exist (within allowed paths)
 *
 * @param {string} inputPath - The file path to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.createParentDir - Whether to create parent directory if it doesn't exist (default: true)
 * @returns {string} The validated and normalized absolute path
 * @throws {PathSecurityError} If the path fails validation
 */
export function validateWritePath(inputPath, options = {}) {
  const {
    createParentDir = true,
    ...validateOptions
  } = options;

  const validatedPath = validatePath(inputPath, validateOptions);
  const parentDir = path.dirname(validatedPath);

  // If parent directory doesn't exist and we're allowed to create it
  if (!fs.existsSync(parentDir)) {
    if (createParentDir) {
      // Validate parent directory is also within allowed directories
      validatePath(parentDir, validateOptions);
      fs.mkdirSync(parentDir, { recursive: true });
    } else {
      throw new PathSecurityError(
        `Parent directory does not exist: ${parentDir}`,
        'PARENT_DIRECTORY_NOT_FOUND'
      );
    }
  }

  return validatedPath;
}

/**
 * Validates a path from dialog result (already validated by OS dialog)
 * Less strict - just checks for null bytes and normalizes
 *
 * @param {string} inputPath - The path from dialog.showSaveDialog or dialog.showOpenDialog
 * @returns {string} The validated and normalized path
 * @throws {PathSecurityError} If the path contains malicious content
 */
export function validateDialogPath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new PathSecurityError('Path must be a non-empty string', 'INVALID_PATH_TYPE');
  }

  // Check for null bytes
  if (inputPath.includes('\0')) {
    throw new PathSecurityError('Path contains null bytes', 'NULL_BYTE_INJECTION');
  }

  // Normalize the path
  return path.resolve(inputPath);
}

/**
 * Wraps a file operation handler with path validation
 *
 * @param {Function} handler - The handler function to wrap
 * @param {Object} options - Options for path validation
 * @param {string} options.pathParam - Name of the path parameter (default: 'path')
 * @param {boolean} options.isDirectory - Whether the path should be a directory
 * @param {boolean} options.isWrite - Whether this is a write operation
 * @returns {Function} Wrapped handler with path validation
 */
export function withPathValidation(handler, options = {}) {
  const {
    pathParam = 'path',
    isDirectory = false,
    isWrite = false,
  } = options;

  return async (event, data) => {
    // Extract and validate the path
    const inputPath = data[pathParam];

    let validatedPath;
    if (isDirectory) {
      validatedPath = validateDirectoryPath(inputPath);
    } else if (isWrite) {
      validatedPath = validateWritePath(inputPath);
    } else {
      validatedPath = validatePath(inputPath);
    }

    // Replace the original path with validated path
    const validatedData = {
      ...data,
      [pathParam]: validatedPath,
    };

    return handler(event, validatedData);
  };
}

export default {
  getAllowedDirectories,
  PathSecurityError,
  validatePath,
  validateDirectoryPath,
  validateWritePath,
  validateDialogPath,
  withPathValidation,
};
