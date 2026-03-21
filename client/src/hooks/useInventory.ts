import { useState, useCallback, useMemo, useEffect } from "react";
import {
  InventoryItem,
  InventoryFilters,
  ShoppingCart,
  CartItem,
  PlantType,
  ClimateZone,
} from "@shared/inventory-types";
import { trpc } from "@/lib/trpc";

/**
 * Hook para gestión del inventario
 * Proporciona acceso a plantas, filtrado, carrito y control de stock
 */
export function useInventory() {
  // Estado del inventario
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cart, setCart] = useState<ShoppingCart>({
    items: [],
    totalQuantity: 0,
    totalCost: 0,
    lastUpdated: Date.now(),
  });
  const [filters, setFilters] = useState<InventoryFilters>({});
  
  // Usar tRPC para obtener el inventario real
  const inventoryQuery = trpc.inventory.getAll.useQuery();

  // Actualizar el estado local cuando cambian los datos de tRPC
  useEffect(() => {
    if (inventoryQuery.data) {
      // Mapear los datos del backend al formato esperado por el frontend si es necesario
      const mappedInventory: InventoryItem[] = inventoryQuery.data.map((item: any) => ({
        id: item.id,
        name: item.name,
        scientificName: item.scientificName || "",
        type: item.type as PlantType,
        description: item.description || "",
        imageUrl: item.imageUrl || "https://via.placeholder.com/200?text=Plant",
        price: item.price,
        stock: item.stock,
        minStock: item.minStock,
        climateZones: item.climate ? [item.climate as ClimateZone] : [],
        matureHeight: item.matureHeight || 0,
        matureWidth: item.matureWidth || 0,
        minSpacing: item.minSpacing || 0,
        sunRequirement: item.lightRequirement || "full",
        waterNeeds: item.waterRequirement || "medium",
        maintenanceLevel: "medium",
        nativeRegion: "Various",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      }));
      setInventory(mappedInventory);
    }
  }, [inventoryQuery.data]);

  /**
   * Cargar inventario (ahora manejado por tRPC)
   */
  const loadInventory = useCallback(async () => {
    inventoryQuery.refetch();
  }, [inventoryQuery]);

  /**
   * Filtrar inventario según criterios
   */
  const filteredInventory = useMemo(() => {
    let result = inventory;

    // Filtro de búsqueda
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.scientificName.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term)
      );
    }

    // Filtro de tipo
    if (filters.types && filters.types.length > 0) {
      result = result.filter((item) => filters.types!.includes(item.type));
    }

    // Filtro de clima
    if (filters.climateZones && filters.climateZones.length > 0) {
      result = result.filter((item) =>
        item.climateZones.some((zone) => filters.climateZones!.includes(zone))
      );
    }

    // Filtro de precio
    if (filters.priceRange) {
      result = result.filter(
        (item) =>
          item.price >= filters.priceRange!.min &&
          item.price <= filters.priceRange!.max
      );
    }

    // Filtro de luz
    if (filters.sunRequirement) {
      result = result.filter((item) => item.sunRequirement === filters.sunRequirement);
    }

    // Filtro de agua
    if (filters.waterNeeds) {
      result = result.filter((item) => item.waterNeeds === filters.waterNeeds);
    }

    // Filtro de mantenimiento
    if (filters.maintenanceLevel) {
      result = result.filter((item) => item.maintenanceLevel === filters.maintenanceLevel);
    }

    // Filtro de stock
    if (filters.inStockOnly) {
      result = result.filter((item) => item.stock > 0);
    }

    return result;
  }, [inventory, filters]);

  /**
   * Actualizar filtros
   */
  const updateFilters = useCallback((newFilters: Partial<InventoryFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  /**
   * Limpiar filtros
   */
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  /**
   * Agregar item al carrito
   */
  const addToCart = useCallback(
    (inventoryItemId: string, quantity: number) => {
      const item = inventory.find((i) => i.id === inventoryItemId);
      if (!item) {
        return false;
      }

      if (item.stock < quantity) {
        return false;
      }

      setCart((prev) => {
        const existingItem = prev.items.find((i) => i.inventoryItemId === inventoryItemId);
        let newItems: CartItem[];

        if (existingItem) {
          newItems = prev.items.map((i) =>
            i.inventoryItemId === inventoryItemId
              ? {
                  ...i,
                  quantity: i.quantity + quantity,
                  subtotal: (i.quantity + quantity) * i.unitPrice,
                }
              : i
          );
        } else {
          newItems = [
            ...prev.items,
            {
              inventoryItemId,
              quantity,
              unitPrice: item.price,
              subtotal: quantity * item.price,
            },
          ];
        }

        const totalQuantity = newItems.reduce((sum, i) => sum + i.quantity, 0);
        const totalCost = newItems.reduce((sum, i) => sum + i.subtotal, 0);

        return {
          items: newItems,
          totalQuantity,
          totalCost,
          lastUpdated: Date.now(),
        };
      });

      return true;
    },
    [inventory]
  );

  /**
   * Remover item del carrito
   */
  const removeFromCart = useCallback((inventoryItemId: string) => {
    setCart((prev) => {
      const newItems = prev.items.filter((i) => i.inventoryItemId !== inventoryItemId);
      const totalQuantity = newItems.reduce((sum, i) => sum + i.quantity, 0);
      const totalCost = newItems.reduce((sum, i) => sum + i.subtotal, 0);

      return {
        items: newItems,
        totalQuantity,
        totalCost,
        lastUpdated: Date.now(),
      };
    });
  }, []);

  /**
   * Actualizar cantidad en carrito
   */
  const updateCartQuantity = useCallback(
    (inventoryItemId: string, newQuantity: number) => {
      if (newQuantity <= 0) {
        removeFromCart(inventoryItemId);
        return;
      }

      const item = inventory.find((i) => i.id === inventoryItemId);
      if (!item) return;

      if (item.stock < newQuantity) {
        return;
      }

      setCart((prev) => {
        const newItems = prev.items.map((i) =>
          i.inventoryItemId === inventoryItemId
            ? {
                ...i,
                quantity: newQuantity,
                subtotal: newQuantity * i.unitPrice,
              }
            : i
        );

        const totalQuantity = newItems.reduce((sum, i) => sum + i.quantity, 0);
        const totalCost = newItems.reduce((sum, i) => sum + i.subtotal, 0);

        return {
          items: newItems,
          totalQuantity,
          totalCost,
          lastUpdated: Date.now(),
        };
      });
    },
    [inventory, removeFromCart]
  );

  /**
   * Limpiar carrito
   */
  const clearCart = useCallback(() => {
    setCart({
      items: [],
      totalQuantity: 0,
      totalCost: 0,
      lastUpdated: Date.now(),
    });
  }, []);

  /**
   * Obtener item del inventario
   */
  const getInventoryItem = useCallback(
    (id: string) => inventory.find((i) => i.id === id),
    [inventory]
  );

  /**
   * Actualizar stock (después de usar en diseño)
   */
  const updateStock = useCallback(
    (inventoryItemId: string, change: number) => {
      setInventory((prev) =>
        prev.map((item) =>
          item.id === inventoryItemId
            ? { ...item, stock: Math.max(0, item.stock + change) }
            : item
        )
      );
    },
    []
  );

  return {
    // Inventario
    inventory,
    filteredInventory,
    isLoading: inventoryQuery.isLoading,
    error: inventoryQuery.error ? inventoryQuery.error.message : null,
    loadInventory,

    // Filtros
    filters,
    updateFilters,
    clearFilters,

    // Carrito
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,

    // Utilidades
    getInventoryItem,
    updateStock,
  };
}
