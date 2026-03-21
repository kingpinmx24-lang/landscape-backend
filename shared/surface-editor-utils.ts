/**
 * Surface Editor Utilities
 * ============================================================================
 * Funciones auxiliares para edición de terreno
 * Módulo independiente sin dependencias de otros módulos
 */

import {
  SurfaceType,
  SurfaceToolType,
  EditedZone,
  SurfaceEditAction,
  SurfaceChangeSummary,
  SurfaceCost,
} from "./surface-editor-types";

/**
 * Detectar tipo de superficie por color RGB
 */
export function detectSurfaceTypeByColor(
  r: number,
  g: number,
  b: number
): SurfaceType {
  // Normalizar RGB a 0-1
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;

  // Calcular HSL
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case nr:
        h = ((ng - nb) / d + (ng < nb ? 6 : 0)) / 6;
        break;
      case ng:
        h = ((nb - nr) / d + 2) / 6;
        break;
      case nb:
        h = ((nr - ng) / d + 4) / 6;
        break;
    }
  }

  const hue = h * 360;
  const sat = s * 100;
  const light = l * 100;

  // Clasificar por HSL
  // Pasto: verde (100-150 hue, 30-100 sat, 20-60 light)
  if (hue >= 100 && hue <= 150 && sat >= 30 && light >= 20 && light <= 60) {
    return SurfaceType.GRASS;
  }

  // Tierra: marrón/naranja (15-40 hue, 30-100 sat, 25-55 light)
  if (hue >= 15 && hue <= 40 && sat >= 30 && light >= 25 && light <= 55) {
    return SurfaceType.SOIL;
  }

  // Cemento: gris (0-360 hue, 0-20 sat, 40-90 light)
  if (sat <= 20 && light >= 40 && light <= 90) {
    return SurfaceType.CONCRETE;
  }

  // Grava: gris oscuro (0-360 hue, 0-30 sat, 20-50 light)
  if (sat <= 30 && light >= 20 && light <= 50) {
    return SurfaceType.GRAVEL;
  }

  // Degradada: muy oscura o muy clara sin saturación
  if ((light < 20 || light > 90) && sat < 20) {
    return SurfaceType.DEGRADED;
  }

  // Por defecto
  return SurfaceType.SOIL;
}

/**
 * Extraer píxeles de una zona usando flood fill
 */
export function floodFillZone(
  imageData: ImageData,
  startX: number,
  startY: number,
  tolerance: number = 30
): Set<string> {
  const { data, width, height } = imageData;
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];

  // Color inicial
  const startIdx = (startY * width + startX) * 4;
  const startR = data[startIdx];
  const startG = data[startIdx + 1];
  const startB = data[startIdx + 2];

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    const key = `${x},${y}`;

    if (visited.has(key)) continue;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    // Calcular diferencia de color
    const diff = Math.sqrt(
      (r - startR) ** 2 + (g - startG) ** 2 + (b - startB) ** 2
    );

    if (diff > tolerance) continue;

    visited.add(key);

    // Agregar vecinos
    queue.push({ x: x + 1, y });
    queue.push({ x: x - 1, y });
    queue.push({ x, y: y + 1 });
    queue.push({ x, y: y - 1 });
  }

  return visited;
}

/**
 * Convertir píxeles a polígono convexo
 */
export function pixelsToPolygon(
  pixels: Set<string>
): Array<{ x: number; y: number }> {
  if (pixels.size === 0) return [];

  // Convertir a array de puntos
  const points = Array.from(pixels).map((key) => {
    const [x, y] = key.split(",").map(Number);
    return { x, y };
  });

  // Encontrar envolvente convexa (Graham scan)
  return convexHull(points);
}

/**
 * Algoritmo de Graham scan para envolvente convexa
 */
function convexHull(
  points: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  if (points.length <= 2) return points;

  // Ordenar por x, luego por y
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

  // Construir casco inferior
  const lower: Array<{ x: number; y: number }> = [];
  for (const p of sorted) {
    while (lower.length >= 2) {
      const last = lower[lower.length - 1];
      const secondLast = lower[lower.length - 2];
      const cross =
        (last.x - secondLast.x) * (p.y - secondLast.y) -
        (last.y - secondLast.y) * (p.x - secondLast.x);
      if (cross <= 0) lower.pop();
      else break;
    }
    lower.push(p);
  }

  // Construir casco superior
  const upper: Array<{ x: number; y: number }> = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2) {
      const last = upper[upper.length - 1];
      const secondLast = upper[upper.length - 2];
      const cross =
        (last.x - secondLast.x) * (p.y - secondLast.y) -
        (last.y - secondLast.y) * (p.x - secondLast.x);
      if (cross <= 0) upper.pop();
      else break;
    }
    upper.push(p);
  }

  // Combinar (remover último punto de cada uno para evitar duplicados)
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * Calcular área de polígono usando fórmula de Shoelace
 */
export function calculatePolygonArea(
  polygon: Array<{ x: number; y: number }>,
  pixelToMeterRatio: number
): number {
  if (polygon.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }

  area = Math.abs(area) / 2;

  // Convertir a metros cuadrados
  return area * (pixelToMeterRatio ** 2);
}

/**
 * Aplicar textura a zona
 */
export function applyTextureToZone(
  imageData: ImageData,
  pixels: Set<string>,
  surfaceType: SurfaceType,
  opacity: number = 0.7
): ImageData {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);

  // Colores de textura por tipo
  const textureColors: Record<SurfaceType, { r: number; g: number; b: number }> = {
    [SurfaceType.GRASS]: { r: 34, g: 139, b: 34 }, // Verde oscuro
    [SurfaceType.SOIL]: { r: 139, g: 90, b: 43 }, // Marrón
    [SurfaceType.CONCRETE]: { r: 169, g: 169, b: 169 }, // Gris
    [SurfaceType.GRAVEL]: { r: 128, g: 128, b: 128 }, // Gris oscuro
    [SurfaceType.DEGRADED]: { r: 64, g: 64, b: 64 }, // Muy oscuro
  };

  const color = textureColors[surfaceType];

  for (const key of Array.from(pixels)) {
    const [x, y] = key.split(",").map(Number);
    const idx = (y * width + x) * 4;

    // Mezclar color con opacidad
    newData[idx] = Math.round(newData[idx] * (1 - opacity) + color.r * opacity);
    newData[idx + 1] = Math.round(
      newData[idx + 1] * (1 - opacity) + color.g * opacity
    );
    newData[idx + 2] = Math.round(
      newData[idx + 2] * (1 - opacity) + color.b * opacity
    );
    // Alpha siempre 255
    newData[idx + 3] = 255;
  }

  return new ImageData(newData, width, height);
}

/**
 * Calcular resumen de cambios de superficie
 */
export function calculateSurfaceChangeSummary(
  originalSurfaces: Map<SurfaceType, number>,
  editedZones: Map<string, EditedZone>,
  surfaceCosts: Map<SurfaceType, SurfaceCost>
): SurfaceChangeSummary {
  const editedSurfaces = new Map<SurfaceType, number>();

  // Sumar áreas editadas
  for (const zone of Array.from(editedZones.values())) {
    const current = editedSurfaces.get(zone.type) || 0;
    editedSurfaces.set(zone.type, current + zone.area);
  }

  // Calcular costos
  let totalCost = 0;
  let laborCost = 0;
  let cleaningCost = 0;
  const changes: Array<{
    from: SurfaceType;
    to: SurfaceType;
    area: number;
    cost: number;
  }> = [];

  // Procesar cambios
  for (const [surfaceType, editedArea] of Array.from(editedSurfaces)) {
    const originalArea = originalSurfaces.get(surfaceType) || 0;
    const cost = surfaceCosts.get(surfaceType);

    if (cost) {
      const areaCost = editedArea * cost.costPerSquareMeter;
      const labor = editedArea * cost.laborCost;

      totalCost += areaCost + labor;
      laborCost += labor;

      if (surfaceType === SurfaceType.DEGRADED) {
        cleaningCost += areaCost;
      }

      changes.push({
        from: SurfaceType.SOIL, // Asumiendo cambio desde suelo
        to: surfaceType,
        area: editedArea,
        cost: areaCost + labor,
      });
    }
  }

  return {
    originalSurfaces,
    editedSurfaces,
    totalCost,
    laborCost,
    cleaningCost,
    changes,
  };
}

/**
 * Validar que edición no afecte plantas
 */
export function validateNoPlantIntersection(
  editedPixels: Set<string>,
  plantPositions: Array<{ x: number; y: number; radius: number }>
): boolean {
  for (const plant of plantPositions) {
    for (const key of Array.from(editedPixels)) {
      const [px, py] = key.split(",").map(Number);
      const distance = Math.sqrt(
        (px - plant.x) ** 2 + (py - plant.y) ** 2
      );
      if (distance < plant.radius) {
        return false; // Intersección detectada
      }
    }
  }
  return true;
}

/**
 * Crear acción de edición para historial
 */
export function createEditAction(
  type: SurfaceToolType,
  pixels: Array<{ x: number; y: number }>,
  surfaceType?: SurfaceType
): SurfaceEditAction {
  return {
    id: `action-${Date.now()}-${Math.random()}`,
    type,
    surfaceType,
    pixels,
    timestamp: Date.now(),
    canUndo: true,
  };
}

/**
 * Aplicar acción de edición a imagen
 */
export function applyEditAction(
  imageData: ImageData,
  action: SurfaceEditAction
): ImageData {
  const pixelSet = new Set(
    action.pixels.map((p) => `${p.x},${p.y}`)
  );

  switch (action.type) {
    case SurfaceToolType.APPLY_GRASS:
    case SurfaceToolType.APPLY_GRAVEL:
    case SurfaceToolType.APPLY_SOIL:
      const surfaceType =
        action.type === SurfaceToolType.APPLY_GRASS
          ? SurfaceType.GRASS
          : action.type === SurfaceToolType.APPLY_GRAVEL
            ? SurfaceType.GRAVEL
            : SurfaceType.SOIL;
      return applyTextureToZone(imageData, pixelSet, surfaceType, 0.8);

    case SurfaceToolType.CLEAN:
      return applyTextureToZone(imageData, pixelSet, SurfaceType.SOIL, 0.6);

    default:
      return imageData;
  }
}
