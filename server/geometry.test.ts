import { describe, it, expect, beforeEach } from "vitest";
import type { GeometricObject, SpatialGridConfig, BoundingBox } from "../shared/geometry-types";
import { ObjectType } from "../shared/geometry-types";
import { SpatialGridImpl, createSpatialGrid } from "../shared/geometry-spatial-grid";
import {
  distance,
  detectCircleCollision,
  calculatePenetration,
  detectCollisions,
  isCollisionFree,
  areTooClose,
  calculateSeparationDistance,
  findNearestValidPosition,
  getCollisionStats,
} from "../shared/geometry-collision";
import {
  validatePlacement,
  validateLayout,
  getCollidingObjects,
  isLayoutValid,
  getProblematicObjects,
} from "../shared/geometry-validation";

/**
 * Crear objeto de prueba
 */
function createTestObject(
  id: string,
  x: number,
  y: number,
  radius: number = 1
): GeometricObject {
  return {
    id,
    position: { x, y },
    radius,
    type: ObjectType.PLANT,
  };
}

describe("Geometry Engine - Spatial Grid", () => {
  let grid: SpatialGridImpl;
  const config: SpatialGridConfig = {
    width: 100,
    height: 100,
    cellSize: 10,
    maxObjectsPerCell: 10,
  };
  const bounds: BoundingBox = {
    minX: 0,
    minY: 0,
    maxX: 100,
    maxY: 100,
  };

  beforeEach(() => {
    grid = new SpatialGridImpl(config, bounds);
  });

  describe("Insertion and Retrieval", () => {
    it("should insert and retrieve objects", () => {
      const obj = createTestObject("obj1", 50, 50);
      grid.insert(obj);

      expect(grid.getById("obj1")).toEqual(obj);
      expect(grid.getAll()).toHaveLength(1);
    });

    it("should handle multiple objects", () => {
      const obj1 = createTestObject("obj1", 10, 10);
      const obj2 = createTestObject("obj2", 50, 50);
      const obj3 = createTestObject("obj3", 90, 90);

      grid.insert(obj1);
      grid.insert(obj2);
      grid.insert(obj3);

      expect(grid.getAll()).toHaveLength(3);
    });

    it("should remove objects", () => {
      const obj = createTestObject("obj1", 50, 50);
      grid.insert(obj);
      grid.remove("obj1");

      expect(grid.getById("obj1")).toBeUndefined();
      expect(grid.getAll()).toHaveLength(0);
    });

    it("should update object position", () => {
      const obj = createTestObject("obj1", 50, 50);
      grid.insert(obj);

      const updatedObj = { ...obj, position: { x: 60, y: 60 } };
      grid.update(updatedObj);

      const retrieved = grid.getById("obj1");
      expect(retrieved?.position).toEqual({ x: 60, y: 60 });
    });
  });

  describe("Spatial Queries", () => {
    beforeEach(() => {
      grid.insert(createTestObject("center", 50, 50, 2));
      grid.insert(createTestObject("near1", 52, 50, 1));
      grid.insert(createTestObject("near2", 50, 52, 1));
      grid.insert(createTestObject("far", 90, 90, 1));
    });

    it("should find nearby objects", () => {
      const nearby = grid.getNearby({ x: 50, y: 50 }, 5);
      expect(nearby.length).toBeGreaterThanOrEqual(3);
    });

    it("should find objects in area", () => {
      const inArea = grid.getInArea(45, 45, 55, 55);
      expect(inArea.length).toBeGreaterThanOrEqual(3);
    });

    it("should not find distant objects", () => {
      const nearby = grid.getNearby({ x: 50, y: 50 }, 5);
      const farIds = nearby.map((o) => o.id);
      expect(farIds).not.toContain("far");
    });
  });

  describe("Grid Statistics", () => {
    it("should calculate statistics correctly", () => {
      grid.insert(createTestObject("obj1", 10, 10));
      grid.insert(createTestObject("obj2", 50, 50));

      const stats = grid.getStats();
      expect(stats.totalObjects).toBe(2);
      expect(stats.occupiedCells).toBeGreaterThan(0);
    });

    it("should handle empty grid", () => {
      const stats = grid.getStats();
      expect(stats.totalObjects).toBe(0);
      expect(stats.occupiedCells).toBe(0);
    });
  });
});

describe("Geometry Engine - Collision Detection", () => {
  let grid: SpatialGridImpl;
  const bounds: BoundingBox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  beforeEach(() => {
    grid = new SpatialGridImpl({ width: 100, height: 100, cellSize: 10 }, bounds);
  });

  describe("Distance Calculation", () => {
    it("should calculate distance between points", () => {
      const dist = distance({ x: 0, y: 0 }, { x: 3, y: 4 });
      expect(dist).toBeCloseTo(5, 1);
    });

    it("should handle same point", () => {
      const dist = distance({ x: 5, y: 5 }, { x: 5, y: 5 });
      expect(dist).toBe(0);
    });
  });

  describe("Circle Collision", () => {
    it("should detect collision between overlapping circles", () => {
      const obj1 = createTestObject("obj1", 10, 10, 5);
      const obj2 = createTestObject("obj2", 15, 10, 5);

      expect(detectCircleCollision(obj1, obj2)).toBe(true);
    });

    it("should not detect collision between separate circles", () => {
      const obj1 = createTestObject("obj1", 10, 10, 5);
      const obj2 = createTestObject("obj2", 30, 10, 5);

      expect(detectCircleCollision(obj1, obj2)).toBe(false);
    });

    it("should detect collision at boundary", () => {
      const obj1 = createTestObject("obj1", 10, 10, 5);
      const obj2 = createTestObject("obj2", 20, 10, 5);

      expect(detectCircleCollision(obj1, obj2)).toBe(false); // Touching, not colliding
    });
  });

  describe("Penetration Calculation", () => {
    it("should calculate penetration depth", () => {
      const obj1 = createTestObject("obj1", 10, 10, 5);
      const obj2 = createTestObject("obj2", 15, 10, 5);

      const penetration = calculatePenetration(obj1, obj2);
      expect(penetration).toBeGreaterThan(0);
    });

    it("should return 0 for non-colliding objects", () => {
      const obj1 = createTestObject("obj1", 10, 10, 5);
      const obj2 = createTestObject("obj2", 30, 10, 5);

      const penetration = calculatePenetration(obj1, obj2);
      expect(penetration).toBe(0);
    });
  });

  describe("Collision Detection with Grid", () => {
    it("should detect collisions", () => {
      const obj1 = createTestObject("obj1", 50, 50, 5);
      const obj2 = createTestObject("obj2", 55, 50, 5);

      grid.insert(obj1);
      grid.insert(obj2);

      const collision = detectCollisions(obj1, grid);
      expect(collision.hasCollision).toBe(true);
      expect(collision.collidingObjects).toContain("obj2");
    });

    it("should detect no collisions", () => {
      const obj1 = createTestObject("obj1", 50, 50, 5);
      const obj2 = createTestObject("obj2", 80, 80, 5);

      grid.insert(obj1);
      grid.insert(obj2);

      const collision = detectCollisions(obj1, grid);
      expect(collision.hasCollision).toBe(false);
    });
  });

  describe("Collision-Free Validation", () => {
    it("should validate collision-free placement", () => {
      const obj1 = createTestObject("obj1", 50, 50, 5);
      grid.insert(obj1);

      const obj2 = createTestObject("obj2", 80, 80, 5);
      expect(isCollisionFree(obj2, grid)).toBe(true);
    });

    it("should reject colliding placement", () => {
      const obj1 = createTestObject("obj1", 50, 50, 5);
      grid.insert(obj1);

      const obj2 = createTestObject("obj2", 55, 50, 5);
      expect(isCollisionFree(obj2, grid)).toBe(false);
    });
  });

  describe("Separation Calculation", () => {
    it("should calculate separation distance", () => {
      const obj1 = createTestObject("obj1", 10, 10, 5);
      const obj2 = createTestObject("obj2", 15, 10, 5);

      const separation = calculateSeparationDistance(obj1, obj2);
      expect(separation).toBeGreaterThan(0);
    });

    it("should return 0 for non-colliding objects", () => {
      const obj1 = createTestObject("obj1", 10, 10, 5);
      const obj2 = createTestObject("obj2", 30, 10, 5);

      const separation = calculateSeparationDistance(obj1, obj2);
      expect(separation).toBe(0);
    });
  });

  describe("Collision Statistics", () => {
    it("should calculate collision stats", () => {
      grid.insert(createTestObject("obj1", 50, 50, 5));
      grid.insert(createTestObject("obj2", 55, 50, 5));

      const stats = getCollisionStats(grid);
      expect(stats.totalCollisions).toBe(1);
      expect(stats.totalObjects).toBe(2);
    });

    it("should handle no collisions", () => {
      grid.insert(createTestObject("obj1", 10, 10, 5));
      grid.insert(createTestObject("obj2", 80, 80, 5));

      const stats = getCollisionStats(grid);
      expect(stats.totalCollisions).toBe(0);
    });
  });
});

describe("Geometry Engine - Placement Validation", () => {
  let grid: SpatialGridImpl;
  const bounds: BoundingBox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  beforeEach(() => {
    grid = new SpatialGridImpl({ width: 100, height: 100, cellSize: 10 }, bounds);
  });

  describe("Single Object Validation", () => {
    it("should validate valid placement", () => {
      const obj = createTestObject("obj1", 50, 50, 5);
      const validation = validatePlacement(obj, grid, bounds);

      expect(validation.isValid).toBe(true);
      expect(validation.canPlace).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should reject out of bounds placement", () => {
      const obj = createTestObject("obj1", 105, 50, 5);
      const validation = validatePlacement(obj, grid, bounds);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("should reject invalid radius", () => {
      const obj = createTestObject("obj1", 50, 50, -5);
      const validation = validatePlacement(obj, grid, bounds);

      expect(validation.isValid).toBe(false);
    });

    it("should reject collision", () => {
      grid.insert(createTestObject("obj1", 50, 50, 5));

      const obj2 = createTestObject("obj2", 55, 50, 5);
      const validation = validatePlacement(obj2, grid, bounds);

      expect(validation.isValid).toBe(false);
      expect(validation.canPlace).toBe(false);
    });
  });

  describe("Layout Validation", () => {
    it("should validate valid layout", () => {
      const obj1 = createTestObject("obj1", 20, 20, 5);
      const obj2 = createTestObject("obj2", 80, 80, 5);

      grid.insert(obj1);
      grid.insert(obj2);

      const validation = validateLayout([obj1, obj2], grid, bounds);
      expect(validation.isValid).toBe(true);
      expect(validation.collisions).toHaveLength(0);
    });

    it("should detect layout collisions", () => {
      const obj1 = createTestObject("obj1", 50, 50, 5);
      const obj2 = createTestObject("obj2", 55, 50, 5);

      grid.insert(obj1);
      grid.insert(obj2);

      const validation = validateLayout([obj1, obj2], grid, bounds);
      expect(validation.isValid).toBe(false);
      expect(validation.collisions.length).toBeGreaterThan(0);
    });
  });

  describe("Problematic Objects Detection", () => {
    it("should identify problematic objects", () => {
      grid.insert(createTestObject("obj1", 50, 50, 5));
      grid.insert(createTestObject("obj2", 55, 50, 5)); // Collision

      const problematic = getProblematicObjects(grid, bounds);
      expect(problematic.length).toBeGreaterThan(0);
    });

    it("should return empty for valid layout", () => {
      grid.insert(createTestObject("obj1", 20, 20, 5));
      grid.insert(createTestObject("obj2", 80, 80, 5));

      const problematic = getProblematicObjects(grid, bounds);
      expect(problematic).toHaveLength(0);
    });
  });
});

describe("Geometry Engine - Integration", () => {
  let grid: SpatialGridImpl;
  const bounds: BoundingBox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  beforeEach(() => {
    grid = new SpatialGridImpl({ width: 100, height: 100, cellSize: 10 }, bounds);
  });

  it("should handle complete workflow", () => {
    // 1. Crear objetos
    const obj1 = createTestObject("plant1", 20, 20, 3);
    const obj2 = createTestObject("plant2", 80, 80, 3);

    // 2. Validar colocación
    let validation = validatePlacement(obj1, grid, bounds);
    expect(validation.canPlace).toBe(true);

    // 3. Insertar
    grid.insert(obj1);
    grid.insert(obj2);

    // 4. Validar layout
    const layout = validateLayout([obj1, obj2], grid, bounds);
    expect(layout.isValid).toBe(true);

    // 5. Verificar estadísticas
    const stats = grid.getStats();
    expect(stats.totalObjects).toBe(2);
  });

  it("should detect and report conflicts", () => {
    const obj1 = createTestObject("plant1", 50, 50, 5);
    const obj2 = createTestObject("plant2", 55, 50, 5);

    grid.insert(obj1);

    // Intentar colocar objeto conflictivo
    const validation = validatePlacement(obj2, grid, bounds);

    expect(validation.canPlace).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.collisions.hasCollision).toBe(true);
  });
});
