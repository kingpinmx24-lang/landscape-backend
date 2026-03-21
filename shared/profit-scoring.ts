import type {
  PlantDefinition,
  PlantScore,
  MaintenanceInfo,
  PlantCost,
  VisualInfo,
  PlantCompatibility,
} from "./profit-types";

/**
 * ============================================================================
 * PROFIT ENGINE SCORING SYSTEM
 * ============================================================================
 * Weighted scoring algorithm for plant profitability
 */

/**
 * Pesos de scoring
 */
export const SCORING_WEIGHTS = {
  margin: 0.4,
  visual: 0.3,
  maintenance: 0.1,
  compatibility: 0.2,
} as const;

/**
 * Calcular score de margen (0-100)
 * Basado en: (margen / precio de venta) * 100
 */
export function calculateMarginScore(cost: PlantCost): number {
  if (cost.sellingPrice === 0) return 0;

  const marginPercentage = (cost.margin / cost.sellingPrice) * 100;

  // Normalizar a escala 0-100
  // Asumimos que 100% de margen es el máximo (score 100)
  // 0% de margen es el mínimo (score 0)
  return Math.min(100, Math.max(0, marginPercentage));
}

/**
 * Calcular score de mantenimiento (0-100)
 * Basado en: frecuencia, costo anual, dificultad
 */
export function calculateMaintenanceScore(maintenance: MaintenanceInfo): number {
  let score = 100;

  // Penalizar por frecuencia
  switch (maintenance.frequency) {
    case "high":
      score -= 40;
      break;
    case "medium":
      score -= 20;
      break;
    case "low":
      score -= 5;
      break;
  }

  // Penalizar por costo anual
  // Asumimos que >$500/año es alto costo
  const costPenalty = Math.min(30, (maintenance.costPerYear / 500) * 30);
  score -= costPenalty;

  // Penalizar por dificultad
  switch (maintenance.difficulty) {
    case "hard":
      score -= 20;
      break;
    case "moderate":
      score -= 10;
      break;
    case "easy":
      score -= 2;
      break;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calcular score visual (0-100)
 * Basado en: visual score definido + categoría estética
 */
export function calculateVisualScore(visual: VisualInfo): number {
  let score = visual.visualScore;

  // Bonificar por categoría estética
  switch (visual.aestheticCategory) {
    case "flowering":
      score += 15;
      break;
    case "foliage":
      score += 10;
      break;
    case "structural":
      score += 8;
      break;
    case "groundcover":
      score += 5;
      break;
  }

  return Math.min(100, score);
}

/**
 * Calcular score de compatibilidad (0-100)
 * Basado en: compatibilidad definida + preferencia de agrupación
 */
export function calculateCompatibilityScore(compatibility: PlantCompatibility): number {
  let score = compatibility.compatibilityScore;

  // Bonificar por preferencia de agrupación
  switch (compatibility.groupingPreference) {
    case "mass":
      score += 15; // Mejor para diseños grandes
      break;
    case "groups":
      score += 10;
      break;
    case "pairs":
      score += 5;
      break;
    case "solitary":
      score += 0;
      break;
  }

  return Math.min(100, score);
}

/**
 * Calcular score ponderado total
 */
export function calculateTotalScore(
  marginScore: number,
  visualScore: number,
  maintenanceScore: number,
  compatibilityScore: number,
  weights = SCORING_WEIGHTS
): number {
  const total =
    marginScore * weights.margin +
    visualScore * weights.visual +
    maintenanceScore * weights.maintenance +
    compatibilityScore * weights.compatibility;

  return Math.min(100, Math.max(0, total));
}

/**
 * Calcular score completo de una planta
 */
export function scorePlant(plant: PlantDefinition, weights: Record<string, number> | typeof SCORING_WEIGHTS = SCORING_WEIGHTS): PlantScore {
  const marginScore = calculateMarginScore(plant.cost);
  const visualScore = calculateVisualScore(plant.visual);
  const maintenanceScore = calculateMaintenanceScore(plant.maintenance);
  const compatibilityScore = calculateCompatibilityScore(plant.compatibility);

  const totalScore = calculateTotalScore(
    marginScore,
    visualScore,
    maintenanceScore,
    compatibilityScore,
    weights as typeof SCORING_WEIGHTS
  );

  // Determinar nivel de rentabilidad
  let profitability: "low" | "medium" | "high";
  if (totalScore >= 70) {
    profitability = "high";
  } else if (totalScore >= 50) {
    profitability = "medium";
  } else {
    profitability = "low";
  }

  return {
    plantId: plant.id,
    marginScore,
    visualScore,
    maintenanceScore,
    compatibilityScore,
    totalScore,
    profitability,
  };
}

/**
 * Calcular scores para múltiples plantas
 */
export function scoreMultiplePlants(
  plants: PlantDefinition[],
  weights = SCORING_WEIGHTS
): PlantScore[] {
  return plants.map((plant) => scorePlant(plant, weights));
}

/**
 * Ordenar plantas por score
 */
export function rankPlantsByScore(scores: PlantScore[]): PlantScore[] {
  return [...scores].sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Filtrar plantas por criterio de rentabilidad
 */
export function filterByProfitability(
  scores: PlantScore[],
  profitability: "low" | "medium" | "high"
): PlantScore[] {
  return scores.filter((s) => s.profitability === profitability);
}

/**
 * Obtener plantas de alto score
 */
export function getHighScoringPlants(scores: PlantScore[], threshold: number = 70): PlantScore[] {
  return scores.filter((s) => s.totalScore >= threshold);
}

/**
 * Calcular score promedio
 */
export function calculateAverageScore(scores: PlantScore[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, s) => acc + s.totalScore, 0);
  return sum / scores.length;
}

/**
 * Comparar dos plantas por score
 */
export function comparePlantScores(score1: PlantScore, score2: PlantScore): number {
  return score2.totalScore - score1.totalScore;
}

/**
 * Obtener análisis de distribución de scores
 */
export function analyzeScoreDistribution(scores: PlantScore[]) {
  const sorted = rankPlantsByScore(scores);

  const highProfit = sorted.filter((s) => s.profitability === "high");
  const mediumProfit = sorted.filter((s) => s.profitability === "medium");
  const lowProfit = sorted.filter((s) => s.profitability === "low");

  return {
    total: scores.length,
    highProfit: {
      count: highProfit.length,
      percentage: (highProfit.length / scores.length) * 100,
      plants: highProfit,
    },
    mediumProfit: {
      count: mediumProfit.length,
      percentage: (mediumProfit.length / scores.length) * 100,
      plants: mediumProfit,
    },
    lowProfit: {
      count: lowProfit.length,
      percentage: (lowProfit.length / scores.length) * 100,
      plants: lowProfit,
    },
    average: calculateAverageScore(scores),
    min: sorted.length > 0 ? sorted[sorted.length - 1]!.totalScore : 0,
    max: sorted.length > 0 ? sorted[0]!.totalScore : 0,
  };
}

/**
 * Calcular impacto de cambio de peso
 */
export function calculateWeightImpact(
  plant: PlantDefinition,
  newWeights: Partial<typeof SCORING_WEIGHTS>
): {
  oldScore: number;
  newScore: number;
  difference: number;
} {
  const oldScore = scorePlant(plant, SCORING_WEIGHTS).totalScore;
  const newScore = scorePlant(plant, {
    ...SCORING_WEIGHTS,
    ...newWeights,
  }).totalScore;

  return {
    oldScore,
    newScore,
    difference: newScore - oldScore,
  };
}

/**
 * Obtener plantas por categoría de score
 */
export function groupPlantsByScoreCategory(scores: PlantScore[]): {
  premium: PlantScore[]; // 80-100
  excellent: PlantScore[]; // 60-79
  good: PlantScore[]; // 40-59
  fair: PlantScore[]; // 20-39
  poor: PlantScore[]; // 0-19
} {
  return {
    premium: scores.filter((s) => s.totalScore >= 80),
    excellent: scores.filter((s) => s.totalScore >= 60 && s.totalScore < 80),
    good: scores.filter((s) => s.totalScore >= 40 && s.totalScore < 60),
    fair: scores.filter((s) => s.totalScore >= 20 && s.totalScore < 40),
    poor: scores.filter((s) => s.totalScore < 20),
  };
}

/**
 * Calcular score ponderado con énfasis personalizado
 */
export function calculateWeightedScoreWithEmphasis(
  plant: PlantDefinition,
  emphasis: "margin" | "visual" | "maintenance" | "compatibility"
): PlantScore {
  const weights: Record<keyof typeof SCORING_WEIGHTS, number> = { ...SCORING_WEIGHTS };

  // Aumentar peso del énfasis, reducir otros proporcionalmente
  const baseWeight = weights[emphasis];
  const increase = 0.2; // Aumentar 20%
  const newWeight = baseWeight + increase;
  const reduction = increase / 3; // Reducir otros 3 pesos

  weights[emphasis] = newWeight;
  for (const key of Object.keys(weights) as Array<keyof typeof SCORING_WEIGHTS>) {
    if (key !== emphasis) {
      weights[key] -= reduction;
    }
  }

  return scorePlant(plant, weights);
}

/**
 * Normalizar pesos para asegurar que sumen 1.0
 */
export function normalizeWeights(weights: Partial<typeof SCORING_WEIGHTS>): Record<string, number> {
  const merged = { ...SCORING_WEIGHTS, ...weights };
  const sum = Object.values(merged).reduce((a, b) => a + b, 0);

  return {
    margin: merged.margin / sum,
    visual: merged.visual / sum,
    maintenance: merged.maintenance / sum,
    compatibility: merged.compatibility / sum,
  };
}
