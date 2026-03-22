import React, { useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Camera, Upload, ArrowLeft } from "lucide-react";
import { saveImage, compressToSize } from "../lib/imageStorage";

export default function Capture() {
  const [, params] = useRoute("/projects/:id/capture");
  const [, setLocation] = useLocation();
  const projectId = params?.id as string;

  const [photo, setPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const project = projectId
    ? JSON.parse(localStorage.getItem(`project_${projectId}`) || "{}")
    : null;

  if (!project || !project.id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Proyecto no encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">No se pudo cargar el proyecto.</p>
            <Button onClick={() => setLocation("/projects/new")}>
              Crear nuevo proyecto
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /**
   * Process a File or Blob: read → compress → set as preview.
   */
  const processImageFile = (file: File | Blob) => {
    if (file.size > 30 * 1024 * 1024) {
      setError("La imagen es muy grande (máximo 30MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        // Compress to 800x600 for preview (quality 0.7)
        const compressed = await compressToSize(base64, 800, 600, 0.7);
        setPhoto(compressed);
        setError(null);
      } catch {
        setError("Error al procesar la imagen");
      }
    };
    reader.onerror = () => setError("Error al leer el archivo");
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = "";
  };

  const handleCameraFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = "";
  };

  /**
   * Try getUserMedia first; fall back to file input with capture attribute.
   */
  const handleCameraStart = async () => {
    setError(null);
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
        }
        return;
      } catch (err: any) {
        console.warn("[Capture] getUserMedia failed:", err?.name);
      }
    }
    cameraInputRef.current?.click();
  };

  const handleCameraCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        const photoData = canvasRef.current.toDataURL("image/jpeg", 0.85);
        setPhoto(photoData);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    setIsCameraActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  /**
   * Save photo to IndexedDB (no size limit on iOS Safari) and navigate.
   */
  const handleContinue = async () => {
    if (!photo) {
      setError("Por favor captura o sube una foto");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Compress to a reasonable size for storage and API calls
      // 800x600 @ 0.6 quality ≈ 80-150KB base64 — well within any limit
      const compressed = await compressToSize(photo, 800, 600, 0.6);
      console.log("[Capture] Saving image, size:", compressed.length, "chars");

      // Save to IndexedDB (primary, no size limit)
      const storageKey = `captureImage_${projectId}`;
      await saveImage(storageKey, compressed);

      // Verify it was saved correctly
      const { loadImage } = await import("../lib/imageStorage");
      const verify = await loadImage(storageKey);
      if (!verify || !verify.startsWith("data:")) {
        throw new Error("La imagen no se guardó correctamente. Intenta de nuevo.");
      }

      // Update project metadata (no image inline — just a flag)
      const updatedProject = {
        ...project,
        captureImage: "__stored_separately__",
        status: "captured",
        updatedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(`project_${projectId}`, JSON.stringify(updatedProject));
      } catch {
        sessionStorage.setItem(`project_${projectId}`, JSON.stringify(updatedProject));
      }

      setLocation(`/projects/${projectId}/design`);
    } catch (err: any) {
      console.error("[Capture] Save error:", err);
      setError(err?.message || "Error al guardar la foto. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 md:py-6 flex items-center gap-2 md:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              Paso 1: Captura
            </h1>
            <p className="text-xs md:text-sm text-gray-600">
              Proyecto: {project.name}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Captura la foto del terreno</CardTitle>
            <CardDescription>
              Toma una foto clara del área donde harás el diseño de paisajismo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {photo ? (
              /* ── Photo preview ── */
              <div className="space-y-4">
                <div className="border-2 border-green-200 rounded-lg overflow-hidden bg-green-50 p-2">
                  <img
                    src={photo}
                    alt="Captura"
                    className="w-full h-80 object-cover rounded-lg"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setPhoto(null)}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Tomar otra foto
                  </Button>
                  <Button
                    onClick={handleContinue}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? "Guardando..." : "Continuar →"}
                  </Button>
                </div>
              </div>
            ) : isCameraActive ? (
              /* ── Live camera view ── */
              <div className="space-y-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-80 bg-black rounded-lg object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={stopCamera}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleCameraCapture} className="flex-1">
                    <Camera className="w-4 h-4 mr-2" />
                    Capturar foto
                  </Button>
                </div>
              </div>
            ) : (
              /* ── Initial choice ── */
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Camera button */}
                  <Button
                    onClick={handleCameraStart}
                    size="lg"
                    className="h-32 flex flex-col items-center justify-center gap-2"
                  >
                    <Camera className="w-8 h-8" />
                    <span>Usar Cámara</span>
                  </Button>

                  {/* Upload — label trick guarantees file picker opens on all browsers */}
                  <label
                    htmlFor="upload-photo-input"
                    className="h-32 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <Upload className="w-8 h-8 text-gray-600" />
                    <span className="font-medium text-gray-700">Subir Foto</span>
                    <input
                      id="upload-photo-input"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                </div>

                {/* Hidden camera-capture fallback for getUserMedia failures */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraFileChange}
                  className="sr-only"
                />
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Consejo:</strong> Toma la foto desde un ángulo elevado
                para capturar toda el área. Asegúrate de que haya buena
                iluminación.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
