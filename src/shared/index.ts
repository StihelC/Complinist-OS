/**
 * Shared Module Exports
 *
 * This module exports shared utilities that can be used across the application.
 * The core module contains pure functions that work in both main and renderer processes.
 *
 * Usage:
 *   import { validateIPAddress, formatLicenseCode, estimateTokenCount } from '@/shared/core';
 */

// Re-export everything from the core module
export * from './core';
