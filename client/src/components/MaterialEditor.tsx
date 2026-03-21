/**
 * Component: MaterialEditor
 * ============================================================================
 * Editor para cambiar materiales de terreno (tierra, pasto, concreto, grava)
 */

import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Check } from "lucide-react";

interface MaterialEditorProps {
  onApplyMaterial?: (material: string, area: Array<{ x: number; y: number }>) => void;
  onCleanArea?: (area: Array<{ x: number; y: number }>) => void;
  isLoading?: boolean;
  error?: string;
}

/**
 * Tipos de materiales
 */
const MATERIALS = [
  {
    id: "grass",
    name: "Pasto",
    color: "#4ECDC4",
    description: "Área de pasto verde",
    cost: 5,
  },
  {
    id: "soil",
    name: "Tierra",
    color: "#8B7355",
    description: "Área de tierra/suelo",
    cost: 3,
  },
  {
    id: "concrete",
    name: "Concreto",
    color: "#A9A9A9",
    description: "Área de concreto/pavimento",
    cost: 15,
  },
  {
    id: "gravel",
    name: "Grava",
    color: "#D3D3D3",
    description: "Área de grava/piedras",
    cost: 8,
  },
];

/**
 * Componente MaterialEditor
 */
export const MaterialEditor: React.FC<MaterialEditorProps> = ({
  onApplyMaterial,
  onCleanArea,
  isLoading = false,
  error,
}) => {
  const [selectedMaterial, setSelectedMaterial] = useState<string>("grass");
  const [selectedArea, setSelectedArea] = useState<Array<{ x: number; y: number }>>([]);
  const [mode, setMode] = useState<"draw" | "clean">("draw");

  /**
   * Manejar aplicación de material
   */
  const handleApplyMaterial = useCallback(() => {
    if (selectedArea.length === 0) {
      return;
    }

    if (onApplyMaterial) {
      onApplyMaterial(selectedMaterial, selectedArea);
      setSelectedArea([]);
    }
  }, [selectedMaterial, selectedArea, onApplyMaterial]);

  /**
   * Manejar limpieza de área
   */
  const handleCleanArea = useCallback(() => {
    if (selectedArea.length === 0) {
      return;
    }

    if (onCleanArea) {
      onCleanArea(selectedArea);
      setSelectedArea([]);
    }
  }, [selectedArea, onCleanArea]);

  /**
   * Limpiar selección
   */
  const handleClear = useCallback(() => {
    setSelectedArea([]);
  }, []);

  const selectedMaterialObj = MATERIALS.find((m) => m.id === selectedMaterial);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Editor de Materiales</CardTitle>
        <CardDescription>
          Selecciona un material y dibuja en el canvas para aplicarlo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tabs de modo */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as "draw" | "clean")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="draw">Aplicar Material</TabsTrigger>
            <TabsTrigger value="clean">Limpiar Área</TabsTrigger>
          </TabsList>

          {/* Tab: Aplicar Material */}
          <TabsContent value="draw" className="space-y-4">
            {/* Selección de material */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecciona un material:</label>
              <div className="grid grid-cols-2 gap-2">
                {MATERIALS.map((material) => (
                  <button
                    key={material.id}
                    onClick={() => setSelectedMaterial(material.id)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedMaterial === material.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: material.color }}
                      />
                      <div className="text-left">
                        <div className="text-xs font-semibold">{material.name}</div>
                        <div className="text-xs text-gray-500">${material.cost}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Material seleccionado */}
            {selectedMaterialObj && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm">
                  <div className="font-semibold">{selectedMaterialObj.name}</div>
                  <div className="text-gray-600">{selectedMaterialObj.description}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Costo: ${selectedMaterialObj.cost} por unidad
                  </div>
                </div>
              </div>
            )}

            {/* Instrucciones */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  Dibuja en el canvas para seleccionar el área donde aplicar{" "}
                  <strong>{selectedMaterialObj?.name}</strong>
                </div>
              </div>
            </div>

            {/* Área seleccionada */}
            {selectedArea.length > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <Check className="w-4 h-4 text-green-600 inline mr-1" />
                    <strong>{selectedArea.length} puntos seleccionados</strong>
                  </div>
                  <button
                    onClick={handleClear}
                    className="text-xs text-green-600 hover:text-green-700 underline"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex gap-2">
              <Button
                onClick={handleApplyMaterial}
                disabled={selectedArea.length === 0 || isLoading}
                className="flex-1"
              >
                {isLoading ? "Aplicando..." : "Aplicar Material"}
              </Button>
              <Button
                onClick={handleClear}
                variant="outline"
                disabled={selectedArea.length === 0}
              >
                Cancelar
              </Button>
            </div>
          </TabsContent>

          {/* Tab: Limpiar Área */}
          <TabsContent value="clean" className="space-y-4">
            {/* Instrucciones */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  Dibuja en el canvas para seleccionar el área a limpiar (elimina objetos no deseados)
                </div>
              </div>
            </div>

            {/* Área seleccionada */}
            {selectedArea.length > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <Check className="w-4 h-4 text-green-600 inline mr-1" />
                    <strong>{selectedArea.length} puntos seleccionados</strong>
                  </div>
                  <button
                    onClick={handleClear}
                    className="text-xs text-green-600 hover:text-green-700 underline"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex gap-2">
              <Button
                onClick={handleCleanArea}
                disabled={selectedArea.length === 0 || isLoading}
                variant="destructive"
                className="flex-1"
              >
                {isLoading ? "Limpiando..." : "Limpiar Área"}
              </Button>
              <Button
                onClick={handleClear}
                variant="outline"
                disabled={selectedArea.length === 0}
              >
                Cancelar
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
