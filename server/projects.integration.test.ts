import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * ============================================================================
 * INTEGRATION TESTS: Complete Project Lifecycle
 * ============================================================================
 *
 * Tests the full cycle:
 * 1. Create project with terrain
 * 2. Add plants with positions and metadata
 * 3. Add measurements
 * 4. Add quotations
 * 5. Reload project
 * 6. Verify all data persisted correctly
 * 7. Update and delete operations
 */

// Mock context for authenticated user
function createMockContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-123",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Projects Integration Tests", () => {
  let ctx: TrpcContext;
  let caller: ReturnType<typeof appRouter.createCaller>;
  let projectId: number;

  beforeAll(() => {
    ctx = createMockContext();
    caller = appRouter.createCaller(ctx);
  });

  afterAll(async () => {
    // Cleanup: delete test project if it exists
    if (projectId) {
      try {
        await caller.projects.delete({ id: projectId });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe("Project CRUD Operations", () => {
    it("should create a project with terrain", async () => {
      const result = await caller.projects.create({
        name: "Test Landscape Project",
        description: "A test project for integration testing",
        terrain: {
          width: 100,
          height: 50,
          unit: "m",
          type: "rectangular",
        },
        status: "draft",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(ctx.user.id);
      expect(result.name).toBe("Test Landscape Project");
      expect(result.status).toBe("draft");
      expect(result.terrain).toEqual({
        width: 100,
        height: 50,
        unit: "m",
        type: "rectangular",
      });

      projectId = result.id || 0;
    });

    it("should list projects for the user", async () => {
      const projects = await caller.projects.list();

      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);
      expect(projects.some((p) => p.id === projectId)).toBe(true);
    });

    it("should get a specific project", async () => {
      const project = await caller.projects.get({ id: projectId });

      expect(project).toBeDefined();
      expect(project.id).toBe(projectId);
      expect(project.name).toBe("Test Landscape Project");
      expect(project.plants).toEqual([]);
      expect(project.measurements).toEqual([]);
      expect(project.quotations).toEqual([]);
    });

    it("should update project", async () => {
      const updated = await caller.projects.update({
        id: projectId,
        data: {
          name: "Updated Landscape Project",
          status: "active",
        },
      });

      expect(updated.name).toBe("Updated Landscape Project");
      expect(updated.status).toBe("active");
    });
  });

  describe("Plant Operations", () => {
    it("should add a plant to the project", async () => {
      const plant = await caller.projects.addPlant({
        projectId,
        name: "Rose Bush",
        quantity: 3,
        position: {
          x: 10,
          y: 20,
          z: 0,
          rotation: 0,
          scale: 1,
        },
        metadata: {
          species: "Rosa damascena",
          commonName: "Damask Rose",
          height: 1.5,
          width: 1.2,
          color: "red",
          unitCost: 25.5,
        },
      });

      expect(plant).toBeDefined();
      expect(plant.id).toBeDefined();
      expect(plant.projectId).toBe(projectId);
      expect(plant.name).toBe("Rose Bush");
      expect(plant.quantity).toBe(3);
      expect(plant.position.x).toBe(10);
      expect(plant.metadata.species).toBe("Rosa damascena");
    });

    it("should add multiple plants", async () => {
      const plant2 = await caller.projects.addPlant({
        projectId,
        name: "Lavender",
        quantity: 5,
        position: {
          x: 30,
          y: 15,
          z: 0,
        },
        metadata: {
          species: "Lavandula angustifolia",
          commonName: "English Lavender",
          height: 0.6,
          width: 0.5,
          color: "purple",
          unitCost: 12.0,
        },
      });

      expect(plant2.name).toBe("Lavender");
      expect(plant2.quantity).toBe(5);
    });

    it("should reload project and verify plants persisted", async () => {
      const project = await caller.projects.get({ id: projectId });

      expect(project.plants).toHaveLength(2);
      expect(project.plants[0].name).toBe("Rose Bush");
      expect(project.plants[1].name).toBe("Lavender");
    });
  });

  describe("Measurement Operations", () => {
    it("should add measurements to the project", async () => {
      const measurement = await caller.projects.addMeasurement({
        projectId,
        type: "area",
        value: 5000,
        unit: "m²",
        description: "Total project area",
      });

      expect(measurement).toBeDefined();
      expect(measurement.id).toBeDefined();
      expect(measurement.projectId).toBe(projectId);
      expect(measurement.data.type).toBe("area");
      expect(measurement.data.value).toBe(5000);
    });

    it("should get measurements for the project", async () => {
      const measurements = await caller.projects.getMeasurements({
        projectId,
      });

      expect(Array.isArray(measurements)).toBe(true);
      expect(measurements.length).toBeGreaterThan(0);
      expect(measurements[0].data.type).toBe("area");
    });

    it("should reload project and verify measurements persisted", async () => {
      const project = await caller.projects.get({ id: projectId });

      expect(project.measurements.length).toBeGreaterThan(0);
      expect(project.measurements[0].data.type).toBe("area");
    });
  });

  describe("Quotation Operations", () => {
    it("should add a quotation to the project", async () => {
      const quotation = await caller.projects.addQuotation({
        projectId,
        items: [
          {
            description: "Rose Bushes (3 units)",
            quantity: 3,
            unitPrice: 25.5,
            subtotal: 76.5,
          },
          {
            description: "Lavender Plants (5 units)",
            quantity: 5,
            unitPrice: 12.0,
            subtotal: 60.0,
          },
          {
            description: "Soil and Mulch",
            quantity: 1,
            unitPrice: 150.0,
            subtotal: 150.0,
          },
        ],
        totalCost: "286.50",
        status: "draft",
        metadata: {
          notes: "Initial quotation for landscape project",
          currency: "USD",
        },
      });

      expect(quotation).toBeDefined();
      expect(quotation.id).toBeDefined();
      expect(quotation.projectId).toBe(projectId);
      expect(quotation.status).toBe("draft");
      expect(quotation.items).toHaveLength(3);
      expect(quotation.totalCost).toBe("286.50");
    });

    it("should update quotation status", async () => {
      const quotations = await caller.projects.getQuotations({ projectId });
      const quotationId = quotations[0].id;

      const updated = await caller.projects.updateQuotationStatus({
        quotationId,
        projectId,
        status: "sent",
      });

      expect(updated.status).toBe("sent");
    });

    it("should get quotations for the project", async () => {
      const quotations = await caller.projects.getQuotations({ projectId });

      expect(Array.isArray(quotations)).toBe(true);
      expect(quotations.length).toBeGreaterThan(0);
      expect(quotations[0].status).toBe("sent");
    });

    it("should reload project and verify quotations persisted", async () => {
      const project = await caller.projects.get({ id: projectId });

      expect(project.quotations.length).toBeGreaterThan(0);
      expect(project.quotations[0].items).toHaveLength(3);
      expect(project.quotations[0].status).toBe("sent");
    });
  });

  describe("Complete Project Persistence", () => {
    it("should reload project and verify all data intact", async () => {
      const project = await caller.projects.get({ id: projectId });

      // Verify project data
      expect(project.id).toBe(projectId);
      expect(project.name).toBe("Updated Landscape Project");
      expect(project.status).toBe("active");

      // Verify plants
      expect(project.plants).toHaveLength(2);
      expect(project.plants[0].name).toBe("Rose Bush");
      expect(project.plants[0].quantity).toBe(3);
      expect(project.plants[1].name).toBe("Lavender");
      expect(project.plants[1].quantity).toBe(5);

      // Verify measurements
      expect(project.measurements.length).toBeGreaterThan(0);
      expect(project.measurements[0].data.type).toBe("area");
      expect(project.measurements[0].data.value).toBe(5000);

      // Verify quotations
      expect(project.quotations.length).toBeGreaterThan(0);
      expect(project.quotations[0].items).toHaveLength(3);
      expect(project.quotations[0].status).toBe("sent");
      expect(project.quotations[0].totalCost).toBe("286.50");
    });
  });

  describe("Multiple Projects Simultaneously", () => {
    let projectId2: number;

    it("should create a second project", async () => {
      const project = await caller.projects.create({
        name: "Second Project",
        terrain: {
          width: 200,
          height: 100,
          unit: "m",
          type: "polygonal",
        },
      });

      expect(project.name).toBe("Second Project");
      projectId2 = project.id;
    });

    it("should add plants to second project", async () => {
      const plant = await caller.projects.addPlant({
        projectId: projectId2,
        name: "Oak Tree",
        quantity: 2,
        position: { x: 50, y: 50 },
        metadata: {
          species: "Quercus robur",
          height: 8,
        },
      });

      expect(plant.projectId).toBe(projectId2);
    });

    it("should list both projects", async () => {
      const projects = await caller.projects.list();

      expect(projects.length).toBeGreaterThanOrEqual(2);
      expect(projects.some((p) => p.id === projectId)).toBe(true);
      expect(projects.some((p) => p.id === projectId2)).toBe(true);
    });

    it("should verify projects are independent", async () => {
      const project1 = await caller.projects.get({ id: projectId });
      const project2 = await caller.projects.get({ id: projectId2 });

      expect(project1.plants).toHaveLength(2);
      expect(project2.plants).toHaveLength(1);
      expect(project1.plants[0].name).toBe("Rose Bush");
      expect(project2.plants[0].name).toBe("Oak Tree");
    });

    it("should cleanup second project", async () => {
      if (projectId2) {
        const result = await caller.projects.delete({ id: projectId2 });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Error Handling", () => {
    it("should reject unauthorized access to other user's project", async () => {
      const otherUserCtx = createMockContext();
      otherUserCtx.user.id = 999;
      const otherCaller = appRouter.createCaller(otherUserCtx);

      try {
        await otherCaller.projects.get({ id: projectId });
        expect.fail("Should have thrown an error");
      } catch (error) {
        // Either NOT_FOUND or INTERNAL_SERVER_ERROR is acceptable
        expect(["NOT_FOUND", "INTERNAL_SERVER_ERROR"]).toContain((error as any).code);
      }
    });

    it("should validate required fields", async () => {
      try {
        await caller.projects.create({
          name: "",
          terrain: {
            width: -10,
            height: 50,
            unit: "m",
            type: "rectangular",
          },
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        // Validation errors should be caught
        expect((error as any).code).toBeDefined();
      }
    });

    it("should handle invalid plant position", async () => {
      try {
        await caller.projects.addPlant({
          projectId,
          name: "Invalid Plant",
          quantity: 1,
          position: {
            x: "invalid" as any,
            y: 20,
          },
          metadata: {},
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        // Validation errors should be caught
        expect((error as any).code).toBeDefined();
      }
    });
  });
});
