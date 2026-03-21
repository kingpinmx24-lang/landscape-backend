/**
 * ============================================================================
 * VISUALIZATION TYPES
 * ============================================================================
 * Types for realistic plant visualization with PNG images
 */

/**
 * Información de imagen de planta
 */
export interface PlantImage {
  id: string;
  plantId: string;
  url: string; // URL de imagen PNG
  width: number; // Ancho en píxeles
  height: number; // Alto en píxeles
  naturalWidth: number; // Ancho real en metros
  naturalHeight: number; // Alto real en metros
  hasAlpha: boolean; // Tiene transparencia
  season?: "spring" | "summer" | "fall" | "winter";
}

/**
 * Configuración de escala
 */
export interface ScaleConfig {
  pixelsPerMeter: number; // Píxeles por metro
  canvasWidth: number; // Ancho del canvas en píxeles
  canvasHeight: number; // Alto del canvas en píxeles
  terrainWidth: number; // Ancho del terreno en metros
  terrainHeight: number; // Alto del terreno en metros
  zoom: number; // Nivel de zoom (1.0 = 100%)
  offsetX: number; // Desplazamiento X en píxeles
  offsetY: number; // Desplazamiento Y en píxeles
}

/**
 * Posición en canvas
 */
export interface CanvasPosition {
  x: number; // Posición X en píxeles
  y: number; // Posición Y en píxeles
  screenX: number; // Posición X en pantalla (después de transformaciones)
  screenY: number; // Posición Y en pantalla
}

/**
 * Información de sombra
 */
export interface ShadowConfig {
  offsetX: number; // Desplazamiento X
  offsetY: number; // Desplazamiento Y
  blur: number; // Radio de desenfoque
  color: string; // Color de sombra (rgba)
  opacity: number; // Opacidad (0-1)
}

/**
 * Información de renderizado de planta
 */
export interface PlantRenderInfo {
  id: string;
  plantId: string;
  position: { x: number; y: number }; // Posición en metros
  scale: number; // Escala relativa (1.0 = tamaño natural)
  rotation: number; // Rotación en grados
  opacity: number; // Opacidad (0-1)
  image: PlantImage;
  shadow: ShadowConfig;
  zIndex: number; // Orden de renderizado
  isSelected: boolean;
  isHighlighted: boolean;
}

/**
 * Información de terreno
 */
export interface TerrainRenderInfo {
  width: number; // Ancho en metros
  height: number; // Alto en metros
  backgroundColor: string; // Color de fondo
  gridVisible: boolean;
  gridSpacing: number; // Espaciado de grid en metros
  zones: Array<{
    id: string;
    type: "soil" | "grass" | "concrete";
    color: string;
    polygon: Array<{ x: number; y: number }>;
  }>;
}

/**
 * Configuración de renderizado
 */
export interface RenderConfig {
  scale: ScaleConfig;
  terrain: TerrainRenderInfo;
  plants: PlantRenderInfo[];
  showGrid: boolean;
  showShadows: boolean;
  showLabels: boolean;
  antiAlias: boolean;
  quality: "low" | "medium" | "high";
}

/**
 * Modo BEFORE/AFTER
 */
export interface BeforeAfterConfig {
  enabled: boolean;
  position: number; // 0-1, posición del divisor
  orientation: "vertical" | "horizontal";
  beforeDesign: RenderConfig;
  afterDesign: RenderConfig;
  showLabels: boolean;
  animateTransition: boolean;
}

/**
 * Información de interacción
 */
export interface InteractionInfo {
  type: "pan" | "zoom" | "select" | "hover";
  position: { x: number; y: number };
  delta?: { x: number; y: number };
  scale?: number;
  targetId?: string;
  timestamp: number;
}

/**
 * Estadísticas de renderizado
 */
export interface RenderStats {
  fps: number;
  frameTime: number; // Milisegundos
  plantCount: number;
  imagesCached: number;
  memoryUsage: number;
  lastRenderTime: number;
}

/**
 * Configuración de optimización para iPad
 */
export interface IPadOptimization {
  useRetina: boolean; // Usar resolución Retina
  maxTextureSize: number; // Tamaño máximo de textura
  enableGPUAcceleration: boolean;
  cacheImages: boolean;
  reducedMotion: boolean;
  touchFeedback: boolean;
  fullscreenMode: boolean;
}

/**
 * Configuración de exportación
 */
export interface ExportConfig {
  format: "png" | "jpg" | "webp";
  quality: number; // 0-100
  width: number; // Ancho en píxeles
  height: number; // Alto en píxeles
  includeWatermark: boolean;
  includeScale: boolean;
  backgroundColor: string;
}

/**
 * Resultado de exportación
 */
export interface ExportResult {
  dataUrl: string;
  blob: Blob;
  size: number; // Bytes
  width: number;
  height: number;
  timestamp: number;
}

/**
 * Información de caché de imágenes
 */
export interface ImageCache {
  id: string;
  url: string;
  image: HTMLImageElement;
  canvas?: OffscreenCanvas;
  timestamp: number;
  accessCount: number;
  size: number; // Bytes
}

/**
 * Configuración de animación
 */
export interface AnimationConfig {
  duration: number; // Milisegundos
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  delay: number;
  loop: boolean;
  reverse: boolean;
}

/**
 * Información de zoom
 */
export interface ZoomInfo {
  current: number; // Zoom actual (1.0 = 100%)
  min: number; // Zoom mínimo
  max: number; // Zoom máximo
  step: number; // Paso de zoom
  velocity: number; // Velocidad de zoom (para animación)
}

/**
 * Información de pan
 */
export interface PanInfo {
  offsetX: number; // Desplazamiento X en píxeles
  offsetY: number; // Desplazamiento Y en píxeles
  velocity: { x: number; y: number }; // Velocidad (para inercia)
  isDragging: boolean;
}

/**
 * Información de vista
 */
export interface ViewportInfo {
  width: number; // Ancho en píxeles
  height: number; // Alto en píxeles
  devicePixelRatio: number; // Relación de píxeles del dispositivo
  orientation: "portrait" | "landscape";
  isFullscreen: boolean;
  safeAreaInsets: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/**
 * Información de selección
 */
export interface SelectionInfo {
  selectedIds: string[];
  hoveredId?: string;
  selectionBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  multiSelect: boolean;
}

/**
 * Configuración de etiquetas
 */
export interface LabelConfig {
  visible: boolean;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  borderRadius: number;
  padding: number;
  offset: { x: number; y: number };
}

/**
 * Información de etiqueta
 */
export interface LabelInfo {
  id: string;
  text: string;
  position: { x: number; y: number };
  config: LabelConfig;
  visible: boolean;
}

/**
 * Configuración de grid
 */
export interface GridConfig {
  visible: boolean;
  spacing: number; // Espaciado en metros
  color: string;
  lineWidth: number;
  opacity: number;
  snapToGrid: boolean;
}

/**
 * Información de medida
 */
export interface MeasurementInfo {
  id: string;
  type: "distance" | "area" | "angle";
  points: Array<{ x: number; y: number }>;
  value: number;
  unit: string;
  label: string;
  color: string;
  visible: boolean;
}

/**
 * Configuración de color de zona
 */
export interface ZoneColorConfig {
  soil: string;
  grass: string;
  concrete: string;
  opacity: number;
  borderColor: string;
  borderWidth: number;
}

/**
 * Información de performance
 */
export interface PerformanceInfo {
  renderTime: number;
  imageLoadTime: number;
  totalTime: number;
  plantsRendered: number;
  imagesInCache: number;
  memoryUsed: number;
  fps: number;
}
