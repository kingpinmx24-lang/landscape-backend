import type {
  TerrainType,
  ColorPoint,
  TerrainZone,
  TerrainSegmentation,
  PixelClassification,
  ColorRange,
  ColorClassificationConfig,
  ClassifiedPixel,
  ClassificationMap,
} from "./terrain-types";
import { TerrainType as TType } from "./terrain-types";

/**
 * ============================================================================
 * TERRAIN SEGMENTATION ENGINE
 * ============================================================================
 * Color-based terrain segmentation and zone extraction
 */

/**
 * Configuración de color por defecto
 */
const DEFAULT_COLOR_CONFIG: ColorClassificationConfig = {
  soil: {
    r: { min: 100, max: 160 },
    g: { min: 80, max: 130 },
    b: { min: 50, max: 100 },
  },
  grass: {
    r: { min: 50, max: 120 },
    g: { min: 120, max: 200 },
    b: { min: 50, max: 120 },
  },
  concrete: {
    r: { min: 150, max: 220 },
    g: { min: 150, max: 220 },
    b: { min: 150, max: 220 },
  },
  tolerance: 30,
};

/**
 * Calcular distancia euclidiana en espacio RGB
 */
export function colorDistance(p1: ColorPoint, p2: ColorPoint): number {
  const dr = p1.r - p2.r;
  const dg = p1.g - p2.g;
  const db = p1.b - p2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Verificar si un color está dentro de un rango
 */
export function isColorInRange(color: ColorPoint, range: ColorRange, tolerance: number = 0): boolean {
  const tol = range.tolerance ?? tolerance;
  return (
    color.r >= range.r.min - tol &&
    color.r <= range.r.max + tol &&
    color.g >= range.g.min - tol &&
    color.g <= range.g.max + tol &&
    color.b >= range.b.min - tol &&
    color.b <= range.b.max + tol
  );
}

/**
 * Clasificar píxel por color
 */
export function classifyPixelByColor(
  color: ColorPoint,
  config: ColorClassificationConfig = DEFAULT_COLOR_CONFIG
): PixelClassification {
  const soilDist = colorDistance(color, {
    x: 0,
    y: 0,
    r: (config.soil.r.min + config.soil.r.max) / 2,
    g: (config.soil.g.min + config.soil.g.max) / 2,
    b: (config.soil.b.min + config.soil.b.max) / 2,
  });

  const grassDist = colorDistance(color, {
    x: 0,
    y: 0,
    r: (config.grass.r.min + config.grass.r.max) / 2,
    g: (config.grass.g.min + config.grass.g.max) / 2,
    b: (config.grass.b.min + config.grass.b.max) / 2,
  });

  const concreteDist = colorDistance(color, {
    x: 0,
    y: 0,
    r: (config.concrete.r.min + config.concrete.r.max) / 2,
    g: (config.concrete.g.min + config.concrete.g.max) / 2,
    b: (config.concrete.b.min + config.concrete.b.max) / 2,
  });

  // Encontrar el tipo más cercano
  const distances = [
    { type: TType.SOIL, dist: soilDist },
    { type: TType.GRASS, dist: grassDist },
    { type: TType.CONCRETE, dist: concreteDist },
  ];

  distances.sort((a, b) => a.dist - b.dist);
  const closest = distances[0]!;

  // Calcular confianza (inversa de la distancia)
  const maxDist = 255 * Math.sqrt(3);
  const confidence = Math.max(0, 1 - closest.dist / maxDist);

  return {
    type: closest.type,
    confidence,
    distance: closest.dist,
  };
}

/**
 * Clasificar mapa de píxeles desde datos de imagen
 */
export function classifyImagePixels(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  config: ColorClassificationConfig = DEFAULT_COLOR_CONFIG
): ClassificationMap {
  const pixels: ClassifiedPixel[] = [];

  for (let i = 0; i < imageData.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    const r = imageData[i]!;
    const g = imageData[i + 1]!;
    const b = imageData[i + 2]!;

    const color: ColorPoint = { x, y, r, g, b };
    const classification = classifyPixelByColor(color, config);

    pixels.push({
      x,
      y,
      type: classification.type,
      confidence: classification.confidence,
    });
  }

  return {
    width,
    height,
    pixels,
    timestamp: Date.now(),
  };
}

/**
 * Flood fill para extraer zonas conectadas
 */
export function floodFill(
  classificationMap: ClassificationMap,
  startX: number,
  startY: number,
  targetType: TerrainType
): Array<{ x: number; y: number }> {
  const { width, height, pixels } = classificationMap;
  const pixelMap = new Map<string, ClassifiedPixel>();

  for (const pixel of pixels) {
    pixelMap.set(`${pixel.x},${pixel.y}`, pixel);
  }

  const visited = new Set<string>();
  const zone: Array<{ x: number; y: number }> = [];
  const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    const key = `${x},${y}`;

    if (visited.has(key)) continue;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const pixel = pixelMap.get(key);
    if (!pixel || pixel.type !== targetType) continue;

    visited.add(key);
    zone.push({ x, y });

    // Agregar vecinos (4-conectividad)
    queue.push({ x: x + 1, y });
    queue.push({ x: x - 1, y });
    queue.push({ x, y: y + 1 });
    queue.push({ x, y: y - 1 });
  }

  return zone;
}

/**
 * Extraer todas las zonas del mapa de clasificación
 */
export function extractZones(
  classificationMap: ClassificationMap,
  minZoneSize: number = 100
): TerrainZone[] {
  const { width, height, pixels } = classificationMap;
  const visited = new Set<string>();
  const zones: TerrainZone[] = [];

  for (const pixel of pixels) {
    const key = `${pixel.x},${pixel.y}`;
    if (visited.has(key)) continue;

    const zone = floodFill(classificationMap, pixel.x, pixel.y, pixel.type);

    if (zone.length >= minZoneSize) {
      const terrainZone = createTerrainZone(zone, pixel.type);
      zones.push(terrainZone);

      for (const p of zone) {
        visited.add(`${p.x},${p.y}`);
      }
    }
  }

  return zones;
}

/**
 * Crear objeto TerrainZone desde píxeles
 */
export function createTerrainZone(pixels: Array<{ x: number; y: number }>, type: TerrainType): TerrainZone {
  // Calcular bounding box
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  let sumX = 0,
    sumY = 0;

  for (const p of pixels) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    sumX += p.x;
    sumY += p.y;
  }

  // Calcular centroide
  const centroid = {
    x: sumX / pixels.length,
    y: sumY / pixels.length,
  };

  // Crear polígono convexo aproximado (simplificado)
  const polygon = createConvexPolygon(pixels);

  // Calcular área
  const area = calculatePolygonArea(polygon);

  return {
    id: `zone_${Date.now()}_${Math.random()}`,
    type,
    polygon,
    area,
    centroid,
    boundingBox: {
      minX,
      minY,
      maxX,
      maxY,
    },
    pixelCount: pixels.length,
    confidence: 0.8, // Valor por defecto
  };
}

/**
 * Crear polígono convexo aproximado desde píxeles
 */
export function createConvexPolygon(pixels: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (pixels.length < 3) return pixels;

  // Encontrar puntos extremos
  const sorted = [...pixels].sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });

  const lower: Array<{ x: number; y: number }> = [];
  for (const p of sorted) {
    while (lower.length >= 2) {
      const last = lower[lower.length - 1]!;
      const prev = lower[lower.length - 2]!;
      const cross = (last.x - prev.x) * (p.y - prev.y) - (last.y - prev.y) * (p.x - prev.x);
      if (cross <= 0) break;
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Array<{ x: number; y: number }> = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2) {
      const last = upper[upper.length - 1]!;
      const prev = upper[upper.length - 2]!;
      const cross = (last.x - prev.x) * (p.y - prev.y) - (last.y - prev.y) * (p.x - prev.x);
      if (cross <= 0) break;
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();

  return lower.concat(upper);
}

/**
 * Calcular área de polígono usando fórmula de Shoelace
 */
export function calculatePolygonArea(polygon: Array<{ x: number; y: number }>): number {
  if (polygon.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i]!.x * polygon[j]!.y;
    area -= polygon[j]!.x * polygon[i]!.y;
  }

  return Math.abs(area) / 2;
}

/**
 * Segmentar imagen completa
 */
export function segmentTerrain(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  config: ColorClassificationConfig = DEFAULT_COLOR_CONFIG,
  minZoneSize: number = 100
): TerrainSegmentation {
  const classificationMap = classifyImagePixels(imageData, width, height, config);
  const zones = extractZones(classificationMap, minZoneSize);

  const totalArea = width * height;

  return {
    zones,
    imageWidth: width,
    imageHeight: height,
    totalArea,
    timestamp: Date.now(),
    version: "1.0",
  };
}

/**
 * Obtener configuración de color por defecto
 */
export function getDefaultColorConfig(): ColorClassificationConfig {
  return DEFAULT_COLOR_CONFIG;
}

/**
 * Actualizar configuración de color
 */
export function updateColorConfig(
  config: Partial<ColorClassificationConfig>
): ColorClassificationConfig {
  return {
    ...DEFAULT_COLOR_CONFIG,
    ...config,
  };
}

/**
 * Verificar si un punto está dentro de una zona
 */
export function isPointInZone(point: { x: number; y: number }, zone: TerrainZone): boolean {
  const { polygon } = zone;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.x,
      yi = polygon[i]!.y;
    const xj = polygon[j]!.x,
      yj = polygon[j]!.y;

    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Encontrar zona más cercana a un punto
 */
export function findNearestZone(
  point: { x: number; y: number },
  zones: TerrainZone[]
): TerrainZone | null {
  let nearest: TerrainZone | null = null;
  let minDistance = Infinity;

  for (const zone of zones) {
    const dx = zone.centroid.x - point.x;
    const dy = zone.centroid.y - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      nearest = zone;
    }
  }

  return nearest;
}

/**
 * Calcular estadísticas de segmentación
 */
export function getSegmentationStats(segmentation: TerrainSegmentation) {
  const stats = {
    totalZones: segmentation.zones.length,
    zonesByType: {
      soil: 0,
      grass: 0,
      concrete: 0,
      unknown: 0,
    },
    totalArea: 0,
    areaByType: {
      soil: 0,
      grass: 0,
      concrete: 0,
    },
    averageZoneSize: 0,
    largestZone: null as TerrainZone | null,
    smallestZone: null as TerrainZone | null,
  };

  let maxArea = 0,
    minArea = Infinity;

  for (const zone of segmentation.zones) {
    if (zone.type === 'soil' || zone.type === 'grass' || zone.type === 'concrete') {
      stats.zonesByType[zone.type]++;
      stats.areaByType[zone.type] += zone.area;
    } else {
      stats.zonesByType.unknown++;
    }
    stats.totalArea += zone.area;

    if (zone.area > maxArea) {
      maxArea = zone.area;
      stats.largestZone = zone;
    }

    if (zone.area < minArea) {
      minArea = zone.area;
      stats.smallestZone = zone;
    }
  }

  stats.averageZoneSize = stats.totalZones > 0 ? stats.totalArea / stats.totalZones : 0;

  return stats;
}
