/**
 * ============================================================================
 * VISUALIZATION UTILITIES
 * ============================================================================
 * Utilities for scaling, transformations, and rendering
 */

import type {
  ScaleConfig,
  CanvasPosition,
  PlantRenderInfo,
  ViewportInfo,
  ZoomInfo,
  PanInfo,
} from "./visualization-types";

/**
 * Crear configuración de escala
 */
export function createScaleConfig(
  terrainWidth: number,
  terrainHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  pixelsPerMeter: number = 50
): ScaleConfig {
  return {
    pixelsPerMeter,
    canvasWidth,
    canvasHeight,
    terrainWidth,
    terrainHeight,
    zoom: 1.0,
    offsetX: 0,
    offsetY: 0,
  };
}

/**
 * Convertir coordenadas de metros a píxeles
 */
export function metersToPixels(
  meters: number,
  scale: ScaleConfig
): number {
  return meters * scale.pixelsPerMeter * scale.zoom;
}

/**
 * Convertir coordenadas de píxeles a metros
 */
export function pixelsToMeters(
  pixels: number,
  scale: ScaleConfig
): number {
  return pixels / (scale.pixelsPerMeter * scale.zoom);
}

/**
 * Transformar posición de metros a canvas
 */
export function transformPosition(
  x: number,
  y: number,
  scale: ScaleConfig
): CanvasPosition {
  const screenX = metersToPixels(x, scale) + scale.offsetX;
  const screenY = metersToPixels(y, scale) + scale.offsetY;

  return {
    x,
    y,
    screenX,
    screenY,
  };
}

/**
 * Transformar posición inversa (canvas a metros)
 */
export function inverseTransformPosition(
  screenX: number,
  screenY: number,
  scale: ScaleConfig
): { x: number; y: number } {
  const x = pixelsToMeters(screenX - scale.offsetX, scale);
  const y = pixelsToMeters(screenY - scale.offsetY, scale);

  return { x, y };
}

/**
 * Calcular escala de imagen según tamaño real
 */
export function calculateImageScale(
  imageNaturalWidth: number,
  imageNaturalHeight: number,
  plantWidth: number,
  plantHeight: number,
  scale: ScaleConfig
): number {
  const targetPixelWidth = metersToPixels(plantWidth, scale);
  const imageScale = targetPixelWidth / imageNaturalWidth;

  return imageScale;
}

/**
 * Calcular dimensiones renderizadas
 */
export function calculateRenderDimensions(
  imageWidth: number,
  imageHeight: number,
  scale: number
): { width: number; height: number } {
  return {
    width: imageWidth * scale,
    height: imageHeight * scale,
  };
}

/**
 * Verificar si punto está dentro de rectángulo
 */
export function isPointInRect(
  x: number,
  y: number,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): boolean {
  return (
    x >= rectX &&
    x <= rectX + rectWidth &&
    y >= rectY &&
    y <= rectY + rectHeight
  );
}

/**
 * Verificar si punto está dentro de círculo
 */
export function isPointInCircle(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radius: number
): boolean {
  const dx = x - centerX;
  const dy = y - centerY;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Calcular distancia entre dos puntos
 */
export function calculateDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Aplicar zoom a escala
 */
export function applyZoom(
  scale: ScaleConfig,
  zoomFactor: number,
  centerX: number,
  centerY: number
): ScaleConfig {
  const oldZoom = scale.zoom;
  const newZoom = Math.max(0.1, Math.min(5, oldZoom * zoomFactor));

  // Ajustar offset para mantener el punto de zoom centrado
  const zoomRatio = newZoom / oldZoom;
  const newOffsetX = centerX - (centerX - scale.offsetX) * zoomRatio;
  const newOffsetY = centerY - (centerY - scale.offsetY) * zoomRatio;

  return {
    ...scale,
    zoom: newZoom,
    offsetX: newOffsetX,
    offsetY: newOffsetY,
  };
}

/**
 * Aplicar pan a escala
 */
export function applyPan(
  scale: ScaleConfig,
  deltaX: number,
  deltaY: number
): ScaleConfig {
  return {
    ...scale,
    offsetX: scale.offsetX + deltaX,
    offsetY: scale.offsetY + deltaY,
  };
}

/**
 * Limitar offset dentro de límites
 */
export function constrainOffset(
  scale: ScaleConfig
): ScaleConfig {
  const maxOffsetX = 0;
  const minOffsetX = scale.canvasWidth - metersToPixels(scale.terrainWidth, scale);
  const maxOffsetY = 0;
  const minOffsetY = scale.canvasHeight - metersToPixels(scale.terrainHeight, scale);

  return {
    ...scale,
    offsetX: Math.max(minOffsetX, Math.min(maxOffsetX, scale.offsetX)),
    offsetY: Math.max(minOffsetY, Math.min(maxOffsetY, scale.offsetY)),
  };
}

/**
 * Calcular zoom para ajustar terreno completo
 */
export function calculateFitZoom(
  scale: ScaleConfig
): number {
  const terrainPixelWidth = metersToPixels(scale.terrainWidth, { ...scale, zoom: 1 });
  const terrainPixelHeight = metersToPixels(scale.terrainHeight, { ...scale, zoom: 1 });

  const zoomX = scale.canvasWidth / terrainPixelWidth;
  const zoomY = scale.canvasHeight / terrainPixelHeight;

  return Math.min(zoomX, zoomY, 1);
}

/**
 * Crear información de zoom
 */
export function createZoomInfo(
  current: number = 1,
  min: number = 0.1,
  max: number = 5,
  step: number = 0.1
): ZoomInfo {
  return {
    current: Math.max(min, Math.min(max, current)),
    min,
    max,
    step,
    velocity: 0,
  };
}

/**
 * Crear información de pan
 */
export function createPanInfo(): PanInfo {
  return {
    offsetX: 0,
    offsetY: 0,
    velocity: { x: 0, y: 0 },
    isDragging: false,
  };
}

/**
 * Calcular información de viewport
 */
export function getViewportInfo(
  canvas: HTMLCanvasElement | null
): ViewportInfo {
  if (!canvas) {
    return {
      width: 0,
      height: 0,
      devicePixelRatio: 1,
      orientation: "landscape",
      isFullscreen: false,
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    };
  }

  const rect = canvas.getBoundingClientRect();
  const isPortrait = window.innerHeight > window.innerWidth;

  return {
    width: rect.width,
    height: rect.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    orientation: isPortrait ? "portrait" : "landscape",
    isFullscreen: document.fullscreenElement !== null,
    safeAreaInsets: {
      top: parseInt(getComputedStyle(document.documentElement).getPropertyValue("--safe-area-inset-top")) || 0,
      right: parseInt(getComputedStyle(document.documentElement).getPropertyValue("--safe-area-inset-right")) || 0,
      bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue("--safe-area-inset-bottom")) || 0,
      left: parseInt(getComputedStyle(document.documentElement).getPropertyValue("--safe-area-inset-left")) || 0,
    },
  };
}

/**
 * Calcular dimensiones de canvas para Retina
 */
export function calculateCanvasDimensions(
  displayWidth: number,
  displayHeight: number,
  devicePixelRatio: number
): { width: number; height: number; scale: number } {
  const width = displayWidth * devicePixelRatio;
  const height = displayHeight * devicePixelRatio;

  return {
    width,
    height,
    scale: devicePixelRatio,
  };
}

/**
 * Interpolar entre dos valores
 */
export function lerp(
  start: number,
  end: number,
  t: number
): number {
  return start + (end - start) * Math.max(0, Math.min(1, t));
}

/**
 * Easing functions
 */
export const easing = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
};

/**
 * Calcular posición de sombra
 */
export function calculateShadowOffset(
  angle: number,
  distance: number
): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  return {
    x: Math.cos(radians) * distance,
    y: Math.sin(radians) * distance,
  };
}

/**
 * Calcular color de sombra con opacidad
 */
export function calculateShadowColor(
  baseColor: string,
  opacity: number
): string {
  // Convertir color a rgba
  if (baseColor.startsWith("#")) {
    const hex = baseColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return baseColor;
}

/**
 * Crear matriz de transformación 2D
 */
export function createTransformMatrix(
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  rotation: number
): DOMMatrix {
  const matrix = new DOMMatrix();
  matrix.translateSelf(x, y);
  matrix.rotateSelf(0, 0, rotation);
  matrix.scaleSelf(scaleX, scaleY);
  return matrix;
}

/**
 * Aplicar matriz de transformación a punto
 */
export function transformPoint(
  x: number,
  y: number,
  matrix: DOMMatrix
): { x: number; y: number } {
  const point = new DOMPoint(x, y);
  const transformed = point.matrixTransform(matrix);
  return { x: transformed.x, y: transformed.y };
}

/**
 * Calcular bounding box de planta renderizada
 */
export function calculatePlantBounds(
  plant: PlantRenderInfo,
  scale: ScaleConfig
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const pos = transformPosition(plant.position.x, plant.position.y, scale);
  const width = metersToPixels(plant.image.naturalWidth * plant.scale, scale);
  const height = metersToPixels(plant.image.naturalHeight * plant.scale, scale);

  return {
    x: pos.screenX - width / 2,
    y: pos.screenY - height / 2,
    width,
    height,
  };
}

/**
 * Detectar colisión entre dos plantas
 */
export function detectPlantCollision(
  plant1: PlantRenderInfo,
  plant2: PlantRenderInfo,
  scale: ScaleConfig
): boolean {
  const bounds1 = calculatePlantBounds(plant1, scale);
  const bounds2 = calculatePlantBounds(plant2, scale);

  return !(
    bounds1.x + bounds1.width < bounds2.x ||
    bounds2.x + bounds2.width < bounds1.x ||
    bounds1.y + bounds1.height < bounds2.y ||
    bounds2.y + bounds2.height < bounds1.y
  );
}

/**
 * Calcular Z-index basado en posición Y
 */
export function calculateZIndex(
  y: number,
  maxY: number
): number {
  return Math.floor((y / maxY) * 1000);
}
