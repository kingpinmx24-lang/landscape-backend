/**
 * ============================================================================
 * SYSTEM VALIDATION TESTS
 * ============================================================================
 * Comprehensive validation of complete system functionality
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "../server/db";
import {
  createProject,
  getProjectById,
  addPlant,
  getMeasurements,
  addMeasurement,
  addQuotation,
  getQuotations,
  updateProjectStatus,
} from "../server/queries";
import {
  validatePlacement,
  validateLayout,
  getProblematicObjects,
  SpatialGridImpl,
} from "../shared/geometry-collision";
import { classifyPixel, extractZones, pointInZone } from "../shared/terrain-segmentation";
import { validateDesignByZones, getPlantZoneCompatibility } from "../shared/terrain-rules";
import { scorePlant, generateBalancedDesign } from "../shared/profit-design-generator";
import type { GeometricObject, CollisionResult } from "../shared/geometry-types";
import type { TerrainType } from "../shared/terrain-types";
import type { Plant } from "../shared/profit-types";

describe("System Validation Tests", () => {
  const testProjectId = 999;
  const testUserId = 1;
  let projectId: number | null = null;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test project
    const result = await createProject(testUserId, {
      name: "System Validation Test Project",
      description: "Test project for system validation",
      terrain: {
        width: 100,
        height: 100,
        unit: "m",
      },
      status: "draft",
    });

    if (result.success && result.projectId) {
      projectId = result.projectId;
    } else {
      throw new Error("Failed to create test project");
    }
  });

  afterAll(async () => {
    // Cleanup is handled by database cascade deletes
  });

  describe("1. Save and Reload Project", () => {
    it("should save project to database", async () => {
      expect(projectId).toBeDefined();
      expect(projectId).toBeGreaterThan(0);
    });

    it("should reload project from database", async () => {
      if (!projectId) throw new Error("No project ID");

      const project = await getProjectById(projectId, testUserId);
      expect(project).toBeDefined();
      expect(project?.name).toBe("System Validation Test Project");
      expect(project?.terrain.width).toBe(100);
      expect(project?.terrain.height).toBe(100);
    });

    it("should persist project data across multiple loads", async () => {
      if (!projectId) throw new Error("No project ID");

      const project1 = await getProjectById(projectId, testUserId);
      const project2 = await getProjectById(projectId, testUserId);

      expect(project1).toEqual(project2);
      expect(project1?.createdAt).toEqual(project2?.createdAt);
    });

    it("should preserve all project properties", async () => {
      if (!projectId) throw new Error("No project ID");

      const project = await getProjectById(projectId, testUserId);
      expect(project).toHaveProperty("id");
      expect(project).toHaveProperty("userId");
      expect(project).toHaveProperty("name");
      expect(project).toHaveProperty("description");
      expect(project).toHaveProperty("terrain");
      expect(project).toHaveProperty("status");
      expect(project).toHaveProperty("createdAt");
      expect(project).toHaveProperty("updatedAt");
    });
  });

  describe("2. Terrain Detection", () => {
    it("should correctly classify soil pixels", () => {
      // Soil: brown color (RGB: 139, 69, 19)
      const isSoil = classifyPixel(139, 69, 19);
      expect(isSoil).toBe("soil");
    });

    it("should correctly classify grass pixels", () => {
      // Grass: green color (RGB: 34, 139, 34)
      const isGrass = classifyPixel(34, 139, 34);
      expect(isGrass).toBe("grass");
    });

    it("should correctly classify concrete pixels", () => {
      // Concrete: gray color (RGB: 169, 169, 169)
      const isConcrete = classifyPixel(169, 169, 169);
      expect(isConcrete).toBe("concrete");
    });

    it("should extract zones from image data", () => {
      // Create a simple test image: 10x10 pixels
      const imageData = new Uint8ClampedArray(10 * 10 * 4);

      // Fill with soil color (brown)
      for (let i = 0; i < imageData.length; i += 4) {
        imageData[i] = 139; // R
        imageData[i + 1] = 69; // G
        imageData[i + 2] = 19; // B
        imageData[i + 3] = 255; // A
      }

      const zones = extractZones(imageData, 10, 10);
      expect(zones).toBeDefined();
      expect(zones.length).toBeGreaterThan(0);
      expect(zones[0].type).toBe("soil");
    });

    it("should detect multiple terrain types in same image", () => {
      // Create a 20x20 image with soil and grass
      const imageData = new Uint8ClampedArray(20 * 20 * 4);

      // First half: soil
      for (let i = 0; i < imageData.length / 2; i += 4) {
        imageData[i] = 139;
        imageData[i + 1] = 69;
        imageData[i + 2] = 19;
        imageData[i + 3] = 255;
      }

      // Second half: grass
      for (let i = Math.floor(imageData.length / 2); i < imageData.length; i += 4) {
        imageData[i] = 34;
        imageData[i + 1] = 139;
        imageData[i + 2] = 34;
        imageData[i + 3] = 255;
      }

      const zones = extractZones(imageData, 20, 20);
      expect(zones.length).toBeGreaterThanOrEqual(2);

      const types = new Set(zones.map((z) => z.type));
      expect(types.has("soil")).toBe(true);
      expect(types.has("grass")).toBe(true);
    });
  });

  describe("3. Collision Detection and Prevention", () => {
    it("should detect collision between overlapping objects", () => {
      const grid = new SpatialGridImpl(100, 100, 10);

      const obj1: GeometricObject = { id: "1", x: 50, y: 50, radius: 5 };
      const obj2: GeometricObject = { id: "2", x: 52, y: 50, radius: 5 };

      grid.insert(obj1);
      grid.insert(obj2);

      const collisions = grid.detectAllCollisions();
      expect(collisions.length).toBeGreaterThan(0);
      expect(collisions[0].obj1.id).toBe("1");
      expect(collisions[0].obj2.id).toBe("2");
    });

    it("should not detect collision between distant objects", () => {
      const grid = new SpatialGridImpl(100, 100, 10);

      const obj1: GeometricObject = { id: "1", x: 10, y: 10, radius: 5 };
      const obj2: GeometricObject = { id: "2", x: 90, y: 90, radius: 5 };

      grid.insert(obj1);
      grid.insert(obj2);

      const collisions = grid.detectAllCollisions();
      expect(collisions.length).toBe(0);
    });

    it("should prevent placement of object in collision zone", () => {
      const grid = new SpatialGridImpl(100, 100, 10);

      const obj1: GeometricObject = { id: "1", x: 50, y: 50, radius: 5 };
      grid.insert(obj1);

      const newObj: GeometricObject = { id: "2", x: 52, y: 50, radius: 5 };

      const validation = validatePlacement(newObj, grid);
      expect(validation.canPlace).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("should allow placement of object outside collision zone", () => {
      const grid = new SpatialGridImpl(100, 100, 10);

      const obj1: GeometricObject = { id: "1", x: 50, y: 50, radius: 5 };
      grid.insert(obj1);

      const newObj: GeometricObject = { id: "2", x: 80, y: 80, radius: 5 };

      const validation = validatePlacement(newObj, grid);
      expect(validation.canPlace).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it("should calculate correct overlap distance", () => {
      const grid = new SpatialGridImpl(100, 100, 10);

      const obj1: GeometricObject = { id: "1", x: 50, y: 50, radius: 5 };
      const obj2: GeometricObject = { id: "2", x: 57, y: 50, radius: 5 };

      grid.insert(obj1);
      grid.insert(obj2);

      const collisions = grid.detectAllCollisions();
      expect(collisions.length).toBeGreaterThan(0);

      // Distance between centers: 7, sum of radii: 10, overlap: 3
      const overlap = collisions[0].penetration;
      expect(overlap).toBeCloseTo(3, 0);
    });

    it("should handle multiple simultaneous collisions", () => {
      const grid = new SpatialGridImpl(100, 100, 10);

      const center: GeometricObject = { id: "center", x: 50, y: 50, radius: 5 };
      const obj1: GeometricObject = { id: "1", x: 52, y: 50, radius: 5 };
      const obj2: GeometricObject = { id: "2", x: 50, y: 52, radius: 5 };
      const obj3: GeometricObject = { id: "3", x: 48, y: 50, radius: 5 };

      grid.insert(center);
      grid.insert(obj1);
      grid.insert(obj2);
      grid.insert(obj3);

      const collisions = grid.detectAllCollisions();
      expect(collisions.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("4. Design Generation and Validation", () => {
    it("should generate valid design without collisions", async () => {
      if (!projectId) throw new Error("No project ID");

      // Create test plants
      const plants: Plant[] = [
        {
          id: "rose",
          name: "Rose",
          type: "flowering",
          cost: 10,
          margin: 8,
          visualScore: 9,
          maintenanceScore: 7,
          compatibilityScore: 8,
          minRadius: 0.5,
          maxRadius: 1.5,
          allowedZones: ["soil", "grass"],
        },
        {
          id: "grass_cover",
          name: "Grass Cover",
          type: "groundcover",
          cost: 5,
          margin: 4,
          visualScore: 6,
          maintenanceScore: 8,
          compatibilityScore: 9,
          minRadius: 0.3,
          maxRadius: 1,
          allowedZones: ["grass"],
        },
      ];

      // Generate design
      const design = generateBalancedDesign(plants, 100, 100, 10);

      expect(design).toBeDefined();
      expect(design.plants).toBeDefined();
      expect(design.plants.length).toBeGreaterThan(0);

      // Validate no collisions
      const grid = new SpatialGridImpl(100, 100, 10);
      for (const plant of design.plants) {
        grid.insert({
          id: plant.id,
          x: plant.position.x,
          y: plant.position.y,
          radius: plant.spacing,
        });
      }

      const collisions = grid.detectAllCollisions();
      expect(collisions.length).toBe(0);
    });

    it("should score plants correctly", () => {
      const plant: Plant = {
        id: "test",
        name: "Test Plant",
        type: "flowering",
        cost: 10,
        margin: 8,
        visualScore: 9,
        maintenanceScore: 7,
        compatibilityScore: 8,
        minRadius: 0.5,
        maxRadius: 1.5,
        allowedZones: ["soil"],
      };

      const weights = {
        margin: 0.4,
        visual: 0.3,
        maintenance: 0.1,
        compatibility: 0.2,
      };

      const score = scorePlant(plant, weights);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should validate design respects zone restrictions", () => {
      const zones = [
        {
          id: "zone1",
          type: "soil" as TerrainType,
          polygon: [
            { x: 0, y: 0 },
            { x: 50, y: 0 },
            { x: 50, y: 50 },
            { x: 0, y: 50 },
          ],
          area: 2500,
        },
        {
          id: "zone2",
          type: "concrete" as TerrainType,
          polygon: [
            { x: 50, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 50 },
            { x: 50, y: 50 },
          ],
          area: 2500,
        },
      ];

      const plants = [
        {
          id: "rose",
          position: { x: 25, y: 25 },
          type: "flowering",
          spacing: 2,
          zone: "zone1",
        },
      ];

      const validation = validateDesignByZones(plants, zones);
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe("5. Database Persistence", () => {
    it("should save plant to database", async () => {
      if (!projectId) throw new Error("No project ID");

      const result = await addPlant(projectId, testUserId, {
        name: "Test Rose",
        quantity: 5,
        position: { x: 25, y: 25 },
        metadata: { type: "flowering", color: "red" },
      });

      expect(result.success).toBe(true);
      expect(result.plantId).toBeDefined();
      expect(result.plantId).toBeGreaterThan(0);
    });

    it("should save measurement to database", async () => {
      if (!projectId) throw new Error("No project ID");

      const result = await addMeasurement(projectId, testUserId, {
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
        ],
        distance: 10,
        unit: "meters",
      });

      expect(result.success).toBe(true);
    });

    it("should retrieve measurements from database", async () => {
      if (!projectId) throw new Error("No project ID");

      const measurements = await getMeasurements(projectId, testUserId);
      expect(measurements).toBeDefined();
      expect(measurements.length).toBeGreaterThan(0);
    });

    it("should save quotation to database", async () => {
      if (!projectId) throw new Error("No project ID");

      const result = await addQuotation(projectId, testUserId, {
        items: [
          { name: "Rose", quantity: 5, unitCost: 10, totalCost: 50 },
          { name: "Labor", quantity: 1, unitCost: 100, totalCost: 100 },
        ],
        totalCost: 150,
        margin: 50,
        status: "draft",
      });

      expect(result.success).toBe(true);
    });

    it("should retrieve quotations from database", async () => {
      if (!projectId) throw new Error("No project ID");

      const quotations = await getQuotations(projectId, testUserId);
      expect(quotations).toBeDefined();
      expect(quotations.length).toBeGreaterThan(0);
    });
  });

  describe("6. Complete Workflow", () => {
    it("should complete full workflow: create → add data → validate → persist", async () => {
      if (!projectId) throw new Error("No project ID");

      // Step 1: Create project (already done)
      const project = await getProjectById(projectId, testUserId);
      expect(project).toBeDefined();

      // Step 2: Add plant
      const plantResult = await addPlant(projectId, testUserId, {
        name: "Workflow Test Plant",
        quantity: 3,
        position: { x: 50, y: 50 },
        metadata: { type: "shrub" },
      });
      expect(plantResult.success).toBe(true);

      // Step 3: Add measurement
      const measurementResult = await addMeasurement(projectId, testUserId, {
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 20, y: 0, z: 0 },
        ],
        distance: 20,
        unit: "meters",
      });
      expect(measurementResult.success).toBe(true);

      // Step 4: Add quotation
      const quotationResult = await addQuotation(projectId, testUserId, {
        items: [{ name: "Plant", quantity: 3, unitCost: 15, totalCost: 45 }],
        totalCost: 45,
        margin: 20,
        status: "draft",
      });
      expect(quotationResult.success).toBe(true);

      // Step 5: Update project status
      const updateResult = await updateProjectStatus(projectId, testUserId, "completed");
      expect(updateResult.success).toBe(true);

      // Step 6: Reload and verify all data persisted
      const reloadedProject = await getProjectById(projectId, testUserId);
      expect(reloadedProject?.status).toBe("completed");

      const measurements = await getMeasurements(projectId, testUserId);
      expect(measurements.length).toBeGreaterThan(0);

      const quotations = await getQuotations(projectId, testUserId);
      expect(quotations.length).toBeGreaterThan(0);
    });
  });
});
