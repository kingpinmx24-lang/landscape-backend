/**
 * ============================================================================
 * EDITOR TRANSFORM UTILITIES
 * ============================================================================
 * Utilities for object transformations in editor
 */

import type { TransformInfo, SnapConfig, TransformInProgress } from "./editor-types";

/**
 * Calcular distancia entre dos puntos
 */
export const calculateDistance = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calcular ángulo entre dos puntos
 */
export const calculateAngle = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
};

/**
 * Normalizar ángulo a 0-360
 */
export const normalizeAngle = (angle: number): number => {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
};

/**
 * Aplicar snap a grid
 */
export const snapToGrid = (value: number, gridSize: number): number => {
  if (gridSize === 0) return value;
  return Math.round(value / gridSize) * gridSize;
};

/**
 * Aplicar snap a valor más cercano
 */
export const snapToValue = (value: number, targetValue: number, tolerance: number): number => {
  const diff = Math.abs(value - targetValue);
  if (diff < tolerance) {
    return targetValue;
  }
  return value;
};

/**
 * Mover objeto
 */
export const moveObject = (
  transform: TransformInfo,
  deltaX: number,
  deltaY: number,
  snap?: SnapConfig
): TransformInfo => {
  let newX = transform.x + deltaX;
  let newY = transform.y + deltaY;

  if (snap?.snapToGrid) {
    newX = snapToGrid(newX, snap.gridSize);
    newY = snapToGrid(newY, snap.gridSize);
  }

  return {
    ...transform,
    x: newX,
    y: newY,
  };
};

/**
 * Rotar objeto
 */
export const rotateObject = (
  transform: TransformInfo,
  deltaRotation: number,
  snap?: SnapConfig
): TransformInfo => {
  let newRotation = normalizeAngle(transform.rotation + deltaRotation);

  // Snap a ángulos comunes
  if (snap?.snapToGrid) {
    const step = snap.gridSize * 10; // Usar gridSize como base para paso
    newRotation = snapToGrid(newRotation, step);
  }

  return {
    ...transform,
    rotation: newRotation,
  };
};

/**
 * Escalar objeto
 */
export const scaleObject = (
  transform: TransformInfo,
  deltaScale: number,
  minScale = 0.1,
  maxScale = 10
): TransformInfo => {
  let newScale = Math.max(minScale, Math.min(maxScale, transform.scale + deltaScale));

  return {
    ...transform,
    scale: newScale,
  };
};

/**
 * Escalar objeto desde handle
 */
export const scaleObjectFromHandle = (
  transform: TransformInfo,
  handle: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w",
  deltaX: number,
  deltaY: number,
  maintainAspectRatio = true
): TransformInfo => {
  let newWidth = transform.width;
  let newHeight = transform.height;
  let newX = transform.x;
  let newY = transform.y;

  const aspectRatio = transform.width / transform.height;

  // Calcular cambios según handle
  switch (handle) {
    case "nw":
      newX += deltaX;
      newY += deltaY;
      newWidth -= deltaX;
      newHeight -= deltaY;
      break;
    case "n":
      newY += deltaY;
      newHeight -= deltaY;
      if (maintainAspectRatio) {
        newWidth = newHeight * aspectRatio;
        newX -= (newWidth - transform.width) / 2;
      }
      break;
    case "ne":
      newY += deltaY;
      newWidth += deltaX;
      newHeight -= deltaY;
      break;
    case "e":
      newWidth += deltaX;
      if (maintainAspectRatio) {
        newHeight = newWidth / aspectRatio;
        newY -= (newHeight - transform.height) / 2;
      }
      break;
    case "se":
      newWidth += deltaX;
      newHeight += deltaY;
      break;
    case "s":
      newHeight += deltaY;
      if (maintainAspectRatio) {
        newWidth = newHeight * aspectRatio;
        newX -= (newWidth - transform.width) / 2;
      }
      break;
    case "sw":
      newX += deltaX;
      newWidth -= deltaX;
      newHeight += deltaY;
      break;
    case "w":
      newX += deltaX;
      newWidth -= deltaX;
      if (maintainAspectRatio) {
        newHeight = newWidth / aspectRatio;
        newY -= (newHeight - transform.height) / 2;
      }
      break;
  }

  // Validar dimensiones mínimas
  if (newWidth < 0.1) newWidth = 0.1;
  if (newHeight < 0.1) newHeight = 0.1;

  return {
    ...transform,
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight,
  };
};

/**
 * Obtener bounding box de múltiples objetos
 */
export const getBoundingBox = (
  transforms: TransformInfo[]
): {
  x: number;
  y: number;
  width: number;
  height: number;
} => {
  if (transforms.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = transforms[0].x;
  let minY = transforms[0].y;
  let maxX = transforms[0].x + transforms[0].width;
  let maxY = transforms[0].y + transforms[0].height;

  for (let i = 1; i < transforms.length; i++) {
    const t = transforms[i];
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + t.width);
    maxY = Math.max(maxY, t.y + t.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

/**
 * Alinear objetos
 */
export const alignObjects = (
  transforms: TransformInfo[],
  alignment: "left" | "center" | "right" | "top" | "middle" | "bottom"
): TransformInfo[] => {
  if (transforms.length === 0) return transforms;

  const bbox = getBoundingBox(transforms);

  return transforms.map((t) => {
    switch (alignment) {
      case "left":
        return { ...t, x: bbox.x };
      case "center":
        return { ...t, x: bbox.x + (bbox.width - t.width) / 2 };
      case "right":
        return { ...t, x: bbox.x + bbox.width - t.width };
      case "top":
        return { ...t, y: bbox.y };
      case "middle":
        return { ...t, y: bbox.y + (bbox.height - t.height) / 2 };
      case "bottom":
        return { ...t, y: bbox.y + bbox.height - t.height };
      default:
        return t;
    }
  });
};

/**
 * Distribuir objetos
 */
export const distributeObjects = (
  transforms: TransformInfo[],
  direction: "horizontal" | "vertical",
  spacing: number
): TransformInfo[] => {
  if (transforms.length < 2) return transforms;

  const sorted =
    direction === "horizontal"
      ? [...transforms].sort((a, b) => a.x - b.x)
      : [...transforms].sort((a, b) => a.y - b.y);

  const result: TransformInfo[] = [];
  let currentPos = direction === "horizontal" ? sorted[0].x : sorted[0].y;

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (direction === "horizontal") {
      result.push({ ...t, x: currentPos });
      currentPos += t.width + spacing;
    } else {
      result.push({ ...t, y: currentPos });
      currentPos += t.height + spacing;
    }
  }

  return result;
};

/**
 * Validar transformación
 */
export const validateTransform = (
  transform: TransformInfo,
  bounds?: { minX: number; minY: number; maxX: number; maxY: number }
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (transform.width <= 0) errors.push("Width must be positive");
  if (transform.height <= 0) errors.push("Height must be positive");
  if (transform.scale <= 0) errors.push("Scale must be positive");
  if (transform.rotation < 0 || transform.rotation > 360) {
    errors.push("Rotation must be between 0 and 360");
  }

  if (bounds) {
    if (transform.x < bounds.minX) errors.push("Object is outside left boundary");
    if (transform.y < bounds.minY) errors.push("Object is outside top boundary");
    if (transform.x + transform.width > bounds.maxX)
      errors.push("Object is outside right boundary");
    if (transform.y + transform.height > bounds.maxY)
      errors.push("Object is outside bottom boundary");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Clonar transformación
 */
export const cloneTransform = (transform: TransformInfo): TransformInfo => ({
  ...transform,
});

/**
 * Interpolar entre dos transformaciones
 */
export const interpolateTransform = (
  from: TransformInfo,
  to: TransformInfo,
  t: number
): TransformInfo => {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
    rotation: from.rotation + (to.rotation - from.rotation) * t,
    scale: from.scale + (to.scale - from.scale) * t,
  };
};

/**
 * Calcular centro de transformación
 */
export const getTransformCenter = (transform: TransformInfo): { x: number; y: number } => ({
  x: transform.x + transform.width / 2,
  y: transform.y + transform.height / 2,
});

/**
 * Rotar punto alrededor de centro
 */
export const rotatePoint = (
  point: { x: number; y: number },
  center: { x: number; y: number },
  angle: number
): { x: number; y: number } => {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
};

/**
 * Detectar punto en rectángulo
 */
export const isPointInRect = (
  point: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number }
): boolean => {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
};

/**
 * Detectar colisión entre rectángulos
 */
export const detectRectCollision = (
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): boolean => {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect2.x + rect2.width < rect1.x ||
    rect1.y + rect1.height < rect2.y ||
    rect2.y + rect2.height < rect1.y
  );
};
