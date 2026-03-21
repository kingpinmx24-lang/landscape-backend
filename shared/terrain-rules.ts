import type {
  PlantType,
  TerrainType,
  TerrainZone,
  PlacementRule,
  CompatibilityRules,
  ZonePlacementValidation,
  DesignValidation,
  DesignError,
  DesignWarning,
  CoverageAnalysis,
  DesignRecommendation,
} from "./terrain-types";
import { PlantType as PType, TerrainType as TType } from "./terrain-types";

/**
 * ============================================================================
 * TERRAIN RULES ENGINE
 * ============================================================================
 * Placement rules and design validation based on terrain zones
 */

/**
 * Reglas de compatibilidad por defecto
 */
const DEFAULT_COMPATIBILITY_RULES: CompatibilityRules = {
  rules: [
    {
      plantType: PType.FLOWERING,
      allowedZones: [TType.SOIL, TType.GRASS],
      minZoneArea: 10,
    },
    {
      plantType: PType.SHRUB,
      allowedZones: [TType.SOIL, TType.GRASS],
      minZoneArea: 15,
    },
    {
      plantType: PType.TREE,
      allowedZones: [TType.SOIL, TType.GRASS],
      minZoneArea: 50,
    },
    {
      plantType: PType.GROUNDCOVER,
      allowedZones: [TType.GRASS, TType.SOIL],
      minZoneArea: 5,
    },
    {
      plantType: PType.DECORATIVE,
      allowedZones: [TType.CONCRETE, TType.GRASS],
      minZoneArea: 5,
    },
  ],
};

/**
 * Obtener regla para tipo de planta
 */
export function getPlacementRule(
  plantType: PlantType,
  rules: CompatibilityRules = DEFAULT_COMPATIBILITY_RULES
): PlacementRule | null {
  return rules.rules.find((r) => r.plantType === plantType) || rules.defaultRule || null;
}

/**
 * Validar colocación de planta en zona
 */
export function validatePlantInZone(
  plantType: PlantType,
  zone: TerrainZone,
  rules: CompatibilityRules = DEFAULT_COMPATIBILITY_RULES
): ZonePlacementValidation {
  const rule = getPlacementRule(plantType, rules);

  if (!rule) {
    return {
      isValid: false,
      zone: null,
      plantType,
      reason: `No rule defined for plant type: ${plantType}`,
    };
  }

  // Verificar si la zona es permitida
  if (!rule.allowedZones.includes(zone.type)) {
    return {
      isValid: false,
      zone: null,
      plantType,
      reason: `Plant type ${plantType} cannot be placed in ${zone.type} zones`,
    };
  }

  // Verificar área mínima
  if (rule.minZoneArea && zone.area < rule.minZoneArea) {
    return {
      isValid: false,
      zone: null,
      plantType,
      reason: `Zone area (${zone.area.toFixed(2)}) is below minimum required (${rule.minZoneArea})`,
    };
  }

  // Verificar área máxima
  if (rule.maxZoneArea && zone.area > rule.maxZoneArea) {
    return {
      isValid: false,
      zone: null,
      plantType,
      reason: `Zone area (${zone.area.toFixed(2)}) exceeds maximum allowed (${rule.maxZoneArea})`,
    };
  }

  return {
    isValid: true,
    zone,
    plantType,
    reason: "Plant can be placed in this zone",
  };
}

/**
 * Encontrar zonas válidas para un tipo de planta
 */
export function findValidZones(
  plantType: PlantType,
  zones: TerrainZone[],
  rules: CompatibilityRules = DEFAULT_COMPATIBILITY_RULES
): TerrainZone[] {
  const rule = getPlacementRule(plantType, rules);

  if (!rule) {
    return [];
  }

  return zones.filter((zone) => {
    const validation = validatePlantInZone(plantType, zone, rules);
    return validation.isValid;
  });
}

/**
 * Validar diseño completo basado en zonas
 */
export function validateDesignByZones(
  zones: TerrainZone[],
  plants: Array<{
    id: string;
    type: PlantType;
    zoneId: string;
  }>,
  rules: CompatibilityRules = DEFAULT_COMPATIBILITY_RULES
): DesignValidation {
  const errors: DesignError[] = [];
  const warnings: DesignWarning[] = [];
  const plantsByZone = new Map<string, number>();

  // Verificar que hay zonas
  if (zones.length === 0) {
    errors.push({
      type: "no_zones",
      message: "No terrain zones defined. Please segment terrain first.",
    });

    return {
      isValid: false,
      hasValidZones: false,
      zonesCovered: 0,
      totalZones: 0,
      plantsByZone,
      errors,
      warnings,
      coverage: {
        soil: 0,
        grass: 0,
        concrete: 0,
      },
    };
  }

  // Mapear zonas por ID
  const zoneMap = new Map<string, TerrainZone>();
  for (const zone of zones) {
    zoneMap.set(zone.id, zone);
  }

  // Validar cada planta
  for (const plant of plants) {
    const zone = zoneMap.get(plant.zoneId);

    if (!zone) {
      errors.push({
        type: "invalid_plant_placement",
        message: `Plant ${plant.id} references non-existent zone ${plant.zoneId}`,
        affectedPlants: [plant.id],
      });
      continue;
    }

    const validation = validatePlantInZone(plant.type, zone, rules);

    if (!validation.isValid) {
      errors.push({
        type: "invalid_plant_placement",
        message: `Plant ${plant.id} (${plant.type}) cannot be placed in ${zone.type} zone: ${validation.reason}`,
        affectedPlants: [plant.id],
        affectedZones: [zone.id],
      });
    }

    // Contar plantas por zona
    plantsByZone.set(plant.zoneId, (plantsByZone.get(plant.zoneId) || 0) + 1);
  }

  // Calcular cobertura
  let soilArea = 0,
    grassArea = 0,
    concreteArea = 0;

  for (const zone of zones) {
    if (zone.type === "soil") soilArea += zone.area;
    else if (zone.type === "grass") grassArea += zone.area;
    else if (zone.type === "concrete") concreteArea += zone.area;
  }

  const totalArea = soilArea + grassArea + concreteArea;

  // Verificar cobertura mínima
  if (soilArea === 0 && grassArea === 0) {
    warnings.push({
      type: "low_coverage",
      message: "No soil or grass zones available for planting",
      severity: "high",
    });
  }

  // Verificar si hay plantas
  if (plants.length === 0) {
    warnings.push({
      type: "sparse_planting",
      message: "No plants placed in any zones",
      severity: "medium",
    });
  }

  // Verificar zonas no utilizadas
  const unusedZones = zones.filter((z) => !plantsByZone.has(z.id));
  if (unusedZones.length > 0 && plants.length > 0) {
    warnings.push({
      type: "unbalanced_zones",
      message: `${unusedZones.length} zone(s) have no plants`,
      severity: "low",
    });
  }

  const isValid = errors.length === 0;
  const hasValidZones = zones.length > 0 && (soilArea > 0 || grassArea > 0);

  return {
    isValid,
    hasValidZones,
    zonesCovered: plantsByZone.size,
    totalZones: zones.length,
    plantsByZone,
    errors,
    warnings,
    coverage: {
      soil: soilArea,
      grass: grassArea,
      concrete: concreteArea,
    },
  };
}

/**
 * Calcular análisis de cobertura
 */
export function analyzeCoverage(zones: TerrainZone[]): CoverageAnalysis {
  let totalArea = 0;
  let coveredArea = 0;
  const byZone: Array<{
    type: TerrainType;
    area: number;
    percentage: number;
    plantCount: number;
  }> = [];

  const typeMap = new Map<TerrainType, { area: number; count: number }>();

  for (const zone of zones) {
    totalArea += zone.area;
    coveredArea += zone.area;

    const existing = typeMap.get(zone.type) || { area: 0, count: 0 };
    existing.area += zone.area;
    existing.count++;
    typeMap.set(zone.type, existing);
  }

  typeMap.forEach((data, type) => {
    byZone.push({
      type,
      area: data.area,
      percentage: totalArea > 0 ? (data.area / totalArea) * 100 : 0,
      plantCount: data.count,
    });
  });

  return {
    totalArea,
    coveredArea,
    coveragePercentage: totalArea > 0 ? (coveredArea / totalArea) * 100 : 0,
    byZone,
  };
}

/**
 * Generar recomendaciones de mejora
 */
export function generateRecommendations(
  zones: TerrainZone[],
  plants: Array<{ id: string; type: PlantType; zoneId: string }>,
  validation: DesignValidation,
  rules: CompatibilityRules = DEFAULT_COMPATIBILITY_RULES
): DesignRecommendation[] {
  const recommendations: DesignRecommendation[] = [];

  // Recomendar agregar plantas a zonas vacías
  const unusedZones = zones.filter((z) => !validation.plantsByZone.has(z.id));

  for (const zone of unusedZones) {
    // Encontrar plantas válidas para esta zona
    const validPlantTypes = rules.rules
      .filter((r) => r.allowedZones.includes(zone.type))
      .map((r) => r.plantType);

    if (validPlantTypes.length > 0) {
      recommendations.push({
        type: "add_plants",
        description: `Add plants to unused ${zone.type} zone (area: ${zone.area.toFixed(2)})`,
        zone,
        priority: zone.area > 50 ? "high" : "medium",
        expectedImprovement: 0.2,
      });
    }
  }

  // Recomendar diversificar tipos de plantas
  const plantTypeCount = new Map<PlantType, number>();
  for (const plant of plants) {
    plantTypeCount.set(plant.type, (plantTypeCount.get(plant.type) || 0) + 1);
  }

  if (plantTypeCount.size === 1 && plants.length > 3) {
    recommendations.push({
      type: "change_type",
      description: "Add variety by using different plant types",
      zone: zones[0]!,
      priority: "low",
      expectedImprovement: 0.1,
    });
  }

  // Recomendar mejorar cobertura
  if (validation.coverage.soil === 0 && validation.coverage.grass === 0) {
    recommendations.push({
      type: "add_plants",
      description: "No plantable zones available. Consider adding soil or grass zones.",
      zone: zones[0]!,
      priority: "high",
      expectedImprovement: 0.5,
    });
  }

  return recommendations;
}

/**
 * Obtener reglas de compatibilidad por defecto
 */
export function getDefaultCompatibilityRules(): CompatibilityRules {
  return DEFAULT_COMPATIBILITY_RULES;
}

/**
 * Crear regla personalizada
 */
export function createCustomRule(
  plantType: PlantType,
  allowedZones: TerrainType[],
  minZoneArea?: number,
  maxZoneArea?: number
): PlacementRule {
  return {
    plantType,
    allowedZones,
    minZoneArea,
    maxZoneArea,
  };
}

/**
 * Verificar compatibilidad entre tipos de plantas
 */
export function checkPlantCompatibility(
  plant1Type: PlantType,
  plant2Type: PlantType,
  rules: CompatibilityRules = DEFAULT_COMPATIBILITY_RULES
): boolean {
  const rule1 = getPlacementRule(plant1Type, rules);
  const rule2 = getPlacementRule(plant2Type, rules);

  if (!rule1 || !rule2) return false;

  // Verificar si comparten zonas permitidas
  return rule1.allowedZones.some((zone) => rule2.allowedZones.includes(zone));
}

/**
 * Obtener descripción de error de diseño
 */
export function getDesignErrorDescription(error: DesignError): string {
  const baseMessage = error.message;
  let details = "";

  if (error.affectedZones && error.affectedZones.length > 0) {
    details += ` Affected zones: ${error.affectedZones.join(", ")}`;
  }

  if (error.affectedPlants && error.affectedPlants.length > 0) {
    details += ` Affected plants: ${error.affectedPlants.join(", ")}`;
  }

  return baseMessage + details;
}

/**
 * Calcular puntuación de validación de diseño
 */
export function calculateDesignScore(validation: DesignValidation): number {
  let score = 100;

  // Penalizar por errores
  score -= validation.errors.length * 20;

  // Penalizar por warnings
  score -= validation.warnings.length * 5;

  // Bonificar por cobertura
  const totalCoverage = validation.coverage.soil + validation.coverage.grass + validation.coverage.concrete;
  if (totalCoverage > 0) {
    const plantableCoverage = validation.coverage.soil + validation.coverage.grass;
    const coverageRatio = plantableCoverage / totalCoverage;
    score += coverageRatio * 10;
  }

  return Math.max(0, Math.min(100, score));
}
