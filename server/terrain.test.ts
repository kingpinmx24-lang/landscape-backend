import { describe, it, expect, beforeEach } from "vitest";
import type {
  TerrainZone,
  TerrainSegmentation,
  ColorPoint,
  DesignValidation,
} from "../shared/terrain-types";
import { TerrainType, PlantType } from "../shared/terrain-types";
import {
  classifyPixelByColor,
  createTerrainZone,
  createConvexPolygon,
  calculatePolygonArea,
  isPointInZone,
  findNearestZone,
  getSegmentationStats,
} from "../shared/terrain-segmentation";
import {
  validatePlantInZone,
  findValidZones,
  validateDesignByZones,
  analyzeCoverage,
  generateRecommendations,
  calculateDesignScore,
  getDefaultCompatibilityRules,
} from "../shared/terrain-rules";

/**
 * Crear zona de prueba
 */
function createTestZone(
  id: string,
  type: TerrainType,
  area: number = 100,
  centroidX: number = 50,
  centroidY: number = 50
): TerrainZone {
  return {
    id,
    type,
    polygon: [
      { x: centroidX - 10, y: centroidY - 10 },
      { x: centroidX + 10, y: centroidY - 10 },
      { x: centroidX + 10, y: centroidY + 10 },
      { x: centroidX - 10, y: centroidY + 10 },
    ],
    area,
    centroid: { x: centroidX, y: centroidY },
    boundingBox: {
      minX: centroidX - 10,
      minY: centroidY - 10,
      maxX: centroidX + 10,
      maxY: centroidY + 10,
    },
    pixelCount: area,
    confidence: 0.9,
  };
}

describe("Terrain Engine - Color Classification", () => {
  describe("Pixel Classification", () => {
    it("should classify soil color", () => {
      const soilColor: ColorPoint = {
        x: 0,
        y: 0,
        r: 130,
        g: 105,
        b: 75,
      };

      const classification = classifyPixelByColor(soilColor);
      expect(classification.type).toBe(TerrainType.SOIL);
      expect(classification.confidence).toBeGreaterThan(0.5);
    });

    it("should classify grass color", () => {
      const grassColor: ColorPoint = {
        x: 0,
        y: 0,
        r: 85,
        g: 160,
        b: 85,
      };

      const classification = classifyPixelByColor(grassColor);
      expect(classification.type).toBe(TerrainType.GRASS);
      expect(classification.confidence).toBeGreaterThan(0.5);
    });

    it("should classify concrete color", () => {
      const concreteColor: ColorPoint = {
        x: 0,
        y: 0,
        r: 185,
        g: 185,
        b: 185,
      };

      const classification = classifyPixelByColor(concreteColor);
      expect(classification.type).toBe(TerrainType.CONCRETE);
      expect(classification.confidence).toBeGreaterThan(0.5);
    });

    it("should calculate confidence", () => {
      const color: ColorPoint = {
        x: 0,
        y: 0,
        r: 130,
        g: 105,
        b: 75,
      };

      const classification = classifyPixelByColor(color);
      expect(classification.confidence).toBeGreaterThanOrEqual(0);
      expect(classification.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Zone Creation", () => {
    it("should create terrain zone from pixels", () => {
      const pixels = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ];

      const zone = createTerrainZone(pixels, TerrainType.SOIL);

      expect(zone.type).toBe(TerrainType.SOIL);
      expect(zone.pixelCount).toBe(4);
      expect(zone.centroid).toBeDefined();
      expect(zone.polygon).toBeDefined();
    });

    it("should calculate polygon area", () => {
      const polygon = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const area = calculatePolygonArea(polygon);
      expect(area).toBeCloseTo(100, 0);
    });

    it("should create convex polygon", () => {
      const pixels = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
        { x: 10, y: 10 },
        { x: 5, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 5 },
      ];

      const polygon = createConvexPolygon(pixels);
      expect(polygon.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Point in Zone", () => {
    it("should detect point inside zone", () => {
      const zone = createTestZone("zone1", TerrainType.SOIL);
      const point = { x: 50, y: 50 };

      expect(isPointInZone(point, zone)).toBe(true);
    });

    it("should detect point outside zone", () => {
      const zone = createTestZone("zone1", TerrainType.SOIL);
      const point = { x: 100, y: 100 };

      expect(isPointInZone(point, zone)).toBe(false);
    });
  });

  describe("Nearest Zone", () => {
    it("should find nearest zone", () => {
      const zones = [
        createTestZone("zone1", TerrainType.SOIL, 100, 10, 10),
        createTestZone("zone2", TerrainType.GRASS, 100, 100, 100),
      ];

      const point = { x: 15, y: 15 };
      const nearest = findNearestZone(point, zones);

      expect(nearest?.id).toBe("zone1");
    });

    it("should return null for empty zones", () => {
      const nearest = findNearestZone({ x: 50, y: 50 }, []);
      expect(nearest).toBeNull();
    });
  });
});

describe("Terrain Engine - Placement Rules", () => {
  const rules = getDefaultCompatibilityRules();

  describe("Plant in Zone Validation", () => {
    it("should allow flowering in soil", () => {
      const zone = createTestZone("zone1", TerrainType.SOIL);
      const validation = validatePlantInZone(PlantType.FLOWERING, zone, rules);

      expect(validation.isValid).toBe(true);
    });

    it("should allow decorative in concrete", () => {
      const zone = createTestZone("zone1", TerrainType.CONCRETE);
      const validation = validatePlantInZone(PlantType.DECORATIVE, zone, rules);

      expect(validation.isValid).toBe(true);
    });

    it("should reject flowering in concrete", () => {
      const zone = createTestZone("zone1", TerrainType.CONCRETE);
      const validation = validatePlantInZone(PlantType.FLOWERING, zone, rules);

      expect(validation.isValid).toBe(false);
    });

    it("should check minimum zone area", () => {
      const zone = createTestZone("zone1", TerrainType.SOIL, 5); // Área muy pequeña
      const validation = validatePlantInZone(PlantType.TREE, zone, rules);

      expect(validation.isValid).toBe(false);
    });
  });

  describe("Valid Zones for Plant", () => {
    it("should find valid zones for flowering", () => {
      const zones = [
        createTestZone("zone1", TerrainType.SOIL),
        createTestZone("zone2", TerrainType.GRASS),
        createTestZone("zone3", TerrainType.CONCRETE),
      ];

      const validZones = findValidZones(PlantType.FLOWERING, zones, rules);
      expect(validZones.length).toBe(2); // soil + grass
    });

    it("should find valid zones for decorative", () => {
      const zones = [
        createTestZone("zone1", TerrainType.SOIL),
        createTestZone("zone2", TerrainType.GRASS),
        createTestZone("zone3", TerrainType.CONCRETE),
      ];

      const validZones = findValidZones(PlantType.DECORATIVE, zones, rules);
      expect(validZones.length).toBe(2); // concrete + grass
    });
  });
});

describe("Terrain Engine - Design Validation", () => {
  const rules = getDefaultCompatibilityRules();

  describe("Design Validation", () => {
    it("should validate valid design", () => {
      const zones = [
        createTestZone("zone1", TerrainType.SOIL),
        createTestZone("zone2", TerrainType.GRASS),
      ];

      const plants = [
        { id: "plant1", type: PlantType.FLOWERING, zoneId: "zone1" },
        { id: "plant2", type: PlantType.GROUNDCOVER, zoneId: "zone2" },
      ];

      const validation = validateDesignByZones(zones, plants, rules);
      expect(validation.isValid).toBe(true);
      expect(validation.hasValidZones).toBe(true);
    });

    it("should reject design without zones", () => {
      const zones: TerrainZone[] = [];
      const plants = [{ id: "plant1", type: PlantType.FLOWERING, zoneId: "zone1" }];

      const validation = validateDesignByZones(zones, plants, rules);
      expect(validation.isValid).toBe(false);
      expect(validation.hasValidZones).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("should detect invalid plant placement", () => {
      const zones = [createTestZone("zone1", TerrainType.CONCRETE)];

      const plants = [{ id: "plant1", type: PlantType.FLOWERING, zoneId: "zone1" }];

      const validation = validateDesignByZones(zones, plants, rules);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("should warn about unused zones", () => {
      const zones = [
        createTestZone("zone1", TerrainType.SOIL),
        createTestZone("zone2", TerrainType.GRASS),
      ];

      const plants = [{ id: "plant1", type: PlantType.FLOWERING, zoneId: "zone1" }];

      const validation = validateDesignByZones(zones, plants, rules);
      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    it("should count plants by zone", () => {
      const zones = [createTestZone("zone1", TerrainType.SOIL)];

      const plants = [
        { id: "plant1", type: PlantType.FLOWERING, zoneId: "zone1" },
        { id: "plant2", type: PlantType.SHRUB, zoneId: "zone1" },
      ];

      const validation = validateDesignByZones(zones, plants, rules);
      expect(validation.plantsByZone.get("zone1")).toBe(2);
    });
  });

  describe("Coverage Analysis", () => {
    it("should analyze coverage", () => {
      const zones = [
        createTestZone("zone1", TerrainType.SOIL, 50),
        createTestZone("zone2", TerrainType.GRASS, 30),
        createTestZone("zone3", TerrainType.CONCRETE, 20),
      ];

      const coverage = analyzeCoverage(zones);
      expect(coverage.totalArea).toBe(100);
      expect(coverage.coveredArea).toBe(100);
      expect(coverage.coveragePercentage).toBe(100);
      expect(coverage.byZone.length).toBe(3);
    });

    it("should calculate percentage by zone type", () => {
      const zones = [
        createTestZone("zone1", TerrainType.SOIL, 50),
        createTestZone("zone2", TerrainType.GRASS, 50),
      ];

      const coverage = analyzeCoverage(zones);
      const soilCoverage = coverage.byZone.find((z) => z.type === TerrainType.SOIL);
      expect(soilCoverage?.percentage).toBeCloseTo(50, 0);
    });
  });

  describe("Design Recommendations", () => {
    it("should recommend adding plants to unused zones", () => {
      const zones = [
        createTestZone("zone1", TerrainType.SOIL),
        createTestZone("zone2", TerrainType.GRASS),
      ];

      const plants = [{ id: "plant1", type: PlantType.FLOWERING, zoneId: "zone1" }];

      const validation = validateDesignByZones(zones, plants, rules);
      const recommendations = generateRecommendations(zones, plants, validation, rules);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some((r) => r.type === "add_plants")).toBe(true);
    });
  });

  describe("Design Score", () => {
    it("should calculate design score", () => {
      const zones = [createTestZone("zone1", TerrainType.SOIL)];
      const plants = [{ id: "plant1", type: PlantType.FLOWERING, zoneId: "zone1" }];

      const validation = validateDesignByZones(zones, plants, rules);
      const score = calculateDesignScore(validation);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should penalize errors", () => {
      const zones = [createTestZone("zone1", TerrainType.CONCRETE)];
      const plants = [{ id: "plant1", type: PlantType.FLOWERING, zoneId: "zone1" }];

      const validation = validateDesignByZones(zones, plants, rules);
      const score = calculateDesignScore(validation);

      expect(score).toBeLessThan(100);
    });
  });
});

describe("Terrain Engine - Integration", () => {
  const rules = getDefaultCompatibilityRules();

  it("should handle complete workflow", () => {
    // 1. Crear zonas
    const zones = [
      createTestZone("soil1", TerrainType.SOIL, 100),
      createTestZone("grass1", TerrainType.GRASS, 80),
      createTestZone("concrete1", TerrainType.CONCRETE, 50),
    ];

    // 2. Crear plantas
    const plants = [
      { id: "flowering1", type: PlantType.FLOWERING, zoneId: "soil1" },
      { id: "tree1", type: PlantType.TREE, zoneId: "grass1" },
      { id: "decorative1", type: PlantType.DECORATIVE, zoneId: "concrete1" },
    ];

    // 3. Validar diseño
    const validation = validateDesignByZones(zones, plants, rules);
    expect(validation.isValid).toBe(true);

    // 4. Analizar cobertura
    const coverage = analyzeCoverage(zones);
    expect(coverage.totalArea).toBe(230);

    // 5. Generar recomendaciones
    const recommendations = generateRecommendations(zones, plants, validation, rules);
    expect(recommendations).toBeDefined();

    // 6. Calcular puntuación
    const score = calculateDesignScore(validation);
    expect(score).toBeGreaterThan(80);
  });
});
