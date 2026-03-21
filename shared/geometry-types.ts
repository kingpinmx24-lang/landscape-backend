/**
 * ============================================================================
 * GEOMETRY ENGINE TYPES
 * ============================================================================
 * Types for geometric objects, collision detection, and spatial indexing
 */

/**
 * 2D Point
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Geometric object with position and radius
 */
export interface GeometricObject {
  id: string;
  position: Point2D;
  radius: number; // spacing/buffer zone
  type: ObjectType;
  metadata?: Record<string, any>;
}

/**
 * Type of geometric object
 */
export enum ObjectType {
  PLANT = "plant",
  TREE = "tree",
  STRUCTURE = "structure",
  OBSTACLE = "obstacle",
  ZONE = "zone",
}

/**
 * Collision detection result
 */
export interface CollisionResult {
  hasCollision: boolean;
  collidingObjects: string[]; // IDs of colliding objects
  minimumDistance: number;
  requiredDistance: number;
  penetrationDepth: number; // How much objects overlap
}

/**
 * Validation result for object placement
 */
export interface PlacementValidation {
  isValid: boolean;
  canPlace: boolean;
  errors: PlacementError[];
  warnings: PlacementWarning[];
  collisions: CollisionResult;
}

/**
 * Placement error types
 */
export enum PlacementErrorType {
  OUT_OF_BOUNDS = "out_of_bounds",
  COLLISION_DETECTED = "collision_detected",
  INSUFFICIENT_SPACE = "insufficient_space",
  INVALID_POSITION = "invalid_position",
  INVALID_RADIUS = "invalid_radius",
}

/**
 * Placement error
 */
export interface PlacementError {
  type: PlacementErrorType;
  message: string;
  severity: "error" | "warning";
  affectedObjects?: string[];
}

/**
 * Placement warning
 */
export interface PlacementWarning {
  message: string;
  affectedObjects?: string[];
  minimumClearance?: number;
}

/**
 * Layout validation result
 */
export interface LayoutValidation {
  isValid: boolean;
  totalObjects: number;
  validObjects: number;
  invalidObjects: number;
  collisions: Array<{
    object1: string;
    object2: string;
    distance: number;
    requiredDistance: number;
  }>;
  errors: PlacementError[];
  coverage?: number; // Percentage of space utilized
}

/**
 * Spatial grid configuration
 */
export interface SpatialGridConfig {
  width: number;
  height: number;
  cellSize: number;
  maxObjectsPerCell?: number;
}

/**
 * Grid cell
 */
export interface GridCell {
  x: number;
  y: number;
  objects: GeometricObject[];
}

/**
 * Spatial grid
 */
export interface SpatialGrid {
  config: SpatialGridConfig;
  cells: Map<string, GridCell>;
  objects: Map<string, GeometricObject>;
  insert(obj: GeometricObject): void;
  remove(objectId: string): void;
  update(obj: GeometricObject): void;
  getNearby(position: Point2D, searchRadius: number): GeometricObject[];
  getInArea(minX: number, minY: number, maxX: number, maxY: number): GeometricObject[];
  getAll(): GeometricObject[];
  getById(id: string): GeometricObject | undefined;
  clear(): void;
  getStats(): any;
}

/**
 * Bounding circle
 */
export interface BoundingCircle {
  center: Point2D;
  radius: number;
}

/**
 * Bounding box
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Collision pair
 */
export interface CollisionPair {
  object1Id: string;
  object2Id: string;
  distance: number;
  overlap: number;
}

/**
 * Geometry engine configuration
 */
export interface GeometryEngineConfig {
  bounds: BoundingBox;
  spatialGridConfig: SpatialGridConfig;
  minimumSpacing: number; // Global minimum spacing between objects
  enableGridOptimization: boolean;
}

/**
 * Geometry engine statistics
 */
export interface GeometryEngineStats {
  totalObjects: number;
  gridCells: number;
  occupiedCells: number;
  averageObjectsPerCell: number;
  collisionCheckTime: number; // milliseconds
  lastUpdateTime: number;
}

/**
 * Object placement suggestion
 */
export interface PlacementSuggestion {
  position: Point2D;
  distance: number; // Distance from requested position
  isValid: boolean;
  confidence: number; // 0-1
}

/**
 * Geometry operation result
 */
export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

/**
 * Collision detection algorithm type
 */
export enum CollisionAlgorithm {
  BRUTE_FORCE = "brute_force",
  SPATIAL_GRID = "spatial_grid",
  QUADTREE = "quadtree",
  BOUNDING_VOLUME = "bounding_volume",
}

/**
 * Geometry engine options
 */
export interface GeometryEngineOptions {
  algorithm: CollisionAlgorithm;
  enableCaching: boolean;
  enableValidation: boolean;
  strictMode: boolean; // Reject any overlaps
}

/**
 * Cached collision data
 */
export interface CollisionCache {
  objectId: string;
  cachedAt: number;
  collisions: CollisionPair[];
  ttl: number; // Time to live in milliseconds
}

/**
 * Geometry export format
 */
export interface GeometryExport {
  objects: GeometricObject[];
  layout: LayoutValidation;
  timestamp: number;
  version: string;
}
