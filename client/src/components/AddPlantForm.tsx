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
import { InventoryItem, PlantType } from "@shared/inventory-types";
import { useInventory } from "@/hooks/useInventory";
import { trpc } from "@/lib/trpc";
import { ImageUploader } from "./ImageUploader";
import { Loader2 } from "lucide-react";

interface AddPlantFormProps {
  initialData?: InventoryItem;
  onClose: () => void;
  onSave: (plant: InventoryItem) => void;
}

// All plant types accepted by the server
const PLANT_TYPES = [
  { value: "tree",        label: "Árbol" },
  { value: "shrub",       label: "Arbusto" },
  { value: "flower",      label: "Flor / Planta de flor" },
  { value: "grass",       label: "Pasto / Césped" },
  { value: "groundcover", label: "Cubresuelo" },
  { value: "palm",        label: "Palmera" },
  { value: "succulent",   label: "Suculenta / Cactus" },
  { value: "vine",        label: "Enredadera / Trepadora" },
];

/**
 * Formulario simplificado para agregar o editar una planta
 * Solo campos esenciales — rápido de llenar en campo
 */
export function AddPlantForm({ initialData, onClose, onSave }: AddPlantFormProps) {
  const { addPlant, updatePlant } = useInventory();
  const uploadImageMutation = trpc.inventory.uploadImage.useMutation();

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    scientificName: initialData?.scientificName || "",
    type: (initialData?.type as string) || "tree",
    description: initialData?.description || "",
    imageUrl: initialData?.imageUrl || "",
    price: initialData?.price || 0,
    stock: initialData?.stock || 0,
    minStock: initialData?.minStock || 0,
    lightRequirement: (initialData as any)?.lightRequirement || "full",
    waterRequirement: (initialData as any)?.waterRequirement || "medium",
    matureHeight: (initialData as any)?.matureHeight || "",
    matureWidth: (initialData as any)?.matureWidth || "",
    minSpacing: (initialData as any)?.minSpacing || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = "El nombre es requerido";
    if (!formData.price || Number(formData.price) <= 0) newErrors.price = "El precio debe ser mayor a 0";
    if (formData.stock === undefined || Number(formData.stock) < 0) newErrors.stock = "El stock no puede ser negativo";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      // Only send fields that the server accepts
      const plantData = {
        name: formData.name.trim(),
        scientificName: formData.scientificName?.trim() || null,
        type: formData.type as any,
        description: formData.description?.trim() || null,
        imageUrl: formData.imageUrl || null,
        price: Number(formData.price),
        stock: Number(formData.stock) || 0,
        minStock: Number(formData.minStock) || 0,
        lightRequirement: (formData.lightRequirement as "full" | "partial" | "shade") || null,
        waterRequirement: (formData.waterRequirement as "low" | "medium" | "high") || null,
        matureHeight: formData.matureHeight ? Number(formData.matureHeight) : null,
        matureWidth: formData.matureWidth ? Number(formData.matureWidth) : null,
        minSpacing: formData.minSpacing ? Number(formData.minSpacing) : null,
      };

      let savedPlant: any;
      if (initialData?.id) {
        savedPlant = await updatePlant({ id: Number(initialData.id), ...(plantData as any) });
      } else {
        savedPlant = await addPlant(plantData as any);
      }
      onSave(savedPlant as InventoryItem);
    } catch (err: any) {
      console.error("Error saving plant:", err);
      setErrors({ submit: err?.message || "Error al guardar la planta. Intenta de nuevo." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error general */}
      {errors.submit && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {errors.submit}
        </div>
      )}

      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre <span className="text-red-500">*</span>
        </label>
        <Input
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder="Ej: Palmera Real"
          className={errors.name ? "border-red-500" : ""}
          disabled={isSubmitting}
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
      </div>

      {/* Nombre Científico (opcional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre Científico <span className="text-gray-400 text-xs">(opcional)</span>
        </label>
        <Input
          value={formData.scientificName}
          onChange={(e) => handleChange("scientificName", e.target.value)}
          placeholder="Ej: Roystonea regia"
          disabled={isSubmitting}
        />
      </div>

      {/* Tipo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de Planta
        </label>
        <Select
          value={formData.type}
          onValueChange={(value) => handleChange("type", value)}
          disabled={isSubmitting}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLANT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Imagen */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Foto de la Planta
        </label>
        <ImageUploader
          onImageUpload={async (file) => {
            if (!file) return;
            setIsUploadingImage(true);
            try {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onloadend = async () => {
                const base64data = reader.result?.toString().split(",")[1];
                if (base64data) {
                  const result = await uploadImageMutation.mutateAsync({
                    fileData: base64data,
                    mimeType: file.type,
                  });
                  handleChange("imageUrl", result.imageUrl);
                }
                setIsUploadingImage(false);
              };
            } catch (err) {
              console.error("Image upload error:", err);
              setIsUploadingImage(false);
            }
          }}
          maxSizeMB={20}
        />
        {isUploadingImage && (
          <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Subiendo imagen...
          </div>
        )}
        {formData.imageUrl && !isUploadingImage && (
          <div className="mt-3 flex items-center gap-3">
            <img
              src={formData.imageUrl}
              alt="Preview"
              className="w-16 h-16 object-cover rounded-lg border border-gray-200"
            />
            <div>
              <p className="text-xs text-green-600 font-medium">✓ Imagen cargada</p>
              <button
                type="button"
                onClick={() => handleChange("imageUrl", "")}
                className="text-xs text-red-500 hover:text-red-700 mt-0.5"
              >
                Quitar imagen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción <span className="text-gray-400 text-xs">(opcional)</span>
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Describe la planta, características, usos..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          disabled={isSubmitting}
        />
      </div>

      {/* Precio y Stock */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Precio ($) <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.price || ""}
            onChange={(e) => handleChange("price", parseFloat(e.target.value))}
            placeholder="0.00"
            className={errors.price ? "border-red-500" : ""}
            disabled={isSubmitting}
          />
          {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stock <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            min="0"
            value={formData.stock || ""}
            onChange={(e) => handleChange("stock", parseInt(e.target.value))}
            placeholder="0"
            className={errors.stock ? "border-red-500" : ""}
            disabled={isSubmitting}
          />
          {errors.stock && <p className="text-xs text-red-500 mt-1">{errors.stock}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stock Mín.
          </label>
          <Input
            type="number"
            min="0"
            value={formData.minStock || ""}
            onChange={(e) => handleChange("minStock", parseInt(e.target.value))}
            placeholder="0"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Requerimientos */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Luz</label>
          <Select
            value={formData.lightRequirement}
            onValueChange={(v) => handleChange("lightRequirement", v)}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">☀️ Sol pleno</SelectItem>
              <SelectItem value="partial">⛅ Parcial</SelectItem>
              <SelectItem value="shade">🌥️ Sombra</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Agua</label>
          <Select
            value={formData.waterRequirement}
            onValueChange={(v) => handleChange("waterRequirement", v)}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">💧 Baja</SelectItem>
              <SelectItem value="medium">💧💧 Media</SelectItem>
              <SelectItem value="high">💧💧💧 Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dimensiones (opcionales) */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Altura (m)
          </label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={formData.matureHeight || ""}
            onChange={(e) => handleChange("matureHeight", e.target.value)}
            placeholder="0.0"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ancho (m)
          </label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={formData.matureWidth || ""}
            onChange={(e) => handleChange("matureWidth", e.target.value)}
            placeholder="0.0"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Espaciado (m)
          </label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={formData.minSpacing || ""}
            onChange={(e) => handleChange("minSpacing", e.target.value)}
            placeholder="0.0"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="flex-1"
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          disabled={isSubmitting || isUploadingImage}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Guardando...
            </>
          ) : (
            initialData ? "Actualizar Planta" : "Agregar Planta"
          )}
        </Button>
      </div>
    </form>
  );
}
