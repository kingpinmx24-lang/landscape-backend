/**
 * ============================================================================
 * REFACTORED QUERIES - STANDARDIZED RESPONSES
 * ============================================================================
 * All database operations return standardized API responses
 */

import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { projects, plants, measurements, quotations } from "../drizzle/schema";
import { CreateProjectSchema, CreatePlantSchema, CreateMeasurementSchema, CreateQuotationSchema } from "../shared/schemas";
import { successResponse, errorResponse, type ApiResponse } from "./response-helpers";
import { getDb } from "./db";

/**
 * CREATE PROJECT
 * ============================================================================
 */
export async function createProjectRefactored(
  userId: number,
  data: {
    name: string;
    description?: string;
    terrain: Record<string, any>;
    status?: "draft" | "active" | "completed" | "archived";
    metadata?: Record<string, any>;
  }
): Promise<ApiResponse<{ projectId: number }>> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResponse("Database not available");
    }

    // Validate input
    const validated = CreateProjectSchema.parse(data);

    const insertData = {
      userId,
      name: validated.name,
      description: validated.description || null,
      terrain: validated.terrain,
      status: (validated.status || "draft") as any,
      metadata: validated.metadata || null,
    };

    const result = await db.insert(projects).values(insertData);

    // Get the created project ID
    let projectId: number;
    if ((result as any).insertId) {
      projectId = (result as any).insertId;
    } else if ((result as any)[0]?.insertId) {
      projectId = (result as any)[0].insertId;
    } else {
      // Fallback: query the most recent project
      const recent = await db
        .select()
        .from(projects)
        .where(eq(projects.userId, userId))
        .orderBy(desc(projects.createdAt))
        .limit(1);

      if (recent.length === 0) {
        return errorResponse("Failed to create project");
      }
      projectId = recent[0].id;
    }

    return successResponse({ projectId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project";
    console.error("[createProject] Error:", message);
    return errorResponse(message);
  }
}

/**
 * GET PROJECT BY ID
 * ============================================================================
 */
export async function getProjectByIdRefactored(
  projectId: number,
  userId: number
): Promise<ApiResponse<any>> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResponse("Database not available");
    }

    const result = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (result.length === 0) {
      return errorResponse("Project not found");
    }

    const project = result[0];

    // Verify ownership
    if (project.userId !== userId) {
      return errorResponse("Unauthorized access to this project");
    }

    return successResponse(project);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get project";
    console.error("[getProjectById] Error:", message);
    return errorResponse(message);
  }
}

/**
 * LIST PROJECTS BY USER
 * ============================================================================
 */
export async function listProjectsByUserRefactored(
  userId: number
): Promise<ApiResponse<any[]>> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResponse("Database not available");
    }

    const result = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.createdAt));

    return successResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list projects";
    console.error("[listProjectsByUser] Error:", message);
    return errorResponse(message);
  }
}

/**
 * UPDATE PROJECT
 * ============================================================================
 */
export async function updateProjectRefactored(
  projectId: number,
  userId: number,
  data: Partial<{
    name: string;
    description: string;
    terrain: Record<string, any>;
    status: "draft" | "active" | "completed" | "archived";
    metadata: Record<string, any>;
  }>
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResponse("Database not available");
    }

    // Verify ownership
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return errorResponse("Project not found");
    }

    if (project[0].userId !== userId) {
      return errorResponse("Unauthorized access to this project");
    }

    // Update project
    await db.update(projects).set(data).where(eq(projects.id, projectId));

    return successResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project";
    console.error("[updateProject] Error:", message);
    return errorResponse(message);
  }
}

/**
 * DELETE PROJECT
 * ============================================================================
 */
export async function deleteProjectRefactored(
  projectId: number,
  userId: number
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResponse("Database not available");
    }

    // Verify ownership
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return errorResponse("Project not found");
    }

    if (project[0].userId !== userId) {
      return errorResponse("Unauthorized access to this project");
    }

    // Delete project (cascade delete handled by database)
    await db.delete(projects).where(eq(projects.id, projectId));

    return successResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete project";
    console.error("[deleteProject] Error:", message);
    return errorResponse(message);
  }
}

/**
 * ADD PLANT
 * ============================================================================
 */
export async function addPlantRefactored(
  projectId: number,
  userId: number,
  data: {
    name: string;
    quantity: number;
    position: { x: number; y: number };
    metadata?: Record<string, any>;
  }
): Promise<ApiResponse<{ plantId: number }>> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResponse("Database not available");
    }

    // Verify project ownership
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return errorResponse("Project not found");
    }

    if (project[0].userId !== userId) {
      return errorResponse("Unauthorized access to this project");
    }

    // Validate input
    const validated = CreatePlantSchema.parse(data);

    const insertData = {
      projectId,
      name: validated.name,
      quantity: validated.quantity,
      position: validated.position,
      metadata: validated.metadata || null,
    };

    const result = await db.insert(plants).values(insertData);

    // Get the created plant ID
    let plantId: number;
    if ((result as any).insertId) {
      plantId = (result as any).insertId;
    } else if ((result as any)[0]?.insertId) {
      plantId = (result as any)[0].insertId;
    } else {
      // Fallback: query the most recent plant
      const recent = await db
        .select()
        .from(plants)
        .where(eq(plants.projectId, projectId))
        .orderBy(desc(plants.createdAt))
        .limit(1);

      if (recent.length === 0) {
        return errorResponse("Failed to create plant");
      }
      plantId = recent[0].id;
    }

    return successResponse({ plantId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add plant";
    console.error("[addPlant] Error:", message);
    return errorResponse(message);
  }
}

/**
 * GET MEASUREMENTS
 * ============================================================================
 */
export async function getMeasurementsRefactored(
  projectId: number,
  userId: number
): Promise<ApiResponse<any[]>> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResponse("Database not available");
    }

    // Verify project ownership
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return errorResponse("Project not found");
    }

    if (project[0].userId !== userId) {
      return errorResponse("Unauthorized access to this project");
    }

    const result = await db
      .select()
      .from(measurements)
      .where(eq(measurements.projectId, projectId))
      .orderBy(desc(measurements.createdAt));

    return successResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get measurements";
    console.error("[getMeasurements] Error:", message);
    return errorResponse(message);
  }
}

/**
 * ADD MEASUREMENT
 * ============================================================================
 */
export async function addMeasurementRefactored(
  projectId: number,
  userId: number,
  data: {
    type: "distance" | "area" | "angle" | "height" | "custom";
    value: number;
    unit: string;
    description?: string;
    timestamp?: number;
  }
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResponse("Database not available");
    }

    // Verify project ownership
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return errorResponse("Project not found");
    }

    if (project[0].userId !== userId) {
      return errorResponse("Unauthorized access to this project");
    }

    // Validate input
    const validated = CreateMeasurementSchema.parse(data);

    const insertData = {
      projectId,
      data: validated,
    };

    await db.insert(measurements).values(insertData);

    return successResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add measurement";
    console.error("[addMeasurement] Error:", message);
    return errorResponse(message);
  }
}

/**
 * GET QUOTATIONS
 * ============================================================================
 */
export async function getQuotationsRefactored(
  projectId: number,
  userId: number
): Promise<ApiResponse<any[]>> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResponse("Database not available");
    }

    // Verify project ownership
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return errorResponse("Project not found");
    }

    if (project[0].userId !== userId) {
      return errorResponse("Unauthorized access to this project");
    }

    const result = await db
      .select()
      .from(quotations)
      .where(eq(quotations.projectId, projectId))
      .orderBy(desc(quotations.createdAt));

    return successResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get quotations";
    console.error("[getQuotations] Error:", message);
    return errorResponse(message);
  }
}

/**
 * ADD QUOTATION
 * ============================================================================
 */
export async function addQuotationRefactored(
  projectId: number,
  userId: number,
  data: {
    items: Array<{ description: string; quantity: number; unitPrice: number; subtotal: number }>;
    totalCost: number;
    status: "draft" | "sent" | "accepted" | "rejected" | "completed";
    metadata?: { notes?: string; discount?: number; tax?: number; currency?: string };
  }
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResponse("Database not available");
    }

    // Verify project ownership
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return errorResponse("Project not found");
    }

    if (project[0].userId !== userId) {
      return errorResponse("Unauthorized access to this project");
    }

    // Validate input
    const validated = CreateQuotationSchema.parse(data);

    const insertData = {
      projectId,
      items: validated.items,
      totalCost: validated.totalCost,
      status: validated.status as any,
      metadata: validated.metadata || null,
    };

    await db.insert(quotations).values(insertData);

    return successResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add quotation";
    console.error("[addQuotation] Error:", message);
    return errorResponse(message);
  }
}

/**
 * UPDATE PROJECT STATUS
 * ============================================================================
 */
export async function updateProjectStatusRefactored(
  projectId: number,
  userId: number,
  status: "draft" | "active" | "completed" | "archived"
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResponse("Database not available");
    }

    // Verify project ownership
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return errorResponse("Project not found");
    }

    if (project[0].userId !== userId) {
      return errorResponse("Unauthorized access to this project");
    }

    // Update status
    await db.update(projects).set({ status: status as any }).where(eq(projects.id, projectId));

    return successResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project status";
    console.error("[updateProjectStatus] Error:", message);
    return errorResponse(message);
  }
}
