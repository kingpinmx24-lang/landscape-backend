import type {
  GeometricObject,
  PlacementValidation,
  PlacementError,
  PlacementWarning,
  LayoutValidation,
  BoundingBox,
  SpatialGrid,
  PlacementErrorType,
} from "./geometry-types";
import { PlacementErrorType as ErrorType } from "./geometry-types";
import {
  detectCollisions,
  detectAllCollisions,
  isCollisionFree,
  areTooClose,
  getCollisionStats,
} from "./geometry-collision";

/**
 * ============================================================================
 * PLACEMENT VALIDATION SYSTEM
 * ============================================================================
 * Validate object placement and detect conflicts
 */

/**
 * Validar si un objeto puede colocarse en una posición
 */
export function validatePlacement(
  object: GeometricObject,
  spatialGrid: SpatialGrid,
  bounds: BoundingBox,
  minimumSpacing: number = 0
): PlacementValidation {
  const errors: PlacementError[] = [];
  const warnings: PlacementWarning[] = [];

  // 1. Validar que el objeto está dentro de los límites
  if (
    object.position.x - object.radius < bounds.minX ||
    object.position.x + object.radius > bounds.maxX ||
    object.position.y - object.radius < bounds.minY ||
    object.position.y + object.radius > bounds.maxY
  ) {
    errors.push({
      type: ErrorType.OUT_OF_BOUNDS,
      message: "Object position is outside the allowed bounds",
      severity: "error",
    });
  }

  // 2. Validar que el radio es válido
  if (object.radius <= 0) {
    errors.push({
      type: ErrorType.INVALID_RADIUS,
      message: "Object radius must be greater than 0",
      severity: "error",
    });
  }

  // 3. Validar que la posición es válida
  if (!Number.isFinite(object.position.x) || !Number.isFinite(object.position.y)) {
    errors.push({
      type: ErrorType.INVALID_POSITION,
      message: "Object position contains invalid coordinates",
      severity: "error",
    });
  }

  // 4. Detectar colisiones
  const collisions = detectCollisions(object, spatialGrid);

  if (collisions.hasCollision) {
    errors.push({
      type: ErrorType.COLLISION_DETECTED,
      message: `Object collides with ${collisions.collidingObjects.length} other object(s)`,
      severity: "error",
      affectedObjects: collisions.collidingObjects,
    });
  }

  // 5. Validar espaciado mínimo
  if (minimumSpacing > 0 && collisions.minimumDistance < object.radius * 2 + minimumSpacing) {
    warnings.push({
      message: `Object is closer than recommended minimum spacing (${minimumSpacing}m)`,
      minimumClearance: object.radius * 2 + minimumSpacing - collisions.minimumDistance,
    });
  }

  // 6. Validar que hay espacio suficiente
  const availableSpace = Math.min(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY
  );

  if (object.radius * 2 > availableSpace) {
    errors.push({
      type: ErrorType.INSUFFICIENT_SPACE,
      message: "Object is too large for the available space",
      severity: "error",
    });
  }

  const isValid = errors.length === 0;
  const canPlace = isValid && collisions.hasCollision === false;

  return {
    isValid,
    canPlace,
    errors,
    warnings,
    collisions,
  };
}

/**
 * Validar layout completo
 */
export function validateLayout(
  objects: GeometricObject[],
  spatialGrid: SpatialGrid,
  bounds: BoundingBox,
  minimumSpacing: number = 0
): LayoutValidation {
  const errors: PlacementError[] = [];
  const collisions = detectAllCollisions(spatialGrid);
  const stats = getCollisionStats(spatialGrid);

  let validObjects = 0;
  const invalidObjectIds = new Set<string>();

  // Validar cada objeto
  for (const obj of objects) {
    const validation = validatePlacement(obj, spatialGrid, bounds, minimumSpacing);

    if (validation.isValid) {
      validObjects++;
    } else {
      invalidObjectIds.add(obj.id);
      errors.push(...validation.errors);
    }
  }

  // Calcular cobertura
  const totalArea = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
  let usedArea = 0;

  for (const obj of objects) {
    usedArea += Math.PI * obj.radius * obj.radius;
  }

  const coverage = (usedArea / totalArea) * 100;

  return {
    isValid: errors.length === 0 && collisions.length === 0,
    totalObjects: objects.length,
    validObjects,
    invalidObjects: invalidObjectIds.size,
    collisions: collisions.map((c) => ({
      object1: c.object1Id,
      object2: c.object2Id,
      distance: c.distance,
      requiredDistance: 0, // Será calculado
    })),
    errors,
    coverage,
  };
}

/**
 * Obtener lista de objetos que colisionan
 */
export function getCollidingObjects(
  object: GeometricObject,
  spatialGrid: SpatialGrid
): GeometricObject[] {
  const collision = detectCollisions(object, spatialGrid);
  return collision.collidingObjects
    .map((id) => spatialGrid.getById(id))
    .filter((obj): obj is GeometricObject => obj !== undefined);
}

/**
 * Verificar si el layout es válido (sin colisiones)
 */
export function isLayoutValid(
  spatialGrid: SpatialGrid,
  bounds: BoundingBox,
  minimumSpacing: number = 0
): boolean {
  const objects = spatialGrid.getAll();
  const validation = validateLayout(objects, spatialGrid, bounds, minimumSpacing);
  return validation.isValid;
}

/**
 * Obtener objetos problemáticos
 */
export function getProblematicObjects(
  spatialGrid: SpatialGrid,
  bounds: BoundingBox,
  minimumSpacing: number = 0
): GeometricObject[] {
  const objects = spatialGrid.getAll();
  const problematic: GeometricObject[] = [];

  for (const obj of objects) {
    const validation = validatePlacement(obj, spatialGrid, bounds, minimumSpacing);
    if (!validation.isValid) {
      problematic.push(obj);
    }
  }

  return problematic;
}

/**
 * Generar mensaje de error detallado
 */
export function getDetailedErrorMessage(
  validation: PlacementValidation
): string {
  if (validation.isValid) {
    return "Object placement is valid";
  }

  const errorMessages = validation.errors.map((err) => {
    let msg = `• ${err.message}`;
    if (err.affectedObjects && err.affectedObjects.length > 0) {
      msg += ` (affects: ${err.affectedObjects.join(", ")})`;
    }
    return msg;
  });

  const warningMessages = validation.warnings.map((warn) => {
    let msg = `⚠ ${warn.message}`;
    if (warn.minimumClearance) {
      msg += ` (need ${warn.minimumClearance.toFixed(2)}m more clearance)`;
    }
    return msg;
  });

  return [
    "Placement Errors:",
    ...errorMessages,
    ...(warningMessages.length > 0 ? ["Warnings:", ...warningMessages] : []),
  ].join("\n");
}

/**
 * Crear error de colocación
 */
export function createPlacementError(
  type: PlacementErrorType,
  message: string,
  affectedObjects?: string[]
): PlacementError {
  return {
    type,
    message,
    severity: "error",
    affectedObjects,
  };
}

/**
 * Crear warning de colocación
 */
export function createPlacementWarning(
  message: string,
  affectedObjects?: string[],
  minimumClearance?: number
): PlacementWarning {
  return {
    message,
    affectedObjects,
    minimumClearance,
  };
}

/**
 * Validar batch de objetos
 */
export function validateBatch(
  objects: GeometricObject[],
  spatialGrid: SpatialGrid,
  bounds: BoundingBox,
  minimumSpacing: number = 0
): Map<string, PlacementValidation> {
  const results = new Map<string, PlacementValidation>();

  for (const obj of objects) {
    results.set(obj.id, validatePlacement(obj, spatialGrid, bounds, minimumSpacing));
  }

  return results;
}

/**
 * Obtener resumen de validación
 */
export function getValidationSummary(
  validation: LayoutValidation
): string {
  return `
Layout Validation Summary:
- Total Objects: ${validation.totalObjects}
- Valid Objects: ${validation.validObjects}
- Invalid Objects: ${validation.invalidObjects}
- Collisions Detected: ${validation.collisions.length}
- Space Coverage: ${validation.coverage?.toFixed(2)}%
- Status: ${validation.isValid ? "✓ VALID" : "✗ INVALID"}
  `.trim();
}
