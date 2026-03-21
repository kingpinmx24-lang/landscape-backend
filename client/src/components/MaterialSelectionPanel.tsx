/**
 * Component: MaterialSelectionPanel
 * Panel profesional para seleccionar materiales del terreno
 */

import React, { useState } from 'react';
import { TERRAIN_MATERIALS, TerrainMaterial } from '../../../shared/canvas-operations';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface MaterialSelectionPanelProps {
  selectedMaterials: string[];
  onMaterialsChange: (materials: string[]) => void;
  terrainArea: number;
  onGenerateDesign: (materials: string[]) => void;
}

export const MaterialSelectionPanel: React.FC<MaterialSelectionPanelProps> = ({
  selectedMaterials,
  onMaterialsChange,
  terrainArea,
  onGenerateDesign,
}) => {
  const [showPanel, setShowPanel] = useState(false);

  const toggleMaterial = (materialId: string) => {
    const updated = selectedMaterials.includes(materialId)
      ? selectedMaterials.filter(id => id !== materialId)
      : [...selectedMaterials, materialId];
    onMaterialsChange(updated);
  };

  const calculateCost = (material: TerrainMaterial): number => {
    return (terrainArea / material.coverage) * material.price;
  };

  const totalCost = selectedMaterials.reduce((sum, materialId) => {
    const material = TERRAIN_MATERIALS.find(m => m.id === materialId);
    return sum + (material ? calculateCost(material) : 0);
  }, 0);

  return (
    <div className="w-full">
      <Button
        onClick={() => setShowPanel(!showPanel)}
        className="w-full mb-4 bg-blue-600 hover:bg-blue-700"
      >
        {showPanel ? 'Ocultar Materiales' : 'Seleccionar Materiales del Terreno'}
      </Button>

      {showPanel && (
        <Card className="p-4 space-y-4">
          <div className="text-sm font-semibold text-gray-700">
            Área del Terreno: {terrainArea.toFixed(1)} m²
          </div>

          <div className="space-y-3">
            {TERRAIN_MATERIALS.map((material) => (
              <div
                key={material.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => toggleMaterial(material.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedMaterials.includes(material.id)}
                  onChange={() => {}}
                  className="w-4 h-4"
                />
                <div
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: material.color }}
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{material.name}</div>
                  <div className="text-xs text-gray-600">{material.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    ${calculateCost(material).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-600">
                    ${material.price}/{material.coverage}m²
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold">Costo Total:</span>
              <span className="text-lg font-bold text-green-600">
                ${totalCost.toFixed(2)}
              </span>
            </div>

            <Button
              onClick={() => {
                onGenerateDesign(selectedMaterials);
                setShowPanel(false);
              }}
              disabled={selectedMaterials.length === 0}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              Generar Diseño del Terreno
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
