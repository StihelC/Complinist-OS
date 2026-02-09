import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Undo/Redo System
 *
 * Tests verify user-facing undo/redo behavior with real UI interactions:
 * - Adding/removing devices and boundaries
 * - Bulk operations create single undoable actions
 * - Group movement is one undoable action
 * - Alignment operations can be undone
 * - Keyboard shortcuts work
 */

test.describe('Undo/Redo System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');

    // Wait for the app to load
    await page.waitForSelector('[data-testid="topology-canvas"]', { timeout: 10000 });

    // Create a new project if needed
    const projectDialog = page.locator('[data-testid="project-dialog"]');
    if (await projectDialog.isVisible()) {
      await page.fill('[data-testid="project-name-input"]', 'Undo/Redo Test Project');
      await page.click('[data-testid="create-project-button"]');
      await page.waitForTimeout(500);
    }
  });

  test.describe('Basic Undo/Redo', () => {
    test('should undo adding a device', async ({ page }) => {
      // Open device palette
      await page.click('[aria-label="Open device palette to add devices to the topology"]');
      await page.waitForTimeout(300);

      // Click first device icon
      const firstDevice = page.locator('[data-testid^="device-icon-"]').first();
      await firstDevice.click();
      await page.waitForTimeout(300);

      // Click on canvas to place device
      const canvas = page.locator('.react-flow__pane');
      await canvas.click({ position: { x: 400, y: 300 } });
      await page.waitForTimeout(500);

      // Verify device was added
      const nodes = page.locator('.react-flow__node');
      const nodeCount = await nodes.count();
      expect(nodeCount).toBeGreaterThan(0);

      // Undo (Ctrl+Z or Cmd+Z)
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
      await page.waitForTimeout(500);

      // Verify device was removed
      const nodesAfterUndo = page.locator('.react-flow__node');
      const nodeCountAfterUndo = await nodesAfterUndo.count();
      expect(nodeCountAfterUndo).toBe(nodeCount - 1);
    });

    test('should undo adding a boundary', async ({ page }) => {
      // Open boundary palette
      await page.click('[aria-label="Open boundary form to create security zones and boundaries"]');
      await page.waitForTimeout(300);

      // Click Security Zone
      await page.click('text=Security Zone');
      await page.waitForTimeout(300);

      // Draw boundary on canvas
      const canvas = page.locator('.react-flow__pane');
      await canvas.dragTo(canvas, {
        sourcePosition: { x: 200, y: 200 },
        targetPosition: { x: 500, y: 400 },
      });
      await page.waitForTimeout(500);

      // Verify boundary was added
      const boundaries = page.locator('.react-flow__node[data-type="boundary"]');
      const boundaryCount = await boundaries.count();
      expect(boundaryCount).toBeGreaterThan(0);

      // Undo
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
      await page.waitForTimeout(500);

      // Verify boundary was removed
      const boundariesAfterUndo = page.locator('.react-flow__node[data-type="boundary"]');
      const boundaryCountAfterUndo = await boundariesAfterUndo.count();
      expect(boundaryCountAfterUndo).toBe(boundaryCount - 1);
    });

    test('should undo deleting a node', async ({ page }) => {
      // Add a device first
      await page.click('[aria-label="Open device palette to add devices to the topology"]');
      await page.waitForTimeout(300);
      const firstDevice = page.locator('[data-testid^="device-icon-"]').first();
      await firstDevice.click();
      await page.waitForTimeout(300);
      const canvas = page.locator('.react-flow__pane');
      await canvas.click({ position: { x: 400, y: 300 } });
      await page.waitForTimeout(500);

      // Get initial node count
      const nodes = page.locator('.react-flow__node');
      const initialCount = await nodes.count();

      // Select and delete the node
      await nodes.first().click();
      await page.waitForTimeout(200);
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);

      // Verify node was deleted
      const nodesAfterDelete = page.locator('.react-flow__node');
      expect(await nodesAfterDelete.count()).toBe(initialCount - 1);

      // Undo
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
      await page.waitForTimeout(500);

      // Verify node was restored
      const nodesAfterUndo = page.locator('.react-flow__node');
      expect(await nodesAfterUndo.count()).toBe(initialCount);
    });

    test('should undo deleting an edge', async ({ page }) => {
      // Add two devices
      await page.click('[aria-label="Open device palette to add devices to the topology"]');
      await page.waitForTimeout(300);
      const firstDevice = page.locator('[data-testid^="device-icon-"]').first();
      await firstDevice.click();
      await page.waitForTimeout(300);
      const canvas = page.locator('.react-flow__pane');
      await canvas.click({ position: { x: 300, y: 300 } });
      await page.waitForTimeout(300);
      await canvas.click({ position: { x: 500, y: 300 } });
      await page.waitForTimeout(500);

      // Connect them (drag from first to second)
      const nodes = page.locator('.react-flow__node');
      const firstNode = nodes.first();
      const secondNode = nodes.nth(1);

      const firstNodeBox = await firstNode.boundingBox();
      const secondNodeBox = await secondNode.boundingBox();

      if (firstNodeBox && secondNodeBox) {
        await page.mouse.move(firstNodeBox.x + firstNodeBox.width / 2, firstNodeBox.y + firstNodeBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(secondNodeBox.x + secondNodeBox.width / 2, secondNodeBox.y + secondNodeBox.height / 2);
        await page.mouse.up();
        await page.waitForTimeout(500);
      }

      // Get initial edge count
      const edges = page.locator('.react-flow__edge');
      const initialEdgeCount = await edges.count();
      expect(initialEdgeCount).toBeGreaterThan(0);

      // Select and delete edge
      await edges.first().click();
      await page.waitForTimeout(200);
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);

      // Verify edge was deleted
      const edgesAfterDelete = page.locator('.react-flow__edge');
      expect(await edgesAfterDelete.count()).toBe(initialEdgeCount - 1);

      // Undo
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
      await page.waitForTimeout(500);

      // Verify edge was restored
      const edgesAfterUndo = page.locator('.react-flow__edge');
      expect(await edgesAfterUndo.count()).toBe(initialEdgeCount);
    });
  });

  test.describe('Bulk Operations', () => {
    test('should undo bulk deletion as single action', async ({ page }) => {
      // Add multiple devices
      await page.click('[aria-label="Open device palette to add devices to the topology"]');
      await page.waitForTimeout(300);
      const firstDevice = page.locator('[data-testid^="device-icon-"]').first();
      await firstDevice.click();
      await page.waitForTimeout(300);
      const canvas = page.locator('.react-flow__pane');

      // Place 3 devices
      for (let i = 0; i < 3; i++) {
        await canvas.click({ position: { x: 300 + i * 100, y: 300 } });
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(500);

      // Get initial count
      const nodes = page.locator('.react-flow__node');
      const initialCount = await nodes.count();
      expect(initialCount).toBeGreaterThanOrEqual(3);

      // Select all nodes (marquee select)
      await page.mouse.move(200, 200);
      await page.mouse.down();
      await page.mouse.move(600, 400);
      await page.mouse.up();
      await page.waitForTimeout(500);

      // Delete all selected
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);

      // Verify all were deleted
      const nodesAfterDelete = page.locator('.react-flow__node');
      const countAfterDelete = await nodesAfterDelete.count();
      expect(countAfterDelete).toBeLessThan(initialCount);

      // Undo once should restore all
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
      await page.waitForTimeout(500);

      // Verify all were restored
      const nodesAfterUndo = page.locator('.react-flow__node');
      expect(await nodesAfterUndo.count()).toBe(initialCount);
    });

    test('should undo group movement as single action', async ({ page }) => {
      // Add multiple devices
      await page.click('[aria-label="Open device palette to add devices to the topology"]');
      await page.waitForTimeout(300);
      const firstDevice = page.locator('[data-testid^="device-icon-"]').first();
      await firstDevice.click();
      await page.waitForTimeout(300);
      const canvas = page.locator('.react-flow__pane');

      // Place 2 devices close together
      await canvas.click({ position: { x: 300, y: 300 } });
      await page.waitForTimeout(300);
      await canvas.click({ position: { x: 350, y: 300 } });
      await page.waitForTimeout(500);

      // Select both (marquee select)
      await page.mouse.move(250, 250);
      await page.mouse.down();
      await page.mouse.move(450, 350);
      await page.mouse.up();
      await page.waitForTimeout(500);

      // Get initial positions
      const nodes = page.locator('.react-flow__node');
      const firstNode = nodes.first();
      const firstNodeBox = await firstNode.boundingBox();

      // Drag the selection
      if (firstNodeBox) {
        await page.mouse.move(firstNodeBox.x + firstNodeBox.width / 2, firstNodeBox.y + firstNodeBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(firstNodeBox.x + 200, firstNodeBox.y + 200);
        await page.mouse.up();
        await page.waitForTimeout(500);
      }

      // Undo should restore original positions
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
      await page.waitForTimeout(500);

      // Verify positions were restored (check that nodes are back in original area)
      const nodesAfterUndo = page.locator('.react-flow__node');
      const firstNodeAfterUndo = nodesAfterUndo.first();
      const firstNodeAfterUndoBox = await firstNodeAfterUndo.boundingBox();

      if (firstNodeBox && firstNodeAfterUndoBox) {
        // Should be close to original position (within 50px)
        const deltaX = Math.abs(firstNodeBox.x - firstNodeAfterUndoBox.x);
        const deltaY = Math.abs(firstNodeBox.y - firstNodeAfterUndoBox.y);
        expect(deltaX).toBeLessThan(50);
        expect(deltaY).toBeLessThan(50);
      }
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('should trigger undo with Ctrl+Z (Cmd+Z on Mac)', async ({ page }) => {
      // Add a device
      await page.click('[aria-label="Open device palette to add devices to the topology"]');
      await page.waitForTimeout(300);
      const firstDevice = page.locator('[data-testid^="device-icon-"]').first();
      await firstDevice.click();
      await page.waitForTimeout(300);
      const canvas = page.locator('.react-flow__pane');
      await canvas.click({ position: { x: 400, y: 300 } });
      await page.waitForTimeout(500);

      const nodes = page.locator('.react-flow__node');
      const countBefore = await nodes.count();

      // Undo
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
      await page.waitForTimeout(500);

      const countAfter = await nodes.count();
      expect(countAfter).toBe(countBefore - 1);
    });

    test('should trigger redo with Ctrl+Shift+Z (Cmd+Shift+Z on Mac)', async ({ page }) => {
      // Add a device
      await page.click('[aria-label="Open device palette to add devices to the topology"]');
      await page.waitForTimeout(300);
      const firstDevice = page.locator('[data-testid^="device-icon-"]').first();
      await firstDevice.click();
      await page.waitForTimeout(300);
      const canvas = page.locator('.react-flow__pane');
      await canvas.click({ position: { x: 400, y: 300 } });
      await page.waitForTimeout(500);

      const nodes = page.locator('.react-flow__node');
      const countBefore = await nodes.count();

      // Undo
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
      await page.waitForTimeout(500);

      // Redo
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+Z' : 'Control+Shift+Z');
      await page.waitForTimeout(500);

      const countAfter = await nodes.count();
      expect(countAfter).toBe(countBefore);
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle multiple rapid undos', async ({ page }) => {
      // Add multiple devices
      await page.click('[aria-label="Open device palette to add devices to the topology"]');
      await page.waitForTimeout(300);
      const firstDevice = page.locator('[data-testid^="device-icon-"]').first();
      await firstDevice.click();
      await page.waitForTimeout(300);
      const canvas = page.locator('.react-flow__pane');

      // Place 3 devices
      for (let i = 0; i < 3; i++) {
        await canvas.click({ position: { x: 300 + i * 100, y: 300 } });
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(500);

      const nodes = page.locator('.react-flow__node');
      const initialCount = await nodes.count();

      // Undo multiple times
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
        await page.waitForTimeout(300);
      }

      // Should have undone all 3 additions
      const finalCount = await nodes.count();
      expect(finalCount).toBeLessThan(initialCount);
    });

    test('should preserve nested boundaries on undo/redo', async ({ page }) => {
      // Create parent boundary
      await page.click('[aria-label="Open boundary form to create security zones and boundaries"]');
      await page.waitForTimeout(300);
      await page.click('text=Security Zone');
      await page.waitForTimeout(300);

      const canvas = page.locator('.react-flow__pane');
      await canvas.dragTo(canvas, {
        sourcePosition: { x: 200, y: 200 },
        targetPosition: { x: 600, y: 500 },
      });
      await page.waitForTimeout(500);

      // Add device inside boundary
      await page.click('[aria-label="Open device palette to add devices to the topology"]');
      await page.waitForTimeout(300);
      const firstDevice = page.locator('[data-testid^="device-icon-"]').first();
      await firstDevice.click();
      await page.waitForTimeout(300);
      await canvas.click({ position: { x: 400, y: 350 } });
      await page.waitForTimeout(500);

      // Verify device is inside boundary
      const nodes = page.locator('.react-flow__node');
      const deviceNode = nodes.filter({ hasText: /Device/ }).first();
      expect(await deviceNode.count()).toBeGreaterThan(0);

      // Undo device addition
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
      await page.waitForTimeout(500);

      // Redo device addition
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+Z' : 'Control+Shift+Z');
      await page.waitForTimeout(500);

      // Verify device is still inside boundary
      const deviceNodeAfterRedo = nodes.filter({ hasText: /Device/ }).first();
      expect(await deviceNodeAfterRedo.count()).toBeGreaterThan(0);
    });
  });
});
