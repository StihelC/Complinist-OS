import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../setup.ts'],

    // Include e2e test patterns
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    // No exclusions for e2e
    exclude: ['**/node_modules/**', '**/dist/**'],

    // Reporter configuration
    reporters: ['verbose'],

    // Test timeout settings - longer for e2e
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
    },
  },
})
