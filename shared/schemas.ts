import { z } from "zod";

/**
 * ============================================================================
 * TERRAIN SCHEMA
 * ============================================================================
 */

export const TerrainSchema = z.object({
  width: z.number().positive("Width must be positive"),
  height: z.number().positive("Height must be positive"),
  unit: z.enum(["m", "ft", "cm", "mm"]).default("m"),
  type: z.enum(["rectangular", "polygonal", "freeform"]).default("rectangular"),
  description: z.string().optional(),
});

export type Terrain = z.infer<typeof TerrainSchema>;

/**
 * ============================================================================
 * PLANT SCHEMA
 * ============================================================================
 */

export const PlantPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number().optional().default(0),
  rotation: z.number().optional().default(0),
  scale: z.number().positive().optional().default(1),
});

export type PlantPosition = z.infer<typeof PlantPositionSchema>;

export const PlantMetadataSchema = z.object({
  species: z.string().optional(),
  commonName: z.string().optional(),
  height: z.number().positive().optional(),
  width: z.number().positive().optional(),
  color: z.string().optional(),
  unitCost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export type PlantMetadata = z.infer<typeof PlantMetadataSchema>;

export const CreatePlantSchema = z.object({
  projectId: z.number().int().positive(),
  name: z.string().min(1, "Plant name is required").max(255),
  quantity: z.number().int().positive().default(1),
  position: PlantPositionSchema,
  metadata: PlantMetadataSchema,
});

export type CreatePlant = z.infer<typeof CreatePlantSchema>;

export const UpdatePlantSchema = CreatePlantSchema.partial().extend({
  id: z.number().int().positive(),
});

export type UpdatePlant = z.infer<typeof UpdatePlantSchema>;

/**
 * ============================================================================
 * MEASUREMENT SCHEMA
 * ============================================================================
 */

export const MeasurementDataSchema = z.object({
  type: z.enum(["distance", "area", "angle", "height", "custom"]),
  value: z.number(),
  unit: z.string(),
  description: z.string().optional(),
  timestamp: z.number().optional(),
});

export type MeasurementData = z.infer<typeof MeasurementDataSchema>;

export const CreateMeasurementSchema = z.object({
  projectId: z.number().int().positive(),
  data: MeasurementDataSchema,
});

export type CreateMeasurement = z.infer<typeof CreateMeasurementSchema>;

/**
 * ============================================================================
 * QUOTATION SCHEMA
 * ============================================================================
 */

export const QuotationItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
});

export type QuotationItem = z.infer<typeof QuotationItemSchema>;

export const QuotationMetadataSchema = z.object({
  notes: z.string().optional(),
  discount: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  currency: z.string().default("USD"),
});

export type QuotationMetadata = z.infer<typeof QuotationMetadataSchema>;

export const CreateQuotationSchema = z.object({
  projectId: z.number().int().positive(),
  items: z.array(QuotationItemSchema).min(1, "At least one item is required"),
  totalCost: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid total cost format"),
  status: z.enum(["draft", "sent", "accepted", "rejected", "completed"]).default("draft"),
  metadata: QuotationMetadataSchema.optional(),
});

export type CreateQuotation = z.infer<typeof CreateQuotationSchema>;

export const UpdateQuotationSchema = CreateQuotationSchema.partial().extend({
  id: z.number().int().positive(),
});

export type UpdateQuotation = z.infer<typeof UpdateQuotationSchema>;

/**
 * ============================================================================
 * PROJECT SCHEMA
 * ============================================================================
 */

export const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(255),
  description: z.string().optional(),
  terrain: TerrainSchema,
  status: z.enum(["draft", "active", "completed", "archived"]).default("draft"),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type CreateProject = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  id: z.number().int().positive(),
});

export type UpdateProject = z.infer<typeof UpdateProjectSchema>;

/**
 * ============================================================================
 * COMPLETE PROJECT SCHEMA (with all relations)
 * ============================================================================
 */

export const CompleteProjectSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  name: z.string(),
  description: z.string().nullable(),
  terrain: z.record(z.string(), z.any()),
  status: z.enum(["draft", "active", "completed", "archived"]),
  metadata: z.record(z.string(), z.any()).nullable(),
  plants: z.array(
    z.object({
      id: z.number(),
      projectId: z.number(),
      name: z.string(),
      quantity: z.number(),
      position: z.record(z.string(), z.any()),
      metadata: z.record(z.string(), z.any()),
      createdAt: z.date(),
      updatedAt: z.date(),
    })
  ),
  measurements: z.array(
    z.object({
      id: z.number(),
      projectId: z.number(),
      data: z.record(z.string(), z.any()),
      createdAt: z.date(),
      updatedAt: z.date(),
    })
  ),
  quotations: z.array(
    z.object({
      id: z.number(),
      projectId: z.number(),
      totalCost: z.string(),
      items: z.array(z.record(z.string(), z.any())),
      status: z.enum(["draft", "sent", "accepted", "rejected", "completed"]),
      metadata: z.record(z.string(), z.any()).nullable(),
      createdAt: z.date(),
      updatedAt: z.date(),
    })
  ),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CompleteProject = z.infer<typeof CompleteProjectSchema>;
