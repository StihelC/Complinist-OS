import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * E2E Test: Terraform Import and Screenshot
 *
 * This test:
 * 1. Launches the app (via dev server)
 * 2. Creates a project if needed
 * 3. Opens the Terraform dialog
 * 4. Imports a Terraform fixture JSON
 * 5. Takes a screenshot of the resulting topology
 * 6. Saves it for analysis
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_OUTPUT = '/tmp/terraform-topology-screenshot.png';
const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/terraform/fixtures/production-aws-infrastructure.json');

test.describe('Terraform Import Screenshot', () => {
  test.setTimeout(60000); // 60 second timeout

  test('import terraform plan and capture screenshot', async ({ page }) => {
    // 1. Navigate to the app
    console.log('Navigating to app...');
    await page.goto('http://localhost:5173');

    // 2. Wait for app to load
    console.log('Waiting for app to load...');
    await page.waitForSelector('text=CompliNist', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 3. Handle any modal dialogs that might be blocking
    console.log('Handling initial dialogs...');

    // First, dismiss any welcome tour dialog
    const tourText = page.locator('text=show you around');
    if (await tourText.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Welcome tour detected, dismissing...');
      // Look for skip/dismiss button or press Escape
      const skipButton = page.locator('button:has-text("Skip"), button:has-text("No thanks"), button:has-text("Later"), button:has-text("Dismiss")').first();
      if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await skipButton.click({ force: true });
        await page.waitForTimeout(500);
      } else {
        // Try pressing Escape to close
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    // Check for project manager dialog and handle it
    const projectManagerDialog = page.locator('[class*="fixed inset-0"]').first();
    if (await projectManagerDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Project dialog detected, looking for create/select options...');

      // Try to find and click "Create New Project" or similar - use force click
      const createButton = page.locator('button:has-text("Create"), button:has-text("New Project"), [class*="quick-action"]').first();
      if (await createButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await createButton.click({ force: true });
        await page.waitForTimeout(500);
      }

      // If there's a project name input, fill it
      const nameInput = page.locator('input[type="text"]').first();
      if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nameInput.fill('Terraform Test Project');
        await page.waitForTimeout(300);
      }

      // Look for confirm/create/save button
      const confirmButton = page.locator('button:has-text("Create Project"), button:has-text("Save"), button:has-text("Confirm")').first();
      if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmButton.click({ force: true });
        await page.waitForTimeout(1000);
      }

      // If there's just a close button or backdrop, try clicking it
      const closeButton = page.locator('button[aria-label="Close"], [class*="close"]').first();
      if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeButton.click({ force: true });
        await page.waitForTimeout(500);
      }
    }

    // Wait a bit for any transitions
    await page.waitForTimeout(500);

    // 4. Click on Terraform button to open dialog (the one in header, not empty state)
    console.log('Opening Terraform dialog...');
    const terraformButton = page.getByRole('button', { name: 'Terraform', exact: true });
    await terraformButton.waitFor({ state: 'visible', timeout: 10000 });
    // Force click to bypass any remaining overlays
    await terraformButton.click({ force: true });
    await page.waitForTimeout(500);

    // 5. Wait for the Terraform dialog to open
    console.log('Waiting for Terraform dialog...');
    const dialogTitle = page.locator('text=Terraform Plan Visualization');
    await dialogTitle.waitFor({ state: 'visible', timeout: 5000 });

    // 6. Upload the fixture JSON file using the hidden file input
    console.log('Uploading Terraform fixture...');

    // The TerraformPlanLoader has a hidden file input with id="terraform-file-input"
    const fileInput = page.locator('#terraform-file-input');

    // Read the fixture content
    const fixtureContent = fs.readFileSync(FIXTURE_PATH, 'utf-8');

    // Set the file on the input
    await fileInput.setInputFiles({
      name: 'production-aws-infrastructure.json',
      mimeType: 'application/json',
      buffer: Buffer.from(fixtureContent)
    });

    // 7. Wait for preview to appear
    console.log('Waiting for preview...');
    await page.waitForSelector('text=Review Terraform Plan', { timeout: 10000 });

    // 8. Check the summary is visible
    const createCount = page.locator('text=/\\d+/ >> xpath=./following-sibling::div[contains(text(), "Create")]');
    await expect(page.locator('text=Create').first()).toBeVisible();

    // 9. Click Confirm & Import button
    console.log('Confirming import...');
    const confirmButton = page.locator('button:has-text("Confirm & Import")');
    await confirmButton.click();

    // 10. Wait for import to complete
    console.log('Waiting for import to complete...');
    await page.waitForSelector('text=Successfully loaded', { timeout: 15000 });

    // 11. Close the dialog
    console.log('Closing dialog...');
    // Click outside or find close button
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 12. Wait for nodes to render on canvas
    console.log('Waiting for nodes to render...');
    await page.waitForTimeout(2000); // Give time for layout

    // Check that nodes are visible
    const canvas = page.locator('.react-flow');
    await canvas.waitFor({ state: 'visible', timeout: 5000 });

    // 13. Fit the view to show all nodes (if there's a fit button)
    const fitButton = page.locator('[aria-label*="fit"], button:has-text("Fit")').first();
    if (await fitButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await fitButton.click();
      await page.waitForTimeout(500);
    }

    // 14. Take a screenshot of the topology
    console.log('Taking screenshot...');

    // Screenshot just the canvas area
    const canvasElement = page.locator('.react-flow').first();
    await canvasElement.screenshot({
      path: SCREENSHOT_OUTPUT,
      animations: 'disabled'
    });

    console.log(`Screenshot saved to: ${SCREENSHOT_OUTPUT}`);

    // Also take a full page screenshot
    await page.screenshot({
      path: '/tmp/terraform-topology-full.png',
      fullPage: false
    });
    console.log('Full page screenshot saved to: /tmp/terraform-topology-full.png');

    // 15. Verify the screenshot was created
    expect(fs.existsSync(SCREENSHOT_OUTPUT)).toBe(true);
    const stats = fs.statSync(SCREENSHOT_OUTPUT);
    expect(stats.size).toBeGreaterThan(1000); // Should be more than 1KB

    console.log(`Screenshot size: ${stats.size} bytes`);
    console.log('Test completed successfully!');
  });
});
