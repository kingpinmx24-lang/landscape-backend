import { describe, it, expect, beforeEach } from "vitest";
import type { PlantDefinition, PlantScore, GeneratedDesign } from "../shared/profit-types";
import { PlantType } from "../shared/terrain-types";
import { TerrainType } from "../shared/terrain-types";
import {
  calculateMarginScore,
  calculateMaintenanceScore,
  calculateVisualScore,
  calculateCompatibilityScore,
  calculateTotalScore,
  scorePlant,
  rankPlantsByScore,
  filterByProfitability,
  getHighScoringPlants,
  calculateAverageScore,
  analyzeScoreDistribution,
  SCORING_WEIGHTS,
} from "../shared/profit-scoring";
import {
  generateBalancedDesign,
  generatePremiumDesign,
  generateHighProfitDesign,
  generateAllDesigns,
  compareDesigns,
  selectBestDesign,
} from "../shared/profit-design-generator";

/**
 * Crear planta de prueba
 */
function createTestPlant(
  id: string,
  name: string,
  margin: number = 50,
  visualScore: number = 70,
  maintenanceCost: number = 100
): PlantDefinition {
  return {
    id,
    name,
    type: PlantType.FLOWERING,
    allowedZones: [TerrainType.SOIL, TerrainType.GRASS],
    cost: {
      purchasePrice: 100,
      sellingPrice: 100 + margin,
      margin,
      marginPercentage: (margin / (100 + margin)) * 100,
    },
    maintenance: {
      frequency: "low",
      costPerYear: maintenanceCost,
      difficulty: "easy",
      waterNeeds: "medium",
      sunlight: "full_sun",
    },
    visual: {
      color: "#FF0000",
      height: 1,
      width: 0.5,
      season: "spring",
      visualScore,
      aestheticCategory: "flowering",
    },
    compatibility: {
      compatibleWith: [],
      incompatibleWith: [],
      compatibilityScore: 80,
      groupingPreference: "groups",
    },
    inventory: {
      available: 100,
      reserved: 0,
      reorderLevel: 10,
      reorderQuantity: 50,
      lastRestockDate: Date.now(),
    },
    spacing: 0.5,
  };
}

describe("Profit Engine - Scoring System", () => {
  describe("Margin Score", () => {
    it("should calculate margin score from cost", () => {
      const cost = {
        purchasePrice: 100,
        sellingPrice: 150,
        margin: 50,
        marginPercentage: 33.33,
      };

      const score = calculateMarginScore(cost);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should return 0 for zero selling price", () => {
      const cost = {
        purchasePrice: 100,
        sellingPrice: 0,
        margin: 0,
        marginPercentage: 0,
      };

      const score = calculateMarginScore(cost);
      expect(score).toBe(0);
    });

    it("should handle high margin", () => {
      const cost = {
        purchasePrice: 50,
        sellingPrice: 200,
        margin: 150,
        marginPercentage: 75,
      };

      const score = calculateMarginScore(cost);
      expect(score).toBeGreaterThan(50);
    });
  });

  describe("Maintenance Score", () => {
    it("should penalize high maintenance frequency", () => {
      const highMaint = {
        frequency: "high" as const,
        costPerYear: 100,
        difficulty: "easy" as const,
        waterNeeds: "low" as const,
        sunlight: "full_sun" as const,
      };

      const lowMaint = {
        frequency: "low" as const,
        costPerYear: 100,
        difficulty: "easy" as const,
        waterNeeds: "low" as const,
        sunlight: "full_sun" as const,
      };

      const highScore = calculateMaintenanceScore(highMaint);
      const lowScore = calculateMaintenanceScore(lowMaint);

      expect(lowScore).toBeGreaterThan(highScore);
    });
  });

  describe("Visual Score", () => {
    it("should calculate visual score", () => {
      const visual = {
        color: "#FF0000",
        height: 1,
        width: 0.5,
        season: "spring" as const,
        visualScore: 80,
        aestheticCategory: "flowering" as const,
      };

      const score = calculateVisualScore(visual);
      expect(score).toBeGreaterThan(80);
    });
  });

  describe("Compatibility Score", () => {
    it("should calculate compatibility score", () => {
      const compatibility = {
        compatibleWith: [],
        incompatibleWith: [],
        compatibilityScore: 75,
        groupingPreference: "groups" as const,
      };

      const score = calculateCompatibilityScore(compatibility);
      expect(score).toBeGreaterThan(75);
    });
  });

  describe("Total Score", () => {
    it("should calculate weighted total score", () => {
      const total = calculateTotalScore(80, 70, 60, 75, SCORING_WEIGHTS);

      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThanOrEqual(100);
      expect(total).toBeCloseTo(80 * 0.4 + 70 * 0.3 + 60 * 0.1 + 75 * 0.2, 0);
    });
  });

  describe("Plant Scoring", () => {
    it("should score plant correctly", () => {
      const plant = createTestPlant("plant1", "Rose", 50, 80, 100);
      const score = scorePlant(plant);

      expect(score.plantId).toBe("plant1");
      expect(score.marginScore).toBeGreaterThan(0);
      expect(score.visualScore).toBeGreaterThan(0);
      expect(score.totalScore).toBeGreaterThan(0);
      expect(score.profitability).toBeDefined();
    });

    it("should rank plants by score", () => {
      const plant1 = createTestPlant("plant1", "Rose", 50, 80, 100);
      const plant2 = createTestPlant("plant2", "Daisy", 30, 60, 150);

      const scores = [scorePlant(plant1), scorePlant(plant2)];
      const ranked = rankPlantsByScore(scores);

      expect(ranked[0]!.totalScore).toBeGreaterThanOrEqual(ranked[1]!.totalScore);
    });

    it("should filter by profitability", () => {
      const plant1 = createTestPlant("plant1", "Rose", 80, 90, 50);
      const plant2 = createTestPlant("plant2", "Daisy", 20, 40, 200);

      const scores = [scorePlant(plant1), scorePlant(plant2)];
      const highProfit = filterByProfitability(scores, "high");

      expect(highProfit.length).toBeGreaterThan(0);
      expect(highProfit.every((s) => s.profitability === "high")).toBe(true);
    });

    it("should get high scoring plants", () => {
      const plant1 = createTestPlant("plant1", "Rose", 80, 90, 50);
      const plant2 = createTestPlant("plant2", "Daisy", 20, 40, 200);

      const scores = [scorePlant(plant1), scorePlant(plant2)];
      const highScoring = getHighScoringPlants(scores, 70);

      expect(highScoring.length).toBeGreaterThan(0);
      expect(highScoring.every((s) => s.totalScore >= 70)).toBe(true);
    });

    it("should calculate average score", () => {
      const plant1 = createTestPlant("plant1", "Rose", 80, 90, 50);
      const plant2 = createTestPlant("plant2", "Daisy", 60, 70, 100);

      const scores = [scorePlant(plant1), scorePlant(plant2)];
      const average = calculateAverageScore(scores);

      expect(average).toBeGreaterThan(0);
      expect(average).toBeLessThanOrEqual(100);
    });

    it("should analyze score distribution", () => {
      const plants = [
        createTestPlant("plant1", "Rose", 80, 90, 50),
        createTestPlant("plant2", "Daisy", 60, 70, 100),
        createTestPlant("plant3", "Tulip", 40, 50, 150),
      ];

      const scores = plants.map((p) => scorePlant(p));
      const analysis = analyzeScoreDistribution(scores);

      expect(analysis.total).toBe(3);
      expect(analysis.highProfit.count + analysis.mediumProfit.count + analysis.lowProfit.count).toBe(3);
      expect(analysis.average).toBeGreaterThan(0);
    });
  });
});

describe("Profit Engine - Design Generation", () => {
  let plants: PlantDefinition[];
  let zones: any[];

  beforeEach(() => {
    plants = [
      createTestPlant("plant1", "Rose", 80, 90, 50),
      createTestPlant("plant2", "Daisy", 60, 70, 100),
      createTestPlant("plant3", "Tulip", 40, 50, 150),
    ];

    zones = [
      {
        id: "zone1",
        type: "soil",
        area: 100,
        centroid: { x: 50, y: 50 },
        polygon: [],
      },
      {
        id: "zone2",
        type: "grass",
        area: 80,
        centroid: { x: 100, y: 100 },
        polygon: [],
      },
    ];
  });

  describe("Design Generators", () => {
    it("should generate balanced design", () => {
      const design = generateBalancedDesign(plants, zones);

      expect(design).toBeDefined();
      expect(design.type).toBe("balanced");
      expect(design.placements.length).toBeGreaterThan(0);
      expect(design.totalMargin).toBeGreaterThan(0);
    });

    it("should generate premium design", () => {
      const design = generatePremiumDesign(plants, zones);

      expect(design).toBeDefined();
      expect(design.type).toBe("premium");
      expect(design.visualScore).toBeGreaterThan(0);
    });

    it("should generate high profit design", () => {
      const design = generateHighProfitDesign(plants, zones);

      expect(design).toBeDefined();
      expect(design.type).toBe("high_profit");
      expect(design.placements.length).toBeGreaterThan(0);
    });

    it("should generate all designs", () => {
      const designs = generateAllDesigns(plants, zones);

      expect(designs.balanced).toBeDefined();
      expect(designs.premium).toBeDefined();
      expect(designs.highProfit).toBeDefined();
    });
  });

  describe("Design Comparison", () => {
    it("should compare designs", () => {
      const designs = [
        generateBalancedDesign(plants, zones),
        generatePremiumDesign(plants, zones),
        generateHighProfitDesign(plants, zones),
      ];

      const comparison = compareDesigns(designs);

      expect(comparison.bestMargin).toBeDefined();
      expect(comparison.bestVisual).toBeDefined();
      expect(comparison.bestBalance).toBeDefined();
    });

    it("should select best design by margin", () => {
      const designs = [
        generateBalancedDesign(plants, zones),
        generatePremiumDesign(plants, zones),
        generateHighProfitDesign(plants, zones),
      ];

      const best = selectBestDesign(designs, "margin");

      expect(best).toBeDefined();
      expect(best?.placements.length).toBeGreaterThan(0);
    });

    it("should select best design by visual", () => {
      const designs = [
        generateBalancedDesign(plants, zones),
        generatePremiumDesign(plants, zones),
        generateHighProfitDesign(plants, zones),
      ];

      const best = selectBestDesign(designs, "visual");

      expect(best).toBeDefined();
      expect(best?.placements.length).toBeGreaterThan(0);
    });
  });
});

describe("Profit Engine - Integration", () => {
  it("should handle complete workflow", () => {
    const plants = [
      createTestPlant("plant1", "Rose", 80, 90, 50),
      createTestPlant("plant2", "Daisy", 60, 70, 100),
      createTestPlant("plant3", "Tulip", 40, 50, 150),
    ];

    const zones = [
      {
        id: "zone1",
        type: "soil",
        area: 100,
        centroid: { x: 50, y: 50 },
        polygon: [],
      },
    ];

    // 1. Score plants
    const scores = plants.map((p) => scorePlant(p));
    expect(scores.length).toBe(3);

    // 2. Generate designs
    const balanced = generateBalancedDesign(plants, zones);
    const premium = generatePremiumDesign(plants, zones);
    const highProfit = generateHighProfitDesign(plants, zones);

    expect(balanced.placements.length).toBeGreaterThan(0);
    expect(premium.placements.length).toBeGreaterThan(0);
    expect(highProfit.placements.length).toBeGreaterThan(0);

    // 3. Compare designs
    const comparison = compareDesigns([balanced, premium, highProfit]);
    expect(comparison.bestMargin).toBeDefined();

    // 4. Select best
    const best = selectBestDesign([balanced, premium, highProfit], "balance");
    expect(best).toBeDefined();
  });
});
