import { describe, it, expect } from "vitest";
import {
  calculatePolygonArea,
  calculatePolygonPerimeter,
  isValidPolygon,
  estimateConfidence,
  formatMeasurement,
} from "./useMeasurement";
import { classifyPixelByColor, extractTerrainZones } from "./useTerrainDetection";
import type { Point3D, TerrainSegmentation, SegmentedPixel } from "../../../shared/capture-types";
import { TerrainType } from "../../../shared/capture-types";

describe("Measurement Functions", () => {
  describe("calculatePolygonArea", () => {
    it("should calculate area of a square", () => {
      const points: Point3D[] = [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 10, z: 0 },
        { x: 0, y: 10, z: 0 },
      ];

      const area = calculatePolygonArea(points);
      expect(area).toBeCloseTo(100, 0);
    });

    it("should calculate area of a triangle", () => {
      const points: Point3D[] = [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 5, y: 10, z: 0 },
      ];

      const area = calculatePolygonArea(points);
      expect(area).toBeCloseTo(50, 0);
    });

    it("should return 0 for less than 3 points", () => {
      const points: Point3D[] = [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
      ];

      const area = calculatePolygonArea(points);
      expect(area).toBe(0);
    });
  });

  describe("calculatePolygonPerimeter", () => {
    it("should calculate perimeter of a square", () => {
      const points: Point3D[] = [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 10, z: 0 },
        { x: 0, y: 10, z: 0 },
      ];

      const perimeter = calculatePolygonPerimeter(points);
      expect(perimeter).toBeCloseTo(40, 0);
    });

    it("should calculate perimeter of a triangle", () => {
      const points: Point3D[] = [
        { x: 0, y: 0, z: 0 },
        { x: 3, y: 0, z: 0 },
        { x: 0, y: 4, z: 0 },
      ];

      const perimeter = calculatePolygonPerimeter(points);
      expect(perimeter).toBeCloseTo(12, 0); // 3 + 4 + 5
    });
  });

  describe("isValidPolygon", () => {
    it("should validate a valid polygon", () => {
      const points: Point3D[] = [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 10, z: 0 },
        { x: 0, y: 10, z: 0 },
      ];

      expect(isValidPolygon(points)).toBe(true);
    });

    it("should reject polygon with less than 3 points", () => {
      const points: Point3D[] = [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
      ];

      expect(isValidPolygon(points)).toBe(false);
    });

    it("should reject polygon with duplicate points", () => {
      const points: Point3D[] = [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 }, // Duplicate
      ];

      expect(isValidPolygon(points)).toBe(false);
    });
  });

  describe("formatMeasurement", () => {
    it("should format millimeters", () => {
      const result = formatMeasurement({
        id: "test",
        pointA: { x: 0, y: 0, z: 0 },
        pointB: { x: 0, y: 0, z: 0 },
        distanceMeters: 0.005,
        timestamp: 0,
        confidence: 1,
      });

      expect(result).toMatch(/mm/);
    });

    it("should format centimeters", () => {
      const result = formatMeasurement({
        id: "test",
        pointA: { x: 0, y: 0, z: 0 },
        pointB: { x: 0, y: 0, z: 0 },
        distanceMeters: 0.5,
        timestamp: 0,
        confidence: 1,
      });

      expect(result).toMatch(/cm/);
    });

    it("should format meters", () => {
      const result = formatMeasurement({
        id: "test",
        pointA: { x: 0, y: 0, z: 0 },
        pointB: { x: 0, y: 0, z: 0 },
        distanceMeters: 10,
        timestamp: 0,
        confidence: 1,
      });

      expect(result).toMatch(/m$/);
    });

    it("should format kilometers", () => {
      const result = formatMeasurement({
        id: "test",
        pointA: { x: 0, y: 0, z: 0 },
        pointB: { x: 0, y: 0, z: 0 },
        distanceMeters: 5000,
        timestamp: 0,
        confidence: 1,
      });

      expect(result).toMatch(/km/);
    });
  });

  describe("estimateConfidence", () => {
    it("should give high confidence with LiDAR", () => {
      const confidence = estimateConfidence(true, 0);
      expect(confidence).toBeGreaterThan(0.9);
    });

    it("should give lower confidence without LiDAR", () => {
      const confidence = estimateConfidence(false, 0);
      expect(confidence).toBeLessThan(0.7);
    });

    it("should increase confidence with more calibration points", () => {
      const conf1 = estimateConfidence(false, 1);
      const conf2 = estimateConfidence(false, 5);
      expect(conf2).toBeGreaterThan(conf1);
    });
  });
});

describe("Terrain Detection Functions", () => {
  describe("classifyPixelByColor", () => {
    it("should classify grass", () => {
      // Verde oscuro típico de pasto
      const { terrainType, confidence } = classifyPixelByColor(34, 139, 34);
      expect(terrainType).toBe(TerrainType.GRASS);
      expect(confidence).toBeGreaterThan(0);
    });

    it("should classify concrete", () => {
      // Gris claro típico de cemento
      const { terrainType, confidence } = classifyPixelByColor(200, 200, 200);
      expect(terrainType).toBe(TerrainType.CONCRETE);
      expect(confidence).toBeGreaterThan(0);
    });

    it("should classify earth", () => {
      // Marrón típico de tierra
      const { terrainType, confidence } = classifyPixelByColor(139, 69, 19);
      expect(terrainType).toBe(TerrainType.EARTH);
      expect(confidence).toBeGreaterThan(0);
    });

    it("should have confidence between 0 and 1", () => {
      for (let r = 0; r < 256; r += 50) {
        for (let g = 0; g < 256; g += 50) {
          for (let b = 0; b < 256; b += 50) {
            const { confidence } = classifyPixelByColor(r, g, b);
            expect(confidence).toBeGreaterThanOrEqual(0);
            expect(confidence).toBeLessThanOrEqual(1);
          }
        }
      }
    });
  });
});

describe("Capture Integration", () => {
  it("should handle complete capture workflow", () => {
    // 1. Crear puntos de medición
    const point1: Point3D = { x: 0, y: 0, z: 0 };
    const point2: Point3D = { x: 10, y: 10, z: 0 };

    // 2. Calcular distancia
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const dz = point2.z - point1.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    expect(distance).toBeCloseTo(14.14, 1); // sqrt(200)

    // 3. Validar polígono
    const polygon: Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 10, z: 0 },
      { x: 0, y: 10, z: 0 },
    ];

    expect(isValidPolygon(polygon)).toBe(true);
    expect(calculatePolygonArea(polygon)).toBeCloseTo(100, 0);
    expect(calculatePolygonPerimeter(polygon)).toBeCloseTo(40, 0);
  });
});
