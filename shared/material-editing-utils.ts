/**
 * Material Editing Utilities
 * ============================================================================
 * Funciones para edición de materiales de terreno en vivo
 */

/**
 * Tipos de materiales
 */
export enum MaterialType {
  GRASS = "grass",
  SOIL = "soil",
  CONCRETE = "concrete",
  GRAVEL = "gravel",
}

/**
 * Información de material
 */
export interface MaterialInfo {
  type: MaterialType;
  name: string;
  color: string;
  costPerUnit: number;
  description: string;
}

/**
 * Punto de área
 */
export interface AreaPoint {
  x: number;
  y: number;
}

/**
 * Resultado de aplicación de material
 */
export interface ApplyMaterialResult {
  success: boolean;
  material: MaterialType;
  areaSize: number;
  costAdded: number;
  message: string;
}

/**
 * Resultado de limpieza de área
 */
export interface CleanAreaResult {
  success: boolean;
  areaSize: number;
  objectsRemoved: string[];
  costSaved: number;
  message: string;
}

/**
 * Mapa de materiales
 */
export const MATERIAL_MAP: Record<MaterialType, MaterialInfo> = {
  [MaterialType.GRASS]: {
    type: MaterialType.GRASS,
    name: "Pasto",
    color: "#4ECDC4",
    costPerUnit: 5,
    description: "Área de pasto verde",
  },
  [MaterialType.SOIL]: {
    type: MaterialType.SOIL,
    name: "Tierra",
    color: "#8B7355",
    costPerUnit: 3,
    description: "Área de tierra/suelo",
  },
  [MaterialType.CONCRETE]: {
    type: MaterialType.CONCRETE,
    name: "Concreto",
    color: "#A9A9A9",
    costPerUnit: 15,
    description: "Área de concreto/pavimento",
  },
  [MaterialType.GRAVEL]: {
    type: MaterialType.GRAVEL,
    name: "Grava",
    color: "#D3D3D3",
    costPerUnit: 8,
    description: "Área de grava/piedras",
  },
};

/**
 * Calcular área a partir de puntos (fórmula de Shoelace)
 */
export function calculateAreaFromPoints(points: AreaPoint[]): number {
  if (points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }

  return Math.abs(area) / 2;
}

/**
 * Calcular costo de material
 */
export function calculateMaterialCost(
  material: MaterialType,
  areaSize: number
): number {
  const materialInfo = MATERIAL_MAP[material];
  if (!materialInfo) {
    return 0;
  }

  return Math.round(areaSize * materialInfo.costPerUnit * 100) / 100;
}

/**
 * Validar puntos de área
 */
export function validateAreaPoints(points: AreaPoint[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (points.length < 3) {
    errors.push("Se necesitan al menos 3 puntos para definir un área");
  }

  // Verificar que los puntos no estén duplicados
  const uniquePoints = new Set(points.map((p) => `${p.x},${p.y}`));
  if (uniquePoints.size !== points.length) {
    errors.push("Hay puntos duplicados en el área");
  }

  // Verificar que el área sea válida (no auto-intersectante)
  if (points.length > 3) {
    const area = calculateAreaFromPoints(points);
    if (area < 10) {
      errors.push("El área es demasiado pequeña");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Detectar objetos dentro de un área
 */
export function detectObjectsInArea(
  objects: Array<{ id: string; x: number; y: number; radius: number }>,
  areaPoints: AreaPoint[]
): string[] {
  const objectsInArea: string[] = [];

  for (const obj of objects) {
    if (isPointInPolygon(obj.x, obj.y, areaPoints)) {
      objectsInArea.push(obj.id);
    }
  }

  return objectsInArea;
}

/**
 * Verificar si un punto está dentro de un polígono (ray casting)
 */
export function isPointInPolygon(x: number, y: number, polygon: AreaPoint[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Crear resultado de aplicación de material
 */
export function createApplyMaterialResult(
  material: MaterialType,
  areaPoints: AreaPoint[]
): ApplyMaterialResult {
  const areaSize = calculateAreaFromPoints(areaPoints);
  const cost = calculateMaterialCost(material, areaSize);
  const materialInfo = MATERIAL_MAP[material];

  return {
    success: true,
    material,
    areaSize,
    costAdded: cost,
    message: `Material ${materialInfo.name} aplicado. Área: ${areaSize.toFixed(2)} m², Costo: $${cost}`,
  };
}

/**
 * Crear resultado de limpieza de área
 */
export function createCleanAreaResult(
  objects: Array<{ id: string; x: number; y: number; radius: number }>,
  areaPoints: AreaPoint[]
): CleanAreaResult {
  const objectsRemoved = detectObjectsInArea(objects, areaPoints);
  const areaSize = calculateAreaFromPoints(areaPoints);

  // Estimar costo ahorrado (promedio de $50 por objeto)
  const costSaved = objectsRemoved.length * 50;

  return {
    success: true,
    areaSize,
    objectsRemoved,
    costSaved,
    message: `Área limpia. Objetos removidos: ${objectsRemoved.length}, Costo ahorrado: $${costSaved}`,
  };
}

/**
 * Validar cambio de material
 */
export function validateMaterialChange(
  currentMaterial: MaterialType,
  newMaterial: MaterialType
): {
  isValid: boolean;
  message: string;
} {
  if (currentMaterial === newMaterial) {
    return {
      isValid: false,
      message: "El material es igual al actual",
    };
  }

  const currentInfo = MATERIAL_MAP[currentMaterial];
  const newInfo = MATERIAL_MAP[newMaterial];

  if (!currentInfo || !newInfo) {
    return {
      isValid: false,
      message: "Material inválido",
    };
  }

  const costDifference = newInfo.costPerUnit - currentInfo.costPerUnit;
  const message =
    costDifference > 0
      ? `Cambio a ${newInfo.name} (+$${costDifference}/unidad)`
      : `Cambio a ${newInfo.name} (-$${Math.abs(costDifference)}/unidad)`;

  return {
    isValid: true,
    message,
  };
}

/**
 * Simplificar puntos de área (reducir puntos cercanos)
 */
export function simplifyAreaPoints(
  points: AreaPoint[],
  tolerance: number = 5
): AreaPoint[] {
  if (points.length <= 2) {
    return points;
  }

  const simplified: AreaPoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const lastPoint = simplified[simplified.length - 1];
    const distance = Math.sqrt(
      Math.pow(points[i].x - lastPoint.x, 2) +
        Math.pow(points[i].y - lastPoint.y, 2)
    );

    if (distance > tolerance) {
      simplified.push(points[i]);
    }
  }

  // Verificar distancia del último punto al primero
  const lastPoint = simplified[simplified.length - 1];
  const firstPoint = simplified[0];
  const distance = Math.sqrt(
    Math.pow(lastPoint.x - firstPoint.x, 2) +
      Math.pow(lastPoint.y - firstPoint.y, 2)
  );

  if (distance > tolerance) {
    simplified.push(firstPoint);
  }

  return simplified;
}

/**
 * Calcular centroide de área
 */
export function calculateAreaCentroid(points: AreaPoint[]): AreaPoint {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  let sumX = 0;
  let sumY = 0;

  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }

  return {
    x: sumX / points.length,
    y: sumY / points.length,
  };
}

/**
 * Expandir área (buffer)
 */
export function expandArea(
  points: AreaPoint[],
  buffer: number
): AreaPoint[] {
  const centroid = calculateAreaCentroid(points);

  return points.map((point) => {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      return point;
    }

    const ratio = (distance + buffer) / distance;

    return {
      x: centroid.x + dx * ratio,
      y: centroid.y + dy * ratio,
    };
  });
}
