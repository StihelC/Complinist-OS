/**
 * Test helper utilities for license import tests
 */

import fs from 'fs';
import path from 'path';

export const LICENSE_FILE_PATH = '/home/cam/1.license';

/**
 * Read and validate license file
 */
export function readLicenseFile(): string {
  if (!fs.existsSync(LICENSE_FILE_PATH)) {
    throw new Error(`License file not found at ${LICENSE_FILE_PATH}`);
  }
  
  const content = fs.readFileSync(LICENSE_FILE_PATH, 'utf-8');
  
  // Validate JSON
  try {
    JSON.parse(content);
  } catch (error) {
    throw new Error(`License file is not valid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return content;
}

/**
 * Parse license file to object
 */
export function parseLicenseFile(): any {
  const content = readLicenseFile();
  return JSON.parse(content);
}

/**
 * Verify license file structure
 */
export function verifyLicenseStructure(license: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required fields
  const requiredFields = ['license_code', 'user_id', 'email', 'expires_at', 'subscription_status'];
  for (const field of requiredFields) {
    if (!(field in license)) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Type checks
  if (license.license_code && typeof license.license_code !== 'string') {
    errors.push('license_code must be a string');
  }
  
  if (license.subscription_status && license.subscription_status !== 'active') {
    errors.push(`subscription_status must be 'active', got: ${license.subscription_status}`);
  }
  
  if (license.expires_at && typeof license.expires_at !== 'number') {
    errors.push('expires_at must be a number');
  }
  
  if (license.expires_at && license.expires_at <= Math.floor(Date.now() / 1000)) {
    errors.push('License appears to be expired');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Capture logs from process
 */
export class LogCapture {
  private logs: string[] = [];
  
  capture(log: string) {
    this.logs.push(log);
  }
  
  getLogs(): string[] {
    return [...this.logs];
  }
  
  findLog(pattern: string | RegExp): string | undefined {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    return this.logs.find(log => regex.test(log));
  }
  
  findAllLogs(pattern: string | RegExp): string[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    return this.logs.filter(log => regex.test(log));
  }
  
  clear() {
    this.logs = [];
  }
}

