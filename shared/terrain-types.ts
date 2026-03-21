/**
 * ============================================================================
 * TERRAIN INTERPRETATION TYPES
 * ============================================================================
 * Types for terrain classification, zone extraction, and placement rules
 */

/**
 * Tipo de zona de terreno
 */
export enum TerrainType {
  SOIL = "soil",
  GRASS = "grass",
  CONCRETE = "concrete",
  UNKNOWN = "unknown",
}

/**
 * Punto 2D con información de color
 */
export interface ColorPoint {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * Zona de terreno clasificada
 */
export interface TerrainZone {
  id: string;
  type: TerrainType;
  polygon: Array<{ x: number; y: number }>;
  area: number;
  centroid: { x: number; y: number };
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  pixelCount: number;
  confidence: number; // 0-1
  metadata?: Record<string, any>;
}

/**
 * Resultado de segmentación de terreno
 */
export interface TerrainSegmentation {
  zones: TerrainZone[];
  imageWidth: number;
  imageHeight: number;
  totalArea: number;
  timestamp: number;
  version: string;
}

/**
 * Clasificación de píxel
 */
export interface PixelClassification {
  type: TerrainType;
  confidence: number;
  distance: number; // Distancia al color de referencia
}

/**
 * Rango de color RGB
 */
export interface ColorRange {
  r: { min: number; max: number };
  g: { min: number; max: number };
  b: { min: number; max: number };
  tolerance?: number; // Tolerancia adicional
}

/**
 * Configuración de clasificación de color
 */
export interface ColorClassificationConfig {
  soil: ColorRange;
  grass: ColorRange;
  concrete: ColorRange;
  tolerance: number; // Tolerancia global (0-255)
}

/**
 * Tipo de planta
 */
export enum PlantType {
  FLOWERING = "flowering",
  SHRUB = "shrub",
  TREE = "tree",
  GROUNDCOVER = "groundcover",
  DECORATIVE = "decorative",
}

/**
 * Restricción de colocación por zona
 */
export interface PlacementRule {
  plantType: PlantType;
  allowedZones: TerrainType[];
  minZoneArea?: number;
  maxZoneArea?: number;
  minDistance?: number; // Distancia mínima a otras zonas
}

/**
 * Reglas de compatibilidad
 */
export interface CompatibilityRules {
  rules: PlacementRule[];
  defaultRule?: PlacementRule;
}

/**
 * Validación de colocación en zona
 */
export interface ZonePlacementValidation {
  isValid: boolean;
  zone: TerrainZone | null;
  plantType: PlantType;
  reason?: string;
  alternatives?: TerrainZone[];
}

/**
 * Validación de diseño por zonas
 */
export interface DesignValidation {
  isValid: boolean;
  hasValidZones: boolean;
  zonesCovered: number;
  totalZones: number;
  plantsByZone: Map<string, number>;
  errors: DesignError[];
  warnings: DesignWarning[];
  coverage: {
    soil: number;
    grass: number;
    concrete: number;
  };
}

/**
 * Error de diseño
 */
export interface DesignError {
  type: "no_zones" | "invalid_plant_placement" | "insufficient_coverage" | "zone_conflict";
  message: string;
  affectedZones?: string[];
  affectedPlants?: string[];
}

/**
 * Warning de diseño
 */
export interface DesignWarning {
  type: "low_coverage" | "unbalanced_zones" | "sparse_planting";
  message: string;
  severity: "low" | "medium" | "high";
}

/**
 * Análisis de cobertura
 */
export interface CoverageAnalysis {
  totalArea: number;
  coveredArea: number;
  coveragePercentage: number;
  byZone: {
    type: TerrainType;
    area: number;
    percentage: number;
    plantCount: number;
  }[];
}

/**
 * Recomendación de mejora
 */
export interface DesignRecommendation {
  type: "add_plants" | "remove_plants" | "reposition" | "change_type";
  description: string;
  zone: TerrainZone;
  priority: "low" | "medium" | "high";
  expectedImprovement: number; // 0-1
}

/**
 * Configuración del motor de terreno
 */
export interface TerrainEngineConfig {
  colorClassification: ColorClassificationConfig;
  compatibilityRules: CompatibilityRules;
  minZoneArea?: number; // Área mínima para considerar una zona
  maxZoneArea?: number;
  smoothingRadius?: number; // Para suavizar bordes
}

/**
 * Estadísticas de terreno
 */
export interface TerrainStats {
  totalZones: number;
  zonesByType: {
    soil: number;
    grass: number;
    concrete: number;
    unknown: number;
  };
  totalArea: number;
  areaByType: {
    soil: number;
    grass: number;
    concrete: number;
  };
  averageZoneSize: number;
  largestZone: TerrainZone | null;
  smallestZone: TerrainZone | null;
}

/**
 * Resultado de procesamiento de terreno
 */
export interface TerrainProcessingResult {
  success: boolean;
  segmentation?: TerrainSegmentation;
  stats?: TerrainStats;
  error?: string;
  warnings?: string[];
  processingTime: number; // milliseconds
}

/**
 * Zona con información de plantas
 */
export interface ZoneWithPlants extends TerrainZone {
  plants: Array<{
    id: string;
    type: PlantType;
    position: { x: number; y: number };
    radius: number;
  }>;
}

/**
 * Exportación de diseño con zonas
 */
export interface DesignExport {
  zones: TerrainZone[];
  plants: Array<{
    id: string;
    type: PlantType;
    position: { x: number; y: number };
    radius: number;
    zoneId: string;
  }>;
  validation: DesignValidation;
  timestamp: number;
}

/**
 * Configuración de detección de color
 */
export interface ColorDetectionConfig {
  method: "range" | "kmeans" | "neural";
  threshold: number;
  minClusterSize: number;
}

/**
 * Píxel clasificado
 */
export interface ClassifiedPixel {
  x: number;
  y: number;
  type: TerrainType;
  confidence: number;
}

/**
 * Mapa de clasificación
 */
export interface ClassificationMap {
  width: number;
  height: number;
  pixels: ClassifiedPixel[];
  timestamp: number;
}
