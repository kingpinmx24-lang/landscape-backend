import { eq, and, desc } from "drizzle-orm";
import {
  projects,
  plants,
  measurements,
  quotations,
  type InsertProject,
  type InsertPlant,
  type InsertMeasurement,
  type InsertQuotation,
  type Project,
  type Plant,
  type Measurement,
  type Quotation,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  CreateProjectSchema,
  CreatePlantSchema,
  CreateMeasurementSchema,
  CreateQuotationSchema,
} from "../shared/schemas";

/**
 * ============================================================================
 * PROJECT QUERIES
 * ============================================================================
 */

/**
 * Get project by ID with all relations (plants, measurements, quotations)
 */
export async function getProjectById(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (result.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }

  const project = result[0];

  // Fetch all relations
  const projectPlants = await db
    .select()
    .from(plants)
    .where(eq(plants.projectId, projectId));

  const projectMeasurements = await db
    .select()
    .from(measurements)
    .where(eq(measurements.projectId, projectId));

  const projectQuotations = await db
    .select()
    .from(quotations)
    .where(eq(quotations.projectId, projectId));

  return {
    ...project,
    plants: projectPlants,
    measurements: projectMeasurements,
    quotations: projectQuotations,
  };
}

/**
 * List all projects for a user
 */
export async function listProjectsByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId));
}

/**
 * Create a new project
 */
export async function createProject(
  userId: number,
  data: {
    name: string;
    description?: string;
    terrain: Record<string, any>;
    status?: "draft" | "active" | "completed" | "archived";
    metadata?: Record<string, any>;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Validate input
  const validated = CreateProjectSchema.parse(data);

  const insertData: InsertProject = {
    userId,
    name: validated.name,
    description: validated.description || null,
    terrain: validated.terrain,
    status: (validated.status || "draft") as any,
    metadata: validated.metadata || null,
  };

  const result = await db.insert(projects).values(insertData);

  // Return the created project
  // For MySQL/TiDB, get the last insert ID
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
    if (recent.length === 0) throw new Error("Failed to create project");
    return recent[0];
  }
  return await getProjectById(projectId, userId);
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: number,
  userId: number,
  data: Partial<{
    name: string;
    description: string;
    terrain: Record<string, any>;
    status: "draft" | "active" | "completed" | "archived";
    metadata: Record<string, any>;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify ownership
  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }

  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.terrain !== undefined) updateData.terrain = data.terrain;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.metadata !== undefined) updateData.metadata = data.metadata;

  await db.update(projects).set(updateData).where(eq(projects.id, projectId));

  return await getProjectById(projectId, userId);
}

/**
 * Delete a project (cascades to plants, measurements, quotations)
 */
export async function deleteProject(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify ownership
  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }

  await db.delete(projects).where(eq(projects.id, projectId));

  return { success: true, projectId };
}

/**
 * ============================================================================
 * PLANT QUERIES
 * ============================================================================
 */

/**
 * Add a plant to a project
 */
export async function addPlant(
  projectId: number,
  userId: number,
  data: {
    name: string;
    quantity?: number;
    position: Record<string, any>;
    metadata: Record<string, any>;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify project ownership
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (project.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }

  // Validate input
  const validated = CreatePlantSchema.parse({
    projectId,
    ...data,
  });

  const insertData: InsertPlant = {
    projectId,
    name: validated.name,
    quantity: validated.quantity || 1,
    position: validated.position,
    metadata: validated.metadata,
  };

  const result = await db.insert(plants).values(insertData);

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
    if (recent.length === 0) throw new Error("Failed to add plant");
    return recent[0];
  }

  const createdPlant = await db
    .select()
    .from(plants)
    .where(eq(plants.id, plantId))
    .limit(1);

  return createdPlant[0];
}

/**
 * Update a plant
 */
export async function updatePlant(
  plantId: number,
  projectId: number,
  userId: number,
  data: Partial<{
    name: string;
    quantity: number;
    position: Record<string, any>;
    metadata: Record<string, any>;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify project ownership
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (project.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }

  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.metadata !== undefined) updateData.metadata = data.metadata;

  await db
    .update(plants)
    .set(updateData)
    .where(and(eq(plants.id, plantId), eq(plants.projectId, projectId)));

  const updated = await db
    .select()
    .from(plants)
    .where(eq(plants.id, plantId))
    .limit(1);

  return updated[0];
}

/**
 * ============================================================================
 * MEASUREMENT QUERIES
 * ============================================================================
 */

/**
 * Add a measurement to a project
 */
/**
 * Get a plant by ID
 */
export async function getPlantById(plantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(plants)
    .where(eq(plants.id, plantId))
    .limit(1);

  return result[0];
}

export async function addMeasurement(
  projectId: number,
  userId: number,
  data: {
    type: "distance" | "area" | "angle" | "height" | "custom";
    value: number;
    unit: string;
    description?: string;
    timestamp?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify project ownership
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (project.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }

  // Validate input
  const validated = CreateMeasurementSchema.parse({
    projectId,
    data,
  });

  const insertData: InsertMeasurement = {
    projectId,
    data: validated.data,
  };

  const result = await db.insert(measurements).values(insertData);

  let measurementId: number;
  if ((result as any).insertId) {
    measurementId = (result as any).insertId;
  } else if ((result as any)[0]?.insertId) {
    measurementId = (result as any)[0].insertId;
  } else {
    // Fallback: query the most recent measurement
    const recent = await db
      .select()
      .from(measurements)
      .where(eq(measurements.projectId, projectId))
      .orderBy(desc(measurements.createdAt))
      .limit(1);
    if (recent.length === 0) throw new Error("Failed to add measurement");
    return recent[0];
  }

  const created = await db
    .select()
    .from(measurements)
    .where(eq(measurements.id, measurementId))
    .limit(1);

  return created[0];
}

/**
 * Get measurements for a project
 */
export async function getMeasurements(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify project ownership
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (project.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }

  return await db
    .select()
    .from(measurements)
    .where(eq(measurements.projectId, projectId));
}

/**
 * ============================================================================
 * QUOTATION QUERIES
 * ============================================================================
 */

/**
 * Add a quotation to a project
 */
/**
 * Get a measurement by ID
 */
export async function getMeasurementById(measurementId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(measurements)
    .where(eq(measurements.id, measurementId))
    .limit(1);

  return result[0];
}

export async function addQuotation(
  projectId: number,
  userId: number,
  data: {
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
    totalCost: string;
    status?: "draft" | "sent" | "accepted" | "rejected" | "completed";
    metadata?: Record<string, any>;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify project ownership
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (project.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }

  // Validate input
  const validated = CreateQuotationSchema.parse({
    projectId,
    ...data,
  });

  const insertData: InsertQuotation = {
    projectId,
    items: validated.items,
    totalCost: validated.totalCost as any,
    status: (validated.status || "draft") as any,
    metadata: validated.metadata || null,
  };

  const result = await db.insert(quotations).values(insertData);

  let quotationId: number;
  if ((result as any).insertId) {
    quotationId = (result as any).insertId;
  } else if ((result as any)[0]?.insertId) {
    quotationId = (result as any)[0].insertId;
  } else {
    // Fallback: query the most recent quotation
    const recent = await db
      .select()
      .from(quotations)
      .where(eq(quotations.projectId, projectId))
      .orderBy(desc(quotations.createdAt))
      .limit(1);
    if (recent.length === 0) throw new Error("Failed to add quotation");
    return recent[0];
  }

  const created = await db
    .select()
    .from(quotations)
    .where(eq(quotations.id, quotationId))
    .limit(1);

  return created[0];
}

/**
 * Get quotations for a project
 */
export async function getQuotations(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify project ownership
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (project.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }

  return await db
    .select()
    .from(quotations)
    .where(eq(quotations.projectId, projectId));
}

/**
 * Update quotation status
 */
/**
 * Get a quotation by ID
 */
export async function getQuotationById(quotationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(quotations)
    .where(eq(quotations.id, quotationId))
    .limit(1);

  return result[0];
}

export async function updateQuotationStatus(
  quotationId: number,
  projectId: number,
  userId: number,
  status: "draft" | "sent" | "accepted" | "rejected" | "completed"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify project ownership
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (project.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }

  await db
    .update(quotations)
    .set({ status: status as any })
    .where(
      and(eq(quotations.id, quotationId), eq(quotations.projectId, projectId))
    );

  const updated = await db
    .select()
    .from(quotations)
    .where(eq(quotations.id, quotationId))
    .limit(1);

  return updated[0];
}
