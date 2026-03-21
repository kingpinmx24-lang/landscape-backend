import { useState, useCallback } from "react";
import { DesignPlant, InventoryItem } from "@shared/inventory-types";
import { useInventory } from "./useInventory";

/**
 * Hook para integración del inventario con el canvas
 * Maneja la colocación de plantas del inventario en el diseño
 */
export function useInventoryCanvas() {
  const { getInventoryItem, updateStock } = useInventory();
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<string | null>(null);
  const [isPlacingMode, setIsPlacingMode] = useState(false);
  const [designPlants, setDesignPlants] = useState<DesignPlant[]>([]);

  /**
   * Activar modo de colocación para una planta del inventario
   */
  const activatePlacingMode = useCallback((inventoryItemId: string) => {
    setSelectedInventoryItem(inventoryItemId);
    setIsPlacingMode(true);
  }, []);

  /**
   * Desactivar modo de colocación
   */
  const deactivatePlacingMode = useCallback(() => {
    setIsPlacingMode(false);
    setSelectedInventoryItem(null);
  }, []);

  /**
   * Colocar planta en el canvas
   */
  const placePlantOnCanvas = useCallback(
    (x: number, y: number, quantity: number = 1) => {
      if (!selectedInventoryItem) return null;

      const inventoryItem = getInventoryItem(selectedInventoryItem);
      if (!inventoryItem) return null;

      const newDesignPlant: DesignPlant = {
        id: `design-${Date.now()}-${Math.random()}`,
        inventoryItemId: selectedInventoryItem,
        x,
        y,
        radius: inventoryItem.matureWidth / 2,
        quantity,
        addedAt: Date.now(),
      };

      setDesignPlants((prev) => [...prev, newDesignPlant]);

      // Actualizar stock
      updateStock(selectedInventoryItem, -quantity);

      return newDesignPlant;
    },
    [selectedInventoryItem, getInventoryItem, updateStock]
  );

  /**
   * Mover planta en el canvas
   */
  const moveDesignPlant = useCallback((plantId: string, x: number, y: number) => {
    setDesignPlants((prev) =>
      prev.map((plant) =>
        plant.id === plantId
          ? { ...plant, x, y }
          : plant
      )
    );
  }, []);

  /**
   * Eliminar planta del diseño
   */
  const removeDesignPlant = useCallback((plantId: string) => {
    setDesignPlants((prev) => {
      const plant = prev.find((p) => p.id === plantId);
      if (plant) {
        // Devolver stock
        updateStock(plant.inventoryItemId, plant.quantity);
      }
      return prev.filter((p) => p.id !== plantId);
    });
  }, [updateStock]);

  /**
   * Duplicar planta en el canvas
   */
  const duplicateDesignPlant = useCallback(
    (plantId: string, offsetX: number = 0, offsetY: number = 0) => {
      const plant = designPlants.find((p) => p.id === plantId);
      if (!plant) return null;

      const inventoryItem = getInventoryItem(plant.inventoryItemId);
      if (!inventoryItem) return null;

      // Verificar stock disponible
      if (inventoryItem.stock < plant.quantity) {
        return null;
      }

      const newDesignPlant: DesignPlant = {
        ...plant,
        id: `design-${Date.now()}-${Math.random()}`,
        x: plant.x + offsetX,
        y: plant.y + offsetY,
        addedAt: Date.now(),
      };

      setDesignPlants((prev) => [...prev, newDesignPlant]);
      updateStock(plant.inventoryItemId, -plant.quantity);

      return newDesignPlant;
    },
    [designPlants, getInventoryItem, updateStock]
  );

  /**
   * Cambiar cantidad de plantas en un punto
   */
  const updateDesignPlantQuantity = useCallback(
    (plantId: string, newQuantity: number) => {
      const plant = designPlants.find((p) => p.id === plantId);
      if (!plant) return;

      const inventoryItem = getInventoryItem(plant.inventoryItemId);
      if (!inventoryItem) return;

      const quantityDifference = newQuantity - plant.quantity;

      // Verificar si hay stock disponible
      if (quantityDifference > 0 && inventoryItem.stock < quantityDifference) {
        return;
      }

      setDesignPlants((prev) =>
        prev.map((p) =>
          p.id === plantId
            ? { ...p, quantity: newQuantity }
            : p
        )
      );

      // Actualizar stock
      updateStock(plant.inventoryItemId, -quantityDifference);
    },
    [designPlants, getInventoryItem, updateStock]
  );

  /**
   * Cambiar tipo de planta en un punto del diseño
   */
  const changeDesignPlantType = useCallback(
    (plantId: string, newInventoryItemId: string) => {
      const plant = designPlants.find((p) => p.id === plantId);
      if (!plant) return;

      const newInventoryItem = getInventoryItem(newInventoryItemId);
      if (!newInventoryItem) return;

      // Verificar stock disponible para la nueva planta
      if (newInventoryItem.stock < plant.quantity) {
        return;
      }

      // Devolver stock de la planta anterior
      updateStock(plant.inventoryItemId, plant.quantity);

      // Restar stock de la nueva planta
      updateStock(newInventoryItemId, -plant.quantity);

      setDesignPlants((prev) =>
        prev.map((p) =>
          p.id === plantId
            ? {
                ...p,
                inventoryItemId: newInventoryItemId,
                radius: newInventoryItem.matureWidth / 2,
              }
            : p
        )
      );
    },
    [designPlants, getInventoryItem, updateStock]
  );

  /**
   * Obtener resumen de plantas usadas
   */
  const getPlantSummary = useCallback(() => {
    const summary: Record<string, { item: InventoryItem; quantity: number; cost: number }> = {};

    designPlants.forEach((plant) => {
      const item = getInventoryItem(plant.inventoryItemId);
      if (item) {
        if (!summary[plant.inventoryItemId]) {
          summary[plant.inventoryItemId] = {
            item,
            quantity: 0,
            cost: 0,
          };
        }
        summary[plant.inventoryItemId].quantity += plant.quantity;
        summary[plant.inventoryItemId].cost += plant.quantity * item.price;
      }
    });

    return Object.values(summary);
  }, [designPlants, getInventoryItem]);

  /**
   * Calcular costo total de plantas
   */
  const getTotalPlantsCost = useCallback(() => {
    return getPlantSummary().reduce((total, item) => total + item.cost, 0);
  }, [getPlantSummary]);

  /**
   * Limpiar todas las plantas del diseño
   */
  const clearAllDesignPlants = useCallback(() => {
    // Devolver todo el stock
    designPlants.forEach((plant) => {
      updateStock(plant.inventoryItemId, plant.quantity);
    });
    setDesignPlants([]);
  }, [designPlants, updateStock]);

  /**
   * Obtener planta del diseño por ID
   */
  const getDesignPlant = useCallback(
    (plantId: string) => designPlants.find((p) => p.id === plantId),
    [designPlants]
  );

  /**
   * Obtener plantas cercanas (para verificar colisiones)
   */
  const getNearbyPlants = useCallback(
    (x: number, y: number, radius: number) => {
      return designPlants.filter((plant) => {
        const distance = Math.sqrt((plant.x - x) ** 2 + (plant.y - y) ** 2);
        const minDistance = (plant.radius + radius) * 1.5; // 1.5x para espaciamiento
        return distance < minDistance;
      });
    },
    [designPlants]
  );

  /**
   * Verificar si hay espacio disponible para colocar planta
   */
  const canPlacePlant = useCallback(
    (x: number, y: number, radius: number) => {
      const nearby = getNearbyPlants(x, y, radius);
      return nearby.length === 0;
    },
    [getNearbyPlants]
  );

  return {
    // Estado
    selectedInventoryItem,
    isPlacingMode,
    designPlants,

    // Activación/Desactivación
    activatePlacingMode,
    deactivatePlacingMode,

    // Operaciones en canvas
    placePlantOnCanvas,
    moveDesignPlant,
    removeDesignPlant,
    duplicateDesignPlant,
    updateDesignPlantQuantity,
    changeDesignPlantType,
    clearAllDesignPlants,

    // Consultas
    getDesignPlant,
    getNearbyPlants,
    canPlacePlant,
    getPlantSummary,
    getTotalPlantsCost,
  };
}
