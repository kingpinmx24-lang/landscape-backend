/**
 * Terrain Design Generator
 * Generador profesional de diseños de terreno basado en materiales seleccionados
 */

import { SelectedObject } from './live-interaction-types';
import { TERRAIN_MATERIALS, DesignSuggestion } from './canvas-operations';

export interface TerrainDesignResult {
  backgroundMaterials: DesignSuggestion[];
  suggestedPlants: Array<{
    type: string;
    quantity: number;
    placement: 'corners' | 'edges' | 'center' | 'scattered';
  }>;
  totalCost: number;
  designNotes: string[];
}

export class TerrainDesignGenerator {
  /**
   * Generar diseño automático del terreno basado en materiales seleccionados
   */
  static generateDesign(
    selectedMaterials: string[],
    terrainArea: number,
    canvasWidth: number,
    canvasHeight: number
  ): TerrainDesignResult {
    if (selectedMaterials.length === 0) {
      throw new Error('Debe seleccionar al menos un material');
    }

    // Calcular distribución de materiales
    const backgroundMaterials = this.calculateMaterialDistribution(
      selectedMaterials,
      terrainArea
    );

    // Sugerir plantas basadas en materiales
    const suggestedPlants = this.suggestPlants(selectedMaterials, terrainArea);

    // Calcular costo total
    const totalCost = backgroundMaterials.reduce((sum, m) => sum + m.cost, 0);

    // Generar notas de diseño
    const designNotes = this.generateDesignNotes(selectedMaterials, terrainArea);

    return {
      backgroundMaterials,
      suggestedPlants,
      totalCost,
      designNotes,
    };
  }

  /**
   * Calcular distribución de materiales en el terreno
   */
  private static calculateMaterialDistribution(
    selectedMaterials: string[],
    terrainArea: number
  ): DesignSuggestion[] {
    const suggestions: DesignSuggestion[] = [];
    const areaPerMaterial = terrainArea / selectedMaterials.length;

    selectedMaterials.forEach((materialId) => {
      const material = TERRAIN_MATERIALS.find(m => m.id === materialId);
      if (!material) return;

      const cost = (areaPerMaterial / material.coverage) * material.price;
      const plantCount = Math.floor(areaPerMaterial / 5); // 1 planta cada 5m²

      suggestions.push({
        materialId,
        area: areaPerMaterial,
        cost,
        plantCount,
      });
    });

    return suggestions;
  }

  /**
   * Sugerir plantas basadas en materiales seleccionados
   */
  private static suggestPlants(
    selectedMaterials: string[],
    terrainArea: number
  ): Array<{
    type: string;
    quantity: number;
    placement: 'corners' | 'edges' | 'center' | 'scattered';
  }> {
    const suggestions = [];

    // Lógica de sugerencia basada en materiales
    if (selectedMaterials.includes('grass')) {
      suggestions.push({
        type: 'Arbustos',
        quantity: Math.max(2, Math.floor(terrainArea / 10)),
        placement: 'edges' as const,
      });
    }

    if (selectedMaterials.includes('gravel')) {
      suggestions.push({
        type: 'Plantas decorativas',
        quantity: Math.max(3, Math.floor(terrainArea / 8)),
        placement: 'scattered' as const,
      });
    }

    if (selectedMaterials.includes('stone')) {
      suggestions.push({
        type: 'Árboles',
        quantity: Math.max(1, Math.floor(terrainArea / 15)),
        placement: 'corners' as const,
      });
    }

    return suggestions;
  }

  /**
   * Generar notas de diseño profesionales
   */
  private static generateDesignNotes(
    selectedMaterials: string[],
    terrainArea: number
  ): string[] {
    const notes: string[] = [];

    if (selectedMaterials.length === 1) {
      notes.push('Diseño monomaterial - Considera agregar contraste con otra superficie');
    } else if (selectedMaterials.length > 3) {
      notes.push('Múltiples materiales - Asegúrate de mantener coherencia visual');
    }

    if (terrainArea > 50) {
      notes.push('Área grande - Considera crear zonas funcionales distintas');
    } else if (terrainArea < 10) {
      notes.push('Área pequeña - Enfócate en plantas de tamaño compacto');
    }

    if (selectedMaterials.includes('concrete')) {
      notes.push('Concreto seleccionado - Ideal para áreas de circulación');
    }

    if (selectedMaterials.includes('grass')) {
      notes.push('Pasto seleccionado - Requiere mantenimiento regular');
    }

    return notes;
  }

  /**
   * Generar objetos de plantas para el canvas basado en diseño
   */
  static generatePlantObjects(
    design: TerrainDesignResult,
    canvasWidth: number,
    canvasHeight: number,
    plantImages: Map<string, string>
  ): SelectedObject[] {
    const objects: SelectedObject[] = [];
    let plantId = 0;

    design.suggestedPlants.forEach((suggestion) => {
      for (let i = 0; i < suggestion.quantity; i++) {
        const { x, y } = this.calculatePlantPosition(
          suggestion.placement,
          i,
          suggestion.quantity,
          canvasWidth,
          canvasHeight
        );

        const imageUrl = plantImages.get(suggestion.type) || '';

        objects.push({
          id: `plant-${plantId++}`,
          x,
          y,
          radius: 25,
          type: 'plant',
          imageUrl,
          metadata: {
            name: suggestion.type,
            price: 0,
            inventoryId: `suggested-${plantId}`,
          },
        });
      }
    });

    return objects;
  }

  /**
   * Calcular posición de planta en el canvas
   */
  private static calculatePlantPosition(
    placement: 'corners' | 'edges' | 'center' | 'scattered',
    index: number,
    total: number,
    width: number,
    height: number
  ): { x: number; y: number } {
    const margin = 50;

    switch (placement) {
      case 'corners':
        const corners = [
          { x: margin, y: margin },
          { x: width - margin, y: margin },
          { x: margin, y: height - margin },
          { x: width - margin, y: height - margin },
        ];
        return corners[index % corners.length];

      case 'edges':
        const isTop = index % 2 === 0;
        const x = margin + ((index / 2) % (width - 2 * margin));
        const y = isTop ? margin : height - margin;
        return { x, y };

      case 'center':
        return {
          x: width / 2 + (Math.random() - 0.5) * 100,
          y: height / 2 + (Math.random() - 0.5) * 100,
        };

      case 'scattered':
      default:
        return {
          x: margin + Math.random() * (width - 2 * margin),
          y: margin + Math.random() * (height - 2 * margin),
        };
    }
  }
}
