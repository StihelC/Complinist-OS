/**
 * Shared Core Module
 *
 * Pure functions that can be imported by both main and renderer processes.
 * This module consolidates business logic to reduce code duplication and
 * ensure consistency across processes.
 *
 * Usage:
 *   - Renderer: import { ... } from '@/shared/core';
 *   - Main: import { ... } from '../src/shared/core/index.js';
 */

// Re-export all modules
export * from './validators';
export * from './license';
export * from './tokens';
export * from './ipc';
export * from './constants';
