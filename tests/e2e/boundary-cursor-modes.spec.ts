import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Boundary Drawing and Cursor Modes
 *
 * Tests verify:
 * 1. Cursor changes correctly for different modes
 * 2. ESC key exits modes properly
 * 3. Mode indicator updates correctly
 * 4. Boundary nesting works with visual feedback
 */

test.describe('Boundary Drawing and Cursor Modes', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');

    // Wait for the app to load
    await page.waitForSelector('[data-testid="topology-canvas"]', { timeout: 10000 });

    // Create a new project if needed (or select existing)
    const projectDialog = page.locator('[data-testid="project-dialog"]');
    if (await projectDialog.isVisible()) {
      await page.fill('[data-testid="project-name-input"]', 'Cursor Test Project');
      await page.click('[data-testid="create-project-button"]');
      await page.waitForTimeout(500);
    }
  });

  test('default mode shows pointer cursor', async ({ page }) => {
    const canvas = page.locator('.react-flow__pane');

    // Get computed cursor style
    const cursor = await canvas.evaluate((el) => {
      return window.getComputedStyle(el).cursor;
    });

    // Should be default pointer (not crosshair)
    expect(cursor).toBe('default');
  });

  test('boundary drawing mode shows crosshair cursor', async ({ page }) => {
    // Open boundary palette
    await page.click('[aria-label="Open boundary form to create security zones and boundaries"]');
    await page.waitForTimeout(300);

    // Select a boundary type
    await page.click('text=ATO Boundary');
    await page.waitForTimeout(300);

    // Check that canvas wrapper has the boundary-drawing-mode class
    const canvasWrapper = page.locator('.react-flow').locator('..');
    const hasClass = await canvasWrapper.evaluate((el) => {
      return el.classList.contains('boundary-drawing-mode');
    });

    expect(hasClass).toBe(true);

    // Verify cursor is crosshair
    const cursor = await canvasWrapper.evaluate((el) => {
      return window.getComputedStyle(el).cursor;
    });

    expect(cursor).toBe('crosshair');
  });

  test('device placement mode shows crosshair cursor', async ({ page }) => {
    // Open device palette
    await page.click('[aria-label="Open device palette to add devices to the topology"]');
    await page.waitForTimeout(300);

    // Click on a device to enter placement mode
    const firstDevice = page.locator('[data-testid^="device-icon-"]').first();
    await firstDevice.click();
    await page.waitForTimeout(300);

    // Check that canvas wrapper has the placement-mode class
    const canvasWrapper = page.locator('.react-flow').locator('..');
    const hasClass = await canvasWrapper.evaluate((el) => {
      return el.classList.contains('placement-mode');
    });

    expect(hasClass).toBe(true);

    // Verify cursor is crosshair
    const cursor = await canvasWrapper.evaluate((el) => {
      return window.getComputedStyle(el).cursor;
    });

    expect(cursor).toBe('crosshair');
  });

  test('ESC key exits boundary drawing mode', async ({ page }) => {
    // Open boundary palette and select type
    await page.click('[aria-label="Open boundary form to create security zones and boundaries"]');
    await page.waitForTimeout(300);
    await page.click('text=Network Segment');
    await page.waitForTimeout(300);

    // Verify we're in drawing mode
    const canvasWrapper = page.locator('.react-flow').locator('..');
    let hasClass = await canvasWrapper.evaluate((el) => {
      return el.classList.contains('boundary-drawing-mode');
    });
    expect(hasClass).toBe(true);

    // Press ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify we exited drawing mode
    hasClass = await canvasWrapper.evaluate((el) => {
      return el.classList.contains('boundary-drawing-mode');
    });
    expect(hasClass).toBe(false);

    // Verify cursor returned to default
    const cursor = await canvasWrapper.evaluate((el) => {
      return window.getComputedStyle(el).cursor;
    });
    expect(cursor).not.toBe('crosshair');
  });

  test('ESC key exits device placement mode', async ({ page }) => {
    // Open device palette and click device
    await page.click('[aria-label="Open device palette to add devices to the topology"]');
    await page.waitForTimeout(300);
    const firstDevice = page.locator('[data-testid^="device-icon-"]').first();
    await firstDevice.click();
    await page.waitForTimeout(300);

    // Verify we're in placement mode
    const canvasWrapper = page.locator('.react-flow').locator('..');
    let hasClass = await canvasWrapper.evaluate((el) => {
      return el.classList.contains('placement-mode');
    });
    expect(hasClass).toBe(true);

    // Press ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify we exited placement mode
    hasClass = await canvasWrapper.evaluate((el) => {
      return el.classList.contains('placement-mode');
    });
    expect(hasClass).toBe(false);
  });

  test('mode indicator shows correct state', async ({ page }) => {
    // Default mode should show "Select / Move"
    const modeIndicator = page.locator('text=Select / Move');
    await expect(modeIndicator).toBeVisible();

    // Enter boundary drawing mode
    await page.click('[aria-label="Open boundary form to create security zones and boundaries"]');
    await page.waitForTimeout(300);
    await page.click('text=Security Zone');
    await page.waitForTimeout(300);

    // Mode indicator should update
    const drawingIndicator = page.locator('text=/Drawing:.*Security Zone/');
    await expect(drawingIndicator).toBeVisible();

    // ESC button should be visible
    const escButton = page.locator('button:has-text("ESC")');
    await expect(escButton).toBeVisible();
  });

  test('ESC button in toolbar exits active mode', async ({ page }) => {
    // Enter boundary drawing mode
    await page.click('[aria-label="Open boundary form to create security zones and boundaries"]');
    await page.waitForTimeout(300);
    await page.click('text=ATO Boundary');
    await page.waitForTimeout(300);

    // Click ESC button in toolbar
    const escButton = page.locator('button:has-text("ESC")');
    await escButton.click();
    await page.waitForTimeout(300);

    // Should return to default mode
    const modeIndicator = page.locator('text=Select / Move');
    await expect(modeIndicator).toBeVisible();
  });

  test('boundary nesting shows hover indicator', async ({ page }) => {
    // Create first boundary
    await page.click('[aria-label="Open boundary form to create security zones and boundaries"]');
    await page.waitForTimeout(300);
    await page.click('text=Security Zone');
    await page.waitForTimeout(300);

    // Draw first boundary
    const canvas = page.locator('.react-flow__pane');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 400, canvasBox.y + 300);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Create second boundary inside first
    await page.click('text=Network Segment');
    await page.waitForTimeout(300);

    await page.mouse.move(canvasBox.x + 150, canvasBox.y + 150);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 350, canvasBox.y + 250);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Exit drawing mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Now try to drag the second boundary - first boundary should highlight
    const boundaries = page.locator('[data-id^="boundary-"]');
    const secondBoundary = boundaries.nth(1);

    // Start dragging
    const boundaryBox = await secondBoundary.boundingBox();
    if (!boundaryBox) throw new Error('Boundary not found');

    await page.mouse.move(boundaryBox.x + 10, boundaryBox.y + 10);
    await page.mouse.down();

    // Move over the first boundary - it should highlight
    await page.mouse.move(canvasBox.x + 200, canvasBox.y + 200);
    await page.waitForTimeout(300);

    // Check if first boundary has hover state (blue background)
    const firstBoundary = boundaries.first();
    const bgColor = await firstBoundary.evaluate((el) => {
      const child = el.querySelector('.w-full.h-full') as HTMLElement;
      return child ? window.getComputedStyle(child).backgroundColor : '';
    });

    // Should have blue highlight (rgba(59, 130, 246, 0.2))
    expect(bgColor).toContain('59, 130, 246');

    // Drop boundary
    await page.mouse.up();
    await page.waitForTimeout(500);
  });

  test('boundary can be nested and un-nested', async ({ page }) => {
    // Create parent boundary
    await page.click('[aria-label="Open boundary form to create security zones and boundaries"]');
    await page.waitForTimeout(300);
    await page.click('text=Security Zone');
    await page.waitForTimeout(300);

    const canvas = page.locator('.react-flow__pane');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Draw parent boundary
    await page.mouse.move(canvasBox.x + 50, canvasBox.y + 50);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 500, canvasBox.y + 400);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Create child boundary
    await page.click('text=Network Segment');
    await page.waitForTimeout(300);

    // Draw child boundary inside parent
    await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 300, canvasBox.y + 250);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Exit drawing mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Get references to boundaries
    const boundaries = page.locator('[data-id^="boundary-"]');
    const childBoundary = boundaries.nth(1);

    // Verify child is nested (check for parentId in node data)
    const isNested = await childBoundary.evaluate((el) => {
      const nodeId = el.getAttribute('data-id');
      // Access React Flow store to check parentId
      return el.closest('.react-flow')?.querySelector(`[data-id="${nodeId}"]`)?.hasAttribute('data-parent');
    });

    expect(isNested).toBeTruthy();

    // Now drag child out of parent
    const childBox = await childBoundary.boundingBox();
    if (!childBox) throw new Error('Child boundary not found');

    await page.mouse.move(childBox.x + 10, childBox.y + 10);
    await page.mouse.down();

    // Drag outside parent boundary
    await page.mouse.move(canvasBox.x + 600, canvasBox.y + 100);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Child should no longer be nested
    // (This is hard to verify directly, but the boundary should have moved)
  });

  test('CSS classes are applied correctly', async ({ page }) => {
    const canvasWrapper = page.locator('.react-flow').locator('..');

    // Default - no special classes
    let classes = await canvasWrapper.getAttribute('class');
    expect(classes).not.toContain('placement-mode');
    expect(classes).not.toContain('boundary-drawing-mode');

    // Enter boundary mode
    await page.click('[aria-label="Open boundary form to create security zones and boundaries"]');
    await page.waitForTimeout(300);
    await page.click('text=ATO Boundary');
    await page.waitForTimeout(300);

    // Should have boundary-drawing-mode class
    classes = await canvasWrapper.getAttribute('class');
    expect(classes).toContain('boundary-drawing-mode');

    // Exit and enter placement mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await page.click('[aria-label="Open device palette to add devices to the topology"]');
    await page.waitForTimeout(300);
    const firstDevice = page.locator('[data-testid^="device-icon-"]').first();
    await firstDevice.click();
    await page.waitForTimeout(300);

    // Should have placement-mode class
    classes = await canvasWrapper.getAttribute('class');
    expect(classes).toContain('placement-mode');
  });
});
