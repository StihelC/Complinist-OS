import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for cursor states
 *
 * These tests capture screenshots to verify:
 * 1. Mode indicator appearance
 * 2. Boundary highlighting during drag
 * 3. UI state for different modes
 */

test.describe('Cursor State Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('[data-testid="topology-canvas"]', { timeout: 10000 });

    // Set viewport to consistent size
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('default mode indicator appearance', async ({ page }) => {
    // Take screenshot of mode indicator in default state
    const modeIndicator = page.locator('text=Select / Move').locator('..');
    await expect(modeIndicator).toHaveScreenshot('mode-indicator-default.png');
  });

  test('boundary drawing mode indicator appearance', async ({ page }) => {
    // Enter boundary drawing mode
    await page.click('[aria-label="Open boundary form to create security zones and boundaries"]');
    await page.waitForTimeout(300);
    await page.click('text=Security Zone');
    await page.waitForTimeout(300);

    // Take screenshot of mode indicator
    const modeIndicator = page.locator('text=/Drawing:.*Security Zone/').locator('..');
    await expect(modeIndicator).toHaveScreenshot('mode-indicator-drawing.png');
  });

  test('device placement mode indicator appearance', async ({ page }) => {
    // Enter placement mode
    await page.click('[aria-label="Open device palette to add devices to the topology"]');
    await page.waitForTimeout(300);
    const firstDevice = page.locator('[data-testid^="device-icon-"]').first();
    await firstDevice.click();
    await page.waitForTimeout(300);

    // Take screenshot of mode indicator
    const toolbar = page.locator('.topology-toolbar-left');
    await expect(toolbar).toHaveScreenshot('mode-indicator-placement.png');
  });

  test('boundary palette in drawing mode', async ({ page }) => {
    await page.click('[aria-label="Open boundary form to create security zones and boundaries"]');
    await page.waitForTimeout(300);
    await page.click('text=ATO Boundary');
    await page.waitForTimeout(300);

    // Screenshot the palette with active drawing mode
    const palette = page.locator('.topology-panel-left');
    await expect(palette).toHaveScreenshot('boundary-palette-active.png');
  });

  test('ESC button in active mode', async ({ page }) => {
    await page.click('[aria-label="Open boundary form to create security zones and boundaries"]');
    await page.waitForTimeout(300);
    await page.click('text=Network Segment');
    await page.waitForTimeout(300);

    // Screenshot showing ESC button
    const escButton = page.locator('button:has-text("ESC")').locator('..');
    await expect(escButton).toHaveScreenshot('esc-button-visible.png');
  });

  test('boundary hover state during drag', async ({ page }) => {
    // Create first boundary
    await page.click('[aria-label="Open boundary form to create security zones and boundaries"]');
    await page.waitForTimeout(300);
    await page.click('text=Security Zone');
    await page.waitForTimeout(300);

    const canvas = page.locator('.react-flow__pane');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Draw first boundary
    await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 400, canvasBox.y + 350);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Create second boundary
    await page.click('text=Network Segment');
    await page.waitForTimeout(300);

    await page.mouse.move(canvasBox.x + 150, canvasBox.y + 150);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 350, canvasBox.y + 300);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Exit drawing mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Drag second boundary
    const boundaries = page.locator('[data-id^="boundary-"]');
    const secondBoundary = boundaries.nth(1);
    const boundaryBox = await secondBoundary.boundingBox();
    if (!boundaryBox) throw new Error('Boundary not found');

    // Start drag and move over first boundary
    await page.mouse.move(boundaryBox.x + 10, boundaryBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 200, canvasBox.y + 200);
    await page.waitForTimeout(300);

    // Take screenshot showing hover state
    await expect(page).toHaveScreenshot('boundary-hover-highlight.png');

    // Release
    await page.mouse.up();
  });

  test('toolbar with all modes inactive', async ({ page }) => {
    const toolbar = page.locator('.topology-toolbar-left');
    await expect(toolbar).toHaveScreenshot('toolbar-inactive.png');
  });

  test('toolbar with boundary button active', async ({ page }) => {
    await page.click('[aria-label="Open boundary form to create security zones and boundaries"]');
    await page.waitForTimeout(300);

    const toolbar = page.locator('.topology-toolbar-left');
    await expect(toolbar).toHaveScreenshot('toolbar-boundary-active.png');
  });

  test('toolbar with device button active', async ({ page }) => {
    await page.click('[aria-label="Open device palette to add devices to the topology"]');
    await page.waitForTimeout(300);

    const toolbar = page.locator('.topology-toolbar-left');
    await expect(toolbar).toHaveScreenshot('toolbar-device-active.png');
  });
});
