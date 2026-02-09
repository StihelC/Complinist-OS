/**
 * Spatial Hash Grid
 *
 * A spatial partitioning data structure for efficient collision detection
 * in large diagrams. Divides space into a uniform grid of cells and only
 * checks for collisions between objects in the same or adjacent cells.
 *
 * Time complexity: O(n) average case vs O(n²) for naive approach
 */

import type { BoundingBox } from './collision-detection';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for configuring the spatial hash grid
 */
export interface SpatialHashOptions {
  /** Size of each grid cell in pixels */
  cellSize: number;
}

/**
 * Internal cell coordinate type
 */
interface CellCoord {
  x: number;
  y: number;
}

// =============================================================================
// Default Constants
// =============================================================================

/** Default cell size based on typical node dimensions */
export const DEFAULT_CELL_SIZE = 250;

// =============================================================================
// SpatialHash Class
// =============================================================================

/**
 * Spatial hash grid for efficient collision detection.
 *
 * The grid divides 2D space into uniform cells. Objects are inserted into
 * all cells they overlap. Queries return all objects in the same cells
 * as the query object, dramatically reducing collision checks.
 *
 * @example
 * ```ts
 * const hash = new SpatialHash({ cellSize: 200 });
 *
 * // Insert all bounding boxes
 * boxes.forEach(box => hash.insert(box));
 *
 * // Query for potential collisions
 * const candidates = hash.query(targetBox);
 * ```
 */
export class SpatialHash {
  private cellSize: number;
  private grid: Map<string, BoundingBox[]>;

  /**
   * Create a new spatial hash grid
   * @param options - Configuration options
   */
  constructor(options: SpatialHashOptions = { cellSize: DEFAULT_CELL_SIZE }) {
    this.cellSize = options.cellSize;
    this.grid = new Map();
  }

  /**
   * Convert world coordinates to cell coordinates
   */
  private worldToCell(x: number, y: number): CellCoord {
    return {
      x: Math.floor(x / this.cellSize),
      y: Math.floor(y / this.cellSize),
    };
  }

  /**
   * Generate a unique string key for a cell coordinate
   */
  private cellKey(cell: CellCoord): string {
    return `${cell.x},${cell.y}`;
  }

  /**
   * Get all cells that a bounding box overlaps
   */
  private getCellsForBox(box: BoundingBox): CellCoord[] {
    const minCell = this.worldToCell(box.x, box.y);
    const maxCell = this.worldToCell(box.x + box.width, box.y + box.height);

    const cells: CellCoord[] = [];

    for (let x = minCell.x; x <= maxCell.x; x++) {
      for (let y = minCell.y; y <= maxCell.y; y++) {
        cells.push({ x, y });
      }
    }

    return cells;
  }

  /**
   * Insert a bounding box into the spatial hash
   * @param box - The bounding box to insert
   */
  insert(box: BoundingBox): void {
    const cells = this.getCellsForBox(box);

    for (const cell of cells) {
      const key = this.cellKey(cell);
      const cellObjects = this.grid.get(key) || [];
      cellObjects.push(box);
      this.grid.set(key, cellObjects);
    }
  }

  /**
   * Query for all bounding boxes that might intersect with the given box.
   * Returns objects from all cells the query box overlaps.
   *
   * @param box - The bounding box to query
   * @returns Array of potentially colliding bounding boxes (may include duplicates)
   */
  query(box: BoundingBox): BoundingBox[] {
    const cells = this.getCellsForBox(box);
    const candidates: BoundingBox[] = [];
    const seen = new Set<string>();

    for (const cell of cells) {
      const key = this.cellKey(cell);
      const cellObjects = this.grid.get(key);

      if (cellObjects) {
        for (const obj of cellObjects) {
          // Avoid duplicates (object may be in multiple cells)
          if (!seen.has(obj.nodeId)) {
            seen.add(obj.nodeId);
            candidates.push(obj);
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Remove all objects from the spatial hash
   */
  clear(): void {
    this.grid.clear();
  }

  /**
   * Get the number of cells in use
   */
  getCellCount(): number {
    return this.grid.size;
  }

  /**
   * Get statistics about the spatial hash
   */
  getStats(): {
    cellCount: number;
    totalObjects: number;
    avgObjectsPerCell: number;
    maxObjectsPerCell: number;
  } {
    let totalObjects = 0;
    let maxObjectsPerCell = 0;

    for (const [, objects] of this.grid) {
      totalObjects += objects.length;
      maxObjectsPerCell = Math.max(maxObjectsPerCell, objects.length);
    }

    const cellCount = this.grid.size;

    return {
      cellCount,
      totalObjects,
      avgObjectsPerCell: cellCount > 0 ? totalObjects / cellCount : 0,
      maxObjectsPerCell,
    };
  }

  /**
   * Rebuild the spatial hash with a new cell size.
   * Useful for adapting to different diagram densities.
   *
   * @param newCellSize - The new cell size
   * @param boxes - All boxes to re-insert
   */
  rebuild(newCellSize: number, boxes: BoundingBox[]): void {
    this.cellSize = newCellSize;
    this.clear();

    for (const box of boxes) {
      this.insert(box);
    }
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate optimal cell size based on node dimensions.
 * Cell size should be larger than most objects to minimize multi-cell insertions.
 *
 * @param boxes - Array of bounding boxes
 * @param clearance - Clearance distance being used
 * @returns Recommended cell size
 */
export function calculateOptimalCellSize(
  boxes: BoundingBox[],
  clearance: number = 100
): number {
  if (boxes.length === 0) {
    return DEFAULT_CELL_SIZE;
  }

  // Find the maximum dimensions among all boxes
  let maxWidth = 0;
  let maxHeight = 0;

  for (const box of boxes) {
    maxWidth = Math.max(maxWidth, box.width);
    maxHeight = Math.max(maxHeight, box.height);
  }

  // Cell size should accommodate the largest object plus clearance
  // Multiply by 1.5 for some headroom
  const optimalSize = Math.max(maxWidth, maxHeight) + clearance;

  return Math.max(optimalSize, DEFAULT_CELL_SIZE);
}

/**
 * Create a spatial hash and populate it with bounding boxes
 *
 * @param boxes - Array of bounding boxes to insert
 * @param options - Spatial hash options
 * @returns Populated SpatialHash instance
 */
export function createPopulatedSpatialHash(
  boxes: BoundingBox[],
  options?: Partial<SpatialHashOptions>
): SpatialHash {
  const cellSize = options?.cellSize ?? calculateOptimalCellSize(boxes);
  const hash = new SpatialHash({ cellSize });

  for (const box of boxes) {
    hash.insert(box);
  }

  return hash;
}

/**
 * Estimate the number of collision checks needed with spatial hashing
 * vs naive approach. Useful for deciding whether to use spatial hashing.
 *
 * @param boxes - Array of bounding boxes
 * @param cellSize - Cell size to use
 * @returns Estimated check counts
 */
export function estimateCollisionChecks(
  boxes: BoundingBox[],
  cellSize: number = DEFAULT_CELL_SIZE
): {
  naiveChecks: number;
  spatialHashChecks: number;
  improvement: number;
} {
  const n = boxes.length;
  const naiveChecks = (n * (n - 1)) / 2;

  // Estimate spatial hash checks by simulating insertion
  const hash = createPopulatedSpatialHash(boxes, { cellSize });
  const stats = hash.getStats();

  // Estimated checks: sum of (k * (k-1) / 2) for each cell with k objects
  // Approximation: avgObjectsPerCell² * cellCount / 2
  const avgK = stats.avgObjectsPerCell;
  const spatialHashChecks = Math.round((avgK * (avgK - 1) * stats.cellCount) / 2);

  const improvement = naiveChecks > 0 ? naiveChecks / Math.max(spatialHashChecks, 1) : 1;

  return {
    naiveChecks,
    spatialHashChecks,
    improvement,
  };
}
