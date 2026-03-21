import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, X, Loader2, CheckCircle } from "lucide-react";

interface ImageUploaderProps {
  onImageUpload: (file: File | null) => void;
  maxSizeMB?: number;
  accept?: string;
}

/**
 * Componente para subir imágenes PNG
 * Guarda en S3 y retorna URL pública
 */
export function ImageUploader({
  onImageUpload,
  maxSizeMB = 20,
  accept = "image/png,image/jpeg,image/webp",
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);


  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      setError("Por favor selecciona una imagen");
      return;
    }

    // Validar tamaño
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      setError(`La imagen no debe superar ${maxSizeMB}MB`);
      return;
    }

    // Mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {/* Área de carga */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition">
        {!preview ? (
          <>
            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 mb-2">
              Arrastra tu imagen aquí o haz clic para seleccionar
            </p>
            <p className="text-xs text-gray-500 mb-4">
              PNG, JPG o WebP - Máximo {maxSizeMB}MB
            </p>
            <input
              type="file"
              accept={accept}
              onChange={(e) => {
                handleFileSelect(e);
                onImageUpload(e.target.files?.[0] || null);
              }}
              className="hidden"
              id="image-input"
            />
            <label htmlFor="image-input" className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>Seleccionar imagen</span>
              </Button>
            </label>
          </>
        ) : (
          <>
            <img
              src={preview}
              alt="Preview"
              className="w-32 h-32 object-cover rounded-lg mx-auto mb-4"
            />
            <p className="text-sm text-gray-600 mb-4">{fileName}</p>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreview(null);
                  setFileName("");
                  onImageUpload(null);
                }}
              >
                <X className="w-4 h-4 mr-1" />
                Cambiar
              </Button>
            </div>
          </>
        )}
      </div>

        {/* Errores */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
    </div>
  );
}
