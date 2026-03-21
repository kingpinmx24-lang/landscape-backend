/**
 * Terrain Detection System
 * ============================================================================
 * Detecta automáticamente zonas de tierra, piedras y pasto en imágenes
 */

export interface TerrainZone {
  id: string;
  type: "soil" | "grass" | "stone" | "concrete";
  color: string;
  percentage: number;
  suggestedMaterials: string[];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface TerrainAnalysis {
  zones: TerrainZone[];
  dominantType: "soil" | "grass" | "stone" | "concrete";
  suggestions: {
    materials: string[];
    plants: string[];
    actions: string[];
  };
}

/**
 * Analizar imagen para detectar zonas de terreno
 */
export const analyzeTerrainImage = (
  imageData: ImageData
): TerrainAnalysis => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  const zones: TerrainZone[] = [];
  const colorMap = new Map<string, number>();

  // Analizar píxeles
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const terrainType = classifyPixel(r, g, b);
    const key = `${terrainType}`;

    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }

  // Convertir a porcentajes
  const totalPixels = width * height;
  const typePercentages = new Map<string, number>();

  colorMap.forEach((count, type) => {
    typePercentages.set(type, (count / totalPixels) * 100);
  });

  // Crear zonas
  let zoneId = 0;
  typePercentages.forEach((percentage, type) => {
    if (percentage > 5) {
      // Solo incluir si es > 5%
      zones.push({
        id: `zone-${zoneId++}`,
        type: type as "soil" | "grass" | "stone" | "concrete",
        color: getColorForType(type as "soil" | "grass" | "stone" | "concrete"),
        percentage,
        suggestedMaterials: getMaterialsForType(
          type as "soil" | "grass" | "stone" | "concrete"
        ),
        bounds: {
          x: 0,
          y: 0,
          width,
          height,
        },
      });
    }
  });

  // Determinar tipo dominante
  let dominantType: "soil" | "grass" | "stone" | "concrete" = "soil";
  let maxPercentage = 0;

  typePercentages.forEach((percentage, type) => {
    if (percentage > maxPercentage) {
      maxPercentage = percentage;
      dominantType = type as "soil" | "grass" | "stone" | "concrete";
    }
  });

  return {
    zones,
    dominantType,
    suggestions: {
      materials: getMaterialsForType(dominantType),
      plants: getPlantsForType(dominantType),
      actions: getActionsForType(dominantType),
    },
  };
};

/**
 * Clasificar píxel por color
 */
const classifyPixel = (r: number, g: number, b: number): string => {
  // Verde = Pasto
  if (g > r + 30 && g > b + 30) {
    return "grass";
  }

  // Gris/Negro = Piedra/Concreto
  if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r < 150) {
    return "stone";
  }

  // Marrón/Rojo = Tierra
  if (r > g && r > b && r - b > 30) {
    return "soil";
  }

  // Gris claro = Concreto
  if (r > 150 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
    return "concrete";
  }

  // Por defecto
  return "soil";
};

/**
 * Obtener color para tipo de terreno
 */
const getColorForType = (
  type: "soil" | "grass" | "stone" | "concrete"
): string => {
  const colors: Record<string, string> = {
    soil: "#8B7355",
    grass: "#7CB342",
    stone: "#757575",
    concrete: "#BDBDBD",
  };
  return colors[type] || "#8B7355";
};

/**
 * Obtener materiales sugeridos para tipo de terreno
 */
const getMaterialsForType = (
  type: "soil" | "grass" | "stone" | "concrete"
): string[] => {
  const materials: Record<string, string[]> = {
    soil: ["Pasto", "Mulch", "Grava", "Tierra Negra"],
    grass: ["Pasto Premium", "Semilla de Pasto", "Mantenimiento"],
    stone: ["Piedras de Río", "Grava Decorativa", "Adoquines"],
    concrete: ["Pintura", "Limpieza", "Remoción"],
  };
  return materials[type] || [];
};

/**
 * Obtener plantas sugeridas para tipo de terreno
 */
const getPlantsForType = (
  type: "soil" | "grass" | "stone" | "concrete"
): string[] => {
  const plants: Record<string, string[]> = {
    soil: ["Rosa", "Lavanda", "Arbusto Boxwood", "Árbol Oak"],
    grass: ["Pasto Perenne", "Trébol", "Hierba Ornamental"],
    stone: ["Suculentas", "Cactus", "Plantas Xerófitas"],
    concrete: ["Contenedores", "Plantas en Maceta", "Trepadoras"],
  };
  return plants[type] || [];
};

/**
 * Obtener acciones sugeridas para tipo de terreno
 */
const getActionsForType = (
  type: "soil" | "grass" | "stone" | "concrete"
): string[] => {
  const actions: Record<string, string[]> = {
    soil: ["Preparar terreno", "Agregar fertilizante", "Nivelar"],
    grass: ["Riego regular", "Corte semanal", "Fertilización"],
    stone: ["Limpiar", "Reorganizar", "Agregar plantas"],
    concrete: ["Remover", "Reparar", "Pintar o sellar"],
  };
  return actions[type] || [];
};

/**
 * Obtener análisis de imagen desde canvas
 */
export const getImageDataFromCanvas = (
  canvas: HTMLCanvasElement
): ImageData | null => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/**
 * Obtener análisis de imagen desde URL
 */
export const analyzeImageUrl = async (
  imageUrl: string
): Promise<TerrainAnalysis | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const analysis = analyzeTerrainImage(imageData);

      resolve(analysis);
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};
