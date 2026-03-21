import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, AlertCircle, CheckCircle } from "lucide-react";
import { InventoryItem, PlantType, ClimateZone } from "@shared/inventory-types";

interface CSVImporterProps {
  onClose: () => void;
}

/**
 * Importador de CSV para plantas
 * Permite subir un archivo CSV con el inventario
 */
export function CSVImporter({ onClose }: CSVImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<Partial<InventoryItem>[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      setError("Por favor selecciona un archivo CSV");
      return;
    }

    setFile(selectedFile);
    setError(null);
    parseCSV(selectedFile);
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split("\n").filter((line) => line.trim());

        if (lines.length < 2) {
          setError("El archivo CSV debe tener encabezados y al menos una fila de datos");
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const plants: Partial<InventoryItem>[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map((v) => v.trim());
          if (values.length < 3) continue;

          const plant: Partial<InventoryItem> = {
            id: `plant-${Date.now()}-${i}`,
            name: values[headers.indexOf("nombre")] || "",
            scientificName: values[headers.indexOf("nombre científico")] || "",
            type: (values[headers.indexOf("tipo")] as PlantType) || PlantType.FLOWER,
            description: values[headers.indexOf("descripción")] || "",
            imageUrl: values[headers.indexOf("url imagen")] || "https://via.placeholder.com/200?text=Plant",
            price: parseFloat(values[headers.indexOf("precio")]) || 0,
            stock: parseInt(values[headers.indexOf("stock")]) || 0,
            minStock: parseInt(values[headers.indexOf("stock mínimo")]) || 0,
            matureHeight: parseFloat(values[headers.indexOf("altura adulta")]) || 0,
            matureWidth: parseFloat(values[headers.indexOf("ancho adulto")]) || 0,
            minSpacing: parseFloat(values[headers.indexOf("espaciamiento mínimo")]) || 0,
            sunRequirement: (values[headers.indexOf("luz")] as "full" | "partial" | "shade") || "full",
            waterNeeds: (values[headers.indexOf("agua")] as "low" | "medium" | "high") || "medium",
            maintenanceLevel: (values[headers.indexOf("mantenimiento")] as "low" | "medium" | "high") || "medium",
            nativeRegion: values[headers.indexOf("región nativa")] || "",
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          if (plant.name) {
            plants.push(plant);
          }
        }

        if (plants.length === 0) {
          setError("No se encontraron plantas válidas en el archivo");
          return;
        }

        setPreview(plants);
        setError(null);
      } catch (err) {
        setError("Error al procesar el archivo CSV");
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!file || preview.length === 0) {
      setError("No hay plantas para importar");
      return;
    }

    try {
      setLoading(true);

      // Obtener inventario actual
      const currentInventory = JSON.parse(localStorage.getItem("inventory") || "[]");

      // Agregar nuevas plantas
      const updatedInventory = [
        ...currentInventory,
        ...preview.map((p) => ({
          ...p,
          id: `plant-${Date.now()}-${Math.random()}`,
        })),
      ];

      // Guardar
      localStorage.setItem("inventory", JSON.stringify(updatedInventory));

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError("Error al importar el inventario");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "Nombre",
      "Nombre Científico",
      "Tipo",
      "Descripción",
      "URL Imagen",
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

    const exampleRow = [
      "Rosa",
      "Rosa spp.",
      "flower",
      "Hermosa flor",
      "https://example.com/rose.jpg",
      "15",
      "50",
      "10",
      "1.5",
      "1.2",
      "1.0",
      "full",
      "medium",
      "medium",
      "Varios",
    ];

    const csv = [headers, exampleRow].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-inventario.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Instrucciones */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <h4 className="font-semibold text-sm mb-2">Formato del CSV:</h4>
          <p className="text-xs text-gray-600 mb-3">
            El archivo debe tener las siguientes columnas (en cualquier orden):
          </p>
          <code className="text-xs bg-white p-2 rounded block overflow-x-auto mb-3">
            Nombre, Nombre Científico, Tipo, Descripción, URL Imagen, Precio, Stock, Stock Mínimo, Altura Adulta, Ancho Adulto, Espaciamiento Mínimo, Luz, Agua, Mantenimiento, Región Nativa
          </code>
          <Button size="sm" variant="outline" onClick={downloadTemplate} className="w-full">
            Descargar Plantilla
          </Button>
        </CardContent>
      </Card>

      {/* Subida de archivo */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600 mb-2">Arrastra tu archivo CSV aquí o haz clic para seleccionar</p>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          id="csv-input"
        />
        <label htmlFor="csv-input" className="cursor-pointer">
          <Button variant="outline" size="sm" asChild>
            <span>Seleccionar archivo</span>
          </Button>
        </label>
        {file && <p className="text-xs text-gray-600 mt-2">{file.name}</p>}
      </div>

      {/* Errores */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Éxito */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            ¡Inventario importado exitosamente!
          </AlertDescription>
        </Alert>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="font-semibold text-sm mb-2">
              Vista previa: {preview.length} plantas
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {preview.slice(0, 5).map((plant, idx) => (
                <div key={idx} className="text-xs bg-gray-50 p-2 rounded">
                  <p className="font-medium">{plant.name}</p>
                  <p className="text-gray-600">${plant.price} - Stock: {plant.stock}</p>
                </div>
              ))}
              {preview.length > 5 && (
                <p className="text-xs text-gray-600 text-center">
                  +{preview.length - 5} más...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botones */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancelar
        </Button>
        <Button
          onClick={handleImport}
          disabled={preview.length === 0 || loading}
          className="flex-1"
        >
          {loading ? "Importando..." : `Importar ${preview.length} plantas`}
        </Button>
      </div>
    </div>
  );
}
