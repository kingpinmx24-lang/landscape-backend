import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InventoryItem, PlantType, ClimateZone } from "@shared/inventory-types";
import { ImageUploader } from "./ImageUploader";

interface AddPlantFormProps {
  initialData?: InventoryItem;
  onClose: () => void;
  onSave: (plant: InventoryItem) => void;
}

/**
 * Formulario para agregar o editar una planta
 */
export function AddPlantForm({ initialData, onClose, onSave }: AddPlantFormProps) {
  const [formData, setFormData] = useState<Partial<InventoryItem>>(
    initialData || {
      name: "",
      scientificName: "",
      type: PlantType.FLOWER,
      description: "",
      imageUrl: "",
      price: 0,
      stock: 0,
      minStock: 0,
      climateZones: [ClimateZone.TEMPERATE],
      matureHeight: 0,
      matureWidth: 0,
      minSpacing: 0,
      sunRequirement: "full",
      waterNeeds: "medium",
      maintenanceLevel: "medium",
      nativeRegion: "",
      isActive: true,
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Limpiar error del campo
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) newErrors.name = "El nombre es requerido";
    if (!formData.scientificName?.trim()) newErrors.scientificName = "El nombre científico es requerido";
    if (!formData.price || formData.price <= 0) newErrors.price = "El precio debe ser mayor a 0";
    if (formData.stock === undefined || formData.stock < 0) newErrors.stock = "El stock no puede ser negativo";
    if (!formData.matureHeight || formData.matureHeight <= 0) newErrors.matureHeight = "La altura debe ser mayor a 0";
    if (!formData.matureWidth || formData.matureWidth <= 0) newErrors.matureWidth = "El ancho debe ser mayor a 0";
    if (!formData.minSpacing || formData.minSpacing <= 0) newErrors.minSpacing = "El espaciamiento debe ser mayor a 0";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const plant: InventoryItem = {
      id: initialData?.id || `plant-${Date.now()}`,
      name: formData.name!,
      scientificName: formData.scientificName!,
      type: formData.type as PlantType,
      description: formData.description || "",
      imageUrl: formData.imageUrl || "https://via.placeholder.com/200?text=Plant",
      price: Number(formData.price) || 0,
      stock: Number(formData.stock) || 0,
      minStock: Number(formData.minStock) || 0,
      climateZones: formData.climateZones || [ClimateZone.TEMPERATE],
      matureHeight: Number(formData.matureHeight) || 0,
      matureWidth: Number(formData.matureWidth) || 0,
      minSpacing: Number(formData.minSpacing) || 0,
      sunRequirement: (formData.sunRequirement as "full" | "partial" | "shade") || "full",
      waterNeeds: (formData.waterNeeds as "low" | "medium" | "high") || "medium",
      maintenanceLevel: (formData.maintenanceLevel as "low" | "medium" | "high") || "medium",
      nativeRegion: formData.nativeRegion || "",
      bloomSeason: formData.bloomSeason,
      bloomColor: formData.bloomColor,
      foliageColor: formData.foliageColor,
      createdAt: initialData?.createdAt || Date.now(),
      updatedAt: Date.now(),
      isActive: formData.isActive !== false,
    };

    // Guardar en localStorage
    const inventory = JSON.parse(localStorage.getItem("inventory") || "[]");
    const index = inventory.findIndex((p: InventoryItem) => p.id === plant.id);
    if (index >= 0) {
      inventory[index] = plant;
    } else {
      inventory.push(plant);
    }
    localStorage.setItem("inventory", JSON.stringify(inventory));

    onSave(plant);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre *
        </label>
        <Input
          value={formData.name || ""}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder="Ej: Rosa"
          className={errors.name ? "border-red-500" : ""}
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
      </div>

      {/* Nombre Científico */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre Científico *
        </label>
        <Input
          value={formData.scientificName || ""}
          onChange={(e) => handleChange("scientificName", e.target.value)}
          placeholder="Ej: Rosa spp."
          className={errors.scientificName ? "border-red-500" : ""}
        />
        {errors.scientificName && <p className="text-xs text-red-500 mt-1">{errors.scientificName}</p>}
      </div>

      {/* Tipo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo
        </label>
        <Select value={formData.type || PlantType.FLOWER} onValueChange={(value) => handleChange("type", value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(PlantType).map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción
        </label>
        <textarea
          value={formData.description || ""}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Describe la planta..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          rows={3}
        />
      </div>

      {/* Carga de Imagen */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Foto de la Planta
        </label>
        <ImageUploader
          onImageUpload={(imageUrl) => handleChange("imageUrl", imageUrl)}
          maxSizeMB={5}
        />
        {formData.imageUrl && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <img
              src={formData.imageUrl}
              alt="Preview"
              className="w-24 h-24 object-cover rounded-lg"
            />
            <p className="text-xs text-gray-600 mt-2">Imagen seleccionada</p>
          </div>
        )}
      </div>

      {/* Precio */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Precio ($) *
        </label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={formData.price || ""}
          onChange={(e) => handleChange("price", parseFloat(e.target.value))}
          placeholder="0.00"
          className={errors.price ? "border-red-500" : ""}
        />
        {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
      </div>

      {/* Stock */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stock Disponible *
          </label>
          <Input
            type="number"
            min="0"
            value={formData.stock || ""}
            onChange={(e) => handleChange("stock", parseInt(e.target.value))}
            placeholder="0"
            className={errors.stock ? "border-red-500" : ""}
          />
          {errors.stock && <p className="text-xs text-red-500 mt-1">{errors.stock}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stock Mínimo
          </label>
          <Input
            type="number"
            min="0"
            value={formData.minStock || ""}
            onChange={(e) => handleChange("minStock", parseInt(e.target.value))}
            placeholder="0"
          />
        </div>
      </div>

      {/* Dimensiones */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Altura Adulta (m) *
          </label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={formData.matureHeight || ""}
            onChange={(e) => handleChange("matureHeight", parseFloat(e.target.value))}
            placeholder="0.0"
            className={errors.matureHeight ? "border-red-500" : ""}
          />
          {errors.matureHeight && <p className="text-xs text-red-500 mt-1">{errors.matureHeight}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ancho Adulto (m) *
          </label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={formData.matureWidth || ""}
            onChange={(e) => handleChange("matureWidth", parseFloat(e.target.value))}
            placeholder="0.0"
            className={errors.matureWidth ? "border-red-500" : ""}
          />
          {errors.matureWidth && <p className="text-xs text-red-500 mt-1">{errors.matureWidth}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Espaciamiento Mín. (m) *
          </label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={formData.minSpacing || ""}
            onChange={(e) => handleChange("minSpacing", parseFloat(e.target.value))}
            placeholder="0.0"
            className={errors.minSpacing ? "border-red-500" : ""}
          />
          {errors.minSpacing && <p className="text-xs text-red-500 mt-1">{errors.minSpacing}</p>}
        </div>
      </div>

      {/* Requerimientos */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Luz
          </label>
          <Select value={formData.sunRequirement || "full"} onValueChange={(value) => handleChange("sunRequirement", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Sol pleno</SelectItem>
              <SelectItem value="partial">Parcial</SelectItem>
              <SelectItem value="shade">Sombra</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Agua
          </label>
          <Select value={formData.waterNeeds || "medium"} onValueChange={(value) => handleChange("waterNeeds", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baja</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mantenimiento
          </label>
          <Select value={formData.maintenanceLevel || "medium"} onValueChange={(value) => handleChange("maintenanceLevel", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Bajo</SelectItem>
              <SelectItem value="medium">Medio</SelectItem>
              <SelectItem value="high">Alto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Región Nativa */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Región Nativa
        </label>
        <Input
          value={formData.nativeRegion || ""}
          onChange={(e) => handleChange("nativeRegion", e.target.value)}
          placeholder="Ej: América del Norte"
        />
      </div>

      {/* Botones */}
      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" className="flex-1">
          {initialData ? "Actualizar" : "Agregar"} Planta
        </Button>
      </div>
    </form>
  );
}
