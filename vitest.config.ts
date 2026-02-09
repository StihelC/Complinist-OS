import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],

    // Include test patterns for comprehensive discovery
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    // Exclude patterns (e2e tests are in tests/e2e/ but we exclude them from unit test runs)
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', 'tests/**/*.spec.ts'],

    // Watch mode configuration for TDD workflow
    watch: true,
    watchExclude: ['**/node_modules/**', '**/dist/**'],

    // Reporter configuration - verbose for better debugging
    reporters: ['verbose'],

    // Test timeout settings
    testTimeout: 10000,
    hookTimeout: 10000,

    // Coverage configuration (used with --coverage flag)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.stories.{ts,tsx}',
      ],
    },

    // Pool configuration for better performance
    pool: 'forks',
    // Note: forks pool options are configured at top level in Vitest 4.x
    isolate: true,

    // UI-specific configuration
    ui: true,
    open: false, // Don't auto-open browser (controlled via script)

    // Slow test threshold for UI highlighting
    slowTestThreshold: 300,

    // Enable test location tracking for UI navigation
    includeTaskLocation: true,

    // Snapshot settings for visual debugging
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true,
    },

    // Diff configuration for rich diffs in UI
    diff: {
      truncateThreshold: 0, // Never truncate diffs
      expand: true, // Always expand diffs
    },

    // Sequence configuration for predictable test ordering
    sequence: {
      shuffle: false,
      hooks: 'list',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

