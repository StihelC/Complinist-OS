import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration optimized for cursor and boundary mode testing
 *
 * Features:
 * - Fast feedback with parallelization
 * - Visual regression testing support
 * - Optimized timeouts for cursor interactions
 * - Screenshots on failure for debugging
 */

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/boundary-cursor-modes.spec.ts', '**/cursor-states.spec.ts'],

  // Maximum time one test can run
  timeout: 60 * 1000,

  // Fail fast for quick feedback
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // Workers for parallel execution
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report/cursor-tests' }],
    ['list'],
    ['json', { outputFile: 'test-results/cursor-tests.json' }],
  ],

  use: {
    // Base URL for the app
    baseURL: 'http://localhost:5173',

    // Collect trace on failure for debugging
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Reduced action timeout for faster failures
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  // Web server for local testing
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
