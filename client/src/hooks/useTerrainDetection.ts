import { useEffect, useState, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import type { TerrainSegmentation, TerrainType, SegmentedPixel } from "../../../shared/capture-types";
import { TerrainType as TerrainTypeEnum } from "../../../shared/capture-types";

/**
 * Hook para detección de terreno usando ML
 */
export function useTerrainDetection() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const modelRef = useRef<tf.LayersModel | null>(null);

  // Inicializar modelo
  useEffect(() => {
    async function loadModel() {
      try {
        // En producción, cargarías un modelo entrenado
        // Por ahora, usamos heurísticas basadas en color
        setIsLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setIsLoading(false);
      }
    }

    loadModel();
  }, []);

  /**
   * Segmentar imagen en tipos de terreno
   */
  const segmentImage = async (imageData: ImageData): Promise<TerrainSegmentation> => {
    const { data, width, height } = imageData;
    const segmentation: SegmentedPixel[] = [];
    const terrainCounts: Record<TerrainType, number> = {
      [TerrainTypeEnum.EARTH]: 0,
      [TerrainTypeEnum.GRASS]: 0,
      [TerrainTypeEnum.CONCRETE]: 0,
      [TerrainTypeEnum.UNKNOWN]: 0,
    };

    // Procesar cada píxel
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Ignorar píxeles transparentes
      if (a < 128) continue;

      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      // Clasificar píxel basado en color
      const { terrainType, confidence } = classifyPixelByColor(r, g, b);

      segmentation.push({
        x,
        y,
        terrainType,
        confidence,
      });

      terrainCounts[terrainType]++;
    }

    return {
      id: `segmentation-${Date.now()}`,
      imageData,
      segmentation,
      terrainCounts,
      timestamp: Date.now(),
    };
  };

  /**
   * Procesar video frame en tiempo real
   */
  const processFrame = async (canvas: HTMLCanvasElement): Promise<TerrainSegmentation | null> => {
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return await segmentImage(imageData);
    } catch (err) {
      console.error("Error processing frame:", err);
      return null;
    }
  };

  return {
    isLoading,
    error,
    segmentImage,
    processFrame,
  };
}

/**
 * Clasificar píxel por color usando heurísticas
 */
function classifyPixelByColor(
  r: number,
  g: number,
  b: number
): { terrainType: TerrainType; confidence: number } {
  // Normalizar valores RGB a 0-1
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;

  // Calcular índices de color
  const brightness = (r + g + b) / 3;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);
  const greenIndex = g - r; // Diferencia verde-rojo

  // Heurísticas para clasificación
  // PASTO: alto greenIndex, saturación media-alta
  if (greenIndex > 20 && saturation > 30 && brightness > 50 && brightness < 200) {
    return {
      terrainType: TerrainTypeEnum.GRASS,
      confidence: Math.min(0.9, (greenIndex / 100) * (saturation / 100)),
    };
  }

  // CEMENTO: bajo greenIndex, baja saturación, brillo alto
  if (greenIndex < 10 && saturation < 30 && brightness > 150) {
    return {
      terrainType: TerrainTypeEnum.CONCRETE,
      confidence: Math.min(0.9, (brightness / 255) * (1 - saturation / 100)),
    };
  }

  // TIERRA: marrón/naranja, greenIndex bajo-medio, saturación media
  if (greenIndex < 30 && r > b && saturation > 20 && saturation < 80) {
    const brownness = Math.abs(r - g) / 255;
    return {
      terrainType: TerrainTypeEnum.EARTH,
      confidence: Math.min(0.9, brownness * (saturation / 100)),
    };
  }

  // Por defecto
  return {
    terrainType: TerrainTypeEnum.UNKNOWN,
    confidence: 0.5,
  };
}

/**
 * Renderizar segmentación en canvas
 */
export function renderSegmentation(
  canvas: HTMLCanvasElement,
  segmentation: TerrainSegmentation,
  opacity: number = 0.5
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;

  // Colores para cada tipo de terreno
  const colors: Record<TerrainType, [number, number, number]> = {
    [TerrainTypeEnum.GRASS]: [34, 139, 34], // Verde oscuro
    [TerrainTypeEnum.EARTH]: [139, 69, 19], // Marrón
    [TerrainTypeEnum.CONCRETE]: [169, 169, 169], // Gris
    [TerrainTypeEnum.UNKNOWN]: [128, 128, 128], // Gris neutro
  };

  // Llenar canvas con colores
  for (const pixel of segmentation.segmentation) {
    const index = (pixel.y * canvas.width + pixel.x) * 4;
    const [r, g, b] = colors[pixel.terrainType];

    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = Math.round(255 * opacity * pixel.confidence);
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Extraer zonas de un tipo de terreno específico
 */
export function extractTerrainZones(
  segmentation: TerrainSegmentation,
  terrainType: TerrainType,
  minClusterSize: number = 100
): Array<SegmentedPixel[]> {
  const pixels = segmentation.segmentation.filter((p) => p.terrainType === terrainType);

  // Agrupar píxeles conectados (flood fill)
  const visited = new Set<string>();
  const zones: Array<SegmentedPixel[]> = [];

  for (const pixel of pixels) {
    const key = `${pixel.x},${pixel.y}`;
    if (visited.has(key)) continue;

    const zone = floodFill(pixels, pixel, visited);
    if (zone.length >= minClusterSize) {
      zones.push(zone);
    }
  }

  return zones;
}

/**
 * Flood fill para encontrar regiones conectadas
 */
function floodFill(
  pixels: SegmentedPixel[],
  start: SegmentedPixel,
  visited: Set<string>
): SegmentedPixel[] {
  const zone: SegmentedPixel[] = [];
  const queue = [start];
  const pixelMap = new Map<string, SegmentedPixel>();

  for (const p of pixels) {
    pixelMap.set(`${p.x},${p.y}`, p);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const key = `${current.x},${current.y}`;
    if (visited.has(key)) continue;

    visited.add(key);
    zone.push(current);

    // Buscar píxeles adyacentes
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        const nx = current.x + dx;
        const ny = current.y + dy;
        const nkey = `${nx},${ny}`;

        if (!visited.has(nkey)) {
          const neighbor = pixelMap.get(nkey);
          if (neighbor) {
            queue.push(neighbor);
          }
        }
      }
    }
  }

  return zone;
}
