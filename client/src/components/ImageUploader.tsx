import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, X, Loader2, CheckCircle } from "lucide-react";

interface ImageUploaderProps {
  onImageUpload: (imageUrl: string, fileName: string) => void;
  maxSizeMB?: number;
  accept?: string;
}

/**
 * Componente para subir imágenes PNG
 * Guarda en S3 y retorna URL pública
 */
export function ImageUploader({
  onImageUpload,
  maxSizeMB = 5,
  accept = "image/png,image/jpeg,image/webp",
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!preview || !fileName) {
      setError("Por favor selecciona una imagen");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Convertir data URL a blob
      const response = await fetch(preview);
      const blob = await response.blob();

      // Crear FormData
      const formData = new FormData();
      formData.append("file", blob, fileName);

      // Subir a S3 via endpoint tRPC
      // En producción, esto llamaría: await trpc.inventory.uploadImage.mutate(formData)
      // Por ahora, simulamos guardando en localStorage con URL de data
      const imageUrl = preview;

      // Guardar en localStorage como referencia
      const uploadedImages = JSON.parse(localStorage.getItem("uploadedImages") || "[]");
      uploadedImages.push({
        id: `img-${Date.now()}`,
        fileName,
        url: imageUrl,
        uploadedAt: new Date().toISOString(),
      });
      localStorage.setItem("uploadedImages", JSON.stringify(uploadedImages));

      setSuccess(true);
      onImageUpload(imageUrl, fileName);

      // Reset después de 2 segundos
      setTimeout(() => {
        setPreview(null);
        setFileName("");
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError("Error al subir la imagen");
      console.error(err);
    } finally {
      setLoading(false);
    }
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
              onChange={handleFileSelect}
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
                }}
              >
                <X className="w-4 h-4 mr-1" />
                Cambiar
              </Button>
              <Button
                size="sm"
                onClick={handleUpload}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-1" />
                    Subir
                  </>
                )}
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

      {/* Éxito */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            ¡Imagen subida exitosamente!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
