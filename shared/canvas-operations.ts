/**
 * Canvas Operations
 * Operaciones profesionales para el canvas de diseño
 */

export interface CanvasOperations {
  deleteSelected: () => void;
  duplicateSelected: () => void;
  selectAll: () => void;
  deselectAll: () => void;
  undo: () => void;
  redo: () => void;
}

export interface TerrainMaterial {
  id: string;
  name: string;
  color: string;
  description: string;
  price: number;
  coverage: number; // m²
}

export const TERRAIN_MATERIALS: TerrainMaterial[] = [
  {
    id: 'grass',
    name: 'Pasto',
    color: '#2ecc71',
    description: 'Pasto verde natural',
    price: 5,
    coverage: 10,
  },
  {
    id: 'gravel',
    name: 'Grava',
    color: '#95a5a6',
    description: 'Grava de río',
    price: 8,
    coverage: 15,
  },
  {
    id: 'concrete',
    name: 'Concreto',
    color: '#7f8c8d',
    description: 'Concreto estampado',
    price: 15,
    coverage: 20,
  },
  {
    id: 'mulch',
    name: 'Mulch',
    color: '#8b4513',
    description: 'Mulch de madera',
    price: 6,
    coverage: 12,
  },
  {
    id: 'stone',
    name: 'Piedra',
    color: '#a9a9a9',
    description: 'Piedra decorativa',
    price: 12,
    coverage: 18,
  },
];

export interface TerrainDesignConfig {
  selectedMaterials: string[];
  totalArea: number;
  budget?: number;
}

export interface DesignSuggestion {
  materialId: string;
  area: number;
  cost: number;
  plantCount: number;
}
