import React, { useEffect, useState } from "react";
import { useInventory } from "@/hooks/useInventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Search, Filter, ShoppingCart as CartIcon } from "lucide-react";
import { PlantType, ClimateZone } from "@shared/inventory-types";

interface InventoryPanelProps {
  onSelectPlant: (inventoryItemId: string) => void;
  onClose?: () => void;
  showCart?: boolean;
  onDragPlant?: (inventoryItemId: string, imageUrl: string, name: string) => void;
}

/**
 * Panel de inventario con filtros y búsqueda
 * Permite seleccionar plantas para agregar al diseño
 */
export function InventoryPanel({
  onSelectPlant,
  onClose,
  showCart = true,
  onDragPlant,
}: InventoryPanelProps) {
  const {
    filteredInventory,
    isLoading,
    error,
    loadInventory,
    filters,
    updateFilters,
    clearFilters,
    cart,
    addToCart,
  } = useInventory();

  const [selectedQuantity, setSelectedQuantity] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<"inventory" | "cart">("inventory");

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const handleAddToCart = (inventoryItemId: string) => {
    const quantity = selectedQuantity[inventoryItemId] || 1;
    if (addToCart(inventoryItemId, quantity)) {
      setSelectedQuantity((prev) => ({
        ...prev,
        [inventoryItemId]: 1,
      }));
    }
  };

  const handleSelectPlant = (inventoryItemId: string) => {
    onSelectPlant(inventoryItemId);
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Tienda / Inventario</h2>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Tabs */}
      {showCart && (
        <div className="flex gap-2 px-4 pt-4 border-b border-gray-200">
          <Button
            variant={activeTab === "inventory" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("inventory")}
          >
            <Search className="w-4 h-4 mr-2" />
            Inventario
          </Button>
          <Button
            variant={activeTab === "cart" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("cart")}
          >
            <CartIcon className="w-4 h-4 mr-2" />
            Carrito ({cart.totalQuantity})
          </Button>
        </div>
      )}

      {/* Inventario Tab */}
      {activeTab === "inventory" && (
        <>
          {/* Filtros */}
          <div className="p-4 border-b border-gray-200 space-y-3">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar plantas..."
                value={filters.searchTerm || ""}
                onChange={(e) => updateFilters({ searchTerm: e.target.value })}
                className="pl-8"
              />
            </div>

            {/* Tipo */}
            <Select
              value={filters.types?.[0] || ""}
              onValueChange={(value) =>
                updateFilters({ types: value ? [value as PlantType] : undefined })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de planta" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(PlantType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Luz */}
            <Select
              value={filters.sunRequirement || ""}
              onValueChange={(value) =>
                updateFilters({
                  sunRequirement: value as "full" | "partial" | "shade" | undefined,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Requerimiento de luz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Sol pleno</SelectItem>
                <SelectItem value="partial">Parcial</SelectItem>
                <SelectItem value="shade">Sombra</SelectItem>
              </SelectContent>
            </Select>

            {/* Agua */}
            <Select
              value={filters.waterNeeds || ""}
              onValueChange={(value) =>
                updateFilters({
                  waterNeeds: value as "low" | "medium" | "high" | undefined,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Necesidad de agua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>

            {/* Limpiar filtros */}
            {Object.keys(filters).length > 0 && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
                <Filter className="w-4 h-4 mr-2" />
                Limpiar filtros
              </Button>
            )}
          </div>

          {/* Lista de plantas */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {isLoading ? (
                <p className="text-center text-gray-500 py-8">Cargando inventario...</p>
              ) : error ? (
                <p className="text-center text-red-500 py-8">{error}</p>
              ) : filteredInventory.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No se encontraron plantas con estos filtros
                </p>
              ) : (
                filteredInventory.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex gap-3">
                        {/* Imagen */}
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-16 h-16 rounded object-cover"
                        />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-gray-900">{item.name}</h4>
                          <p className="text-xs text-gray-500 italic">{item.scientificName}</p>

                          {/* Badges */}
                          <div className="flex gap-1 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              ${item.price}
                            </Badge>
                            <Badge
                              variant={item.stock > 0 ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {item.stock} en stock
                            </Badge>
                          </div>

                          {/* Detalles */}
                          <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                            <p>Altura: {item.matureHeight}m</p>
                            <p>Luz: {item.sunRequirement}</p>
                          </div>
                        </div>

                          {/* Acciones */}
                        <div
                          className="flex flex-col gap-1 cursor-move"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "copy";
                            e.dataTransfer.setData(
                              "application/json",
                              JSON.stringify({
                                type: "plant",
                                id: item.id,
                                name: item.name,
                                imageUrl: item.imageUrl,
                                price: item.price,
                              })
                            );
                            if (onDragPlant) {
                              onDragPlant(item.id, item.imageUrl, item.name);
                            }
                          }}
                        >
                          <input
                            type="number"
                            min="1"
                            max={item.stock}
                            value={selectedQuantity[item.id] || 1}
                            onChange={(e) =>
                              setSelectedQuantity((prev) => ({
                                ...prev,
                                [item.id]: parseInt(e.target.value) || 1,
                              }))
                            }
                            className="w-12 px-1 py-1 text-xs border border-gray-300 rounded"
                            disabled={item.stock === 0}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddToCart(item.id)}
                            disabled={item.stock === 0}
                            className="text-xs"
                          >
                            Agregar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSelectPlant(item.id)}
                            disabled={item.stock === 0}
                            className="text-xs"
                          >
                            Usar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </>
      )}

      {/* Carrito Tab */}
      {activeTab === "cart" && showCart && (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {cart.items.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Carrito vacío</p>
            ) : (
              <>
                {cart.items.map((cartItem) => {
                  const item = filteredInventory.find(
                    (i) => i.id === cartItem.inventoryItemId
                  );
                  return (
                    <Card key={cartItem.inventoryItemId}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-sm">{item?.name}</h4>
                            <p className="text-xs text-gray-600">
                              {cartItem.quantity} × ${cartItem.unitPrice}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm">
                              ${cartItem.subtotal.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Total */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">Total:</span>
                      <span className="text-lg font-bold text-blue-600">
                        ${cart.totalCost.toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
