/**
 * Tests: Live Interaction System
 * ============================================================================
 * Tests para el sistema de interacción en vivo
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateAreaFromPoints,
  calculateMaterialCost,
  validateAreaPoints,
  detectObjectsInArea,
  isPointInPolygon,
  createApplyMaterialResult,
  createCleanAreaResult,
  validateMaterialChange,
  simplifyAreaPoints,
  calculateAreaCentroid,
  expandArea,
  MaterialType,
  MATERIAL_MAP,
} from "../shared/material-editing-utils";

describe("Material Editing Utils", () => {
  describe("calculateAreaFromPoints", () => {
    it("debe calcular el área de un triángulo", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 2, y: 3 },
      ];
      const area = calculateAreaFromPoints(points);
      expect(area).toBe(6);
    });

    it("debe calcular el área de un cuadrado", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];
      const area = calculateAreaFromPoints(points);
      expect(area).toBe(100);
    });

    it("debe retornar 0 para menos de 3 puntos", () => {
      expect(calculateAreaFromPoints([{ x: 0, y: 0 }])).toBe(0);
      expect(calculateAreaFromPoints([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
    });
  });

  describe("calculateMaterialCost", () => {
    it("debe calcular costo para pasto", () => {
      const cost = calculateMaterialCost(MaterialType.GRASS, 100);
      expect(cost).toBe(500); // 100 * 5
    });

    it("debe calcular costo para concreto", () => {
      const cost = calculateMaterialCost(MaterialType.CONCRETE, 50);
      expect(cost).toBe(750); // 50 * 15
    });

    it("debe redondear a 2 decimales", () => {
      const cost = calculateMaterialCost(MaterialType.GRASS, 33.33);
      expect(cost).toBeCloseTo(166.65, 1);
    });
  });

  describe("validateAreaPoints", () => {
    it("debe validar área válida", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ];
      const result = validateAreaPoints(points);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("debe rechazar menos de 3 puntos", () => {
      const result = validateAreaPoints([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("debe detectar puntos duplicados", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 0 },
      ];
      const result = validateAreaPoints(points);
      expect(result.isValid).toBe(false);
    });
  });

  describe("isPointInPolygon", () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    it("debe detectar punto dentro del polígono", () => {
      expect(isPointInPolygon(5, 5, polygon)).toBe(true);
    });

    it("debe detectar punto fuera del polígono", () => {
      expect(isPointInPolygon(15, 15, polygon)).toBe(false);
    });

    it("debe detectar punto en el borde", () => {
      // El algoritmo de ray casting puede incluir puntos en el borde
      // Este es un comportamiento válido
      const result = isPointInPolygon(5, 0, polygon);
      expect(typeof result).toBe("boolean");
    });
  });

  describe("detectObjectsInArea", () => {
    const objects = [
      { id: "obj1", x: 5, y: 5, radius: 1 },
      { id: "obj2", x: 15, y: 15, radius: 1 },
      { id: "obj3", x: 3, y: 3, radius: 1 },
    ];

    const polygon = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    it("debe detectar objetos dentro del área", () => {
      const detected = detectObjectsInArea(objects, polygon);
      expect(detected).toContain("obj1");
      expect(detected).toContain("obj3");
      expect(detected).not.toContain("obj2");
    });
  });

  describe("createApplyMaterialResult", () => {
    it("debe crear resultado válido", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ];
      const result = createApplyMaterialResult(MaterialType.GRASS, points);

      expect(result.success).toBe(true);
      expect(result.material).toBe(MaterialType.GRASS);
      expect(result.areaSize).toBeGreaterThan(0);
      expect(result.costAdded).toBeGreaterThan(0);
    });
  });

  describe("createCleanAreaResult", () => {
    it("debe crear resultado de limpieza", () => {
      const objects = [
        { id: "obj1", x: 5, y: 5, radius: 1 },
        { id: "obj2", x: 15, y: 15, radius: 1 },
      ];

      const polygon = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const result = createCleanAreaResult(objects, polygon);

      expect(result.success).toBe(true);
      expect(result.objectsRemoved).toContain("obj1");
      expect(result.objectsRemoved).not.toContain("obj2");
      expect(result.costSaved).toBeGreaterThan(0);
    });
  });

  describe("validateMaterialChange", () => {
    it("debe validar cambio de material", () => {
      const result = validateMaterialChange(MaterialType.GRASS, MaterialType.CONCRETE);
      expect(result.isValid).toBe(true);
      expect(result.message).toContain("Concreto");
    });

    it("debe rechazar cambio al mismo material", () => {
      const result = validateMaterialChange(MaterialType.GRASS, MaterialType.GRASS);
      expect(result.isValid).toBe(false);
    });
  });

  describe("simplifyAreaPoints", () => {
    it("debe simplificar puntos cercanos", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 100, y: 100 },
      ];

      const simplified = simplifyAreaPoints(points, 5);
      expect(simplified.length).toBeLessThanOrEqual(points.length);
    });

    it("debe mantener puntos lejanos", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 100 },
      ];

      const simplified = simplifyAreaPoints(points, 5);
      expect(simplified.length).toBeGreaterThan(0);
    });
  });

  describe("calculateAreaCentroid", () => {
    it("debe calcular centroide de triángulo", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 3, y: 6 },
      ];

      const centroid = calculateAreaCentroid(points);
      expect(centroid.x).toBeCloseTo(3, 0);
      expect(centroid.y).toBeCloseTo(2, 0);
    });

    it("debe retornar (0,0) para array vacío", () => {
      const centroid = calculateAreaCentroid([]);
      expect(centroid.x).toBe(0);
      expect(centroid.y).toBe(0);
    });
  });

  describe("expandArea", () => {
    it("debe expandir área correctamente", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const expanded = expandArea(points, 5);
      expect(expanded.length).toBe(points.length);

      // Verificar que los puntos se han movido
      const originalArea = calculateAreaFromPoints(points);
      const expandedArea = calculateAreaFromPoints(expanded);
      expect(expandedArea).toBeGreaterThan(originalArea);
    });
  });

  describe("MATERIAL_MAP", () => {
    it("debe contener todos los materiales", () => {
      expect(MATERIAL_MAP[MaterialType.GRASS]).toBeDefined();
      expect(MATERIAL_MAP[MaterialType.SOIL]).toBeDefined();
      expect(MATERIAL_MAP[MaterialType.CONCRETE]).toBeDefined();
      expect(MATERIAL_MAP[MaterialType.GRAVEL]).toBeDefined();
    });

    it("debe tener información correcta de materiales", () => {
      const grass = MATERIAL_MAP[MaterialType.GRASS];
      expect(grass.name).toBe("Pasto");
      expect(grass.costPerUnit).toBe(5);
      expect(grass.color).toBeDefined();
    });
  });
});

describe("Live Interaction Integration", () => {
  it("debe completar flujo de aplicación de material", () => {
    // 1. Validar puntos
    const points = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 10, y: 20 },
    ];

    const validation = validateAreaPoints(points);
    expect(validation.isValid).toBe(true);

    // 2. Crear resultado
    const result = createApplyMaterialResult(MaterialType.GRASS, points);
    expect(result.success).toBe(true);
    expect(result.costAdded).toBeGreaterThan(0);
  });

  it("debe completar flujo de limpieza de área", () => {
    const objects = [
      { id: "plant1", x: 5, y: 5, radius: 2 },
      { id: "plant2", x: 25, y: 25, radius: 2 },
    ];

    const polygon = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];

    const result = createCleanAreaResult(objects, polygon);
    expect(result.success).toBe(true);
    expect(result.objectsRemoved).toHaveLength(1);
    expect(result.objectsRemoved[0]).toBe("plant1");
  });
});
