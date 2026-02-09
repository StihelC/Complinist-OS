import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Electron E2E tests
 */
export default defineConfig({
  testDir: './',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'license-import',
      testMatch: '**/license-import.test.ts',
    },
    {
      name: 'modularization-verification',
      testMatch: '**/modularization-verification.test.ts',
    },
    {
      name: 'ssp-wizard',
      testMatch: '**/ssp-wizard.test.ts',
    },
    {
      name: 'document-upload',
      testMatch: '**/document-upload-verification.test.ts',
    },
    {
      name: 'terraform-screenshot',
      testMatch: '**/terraform-import-screenshot.spec.ts',
    },
  ],
});

