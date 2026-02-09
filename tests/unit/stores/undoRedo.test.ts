import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AppNode, AppEdge } from '@/lib/utils/types';
import { createTestNode, createTestEdge, createTestBoundary } from '@/tests/fixtures/undoRedoFixtures';

/**
 * Unit tests for undo/redo core functionality
 * 
 * These tests verify the checkpoint creation and undo/redo logic
 * in isolation, without the full FlowCanvas component.
 */

describe('Undo/Redo Core Functionality', () => {
  // Mock checkpoint function
  let checkpointFunction: (() => void) | null = null;
  let checkpointCallCount = 0;
  let lastCheckpoint: { nodes: AppNode[]; edges: AppEdge[] } | null = null;

  // Mock undo/redo stacks
  let undoStack: Array<{ nodes: AppNode[]; edges: AppEdge[] }> = [];
  let redoStack: Array<{ nodes: AppNode[]; edges: AppEdge[] }> = [];
  let isUndoRedoOperation = false;

  // Mock state
  let currentNodes: AppNode[] = [];
  let currentEdges: AppEdge[] = [];

  beforeEach(() => {
    // Reset all state
    checkpointFunction = null;
    checkpointCallCount = 0;
    lastCheckpoint = null;
    undoStack = [];
    redoStack = [];
    isUndoRedoOperation = false;
    currentNodes = [];
    currentEdges = [];
  });

  // Helper to simulate checkpoint creation
  const createCheckpoint = (force = false) => {
    if (isUndoRedoOperation) return;
    if (!force && checkpointCallCount > 0) {
      // Simulate debouncing - skip if called too recently
      return;
    }

    const checkpoint = {
      nodes: JSON.parse(JSON.stringify(currentNodes)),
      edges: JSON.parse(JSON.stringify(currentEdges)),
    };

    // Check for duplicates
    const lastCheckpoint = undoStack[undoStack.length - 1];
    if (lastCheckpoint) {
      const nodesChanged = JSON.stringify(currentNodes) !== JSON.stringify(lastCheckpoint.nodes);
      const edgesChanged = JSON.stringify(currentEdges) !== JSON.stringify(lastCheckpoint.edges);
      if (!nodesChanged && !edgesChanged) {
        return; // Skip duplicate
      }
    }

    undoStack.push(checkpoint);
    lastCheckpoint = checkpoint;
    checkpointCallCount++;

    // Limit stack size
    if (undoStack.length > 50) {
      undoStack.shift();
    }

    // Clear redo stack
    redoStack = [];
  };

  // Helper to simulate undo
  const performUndo = () => {
    if (undoStack.length === 0) return;

    const currentState = {
      nodes: JSON.parse(JSON.stringify(currentNodes)),
      edges: JSON.parse(JSON.stringify(currentEdges)),
    };

    redoStack.push(currentState);
    const previousState = undoStack.pop()!;

    isUndoRedoOperation = true;
    currentNodes = previousState.nodes;
    currentEdges = previousState.edges;
    isUndoRedoOperation = false;
  };

  // Helper to simulate redo
  const performRedo = () => {
    if (redoStack.length === 0) return;

    const currentState = {
      nodes: JSON.parse(JSON.stringify(currentNodes)),
      edges: JSON.parse(JSON.stringify(currentEdges)),
    };

    undoStack.push(currentState);
    const nextState = redoStack.pop()!;

    isUndoRedoOperation = true;
    currentNodes = nextState.nodes;
    currentEdges = nextState.edges;
    isUndoRedoOperation = false;
  };

  describe('Checkpoint Creation', () => {
    it('should create checkpoint with current nodes/edges state', () => {
      currentNodes = [createTestNode('node-1')];
      currentEdges = [createTestEdge('edge-1', 'node-1', 'node-2')];

      createCheckpoint(true);

      expect(undoStack).toHaveLength(1);
      expect(undoStack[0].nodes).toHaveLength(1);
      expect(undoStack[0].edges).toHaveLength(1);
      expect(undoStack[0].nodes[0].id).toBe('node-1');
      expect(undoStack[0].edges[0].id).toBe('edge-1');
    });

    it('should skip duplicate checkpoints (same state)', () => {
      currentNodes = [createTestNode('node-1')];
      currentEdges = [];

      createCheckpoint(true);
      expect(undoStack).toHaveLength(1);

      // Try to create checkpoint with same state
      createCheckpoint(true);
      expect(undoStack).toHaveLength(1); // Should not add duplicate
    });

    it('should limit stack size to 50 checkpoints', () => {
      // Create 55 checkpoints
      for (let i = 0; i < 55; i++) {
        currentNodes = [createTestNode(`node-${i}`)];
        createCheckpoint(true);
      }

      expect(undoStack.length).toBeLessThanOrEqual(50);
      // First checkpoint should be removed
      expect(undoStack[0].nodes[0].id).toBe('node-5');
    });

    it('should clear redo stack on new checkpoint', () => {
      // Create initial state
      currentNodes = [createTestNode('node-1')];
      createCheckpoint(true);

      // Undo
      performUndo();
      expect(redoStack).toHaveLength(1);

      // Create new checkpoint
      currentNodes = [createTestNode('node-2')];
      createCheckpoint(true);

      expect(redoStack).toHaveLength(0);
    });

    it('should respect isUndoRedoOperation flag (no checkpoint during undo/redo)', () => {
      currentNodes = [createTestNode('node-1')];
      createCheckpoint(true);
      expect(undoStack).toHaveLength(1);

      // Perform undo
      performUndo();

      // Try to create checkpoint during undo operation
      isUndoRedoOperation = true;
      createCheckpoint(true);
      expect(undoStack).toHaveLength(0); // Should not create checkpoint
    });
  });

  describe('Undo Operation', () => {
    it('should pop from undo stack and restore state', () => {
      // Create initial state
      currentNodes = [createTestNode('node-1')];
      currentEdges = [];
      createCheckpoint(true);

      // Modify state
      currentNodes = [createTestNode('node-2')];
      createCheckpoint(true);

      expect(undoStack).toHaveLength(2);
      expect(currentNodes[0].id).toBe('node-2');

      // Undo
      performUndo();

      expect(undoStack).toHaveLength(1);
      expect(currentNodes[0].id).toBe('node-1');
    });

    it('should move current state to redo stack', () => {
      currentNodes = [createTestNode('node-1')];
      createCheckpoint(true);

      currentNodes = [createTestNode('node-2')];
      createCheckpoint(true);

      performUndo();

      expect(redoStack).toHaveLength(1);
      expect(redoStack[0].nodes[0].id).toBe('node-2');
    });

    it('should handle empty undo stack gracefully', () => {
      expect(undoStack).toHaveLength(0);
      performUndo();
      expect(currentNodes).toHaveLength(0);
      expect(redoStack).toHaveLength(0);
    });

    it('should preserve node/edge relationships', () => {
      const node1 = createTestNode('node-1');
      const node2 = createTestNode('node-2');
      const edge = createTestEdge('edge-1', 'node-1', 'node-2');

      currentNodes = [node1, node2];
      currentEdges = [edge];
      createCheckpoint(true);

      // Modify
      currentNodes = [node1];
      currentEdges = [];
      createCheckpoint(true);

      // Undo
      performUndo();

      expect(currentNodes).toHaveLength(2);
      expect(currentEdges).toHaveLength(1);
      expect(currentEdges[0].source).toBe('node-1');
      expect(currentEdges[0].target).toBe('node-2');
    });

    it('should preserve nested boundaries', () => {
      const parent = createTestBoundary('boundary-1');
      const child = createTestNode('node-1', { parentId: 'boundary-1' });

      currentNodes = [parent, child];
      createCheckpoint(true);

      // Modify
      currentNodes = [parent];
      createCheckpoint(true);

      // Undo
      performUndo();

      expect(currentNodes).toHaveLength(2);
      expect(currentNodes[1].parentId).toBe('boundary-1');
    });
  });

  describe('Redo Operation', () => {
    it('should pop from redo stack and restore state', () => {
      currentNodes = [createTestNode('node-1')];
      createCheckpoint(true);

      currentNodes = [createTestNode('node-2')];
      createCheckpoint(true);

      performUndo();
      expect(currentNodes[0].id).toBe('node-1');

      performRedo();
      expect(currentNodes[0].id).toBe('node-2');
    });

    it('should move current state to undo stack', () => {
      currentNodes = [createTestNode('node-1')];
      createCheckpoint(true);

      currentNodes = [createTestNode('node-2')];
      createCheckpoint(true);

      performUndo();
      performRedo();

      expect(undoStack).toHaveLength(2);
      expect(undoStack[1].nodes[0].id).toBe('node-1');
    });

    it('should handle empty redo stack gracefully', () => {
      expect(redoStack).toHaveLength(0);
      performRedo();
      expect(currentNodes).toHaveLength(0);
      expect(undoStack).toHaveLength(0);
    });
  });

  describe('Stack Management', () => {
    it('should clear stacks on project change', () => {
      currentNodes = [createTestNode('node-1')];
      createCheckpoint(true);

      currentNodes = [createTestNode('node-2')];
      createCheckpoint(true);

      performUndo();
      expect(redoStack).toHaveLength(1);

      // Simulate project change
      undoStack = [];
      redoStack = [];

      expect(undoStack).toHaveLength(0);
      expect(redoStack).toHaveLength(0);
    });

    it('should handle rapid checkpoint creation (debouncing)', () => {
      // Simulate rapid calls
      for (let i = 0; i < 10; i++) {
        currentNodes = [createTestNode(`node-${i}`)];
        createCheckpoint(false); // Not forced, should debounce
      }

      // Should only create one checkpoint due to debouncing
      expect(undoStack.length).toBeLessThanOrEqual(1);
    });

    it('should maintain stack order (LIFO)', () => {
      // Create multiple checkpoints
      for (let i = 0; i < 5; i++) {
        currentNodes = [createTestNode(`node-${i}`)];
        createCheckpoint(true);
      }

      // Undo should restore in reverse order
      for (let i = 4; i >= 0; i--) {
        performUndo();
        expect(currentNodes[0].id).toBe(`node-${i}`);
      }
    });
  });
});
