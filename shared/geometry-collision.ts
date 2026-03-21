import type {
  GeometricObject,
  CollisionResult,
  CollisionPair,
  Point2D,
  SpatialGrid,
} from "./geometry-types";

/**
 * ============================================================================
 * COLLISION DETECTION SYSTEM
 * ============================================================================
 * Efficient collision detection using spatial grid
 */

/**
 * Calcular distancia entre dos puntos
 */
export function distance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Detectar colisión entre dos círculos
 */
export function detectCircleCollision(obj1: GeometricObject, obj2: GeometricObject): boolean {
  const dist = distance(obj1.position, obj2.position);
  const minDistance = obj1.radius + obj2.radius;
  return dist < minDistance;
}

/**
 * Calcular penetración (overlap) entre dos círculos
 */
export function calculatePenetration(obj1: GeometricObject, obj2: GeometricObject): number {
  const dist = distance(obj1.position, obj2.position);
  const minDistance = obj1.radius + obj2.radius;
  return Math.max(0, minDistance - dist);
}

/**
 * Detectar colisiones de un objeto con otros
 */
export function detectCollisions(
  object: GeometricObject,
  spatialGrid: SpatialGrid
): CollisionResult {
  const searchRadius = object.radius * 3; // Buscar en área expandida
  const nearby = spatialGrid.getNearby(object.position, searchRadius);

  const collidingObjects: string[] = [];
  let minimumDistance = Infinity;

  for (const other of nearby) {
    if (other.id === object.id) continue;

    const dist = distance(object.position, other.position);
    const minDist = object.radius + other.radius;

    minimumDistance = Math.min(minimumDistance, dist);

    if (dist < minDist) {
      collidingObjects.push(other.id);
    }
  }

  const penetration = calculatePenetration(object, {
    ...object,
    position: object.position,
  });

  return {
    hasCollision: collidingObjects.length > 0,
    collidingObjects,
    minimumDistance,
    requiredDistance: object.radius * 2,
    penetrationDepth: penetration,
  };
}

/**
 * Detectar todas las colisiones en el layout
 */
export function detectAllCollisions(spatialGrid: SpatialGrid): CollisionPair[] {
  const collisions: CollisionPair[] = [];
    const objects = spatialGrid.getAll();
  const processed = new Set<string>();

  for (const obj1 of objects) {
    for (const obj2 of objects) {
      if (obj1.id === obj2.id) continue;

      const pairKey = [obj1.id, obj2.id].sort().join("-");
      if (processed.has(pairKey)) continue;

      processed.add(pairKey);

      const dist = distance(obj1.position, obj2.position);
      const minDist = obj1.radius + obj2.radius;

      if (dist < minDist) {
        collisions.push({
          object1Id: obj1.id,
          object2Id: obj2.id,
          distance: dist,
          overlap: minDist - dist,
        });
      }
    }
  }

  return collisions;
}

/**
 * Validar que un objeto NO colisiona con otros
 */
export function isCollisionFree(
  object: GeometricObject,
  spatialGrid: SpatialGrid
): boolean {
  const collision = detectCollisions(object, spatialGrid);
  return !collision.hasCollision;
}

/**
 * Encontrar la distancia mínima requerida entre dos objetos
 */
export function getMinimumRequiredDistance(obj1: GeometricObject, obj2: GeometricObject): number {
  return obj1.radius + obj2.radius;
}

/**
 * Verificar si dos objetos están demasiado cerca
 */
export function areTooClose(
  obj1: GeometricObject,
  obj2: GeometricObject,
  minSpacing: number = 0
): boolean {
  const dist = distance(obj1.position, obj2.position);
  const requiredDist = obj1.radius + obj2.radius + minSpacing;
  return dist < requiredDist;
}

/**
 * Calcular distancia de separación necesaria
 */
export function calculateSeparationDistance(
  obj1: GeometricObject,
  obj2: GeometricObject
): number {
  const dist = distance(obj1.position, obj2.position);
  const minDist = obj1.radius + obj2.radius;
  return Math.max(0, minDist - dist);
}

/**
 * Obtener dirección de separación entre dos objetos
 */
export function getSeparationDirection(obj1: GeometricObject, obj2: GeometricObject): Point2D {
  const dx = obj2.position.x - obj1.position.x;
  const dy = obj2.position.y - obj1.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) {
    return { x: 1, y: 0 }; // Default direction
  }

  return {
    x: dx / dist,
    y: dy / dist,
  };
}

/**
 * Calcular posición de separación para un objeto
 */
export function calculateSeparationPosition(
  obj1: GeometricObject,
  obj2: GeometricObject
): Point2D {
  const separation = calculateSeparationDistance(obj1, obj2);
  const direction = getSeparationDirection(obj1, obj2);

  return {
    x: obj1.position.x - direction.x * (separation / 2),
    y: obj1.position.y - direction.y * (separation / 2),
  };
}

/**
 * Encontrar posición válida más cercana para un objeto
 */
export function findNearestValidPosition(
  targetPosition: Point2D,
  object: GeometricObject,
  spatialGrid: SpatialGrid,
  maxSearchRadius: number = 100,
  searchStep: number = 1
): Point2D | null {
  // Primero, verificar si la posición objetivo es válida
  const testObj = { ...object, position: targetPosition };
  if (isCollisionFree(testObj, spatialGrid)) {
    return targetPosition;
  }

  // Búsqueda en espiral
  for (let radius = searchStep; radius <= maxSearchRadius; radius += searchStep) {
    const steps = Math.ceil((2 * Math.PI * radius) / searchStep);

    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const testPos: Point2D = {
        x: targetPosition.x + radius * Math.cos(angle),
        y: targetPosition.y + radius * Math.sin(angle),
      };

      const testObj2 = { ...object, position: testPos };
      if (isCollisionFree(testObj2, spatialGrid)) {
        return testPos;
      }
    }
  }

  return null;
}

/**
 * Calcular estadísticas de colisiones
 */
export function getCollisionStats(spatialGrid: SpatialGrid) {
  const collisions = detectAllCollisions(spatialGrid);
  const objects = spatialGrid.getAll();

  let totalPenetration = 0;
  let maxPenetration = 0;

  for (const collision of collisions) {
    totalPenetration += collision.overlap;
    maxPenetration = Math.max(maxPenetration, collision.overlap);
  }

  return {
    totalCollisions: collisions.length,
    totalObjects: objects.length,
    collidingObjects: new Set(
      collisions.flatMap((c) => [c.object1Id, c.object2Id])
    ).size,
    totalPenetration,
    maxPenetration,
    averagePenetration: collisions.length > 0 ? totalPenetration / collisions.length : 0,
  };
}
