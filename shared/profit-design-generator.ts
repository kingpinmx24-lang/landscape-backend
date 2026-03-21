import type {
  PlantDefinition,
  PlantPlacement,
  GeneratedDesign,
  DesignGenerationConfig,
  ProfitReport,
  PlantScore,
} from "./profit-types";
import { DesignType } from "./profit-types";
import { scorePlant, SCORING_WEIGHTS } from "./profit-scoring";
import type { TerrainZone } from "./terrain-types";

/**
 * ============================================================================
 * PROFIT ENGINE DESIGN GENERATOR
 * ============================================================================
 * Generates optimized designs based on profitability strategy
 */

/**
 * Generar diseño balanceado
 * Balance entre ganancia y estética
 */
export function generateBalancedDesign(
  plants: PlantDefinition[],
  zones: TerrainZone[],
  config: DesignGenerationConfig = {}
): GeneratedDesign {
  const scores = plants.map((p) => scorePlant(p, SCORING_WEIGHTS));

  // Seleccionar plantas de score medio-alto
  const selectedScores = scores
    .filter((s) => s.totalScore >= 55)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, config.maxPlants || 15);

  const placements = createPlacements(selectedScores, plants, zones, config);

  return createDesign("balanced" as any, placements);
}

/**
 * Generar diseño premium
 * Máxima estética, ganancia secundaria
 */
export function generatePremiumDesign(
  plants: PlantDefinition[],
  zones: TerrainZone[],
  config: DesignGenerationConfig = {}
): GeneratedDesign {
  const weights = {
    margin: 0.1,
    visual: 0.6, // Aumentar visual
    maintenance: 0.1,
    compatibility: 0.2,
  };

  const scores = plants.map((p) => scorePlant(p, weights));

  // Seleccionar plantas de alto score visual
  const selectedScores = scores
    .filter((s) => s.visualScore >= 70)
    .sort((a, b) => b.visualScore - a.visualScore)
    .slice(0, config.maxPlants || 12);

  const placements = createPlacements(selectedScores, plants, zones, config);

  return createDesign("premium" as any, placements);
}

/**
 * Generar diseño de alta ganancia
 * Máxima ganancia, estética secundaria
 */
export function generateHighProfitDesign(
  plants: PlantDefinition[],
  zones: TerrainZone[],
  config: DesignGenerationConfig = {}
): GeneratedDesign {
  const weights = {
    margin: 0.7, // Aumentar margen
    visual: 0.1,
    maintenance: 0.1,
    compatibility: 0.1,
  };

  const scores = plants.map((p) => scorePlant(p, weights));

  // Seleccionar plantas de alto margen
  const selectedScores = scores
    .filter((s) => s.marginScore >= 20)
    .sort((a, b) => b.marginScore - a.marginScore)
    .slice(0, config.maxPlants || 20);

  // Si no hay plantas con margen >= 20, usar todas
  if (selectedScores.length === 0) {
    selectedScores.push(...scores.slice(0, 3));
  }

  const placements = createPlacements(selectedScores, plants, zones, config);

  return createDesign("high_profit" as any, placements);
}

/**
 * Crear colocaciones de plantas
 */
function createPlacements(
  scores: PlantScore[],
  plants: PlantDefinition[],
  zones: TerrainZone[],
  config: DesignGenerationConfig
): PlantPlacement[] {
  const placements: PlantPlacement[] = [];
  const plantMap = new Map(plants.map((p) => [p.id, p]));
  let placementId = 0;

  // Si no hay zonas, usar zona por defecto
  const validZones = zones.length > 0 ? zones : [{
    id: "default_zone",
    type: "soil" as any,
    area: 100,
    centroid: { x: 50, y: 50 },
    polygon: [],
  }];

  for (const score of scores) {
    const plant = plantMap.get(score.plantId);
    if (!plant) continue;

    // Encontrar zona válida
    let zone = validZones.find((z) => plant.allowedZones.includes(z.type as any));
    if (!zone) {
      zone = validZones[0]!;
    }

    // Calcular cantidad de plantas
    const maxPlantsInZone = Math.max(1, Math.floor(zone.area / (plant.spacing * plant.spacing)));
    const quantity = Math.min(
      maxPlantsInZone,
      config.maxRepetition || 5,
      Math.max(1, Math.ceil(Math.random() * 3))
    );

    for (let i = 0; i < quantity; i++) {
      const placement: PlantPlacement = {
        id: `placement_${placementId++}`,
        plantId: plant.id,
        position: {
          x: zone.centroid.x + (Math.random() - 0.5) * Math.sqrt(zone.area),
          y: zone.centroid.y + (Math.random() - 0.5) * Math.sqrt(zone.area),
        },
        radius: plant.spacing / 2,
        zoneId: zone.id,
        quantity: 1,
        score,
      };

      placements.push(placement);
    }
  }

  return placements;
}

/**
 * Crear objeto GeneratedDesign
 */
function createDesign(type: string, placements: PlantPlacement[]): GeneratedDesign {
  let totalCost = 0;
  let totalRevenue = 0;
  const plantIds = new Set<string>();

  for (const placement of placements) {
    // Nota: En una implementación real, buscaríamos la planta en la DB
    // Por ahora usamos valores de ejemplo
    totalCost += placement.quantity * 50; // $50 por planta
    totalRevenue += placement.quantity * 120; // $120 por planta
    plantIds.add(placement.plantId);
  }

  const totalMargin = totalRevenue - totalCost;
  const profitMarginPercentage = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
  const averageScore =
    placements.length > 0
      ? placements.reduce((sum, p) => sum + p.score.totalScore, 0) / placements.length
      : 0;
  const visualScore =
    placements.length > 0
      ? placements.reduce((sum, p) => sum + p.score.visualScore, 0) / placements.length
      : 0;
  const maintenanceScore =
    placements.length > 0
      ? placements.reduce((sum, p) => sum + p.score.maintenanceScore, 0) / placements.length
      : 0;

  return {
    id: `design_${Date.now()}_${Math.random()}`,
    type: type as any,
    placements,
    totalCost,
    totalRevenue,
    totalMargin,
    profitMarginPercentage,
    averageScore,
    visualScore,
    maintenanceScore,
    plantCount: placements.length,
    uniquePlants: plantIds.size,
    timestamp: Date.now(),
  };
}

/**
 * Generar todos los tipos de diseño
 */
export function generateAllDesigns(
  plants: PlantDefinition[],
  zones: TerrainZone[],
  config: DesignGenerationConfig = {}
): {
  balanced: GeneratedDesign;
  premium: GeneratedDesign;
  highProfit: GeneratedDesign;
} {
  return {
    balanced: generateBalancedDesign(plants, zones, config),
    premium: generatePremiumDesign(plants, zones, config),
    highProfit: generateHighProfitDesign(plants, zones, config),
  };
}

/**
 * Comparar diseños
 */
export function compareDesigns(
  designs: GeneratedDesign[]
): {
  bestMargin: GeneratedDesign;
  bestVisual: GeneratedDesign;
  bestBalance: GeneratedDesign;
} {
  const sorted = [...designs];

  const bestMargin = sorted.reduce((best, design) =>
    design.totalMargin > best.totalMargin ? design : best
  );

  const bestVisual = sorted.reduce((best, design) =>
    design.visualScore > best.visualScore ? design : best
  );

  const bestBalance = sorted.reduce((best, design) => {
    const bestScore = best.averageScore;
    const designScore = design.averageScore;
    return Math.abs(designScore - 50) < Math.abs(bestScore - 50) ? design : best;
  });

  return {
    bestMargin,
    bestVisual,
    bestBalance,
  };
}

/**
 * Optimizar diseño existente
 */
export function optimizeDesign(
  design: GeneratedDesign,
  plants: PlantDefinition[],
  zones: TerrainZone[]
): GeneratedDesign {
  // Identificar plantas de bajo score
  const lowScorePlacements = design.placements.filter((p) => p.score.totalScore < 40);

  if (lowScorePlacements.length === 0) {
    return design;
  }

  // Encontrar plantas de reemplazo
  const plantMap = new Map(plants.map((p) => [p.id, p]));
  const newPlacements = [...design.placements];

  for (const lowScorePlacement of lowScorePlacements) {
    const currentPlant = plantMap.get(lowScorePlacement.plantId);
    if (!currentPlant) continue;

    // Buscar planta de reemplazo con score similar
    const zone = zones.find((z) => z.id === lowScorePlacement.zoneId);
    if (!zone) continue;

    const replacementPlant = plants.find(
      (p) =>
        p.allowedZones.includes(zone.type) &&
        p.id !== currentPlant.id &&
        p.inventory.available > 0
    );

    if (replacementPlant && replacementPlant.cost.margin > currentPlant.cost.margin) {
      const replacementScore = scorePlant(replacementPlant);
      const index = newPlacements.indexOf(lowScorePlacement);

      if (index !== -1) {
        newPlacements[index] = {
          ...lowScorePlacement,
          plantId: replacementPlant.id,
          score: replacementScore,
        };
      }
    }
  }

  return createDesign(design.type, newPlacements);
}

/**
 * Generar reporte de ganancia
 */
export function generateProfitReport(design: GeneratedDesign, plants: PlantDefinition[]): ProfitReport {
  const plantMap = new Map(plants.map((p) => [p.id, p]));

  const byPlant = design.placements
    .reduce(
      (acc, placement) => {
        const existing = acc.find((p) => p.plantId === placement.plantId);
        if (existing) {
          existing.quantity += placement.quantity;
        } else {
          const plant = plantMap.get(placement.plantId);
          if (plant) {
            acc.push({
              plantId: plant.id,
              plantName: plant.name,
              quantity: placement.quantity,
              unitCost: plant.cost.purchasePrice,
              unitRevenue: plant.cost.sellingPrice,
              totalCost: placement.quantity * plant.cost.purchasePrice,
              totalRevenue: placement.quantity * plant.cost.sellingPrice,
              totalMargin: placement.quantity * plant.cost.margin,
            });
          }
        }
        return acc;
      },
      [] as Array<{
        plantId: string;
        plantName: string;
        quantity: number;
        unitCost: number;
        unitRevenue: number;
        totalCost: number;
        totalRevenue: number;
        totalMargin: number;
      }>
    )
    .sort((a, b) => b.totalMargin - a.totalMargin);

  const byZone: Array<{
    zoneId: string;
    zoneType: string | any;
    plantCount: number;
    totalCost: number;
    totalRevenue: number;
    totalMargin: number;
  }> = [];

  for (const placement of design.placements) {
    const existing = byZone.find((z) => z.zoneId === placement.zoneId);
    if (existing) {
      existing.plantCount += placement.quantity;
      existing.totalCost += placement.quantity * 50;
      existing.totalRevenue += placement.quantity * 120;
      existing.totalMargin += placement.quantity * 70;
    } else {
      byZone.push({
        zoneId: placement.zoneId,
        zoneType: "unknown",
        plantCount: placement.quantity,
        totalCost: placement.quantity * 50,
        totalRevenue: placement.quantity * 120,
        totalMargin: placement.quantity * 70,
      });
    }
  }

  return {
    design,
    breakdown: {
      byPlant,
      byZone: byZone as any,
    },
    metrics: {
      costPerPlant: design.plantCount > 0 ? design.totalCost / design.plantCount : 0,
      revenuePerPlant: design.plantCount > 0 ? design.totalRevenue / design.plantCount : 0,
      marginPerPlant: design.plantCount > 0 ? design.totalMargin / design.plantCount : 0,
      roi: design.totalCost > 0 ? (design.totalMargin / design.totalCost) * 100 : 0,
      profitMargin: design.profitMarginPercentage,
    },
    recommendations: [],
  };
}

/**
 * Seleccionar mejor diseño según criterio
 */
export function selectBestDesign(
  designs: GeneratedDesign[],
  criterion: "margin" | "visual" | "balance"
): GeneratedDesign | null {
  if (designs.length === 0) return null;

  switch (criterion) {
    case "margin":
      return designs.reduce((best, design) =>
        design.totalMargin > best.totalMargin ? design : best
      );
    case "visual":
      return designs.reduce((best, design) =>
        design.visualScore > best.visualScore ? design : best
      );
    case "balance":
      return designs.reduce((best, design) => {
        const bestScore = (best.totalMargin + best.visualScore * 100) / 2;
        const designScore = (design.totalMargin + design.visualScore * 100) / 2;
        return designScore > bestScore ? design : best;
      });
  }
}
