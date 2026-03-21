/**
 * Component: AdjustLiveStep
 * ============================================================================
 * Paso 4 del flujo: Ajuste en vivo con interacción completa e inventario real
 */

import React, { useCallback, useState, useEffect, useMemo } from "react";
import { LiveInteractionCanvas } from "./LiveInteractionCanvas";
import { FloatingControls } from "./FloatingControls";
import { MaterialEditor } from "./MaterialEditor";
import { InventoryPanel } from "./InventoryPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Undo2, Redo2, ShoppingBag } from "lucide-react";
import { useLiveInteraction } from "@/hooks/useLiveInteraction";
import { useDesignSync } from "@/hooks/useDesignSync";
import { useInventory } from "@/hooks/useInventory";
import { DesignData, AdjustLiveData } from "@shared/workflow-persistence-types";

interface AdjustLiveStepProps {
  projectId: string;
  initialDesign: DesignData;
  onComplete?: (adjustmentData: AdjustLiveData) => void;
  onCancel?: () => void;
}

/**
 * Componente AdjustLiveStep
 */
export const AdjustLiveStep: React.FC<AdjustLiveStepProps> = ({
  projectId,
  initialDesign,
  onComplete,
  onCancel,
}) => {
  const [activeTab, setActiveTab] = useState<"canvas" | "materials" | "inventory">("canvas");
  const [userNotes, setUserNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hooks de interacción y sincronización
  const liveInteraction = useLiveInteraction();
  const designSync = useDesignSync(projectId, {
    autoSaveInterval: 2000,
    debounceDelay: 500,
    enableOfflineMode: true,
  });

  // Hook de inventario
  const { getInventoryItem } = useInventory();

  // Inicializar con diseño inicial
  useEffect(() => {
    if (initialDesign && initialDesign.plants) {
      designSync.updateDesignState({
        objects: initialDesign.plants.map((p) => ({
          id: p.id,
          type: p.type,
          x: p.x,
          y: p.y,
          metadata: p.metadata,
        })),
        materials: initialDesign.materials.reduce(
          (acc, m) => {
            acc[m.id] = m.type;
            return acc;
          },
          {} as Record<string, string>
        ),
      });
    }
  }, [initialDesign]);

  /**
   * Calcular cotización en tiempo real basada en los objetos actuales
   */
  const currentQuotation = useMemo(() => {
    const plantsCost = designSync.designState.objects.reduce((sum, obj) => {
      // Intentar obtener el precio del inventario si existe el ID en metadata
      const inventoryId = obj.metadata?.inventoryId as string;
      if (inventoryId) {
        const item = getInventoryItem(inventoryId);
        return sum + (item?.price || 0);
      }
      // Fallback al costo guardado en el objeto
      return sum + (obj.cost || 0);
    }, 0);

    const materialsCost = Object.keys(designSync.designState.materials).length * 50; // Costo fijo por área de material
    const laborCost = (designSync.designState.objects.length * 10) + (Object.keys(designSync.designState.materials).length * 20);
    const subtotal = plantsCost + materialsCost + laborCost;
    const margin = 0.3;
    const totalCost = subtotal;
    const finalPrice = totalCost * (1 + margin);

    return {
      plantsCost,
      materialsCost,
      laborCost,
      totalCost,
      margin,
      finalPrice,
    };
  }, [designSync.designState.objects, designSync.designState.materials, getInventoryItem]);

  /**
   * Manejar selección de objeto
   */
  const handleSelectObject = useCallback(
    (object: any) => {
      liveInteraction.selectObject(object);
    },
    [liveInteraction]
  );

  /**
   * Manejar movimiento de objeto
   */
  const handleMoveObject = useCallback(
    (moveData: any) => {
      liveInteraction.moveObject(moveData);
      designSync.updateObject(moveData.objectId, {
        x: moveData.newX,
        y: moveData.newY,
      });
    },
    [liveInteraction, designSync]
  );

  /**
   * Manejar eliminación de objeto
   */
  const handleDeleteObject = useCallback(
    (deleteData: any) => {
      const objectId = typeof deleteData === 'string' ? deleteData : deleteData.id;
      liveInteraction.deleteObject({ id: objectId } as any);
      designSync.deleteObject(objectId);
    },
    [liveInteraction, designSync]
  );

  /**
   * Manejar duplicación de objeto
   */
  const handleDuplicateObject = useCallback(
    (object: any) => {
      const newObject = {
        ...object,
        id: `${object.id}-${Date.now()}`,
        x: object.x + 50,
        y: object.y + 50,
      };
      designSync.addObject(newObject);
    },
    [designSync]
  );

  /**
   * Manejar cambio de tipo de objeto
   */
  const handleChangeObjectType = useCallback(
    (objectId: string, newType: string) => {
      designSync.updateObject(objectId, { type: newType });
    },
    [designSync]
  );

  /**
   * Manejar aplicación de material
   */
  const handleApplyMaterial = useCallback(
    (material: string, area: Array<{ x: number; y: number }>) => {
      const areaId = `area-${Date.now()}`;
      designSync.applyMaterial(areaId, material);
    },
    [designSync]
  );

  /**
   * Manejar selección de planta desde el inventario
   */
  const handleSelectPlantFromInventory = useCallback((inventoryItemId: string) => {
    const item = getInventoryItem(inventoryItemId);
    if (!item) return;

    const newPlant = {
      id: `plant-${Date.now()}`,
      type: item.type,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      radius: 20,
      name: item.name,
      cost: item.price,
      metadata: {
        inventoryId: item.id,
        scientificName: item.scientificName,
        imageUrl: item.imageUrl,
      },
    };

    designSync.addObject(newPlant);
    setActiveTab("canvas"); // Volver al canvas para ver la planta agregada
  }, [getInventoryItem, designSync]);

  /**
   * Manejar completar ajuste
   */
  const handleComplete = useCallback(async () => {
    try {
      setIsSubmitting(true);

      const adjustmentData: AdjustLiveData = {
        changes: liveInteraction.state.history.map((action, index) => ({
          id: `change-${index}`,
          timestamp: Date.now(),
          type: action.type as any,
          objectId: undefined,
          oldValue: undefined,
          newValue: undefined,
          description: `${action.type}: cambio realizado`,
        })),
        finalDesign: {
          ...initialDesign,
          plants: designSync.designState.objects.map((obj) => ({
            id: obj.id,
            type: obj.type,
            x: obj.x,
            y: obj.y,
            radius: 20,
            name: obj.name || obj.type,
            cost: obj.cost || 0,
            metadata: obj.metadata,
          })),
          materials: Object.entries(designSync.designState.materials).map(([id, type]) => ({
            id,
            type: type as any,
            polygon: [], // En una implementación real, guardaríamos el polígono
            area: 1,
            cost: 50,
          })),
          quotation: currentQuotation,
          timestamp: Date.now(),
        },
        userNotes,
        timestamp: Date.now(),
      };

      // Guardar cambios
      await designSync.manualSync();

      onComplete?.(adjustmentData);
    } catch (error) {
      console.error("Error al completar ajuste:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [liveInteraction, designSync, initialDesign, userNotes, onComplete, currentQuotation]);

  return (
    <div className="flex flex-col h-full gap-4 p-4 bg-gray-50">
      {/* Header con controles */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ajustar Diseño en Vivo</h2>
          <p className="text-gray-600 text-sm">
            Modifica el diseño interactivamente con plantas del inventario real.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => liveInteraction.undo()}
            disabled={liveInteraction.state.history.length === 0}
          >
            <Undo2 className="w-4 h-4 mr-1" />
            Deshacer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => liveInteraction.redo()}
            disabled={liveInteraction.state.historyIndex >= liveInteraction.state.history.length - 1}
          >
            <Redo2 className="w-4 h-4 mr-1" />
            Rehacer
          </Button>
          <Button
            onClick={handleComplete}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-1" />
            {isSubmitting ? "Guardando..." : "Finalizar Diseño"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 overflow-hidden">
        {/* Main Content Area */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden">
          {/* Tabs de herramientas */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3 bg-white">
              <TabsTrigger value="canvas">Canvas</TabsTrigger>
              <TabsTrigger value="materials">Materiales</TabsTrigger>
              <TabsTrigger value="inventory" className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Plantas (Inventario)
              </TabsTrigger>
            </TabsList>

            {/* Tab: Canvas */}
            <TabsContent value="canvas" className="flex-1 mt-0 overflow-hidden">
              <Card className="h-full border-none shadow-sm overflow-hidden">
                <CardContent className="p-0 h-full relative bg-gray-200">
                  <LiveInteractionCanvas
                    width={800}
                    height={600}
                    objects={designSync.designState.objects.map(obj => ({
                      ...obj,
                      radius: 20,
                    }))}
                    onObjectsChange={(objs) => {
                      // Sincronizar cambios de posición si es necesario
                    }}
                    onSelectionChange={(selected) => {
                      if (selected.length > 0) {
                        handleSelectObject(selected[0]);
                      }
                    }}
                  />
                  <FloatingControls
                    x={liveInteraction.state.floatingControlsX || 0}
                    y={liveInteraction.state.floatingControlsY || 0}
                    selectedObject={liveInteraction.state.selectedObjects[0] || null}
                    onDelete={handleDeleteObject}
                    onDuplicate={handleDuplicateObject}
                    onChangeType={handleChangeObjectType}
                    isVisible={liveInteraction.state.showFloatingControls}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Materiales */}
            <TabsContent value="materials" className="flex-1 mt-0 overflow-auto">
              <Card className="h-full border-none shadow-sm">
                <CardHeader>
                  <CardTitle>Editor de Materiales</CardTitle>
                  <CardDescription>
                    Cambia materiales de terreno (pasto, tierra, concreto, grava)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MaterialEditor
                    onApplyMaterial={handleApplyMaterial}
                    onCleanArea={() => {}}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Inventario */}
            <TabsContent value="inventory" className="flex-1 mt-0 overflow-hidden">
              <Card className="h-full border-none shadow-sm overflow-hidden">
                <InventoryPanel
                  onSelectPlant={handleSelectPlantFromInventory}
                  showCart={false}
                />
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar: Cotización en tiempo real */}
        <div className="lg:col-span-1 flex flex-col gap-4 overflow-auto">
          <Card className="border-none shadow-sm bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-green-800">
                Cotización en Tiempo Real
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Plantas ({designSync.designState.objects.length}):</span>
                  <span className="font-semibold text-gray-900">${currentQuotation.plantsCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Materiales:</span>
                  <span className="font-semibold text-gray-900">${currentQuotation.materialsCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Mano de Obra:</span>
                  <span className="font-semibold text-gray-900">${currentQuotation.laborCost.toFixed(2)}</span>
                </div>
                <div className="border-t border-green-200 pt-2 flex justify-between text-sm text-gray-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-gray-900">${currentQuotation.totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Margen (30%):</span>
                  <span className="font-semibold text-gray-900">${(currentQuotation.totalCost * currentQuotation.margin).toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-green-300 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-green-900">Total:</span>
                  <span className="text-3xl font-bold text-green-600">
                    ${currentQuotation.finalPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Notas del Diseño</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full p-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                rows={4}
                placeholder="Añade notas sobre los cambios realizados..."
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
