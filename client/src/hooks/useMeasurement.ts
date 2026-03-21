import { useState, useCallback } from "react";
import type { Point3D, Measurement } from "../../../shared/capture-types";

/**
 * Hook para manejar mediciones de distancia entre puntos
 */
export function useMeasurement() {
  const [selectedPoints, setSelectedPoints] = useState<Point3D[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [currentMeasurement, setCurrentMeasurement] = useState<Measurement | null>(null);

  /**
   * Agregar un punto a la selección
   */
  const addPoint = useCallback(
    (point: Point3D) => {
      const newPoints = [...selectedPoints, point];
      setSelectedPoints(newPoints);

      // Si tenemos 2 puntos, calcular distancia
      if (newPoints.length === 2) {
        const [pointA, pointB] = newPoints;
        const measurement = calculateMeasurement(pointA, pointB);
        setMeasurements((prev) => [...prev, measurement]);
        setCurrentMeasurement(measurement);
        // Reset para siguiente medición
        setSelectedPoints([]);
      }
    },
    [selectedPoints]
  );

  /**
   * Limpiar puntos seleccionados
   */
  const clearSelection = useCallback(() => {
    setSelectedPoints([]);
  }, []);

  /**
   * Limpiar todas las mediciones
   */
  const clearMeasurements = useCallback(() => {
    setMeasurements([]);
    setCurrentMeasurement(null);
    setSelectedPoints([]);
  }, []);

  /**
   * Remover última medición
   */
  const removeLast = useCallback(() => {
    if (measurements.length > 0) {
      const newMeasurements = measurements.slice(0, -1);
      setMeasurements(newMeasurements);
      setCurrentMeasurement(newMeasurements[newMeasurements.length - 1] || null);
    }
  }, [measurements]);

  return {
    selectedPoints,
    measurements,
    currentMeasurement,
    addPoint,
    clearSelection,
    clearMeasurements,
    removeLast,
  };
}

/**
 * Calcular distancia euclidiana entre dos puntos 3D
 */
function calculateMeasurement(pointA: Point3D, pointB: Point3D): Measurement {
  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const dz = pointB.z - pointA.z;

  const distanceMeters = Math.sqrt(dx * dx + dy * dy + dz * dz);

  return {
    id: `measurement-${Date.now()}-${Math.random()}`,
    pointA,
    pointB,
    distanceMeters,
    timestamp: Date.now(),
    confidence: 0.8, // Default confidence, aumentará con LiDAR
  };
}

/**
 * Convertir mediciones a formato legible
 */
export function formatMeasurement(measurement: Measurement): string {
  const { distanceMeters, confidence } = measurement;

  if (distanceMeters < 0.01) {
    return `${(distanceMeters * 1000).toFixed(1)} mm`;
  } else if (distanceMeters < 1) {
    return `${(distanceMeters * 100).toFixed(2)} cm`;
  } else if (distanceMeters < 1000) {
    return `${distanceMeters.toFixed(2)} m`;
  } else {
    return `${(distanceMeters / 1000).toFixed(2)} km`;
  }
}

/**
 * Calcular área de un polígono (usando fórmula de Shoelace)
 */
export function calculatePolygonArea(points: Point3D[]): number {
  if (points.length < 3) return 0;

  // Proyectar puntos al plano XY (ignorar Z)
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    area += current.x * next.y - next.x * current.y;
  }

  return Math.abs(area / 2);
}

/**
 * Calcular perímetro de un polígono
 */
export function calculatePolygonPerimeter(points: Point3D[]): number {
  if (points.length < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const dz = next.z - current.z;

    perimeter += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  return perimeter;
}

/**
 * Validar que los puntos formen un polígono válido
 */
export function isValidPolygon(points: Point3D[]): boolean {
  if (points.length < 3) return false;

  // Verificar que no hay puntos duplicados
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dist = Math.sqrt(
        Math.pow(points[i].x - points[j].x, 2) +
          Math.pow(points[i].y - points[j].y, 2) +
          Math.pow(points[i].z - points[j].z, 2)
      );
      if (dist < 0.001) return false; // Puntos muy cercanos
    }
  }

  return true;
}

/**
 * Estimar confianza de medición basada en LiDAR
 */
export function estimateConfidence(hasLiDAR: boolean, pointCount: number): number {
  let confidence = 0.5; // Base confidence

  if (hasLiDAR) {
    confidence = 0.95; // LiDAR es muy preciso
  } else {
    // Aumentar confianza con más puntos de calibración
    confidence = Math.min(0.8, 0.5 + pointCount * 0.1);
  }

  return confidence;
}
