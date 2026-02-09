import '@testing-library/jest-dom'
import { afterEach, beforeEach, vi } from 'vitest'

// Global test setup for Vitest UI integration
// This provides better debugging experience and richer test output

// Clear all mocks between tests for isolation
beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Mock window.matchMedia for UI component tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver for component tests
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

// Mock IntersectionObserver for lazy loading components
class IntersectionObserverMock {
  root = null
  rootMargin = ''
  thresholds = [0]
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn().mockReturnValue([])
}
window.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver

// Suppress console noise in tests (but keep errors visible for UI debugging)
const originalConsoleError = console.error
console.error = (...args: unknown[]) => {
  // Filter out known React/testing-library warnings
  const message = args[0]?.toString() || ''
  if (
    message.includes('Warning: ReactDOM.render is no longer supported') ||
    message.includes('Warning: An update to') ||
    message.includes('act(...)')
  ) {
    return
  }
  originalConsoleError.apply(console, args)
}

// Global test utilities for better UI debugging
declare global {
  // eslint-disable-next-line no-var
  var __TEST_DEBUG__: boolean
}
globalThis.__TEST_DEBUG__ = process.env.DEBUG === 'true'

