/**
 * ============================================================================
 * EDITOR TYPES
 * ============================================================================
 * Types for professional landscape design editor
 */

/**
 * Herramientas disponibles
 */
export enum EditorTool {
  SELECT = "select",
  MOVE = "move",
  ROTATE = "rotate",
  SCALE = "scale",
  DELETE = "delete",
  MEASURE = "measure",
}

/**
 * Modo de transformación
 */
export enum TransformMode {
  NONE = "none",
  MOVING = "moving",
  ROTATING = "rotating",
  SCALING = "scaling",
  MEASURING = "measuring",
}

/**
 * Dirección de escalado
 */
export enum ScaleDirection {
  NW = "nw",
  N = "n",
  NE = "ne",
  E = "e",
  SE = "se",
  S = "s",
  SW = "sw",
  W = "w",
}

/**
 * Información de transformación
 */
export interface TransformInfo {
  x: number; // Posición X en metros
  y: number; // Posición Y en metros
  width: number; // Ancho en metros
  height: number; // Alto en metros
  rotation: number; // Rotación en grados (0-360)
  scale: number; // Escala relativa (1.0 = tamaño original)
}

/**
 * Información de objeto seleccionado
 */
export interface SelectedObject {
  id: string;
  plantId: string;
  transform: TransformInfo;
  isLocked: boolean;
  isVisible: boolean;
  zIndex: number;
}

/**
 * Información de handle (punto de transformación)
 */
export interface TransformHandle {
  id: string;
  type: "move" | "rotate" | "scale" | "corner" | "edge";
  position: { x: number; y: number };
  direction?: ScaleDirection;
  cursor: string;
  visible: boolean;
}

/**
 * Información de medida
 */
export interface MeasureInfo {
  id: string;
  type: "distance" | "angle" | "area";
  points: Array<{ x: number; y: number }>;
  value: number;
  unit: string;
  label: string;
  visible: boolean;
}

/**
 * Configuración de snap
 */
export interface SnapConfig {
  enabled: boolean;
  gridSize: number; // Tamaño de grid en metros
  snapToGrid: boolean;
  snapToObjects: boolean;
  snapToGuides: boolean;
  snapDistance: number; // Distancia de snap en píxeles
  showGrid: boolean;
  showGuides: boolean;
}

/**
 * Información de guía
 */
export interface Guide {
  id: string;
  type: "vertical" | "horizontal";
  position: number; // Posición en metros
  color: string;
  visible: boolean;
  locked: boolean;
}

/**
 * Información de acción (para undo/redo)
 */
export interface EditorAction {
  id: string;
  type: "create" | "delete" | "transform" | "modify";
  timestamp: number;
  objectId: string;
  before?: any;
  after?: any;
  description: string;
}

/**
 * Historial de acciones
 */
export interface ActionHistory {
  actions: EditorAction[];
  currentIndex: number;
  maxSize: number;
}

/**
 * Estado del editor
 */
export interface EditorState {
  currentTool: EditorTool;
  transformMode: TransformMode;
  selectedObjects: Set<string>;
  hoveredObject?: string;
  selectedHandles: TransformHandle[];
  measures: MeasureInfo[];
  guides: Guide[];
  snap: SnapConfig;
  history: ActionHistory;
  isDirty: boolean;
  isLocked: boolean;
}

/**
 * Información de interacción del editor
 */
export interface EditorInteraction {
  type: "mousedown" | "mousemove" | "mouseup" | "wheel" | "keydown" | "keyup";
  position: { x: number; y: number };
  delta?: { x: number; y: number };
  key?: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  timestamp: number;
}

/**
 * Configuración del editor
 */
export interface EditorConfig {
  gridSize: number; // Tamaño de grid en metros
  snapDistance: number; // Distancia de snap en píxeles
  showGrid: boolean;
  showMeasures: boolean;
  showGuides: boolean;
  precision: number; // Decimales para medidas
  minScale: number; // Escala mínima
  maxScale: number; // Escala máxima
  rotationStep: number; // Paso de rotación en grados
  moveStep: number; // Paso de movimiento en metros
  scaleStep: number; // Paso de escalado
  enableUndo: boolean;
  maxHistorySize: number;
  theme: "light" | "dark";
}

/**
 * Información de validación
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Información de transformación en progreso
 */
export interface TransformInProgress {
  objectId: string;
  startTransform: TransformInfo;
  currentTransform: TransformInfo;
  mode: TransformMode;
  handle?: TransformHandle;
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
  snapInfo?: {
    snapX?: number;
    snapY?: number;
    snapAngle?: number;
  };
}

/**
 * Información de clipboard
 */
export interface ClipboardData {
  objects: Array<{
    id: string;
    plantId: string;
    transform: TransformInfo;
  }>;
  timestamp: number;
}

/**
 * Información de preferencias del usuario
 */
export interface EditorPreferences {
  gridSize: number;
  snapDistance: number;
  showGrid: boolean;
  showMeasures: boolean;
  showGuides: boolean;
  precision: number;
  rotationStep: number;
  moveStep: number;
  theme: "light" | "dark";
  autoSave: boolean;
  autoSaveInterval: number;
}

/**
 * Información de evento de editor
 */
export interface EditorEvent {
  type: string;
  data: any;
  timestamp: number;
  source: "user" | "system";
}

/**
 * Información de selección múltiple
 */
export interface MultiSelectInfo {
  objectIds: string[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  centerX: number;
  centerY: number;
  avgRotation: number;
  avgScale: number;
}

/**
 * Información de alineación
 */
export interface AlignmentInfo {
  type: "left" | "center" | "right" | "top" | "middle" | "bottom" | "distribute";
  axis: "x" | "y";
  spacing?: number;
}

/**
 * Información de distribución
 */
export interface DistributionInfo {
  type: "horizontal" | "vertical";
  spacing: number; // Espacio entre objetos en metros
}

/**
 * Información de grupo
 */
export interface GroupInfo {
  id: string;
  objectIds: string[];
  locked: boolean;
  visible: boolean;
}

/**
 * Información de capa
 */
export interface LayerInfo {
  id: string;
  name: string;
  objectIds: string[];
  visible: boolean;
  locked: boolean;
  opacity: number;
}

/**
 * Información de propiedades de objeto
 */
export interface ObjectProperties {
  id: string;
  plantId: string;
  name: string;
  description?: string;
  transform: TransformInfo;
  locked: boolean;
  visible: boolean;
  opacity: number;
  zIndex: number;
  tags: string[];
  metadata: Record<string, any>;
}

/**
 * Información de validación de colocación
 */
export interface PlacementValidation {
  valid: boolean;
  canPlace: boolean;
  errors: string[];
  warnings: string[];
  collisions: string[];
  outOfBounds: boolean;
}

/**
 * Información de estadísticas del editor
 */
export interface EditorStats {
  objectCount: number;
  selectedCount: number;
  totalArea: number;
  totalCost: number;
  totalMargin: number;
  lastModified: number;
  modificationCount: number;
}
