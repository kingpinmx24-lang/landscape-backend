import React, { useState, useEffect } from "react";
import { useInventory } from "@/hooks/useInventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit2, Trash2, Upload, Download } from "lucide-react";
import { InventoryItem, PlantType } from "@shared/inventory-types";
import { AddPlantForm } from "@/components/AddPlantForm";
import { CSVImporter } from "@/components/CSVImporter";

/**
 * Página de administración de inventario
 * Permite agregar, editar, eliminar plantas y gestionar stock
 */
export default function InventoryAdmin() {
  const { inventory, loadInventory, updateStock } = useInventory();
  const [editingPlant, setEditingPlant] = useState<InventoryItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportCSV, setShowImportCSV] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const filteredInventory = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.scientificName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeletePlant = (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta planta?")) {
      // En producción, sería: await trpc.inventory.delete.mutate(id)
      const updatedInventory = inventory.filter((item) => item.id !== id);
      localStorage.setItem("inventory", JSON.stringify(updatedInventory));
      loadInventory();
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Nombre",
      "Nombre Científico",
      "Tipo",
      "Precio",
      "Stock",
      "Stock Mínimo",
      "Altura Adulta",
      "Ancho Adulto",
      "Espaciamiento Mínimo",
      "Luz",
      "Agua",
      "Mantenimiento",
      "Región Nativa",
    ];

    const rows = inventory.map((item) => [
      item.id,
      item.name,
      item.scientificName,
      item.type,
      item.price,
      item.stock,
      item.minStock,
      item.matureHeight,
      item.matureWidth,
      item.minSpacing,
      item.sunRequirement,
      item.waterNeeds,
      item.maintenanceLevel,
      item.nativeRegion,
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventario-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalValue = inventory.reduce((sum, item) => sum + item.price * item.stock, 0);
  const lowStockItems = inventory.filter((item) => item.stock < item.minStock);
  const outOfStockItems = inventory.filter((item) => item.stock === 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Administración de Inventario</h1>
            <p className="text-gray-600 mt-1">Gestiona tu catálogo de plantas</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
            <Dialog open={showImportCSV} onOpenChange={setShowImportCSV}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar CSV
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Importar Inventario desde CSV</DialogTitle>
                  <DialogDescription>
                    Sube un archivo CSV con tus plantas
                  </DialogDescription>
                </DialogHeader>
                <CSVImporter onClose={() => setShowImportCSV(false)} />
              </DialogContent>
            </Dialog>
            <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Planta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar Nueva Planta</DialogTitle>
                  <DialogDescription>
                    Completa los detalles de la nueva planta
                  </DialogDescription>
                </DialogHeader>
                <AddPlantForm
                  onClose={() => setShowAddForm(false)}
                  onSave={() => {
                    setShowAddForm(false);
                    loadInventory();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total de Plantas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">{inventory.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Valor Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">${totalValue.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Stock Bajo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600">{lowStockItems.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Agotado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{outOfStockItems.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Búsqueda */}
        <div>
          <Input
            placeholder="Buscar plantas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Tabla de plantas */}
        <Card>
          <CardHeader>
            <CardTitle>Plantas en Inventario</CardTitle>
            <CardDescription>
              {filteredInventory.length} plantas encontradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imagen</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Mín.</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Luz</TableHead>
                    <TableHead>Agua</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-500">
                            Sin foto
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-gray-500 italic">{item.scientificName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>${item.price.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.stock === 0
                              ? "destructive"
                              : item.stock < item.minStock
                                ? "secondary"
                                : "default"
                          }
                        >
                          {item.stock}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.minStock}</TableCell>
                      <TableCell>${(item.price * item.stock).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{item.sunRequirement}</TableCell>
                      <TableCell className="text-xs">{item.waterNeeds}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingPlant(item)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeletePlant(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Alertas de stock */}
        {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-yellow-900">Alertas de Stock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {outOfStockItems.length > 0 && (
                <div>
                  <p className="font-semibold text-red-700 mb-1">Agotadas:</p>
                  <div className="flex flex-wrap gap-2">
                    {outOfStockItems.map((item) => (
                      <Badge key={item.id} variant="destructive">
                        {item.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {lowStockItems.length > 0 && (
                <div>
                  <p className="font-semibold text-yellow-700 mb-1">Stock Bajo:</p>
                  <div className="flex flex-wrap gap-2">
                    {lowStockItems.map((item) => (
                      <Badge key={item.id} variant="secondary">
                        {item.name} ({item.stock}/{item.minStock})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de edición */}
      {editingPlant && (
        <Dialog open={!!editingPlant} onOpenChange={() => setEditingPlant(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Planta</DialogTitle>
              <DialogDescription>
                Actualiza los detalles de {editingPlant.name}
              </DialogDescription>
            </DialogHeader>
            <AddPlantForm
              initialData={editingPlant}
              onClose={() => setEditingPlant(null)}
              onSave={() => {
                setEditingPlant(null);
                loadInventory();
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
