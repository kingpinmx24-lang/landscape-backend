/**
 * ============================================================================
 * PERSISTENCE TYPES - COMPLETE PROJECT STATE
 * ============================================================================
 * 
 * Define la estructura completa para guardar y recuperar el estado del proyecto
 * incluyendo: terreno, diseño, configuración, flujo y cotización.
 */

import { z } from "zod";

/**
 * ============================================================================
 * TERRAIN PERSISTENCE
 * ============================================================================
 */

export const PersistedTerrainSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  unit: z.enum(["m", "ft", "cm", "mm"]),
  type: z.enum(["rectangular", "polygonal", "freeform"]),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(), // URL de imagen capturada
  imageData: z.string().optional(), // Base64 de imagen
  zones: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["soil", "grass", "concrete"]),
      polygon: z.array(z.object({ x: z.number(), y: z.number() })),
      area: z.number(),
      color: z.string(),
    })
  ).optional(),
});

export type PersistedTerrain = z.infer<typeof PersistedTerrainSchema>;

/**
 * ============================================================================
 * DESIGN PERSISTENCE
 * ============================================================================
 */

export const PersistedPlantSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number().optional(),
    rotation: z.number(),
    scale: z.number(),
  }),
  metadata: z.record(z.string(), z.any()).optional(),
  imageUrl: z.string().url().optional(),
  cost: z.number().nonnegative().optional(),
  margin: z.number().nonnegative().optional(),
});

export type PersistedPlant = z.infer<typeof PersistedPlantSchema>;

export const PersistedDesignSchema = z.object({
  plants: z.array(PersistedPlantSchema),
  designType: z.enum(["balanced", "premium", "high_profit"]).optional(),
  totalMargin: z.number().nonnegative().optional(),
  totalCost: z.number().nonnegative().optional(),
  visualScore: z.number().min(0).max(100).optional(),
  maintenanceScore: z.number().min(0).max(100).optional(),
  compatibilityScore: z.number().min(0).max(100).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type PersistedDesign = z.infer<typeof PersistedDesignSchema>;

/**
 * ============================================================================
 * QUOTATION PERSISTENCE
 * ============================================================================
 */

export const PersistedQuotationSchema = z.object({
  id: z.string(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().positive(),
      unitPrice: z.number().nonnegative(),
      subtotal: z.number().nonnegative(),
    })
  ),
  totalCost: z.number().nonnegative(),
  discount: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  finalTotal: z.number().nonnegative(),
  status: z.enum(["draft", "sent", "accepted", "rejected", "completed"]),
  notes: z.string().optional(),
  currency: z.string().default("USD"),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type PersistedQuotation = z.infer<typeof PersistedQuotationSchema>;

/**
 * ============================================================================
 * WORKFLOW PERSISTENCE
 * ============================================================================
 */

export const PersistedWorkflowSchema = z.object({
  currentStep: z.enum([
    "scan_terrain",
    "detect_zones",
    "generate_design",
    "adjust_live",
    "show_quotation",
    "save_project",
    "generate_pdf",
  ]),
  completedSteps: z.array(z.string()),
  failedSteps: z.array(z.string()),
  skippedSteps: z.array(z.string()),
  progress: z.number().min(0).max(100),
  stepData: z.record(z.string(), z.any()).optional(),
  startedAt: z.number(),
  lastUpdatedAt: z.number(),
});

export type PersistedWorkflow = z.infer<typeof PersistedWorkflowSchema>;

/**
 * ============================================================================
 * COMPLETE PROJECT PERSISTENCE
 * ============================================================================
 */

export const CompleteProjectPersistenceSchema = z.object({
  // Project metadata
  id: z.number().int().positive().optional(), // Generado por BD
  userId: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "completed", "archived"]).default("draft"),

  // Terrain state
  terrain: PersistedTerrainSchema,

  // Design state
  design: PersistedDesignSchema.optional(),

  // Quotation state
  quotation: PersistedQuotationSchema.optional(),

  // Workflow state
  workflow: PersistedWorkflowSchema.optional(),

  // Editor state
  editorState: z.object({
    selectedObjectIds: z.array(z.string()),
    currentTool: z.enum(["select", "move", "rotate", "scale", "delete", "measure"]).optional(),
    gridSize: z.number().positive().optional(),
    snapEnabled: z.boolean().default(true),
    showMeasurements: z.boolean().default(true),
  }).optional(),

  // Metadata
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  clientName: z.string().optional(),
  clientEmail: z.string().optional(),
  clientPhone: z.string().optional(),

  // Timestamps
  createdAt: z.number(),
  updatedAt: z.number(),
  lastAccessedAt: z.number().optional(),

  // Version
  version: z.number().default(1),
});

export type CompleteProjectPersistence = z.infer<typeof CompleteProjectPersistenceSchema>;

/**
 * ============================================================================
 * SAVE/LOAD RESPONSES
 * ============================================================================
 */

export const SaveProjectResponseSchema = z.object({
  success: z.boolean(),
  projectId: z.number().int().positive(),
  version: z.number(),
  savedAt: z.number(),
  message: z.string().optional(),
});

export type SaveProjectResponse = z.infer<typeof SaveProjectResponseSchema>;

export const LoadProjectResponseSchema = z.object({
  success: z.boolean(),
  project: CompleteProjectPersistenceSchema,
  loadedAt: z.number(),
  message: z.string().optional(),
});

export type LoadProjectResponse = z.infer<typeof LoadProjectResponseSchema>;

/**
 * ============================================================================
 * VALIDATION HELPERS
 * ============================================================================
 */

export function validateProjectPersistence(data: unknown): { valid: boolean; errors: string[] } {
  try {
    CompleteProjectPersistenceSchema.parse(data);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((issue: any) => `${issue.path.join(".")}: ${issue.message}`);
      return { valid: false, errors };
    }
    return { valid: false, errors: ["Unknown validation error"] };
  }
}

export function sanitizeProjectForStorage(project: CompleteProjectPersistence): CompleteProjectPersistence {
  // Remover datos sensibles antes de guardar
  const sanitized = { ...project };
  
  // Remover URLs de imágenes si es necesario (guardar solo base64)
  if (sanitized.terrain.imageUrl && sanitized.terrain.imageData) {
    delete sanitized.terrain.imageUrl;
  }

  return sanitized;
}

export function reconstructProjectState(project: CompleteProjectPersistence) {
  // Reconstruir estado completo para frontend
  return {
    project,
    terrain: project.terrain,
    design: project.design,
    quotation: project.quotation,
    workflow: project.workflow,
    editorState: project.editorState,
    metadata: {
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt),
      lastAccessedAt: project.lastAccessedAt ? new Date(project.lastAccessedAt) : null,
    },
  };
}
