/**
 * Surface Editor Types
 * ============================================================================
 * Módulo independiente para edición visual de terreno
 * No modifica módulos existentes
 */

import { z } from "zod";

/**
 * Tipos de superficie del terreno
 */
export enum SurfaceType {
  GRASS = "grass",
  SOIL = "soil",
  CONCRETE = "concrete",
  GRAVEL = "gravel",
  DEGRADED = "degraded", // Basura o descuidado
}

/**
 * Herramientas disponibles en Surface Editor
 */
export enum SurfaceToolType {
  SELECT = "select",
  BRUSH = "brush",
  CLEAN = "clean",
  APPLY_GRASS = "apply_grass",
  APPLY_GRAVEL = "apply_gravel",
  APPLY_SOIL = "apply_soil",
  UNDO = "undo",
  REDO = "redo",
}

/**
 * Acción de edición de superficie
 */
export interface SurfaceEditAction {
  id: string;
  type: SurfaceToolType;
  surfaceType?: SurfaceType;
  pixels: Array<{ x: number; y: number }>;
  timestamp: number;
  canUndo: boolean;
}

/**
 * Estado de una zona editada
 */
export interface EditedZone {
  id: string;
  type: SurfaceType;
  pixels: Set<string>; // "x,y" format
  polygon?: Array<{ x: number; y: number }>;
  area: number; // en metros cuadrados
  createdAt: number;
  modifiedAt: number;
}

/**
 * Estado del Surface Editor
 */
export interface SurfaceEditorState {
  // Imagen base
  baseImageUrl: string;
  baseImageData?: ImageData;
  canvasWidth: number;
  canvasHeight: number;

  // Herramienta actual
  currentTool: SurfaceToolType;
  brushSize: number; // 1-50 píxeles

  // Zonas editadas
  editedZones: Map<string, EditedZone>;
  selectedZoneId: string | null;

  // Historial
  history: SurfaceEditAction[];
  historyIndex: number;

  // Configuración
  showGrid: boolean;
  gridSize: number;
  opacity: number; // 0-1
  showOriginal: boolean; // Mostrar imagen original

  // Estado
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
}

/**
 * Costo de superficie
 */
export interface SurfaceCost {
  type: SurfaceType;
  costPerSquareMeter: number;
  laborCost: number;
  description: string;
}

/**
 * Resumen de cambios de superficie
 */
export interface SurfaceChangeSummary {
  originalSurfaces: Map<SurfaceType, number>; // área por tipo
  editedSurfaces: Map<SurfaceType, number>; // área por tipo
  totalCost: number;
  laborCost: number;
  cleaningCost: number;
  changes: Array<{
    from: SurfaceType;
    to: SurfaceType;
    area: number;
    cost: number;
  }>;
}

/**
 * Configuración del Surface Editor
 */
export interface SurfaceEditorConfig {
  maxBrushSize: number;
  minBrushSize: number;
  defaultBrushSize: number;
  gridSize: number;
  undoStackSize: number;
  textureQuality: "low" | "medium" | "high";
  enableSmoothing: boolean;
  enableAntiAlias: boolean;
}

/**
 * Schemas de validación
 */
export const SurfaceTypeSchema = z.enum([
  SurfaceType.GRASS,
  SurfaceType.SOIL,
  SurfaceType.CONCRETE,
  SurfaceType.GRAVEL,
  SurfaceType.DEGRADED,
]);

export const SurfaceToolTypeSchema = z.enum([
  SurfaceToolType.SELECT,
  SurfaceToolType.BRUSH,
  SurfaceToolType.CLEAN,
  SurfaceToolType.APPLY_GRASS,
  SurfaceToolType.APPLY_GRAVEL,
  SurfaceToolType.APPLY_SOIL,
  SurfaceToolType.UNDO,
  SurfaceToolType.REDO,
]);

export const EditedZoneSchema = z.object({
  id: z.string(),
  type: SurfaceTypeSchema,
  area: z.number().positive(),
  createdAt: z.number(),
  modifiedAt: z.number(),
});

export const SurfaceEditorStateSchema = z.object({
  baseImageUrl: z.string().url(),
  canvasWidth: z.number().positive(),
  canvasHeight: z.number().positive(),
  currentTool: SurfaceToolTypeSchema,
  brushSize: z.number().min(1).max(50),
  selectedZoneId: z.string().nullable(),
  showGrid: z.boolean(),
  gridSize: z.number().positive(),
  opacity: z.number().min(0).max(1),
  showOriginal: z.boolean(),
  isDirty: z.boolean(),
  isSaving: z.boolean(),
  error: z.string().nullable(),
});

export const SurfaceCostSchema = z.object({
  type: SurfaceTypeSchema,
  costPerSquareMeter: z.number().nonnegative(),
  laborCost: z.number().nonnegative(),
  description: z.string(),
});

export const SurfaceChangeSummarySchema = z.object({
  totalCost: z.number().nonnegative(),
  laborCost: z.number().nonnegative(),
  cleaningCost: z.number().nonnegative(),
});

export type SurfaceEditorStateType = z.infer<typeof SurfaceEditorStateSchema>;
export type EditedZoneType = z.infer<typeof EditedZoneSchema>;
export type SurfaceCostType = z.infer<typeof SurfaceCostSchema>;
export type SurfaceChangeSummaryType = z.infer<typeof SurfaceChangeSummarySchema>;
