# Cursor Modes and Boundary Nesting Testing Guide

## Overview

This guide covers the testing strategy for cursor modes and boundary nesting functionality in CompliNist. The test suite includes unit tests, E2E tests, and visual regression tests to ensure cursor behavior and boundary interactions work correctly.

---

## Quick Start

### Run All Tests

```bash
npm run test:cursor
```

This runs the complete test suite:
1. Unit tests for state management
2. E2E tests for user interactions
3. Visual regression tests for UI appearance
4. Coverage report generation

### Run Specific Test Suites

```bash
# Unit tests only
npm run test:cursor:unit

# E2E tests only
npm run test:cursor:e2e

# Visual regression tests only
npm run test:cursor:visual

# Update visual baselines
npm run test:cursor:visual:update
```

---

## Test Structure

### 1. Unit Tests (`tests/unit/stores/cursorModes.test.ts`)

**Purpose**: Verify state management logic for placement and boundary drawing modes.

**Coverage**:
- ✅ Placement mode initialization and transitions
- ✅ Boundary drawing mode initialization and transitions
- ✅ Mode isolation (modes don't interfere with each other)
- ✅ Mode clearing behavior
- ✅ Edge cases (rapid changes, duplicate sets)

**Run**: `npm run test:cursor:unit`

**Example Test**:
```typescript
it('should set boundary drawing mode with boundary data', () => {
  const { result } = renderHook(() => useFlowStore());

  act(() => {
    result.current.setBoundaryDrawingMode({
      type: 'security_zone',
      label: 'Security Zone',
      color: '#dcfce7',
    });
  });

  expect(result.current.boundaryDrawingMode).toEqual({
    type: 'security_zone',
    label: 'Security Zone',
    color: '#dcfce7',
  });
});
```

---

### 2. E2E Tests (`tests/e2e/boundary-cursor-modes.spec.ts`)

**Purpose**: Verify cursor behavior and user interactions in a real browser.

**Coverage**:
- ✅ Default mode shows pointer cursor
- ✅ Boundary drawing mode shows crosshair cursor
- ✅ Device placement mode shows crosshair cursor
- ✅ ESC key exits modes
- ✅ Mode indicator updates correctly
- ✅ ESC button in toolbar works
- ✅ Boundary nesting shows hover indicator
- ✅ Boundaries can be nested and un-nested
- ✅ CSS classes applied correctly

**Run**: `npm run test:cursor:e2e`

**Browser Support**:
- Chromium (Chrome/Edge)
- Firefox
- WebKit (Safari)

**Example Test**:
```typescript
test('boundary drawing mode shows crosshair cursor', async ({ page }) => {
  await page.click('[aria-label="Open boundary form"]');
  await page.click('text=ATO Boundary');

  const cursor = await page.locator('.react-flow').evaluate((el) => {
    return window.getComputedStyle(el).cursor;
  });

  expect(cursor).toBe('crosshair');
});
```

---

### 3. Visual Regression Tests (`tests/visual/cursor-states.spec.ts`)

**Purpose**: Capture screenshots to detect unintended UI changes.

**Coverage**:
- ✅ Mode indicator appearance (default, drawing, placement)
- ✅ Boundary palette in drawing mode
- ✅ ESC button visibility
- ✅ Boundary hover state during drag
- ✅ Toolbar states (inactive, boundary active, device active)

**Run**: `npm run test:cursor:visual`

**Update Baselines**: `npm run test:cursor:visual:update`

**Example Test**:
```typescript
test('mode indicator shows correct state', async ({ page }) => {
  const modeIndicator = page.locator('[data-testid="mode-indicator"]');
  await expect(modeIndicator).toHaveScreenshot('mode-indicator-default.png');
});
```

---

## Test Scenarios

### Scenario 1: Basic Cursor Changes

**Steps**:
1. Open app → default pointer cursor
2. Click "Add Boundary" → crosshair cursor
3. Press ESC → pointer cursor
4. Click "Add Device" → crosshair cursor
5. Press ESC → pointer cursor

**Verified By**: `boundary drawing mode shows crosshair cursor`, `ESC key exits modes`

---

### Scenario 2: Mode Indicator Updates

**Steps**:
1. Default state → "Select / Move"
2. Enter boundary mode → "Drawing: Security Zone"
3. ESC → "Select / Move"
4. Enter placement mode → "Placing: Virtual Machine"
5. ESC → "Select / Move"

**Verified By**: `mode indicator shows correct state`

---

### Scenario 3: Boundary Nesting

**Steps**:
1. Draw first boundary (Security Zone)
2. Draw second boundary inside first (Network Segment)
3. Drag second boundary → first highlights blue
4. Drop inside first → second becomes nested
5. Drag second boundary outside → un-nests

**Verified By**: `boundary nesting shows hover indicator`, `boundary can be nested and un-nested`

---

### Scenario 4: ESC Key Behavior

**Steps**:
1. Enter boundary mode
2. Start drawing (mouse down + drag)
3. Press ESC mid-draw → cancels drawing
4. Enter placement mode
5. Press ESC → exits placement mode

**Verified By**: `ESC key exits boundary drawing mode`, `ESC key exits device placement mode`

---

## Running Tests Locally

### Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright browsers (first time only)
npx playwright install
```

### Development Workflow

1. **Make changes** to cursor/boundary code
2. **Run unit tests** for quick feedback:
   ```bash
   npm run test:cursor:unit
   ```
3. **Run E2E tests** to verify browser behavior:
   ```bash
   npm run test:cursor:e2e
   ```
4. **Update visual baselines** if UI changed intentionally:
   ```bash
   npm run test:cursor:visual:update
   ```
5. **Verify all tests pass**:
   ```bash
   npm run test:cursor
   ```

---

## Debugging Failed Tests

### Unit Test Failures

```bash
# Run with Vitest UI for debugging
npx vitest --ui tests/unit/stores/cursorModes.test.ts

# Run single test
npx vitest run -t "should set placement mode"
```

### E2E Test Failures

```bash
# Run with headed browser (see what's happening)
npx playwright test tests/e2e/boundary-cursor-modes.spec.ts --headed

# Run single test
npx playwright test tests/e2e/boundary-cursor-modes.spec.ts -g "boundary drawing mode"

# Debug mode (pause on failure)
npx playwright test tests/e2e/boundary-cursor-modes.spec.ts --debug
```

**View test report** (after failure):
```bash
npx playwright show-report playwright-report/cursor-tests
```

### Visual Test Failures

If visual tests fail:

1. **Check diff images** in `test-results/`
2. **Review changes** - are they intentional?
3. **Update baselines** if changes are correct:
   ```bash
   npm run test:cursor:visual:update
   ```

---

## CI/CD Integration

### GitLab CI

Tests run automatically on:
- Merge requests
- Main branch commits
- Release tags

**Pipeline stages**:
```yaml
test:cursor:
  stage: test
  script:
    - npm run test:cursor
  artifacts:
    when: always
    paths:
      - playwright-report/
      - test-results/
      - coverage/
```

### Test Optimization

- **Parallel execution**: Tests run in parallel across workers
- **Retries**: Failed tests retry 2x in CI
- **Caching**: Browser binaries cached between runs
- **Fast feedback**: Unit tests run first (fastest)

---

## Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Unit Tests | 100% | 🎯 |
| E2E Tests | All user flows | 🎯 |
| Visual Tests | All UI states | 🎯 |

---

## Common Issues

### Issue: "Port 5173 already in use"

**Solution**: Dev server already running. Either:
- Use existing server: `npm run test:cursor:e2e`
- Kill existing server: `pkill -f vite`

### Issue: "Timeout waiting for selector"

**Solution**: Element not found. Check:
- Selector is correct (use `data-testid`)
- Element is visible (not hidden)
- Sufficient wait time

### Issue: "Cursor is not crosshair"

**Solution**: CSS not applied. Check:
- Hard refresh browser (Ctrl+Shift+R)
- CSS classes applied to wrapper div
- No conflicting styles

### Issue: "Visual test failed"

**Solution**: Screenshot diff detected. Either:
- Review changes in `test-results/`
- Update baseline if correct: `npm run test:cursor:visual:update`

---

## Performance Benchmarks

| Test Suite | Duration | Parallel |
|------------|----------|----------|
| Unit Tests | ~2s | ✅ |
| E2E Tests (Chromium) | ~30s | ✅ |
| E2E Tests (All browsers) | ~90s | ✅ |
| Visual Tests | ~45s | ✅ |
| **Total** | **~2min** | ✅ |

---

## Best Practices

### Writing New Tests

1. **Use data-testid attributes** for reliable selectors
2. **Wait for elements** before interacting
3. **Clean up state** after each test
4. **Test one thing** per test case
5. **Use descriptive names** for test cases

### Example:
```typescript
test('should show crosshair when entering boundary mode', async ({ page }) => {
  // Arrange - open palette
  await page.click('[data-testid="boundary-button"]');

  // Act - select boundary type
  await page.click('text=Security Zone');
  await page.waitForTimeout(300);

  // Assert - cursor is crosshair
  const cursor = await page.locator('.react-flow__pane').evaluate((el) => {
    return window.getComputedStyle(el).cursor;
  });
  expect(cursor).toBe('crosshair');
});
```

---

## Maintenance

### Updating Tests

When changing cursor/boundary behavior:

1. Update unit tests first (fastest feedback)
2. Update E2E tests to match new behavior
3. Run visual tests and update baselines if UI changed
4. Document changes in this guide

### Deprecating Tests

If a test becomes obsolete:
1. Add `test.skip()` with reason
2. File issue to remove/replace
3. Update documentation

---

## Support

**Questions?** Check:
- [ARCHITECTURE.md](../ARCHITECTURE.md) for system design
- [BOUNDARY_IMPROVEMENTS.md](../../BOUNDARY_IMPROVEMENTS.md) for feature details
- Team Slack: #testing channel

**Found a bug?** File an issue with:
- Test name that failed
- Expected vs actual behavior
- Screenshots/videos
- Steps to reproduce
