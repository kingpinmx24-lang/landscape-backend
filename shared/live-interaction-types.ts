/**
 * Live Interaction System Types
 * ============================================================================
 * Tipos para manipulación en vivo del diseño en canvas
 */

import { z } from "zod";

/**
 * Estados de selección
 */
export enum SelectionMode {
  NONE = "none",
  SINGLE = "single",
  MULTIPLE = "multiple",
  AREA = "area",
}

/**
 * Tipos de acciones en vivo
 */
export enum LiveActionType {
  SELECT = "select",
  MOVE = "move",
  DELETE = "delete",
  CHANGE_TYPE = "change_type",
  DUPLICATE = "duplicate",
  APPLY_MATERIAL = "apply_material",
  CLEAN_AREA = "clean_area",
  ADD_OBJECT = "add_object",
  UNDO = "undo",
  REDO = "redo",
}

/**
 * Objeto seleccionado
 */
export interface SelectedObject {
  id: string;
  type: string; // "plant", "tree", "shrub", etc.
  x: number;
  y: number;
  radius: number;
  rotation?: number;
  scale?: number;
  imageUrl?: string; // URL de imagen PNG de la planta
  metadata?: Record<string, unknown>;
}

/**
 * Estado de interacción en vivo
 */
export interface LiveInteractionState {
  // Selección
  selectedObjects: SelectedObject[];
  selectionMode: SelectionMode;
  
  // Movimiento
  isDragging: boolean;
  dragStartX?: number;
  dragStartY?: number;
  dragOffsetX?: number;
  dragOffsetY?: number;
  
  // Controles flotantes
  showFloatingControls: boolean;
  floatingControlsX?: number;
  floatingControlsY?: number;
  
  // Edición de materiales
  selectedMaterial?: string;
  selectedArea?: Array<{ x: number; y: number }>;
  
  // Historial
  history: LiveAction[];
  historyIndex: number;
  
  // Estado UI
  isLoading: boolean;
  error?: string;
  lastUpdate: number;
}

/**
 * Acción en vivo (para undo/redo)
 */
export interface LiveAction {
  type: LiveActionType;
  timestamp: number;
  data: Record<string, unknown>;
  previousState?: Record<string, unknown>;
}

/**
 * Datos de movimiento
 */
export interface MoveData {
  objectId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  snappedToGrid?: boolean;
  collisionDetected?: boolean;
}

/**
 * Datos de eliminación
 */
export interface DeleteData {
  objectId: string;
  objectType: string;
  x: number;
  y: number;
  costRemoved?: number;
}

/**
 * Datos de cambio de tipo
 */
export interface ChangeTypeData {
  objectId: string;
  fromType: string;
  toType: string;
  costDifference?: number;
}

/**
 * Datos de duplicación
 */
export interface DuplicateData {
  sourceObjectId: string;
  newObjectId: string;
  offsetX: number;
  offsetY: number;
  costAdded?: number;
}

/**
 * Datos de material
 */
export interface ApplyMaterialData {
  material: string; // "grass", "gravel", "soil", "concrete"
  area: Array<{ x: number; y: number }>;
  costAdded?: number;
  areaSize?: number;
}

/**
 * Datos de limpieza
 */
export interface CleanAreaData {
  area: Array<{ x: number; y: number }>;
  objectsRemoved: string[];
  costSaved?: number;
}

/**
 * Configuración de interacción
 */
export interface LiveInteractionConfig {
  // Movimiento
  snapToGrid: boolean;
  gridSize: number;
  smoothMovement: boolean;
  movementSpeed: number; // pixels per ms
  
  // Selección
  selectionBoundingBoxColor: string;
  selectionBoundingBoxWidth: number;
  selectionHandleSize: number;
  
  // Validación
  respectCollisions: boolean;
  respectZones: boolean;
  validateBeforeMove: boolean;
  
  // Performance
  renderOptimization: boolean;
  maxFPS: number;
  debounceUpdates: number; // ms
  
  // Undo/Redo
  maxHistorySize: number;
  autoSaveInterval: number; // ms
}

/**
 * Resultado de validación
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Schemas de validación
 */
export const SelectedObjectSchema = z.object({
  id: z.string(),
  type: z.string(),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  rotation: z.number().optional(),
  scale: z.number().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const LiveInteractionStateSchema = z.object({
  selectedObjects: z.array(SelectedObjectSchema),
  selectionMode: z.nativeEnum(SelectionMode),
  isDragging: z.boolean(),
  dragStartX: z.number().optional(),
  dragStartY: z.number().optional(),
  dragOffsetX: z.number().optional(),
  dragOffsetY: z.number().optional(),
  showFloatingControls: z.boolean(),
  floatingControlsX: z.number().optional(),
  floatingControlsY: z.number().optional(),
  selectedMaterial: z.string().optional(),
  selectedArea: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
  history: z.array(z.record(z.string(), z.unknown())),
  historyIndex: z.number(),
  isLoading: z.boolean(),
  error: z.string().optional(),
  lastUpdate: z.number(),
});

export const LiveInteractionConfigSchema = z.object({
  snapToGrid: z.boolean(),
  gridSize: z.number().positive(),
  smoothMovement: z.boolean(),
  movementSpeed: z.number().positive(),
  selectionBoundingBoxColor: z.string(),
  selectionBoundingBoxWidth: z.number().positive(),
  selectionHandleSize: z.number().positive(),
  respectCollisions: z.boolean(),
  respectZones: z.boolean(),
  validateBeforeMove: z.boolean(),
  renderOptimization: z.boolean(),
  maxFPS: z.number().positive(),
  debounceUpdates: z.number().min(0),
  maxHistorySize: z.number().positive(),
  autoSaveInterval: z.number().positive(),
});

export type SelectedObjectType = z.infer<typeof SelectedObjectSchema>;
export type LiveInteractionStateType = z.infer<typeof LiveInteractionStateSchema>;
export type LiveInteractionConfigType = z.infer<typeof LiveInteractionConfigSchema>;

/**
 * Configuración por defecto
 */
export const DEFAULT_LIVE_INTERACTION_CONFIG: LiveInteractionConfigType = {
  snapToGrid: true,
  gridSize: 20,
  smoothMovement: true,
  movementSpeed: 0.5,
  selectionBoundingBoxColor: "#FF6B6B",
  selectionBoundingBoxWidth: 2,
  selectionHandleSize: 12,
  respectCollisions: true,
  respectZones: true,
  validateBeforeMove: true,
  renderOptimization: true,
  maxFPS: 60,
  debounceUpdates: 100,
  maxHistorySize: 50,
  autoSaveInterval: 2000,
};
