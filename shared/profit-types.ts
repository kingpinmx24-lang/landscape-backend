/**
 * ============================================================================
 * PROFIT ENGINE TYPES
 * ============================================================================
 * Types for plant inventory, scoring, and design optimization
 */

import type { PlantType, TerrainType } from "./terrain-types";

/**
 * Información de costo y margen de una planta
 */
export interface PlantCost {
  purchasePrice: number; // Precio de compra
  sellingPrice: number; // Precio de venta
  margin: number; // Margen (calculado: sellingPrice - purchasePrice)
  marginPercentage: number; // Porcentaje de margen
}

/**
 * Información de mantenimiento de una planta
 */
export interface MaintenanceInfo {
  frequency: "low" | "medium" | "high"; // Frecuencia de mantenimiento
  costPerYear: number; // Costo anual de mantenimiento
  difficulty: "easy" | "moderate" | "hard"; // Dificultad
  waterNeeds: "low" | "medium" | "high"; // Necesidades de agua
  sunlight: "full_sun" | "partial_shade" | "full_shade"; // Requerimientos de luz
}

/**
 * Información visual de una planta
 */
export interface VisualInfo {
  color: string; // Color principal (hex)
  height: number; // Altura en metros
  width: number; // Ancho en metros
  season: "spring" | "summer" | "fall" | "winter" | "year_round"; // Mejor temporada
  visualScore: number; // Score visual (0-100)
  aestheticCategory: "flowering" | "foliage" | "structural" | "groundcover";
}

/**
 * Compatibilidad con otras plantas
 */
export interface PlantCompatibility {
  compatibleWith: string[]; // IDs de plantas compatibles
  incompatibleWith: string[]; // IDs de plantas incompatibles
  compatibilityScore: number; // Score de compatibilidad (0-100)
  groupingPreference: "solitary" | "pairs" | "groups" | "mass"; // Preferencia de agrupación
}

/**
 * Información de disponibilidad en inventario
 */
export interface InventoryInfo {
  available: number; // Cantidad disponible
  reserved: number; // Cantidad reservada
  reorderLevel: number; // Nivel de reorden
  reorderQuantity: number; // Cantidad a reordenar
  lastRestockDate: number; // Timestamp del último reabastecimiento
}

/**
 * Definición completa de una planta
 */
export interface PlantDefinition {
  id: string;
  name: string;
  type: PlantType;
  allowedZones: TerrainType[];
  cost: PlantCost;
  maintenance: MaintenanceInfo;
  visual: VisualInfo;
  compatibility: PlantCompatibility;
  inventory: InventoryInfo;
  spacing: number; // Espaciado mínimo requerido en metros
  minArea?: number; // Área mínima de zona requerida
  maxArea?: number; // Área máxima de zona permitida
  metadata?: Record<string, any>;
}

/**
 * Scoring de una planta
 */
export interface PlantScore {
  plantId: string;
  marginScore: number; // 0-100, ponderación 0.4
  visualScore: number; // 0-100, ponderación 0.3
  maintenanceScore: number; // 0-100, ponderación 0.1
  compatibilityScore: number; // 0-100, ponderación 0.2
  totalScore: number; // Score ponderado final (0-100)
  profitability: "low" | "medium" | "high";
}

/**
 * Colocación de planta en diseño
 */
export interface PlantPlacement {
  id: string;
  plantId: string;
  position: { x: number; y: number };
  radius: number;
  zoneId: string;
  quantity: number;
  score: PlantScore;
}

/**
 * Diseño generado
 */
export interface GeneratedDesign {
  id: string;
  type: DesignType;
  placements: PlantPlacement[];
  totalCost: number;
  totalRevenue: number;
  totalMargin: number;
  profitMarginPercentage: number;
  averageScore: number;
  visualScore: number;
  maintenanceScore: number;
  plantCount: number;
  uniquePlants: number;
  timestamp: number;
}

/**
 * Tipo de diseño
 */
export enum DesignType {
  BALANCED = "balanced", // Balance entre ganancia y estética
  PREMIUM = "premium", // Máxima estética, ganancia secundaria
  HIGH_PROFIT = "high_profit", // Máxima ganancia, estética secundaria
}

/**
 * Configuración de generación de diseño
 */
export interface DesignGenerationConfig {
  designType?: DesignType;
  maxPlants?: number; // Máximo de plantas
  minPlants?: number; // Mínimo de plantas
  budget?: number; // Presupuesto máximo
  prioritizeMargin?: boolean;
  prioritizeVisuals?: boolean;
  allowRepetition?: boolean; // Permitir repetición de plantas
  maxRepetition?: number; // Máximo de repeticiones de la misma planta
}

/**
 * Reporte de ganancia
 */
export interface ProfitReport {
  design: GeneratedDesign;
  breakdown: {
    byPlant: Array<{
      plantId: string;
      plantName: string;
      quantity: number;
      unitCost: number;
      unitRevenue: number;
      totalCost: number;
      totalRevenue: number;
      totalMargin: number;
    }>;
    byZone: Array<{
      zoneId: string;
      zoneType: TerrainType;
      plantCount: number;
      totalCost: number;
      totalRevenue: number;
      totalMargin: number;
    }>;
  };
  metrics: {
    costPerPlant: number;
    revenuePerPlant: number;
    marginPerPlant: number;
    roi: number; // Return on Investment
    profitMargin: number;
  };
  recommendations: ProfitRecommendation[];
}

/**
 * Recomendación de mejora de ganancia
 */
export interface ProfitRecommendation {
  type: "replace" | "add" | "remove" | "adjust_spacing";
  description: string;
  currentPlantId?: string;
  suggestedPlantId?: string;
  expectedMarginIncrease: number;
  expectedVisualImpact: number;
  priority: "low" | "medium" | "high";
}

/**
 * Análisis de inventario
 */
export interface InventoryAnalysis {
  totalAvailable: number;
  totalReserved: number;
  byPlant: Array<{
    plantId: string;
    plantName: string;
    available: number;
    reserved: number;
    reorderLevel: number;
    status: "in_stock" | "low_stock" | "out_of_stock";
  }>;
  recommendations: string[];
}

/**
 * Configuración del Profit Engine
 */
export interface ProfitEngineConfig {
  marginWeight: number; // 0.4
  visualWeight: number; // 0.3
  maintenanceWeight: number; // 0.1
  compatibilityWeight: number; // 0.2
  plants: PlantDefinition[];
  zones: Array<{
    id: string;
    type: TerrainType;
    area: number;
  }>;
}

/**
 * Resultado de optimización
 */
export interface OptimizationResult {
  designs: GeneratedDesign[];
  bestBalanced: GeneratedDesign;
  bestPremium: GeneratedDesign;
  bestHighProfit: GeneratedDesign;
  optimizationTime: number; // milliseconds
}

/**
 * Comparación de diseños
 */
export interface DesignComparison {
  designs: Array<{
    design: GeneratedDesign;
    type: DesignType;
    metrics: {
      totalMargin: number;
      visualScore: number;
      maintenanceScore: number;
      plantDiversity: number;
    };
  }>;
  recommendation: string;
  bestForBudget: GeneratedDesign;
  bestForAesthetics: GeneratedDesign;
  bestForProfit: GeneratedDesign;
}

/**
 * Validación de diseño
 */
export interface DesignValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  inventoryCheck: {
    sufficient: boolean;
    shortages: Array<{
      plantId: string;
      required: number;
      available: number;
    }>;
  };
  spacingCheck: {
    valid: boolean;
    violations: Array<{
      placement1Id: string;
      placement2Id: string;
      distance: number;
      required: number;
    }>;
  };
  zoneCheck: {
    valid: boolean;
    violations: Array<{
      placementId: string;
      plantId: string;
      zoneId: string;
      reason: string;
    }>;
  };
}

/**
 * Histórico de diseños
 */
export interface DesignHistory {
  projectId: string;
  designs: Array<{
    design: GeneratedDesign;
    createdAt: number;
    createdBy: string;
    notes?: string;
  }>;
  selectedDesign?: GeneratedDesign;
  selectedAt?: number;
}

/**
 * Métricas de rendimiento del motor
 */
export interface EngineMetrics {
  totalDesignsGenerated: number;
  averageGenerationTime: number;
  bestMarginAchieved: number;
  bestVisualScoreAchieved: number;
  averageInventoryUtilization: number;
  successRate: number; // Porcentaje de diseños válidos
}
