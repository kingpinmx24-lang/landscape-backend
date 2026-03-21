import React, { useState, useEffect } from "react";
import { useInventory } from "@/hooks/useInventory";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Check } from "lucide-react";
import { InventoryItem, QuickSaleMode as QuickSaleModeType } from "@shared/inventory-types";

interface QuickSaleModeProps {
  onModeChange: (mode: QuickSaleModeType) => void;
  onClose?: () => void;
}

/**
 * Modo rápido de venta
 * Permite seleccionar 2-5 plantas y diseñar SOLO con esas
 */
export function QuickSaleMode({ onModeChange, onClose }: QuickSaleModeProps) {
  const { inventory, filteredInventory } = useInventory();
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [maxPlants] = useState(5);
  const [autoDesign, setAutoDesign] = useState(true);

  const canAddMore = selectedPlants.length < maxPlants;
  const hasMinimum = selectedPlants.length >= 2;

  const handleTogglePlant = (plantId: string) => {
    setSelectedPlants((prev) => {
      if (prev.includes(plantId)) {
        return prev.filter((id) => id !== plantId);
      } else if (canAddMore) {
        return [...prev, plantId];
      }
      return prev;
    });
  };

  const handleActivateMode = () => {
    if (!hasMinimum) return;

    const mode: QuickSaleModeType = {
      enabled: true,
      selectedPlants,
      maxPlants,
      autoDesign,
    };

    onModeChange(mode);
  };

  const handleDeactivateMode = () => {
    const mode: QuickSaleModeType = {
      enabled: false,
      selectedPlants: [],
      maxPlants,
      autoDesign: false,
    };

    onModeChange(mode);
    onClose?.();
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Modo Venta Rápida</CardTitle>
              <CardDescription>
                Selecciona 2-5 plantas para diseñar rápido
              </CardDescription>
            </div>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <p>
              <strong>Modo Rápido:</strong> Diseña usando SOLO las plantas seleccionadas.
              Perfecto para ventas rápidas.
            </p>
          </div>

          {/* Selección de plantas */}
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-2">
              Plantas Seleccionadas ({selectedPlants.length}/{maxPlants})
            </h4>
            <ScrollArea className="h-64 border border-gray-200 rounded-lg p-3">
              <div className="space-y-2">
                {filteredInventory.map((plant) => (
                  <button
                    key={plant.id}
                    onClick={() => handleTogglePlant(plant.id)}
                    disabled={!selectedPlants.includes(plant.id) && !canAddMore}
                    className={`w-full p-2 rounded-lg border-2 transition-colors text-left ${
                      selectedPlants.includes(plant.id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{plant.name}</p>
                        <p className="text-xs text-gray-600">${plant.price}</p>
                      </div>
                      {selectedPlants.includes(plant.id) && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Opciones */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoDesign}
                onChange={(e) => setAutoDesign(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">
                Generar diseño automático con estas plantas
              </span>
            </label>
          </div>

          {/* Resumen */}
          {selectedPlants.length > 0 && (
            <Card className="bg-gray-50">
              <CardContent className="pt-4">
                <h4 className="font-semibold text-sm mb-2">Plantas Seleccionadas:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedPlants.map((plantId) => {
                    const plant = inventory.find((p) => p.id === plantId);
                    return (
                      <Badge key={plantId} variant="secondary">
                        {plant?.name}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botones */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDeactivateMode}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleActivateMode}
              disabled={!hasMinimum}
              className="flex-1"
            >
              Activar Modo Rápido
            </Button>
          </div>

          {!hasMinimum && (
            <p className="text-xs text-gray-600 text-center">
              Selecciona al menos 2 plantas para activar
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
