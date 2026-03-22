import React, { useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Camera, Upload, ArrowLeft } from "lucide-react";

export default function Capture() {
  const [, params] = useRoute("/projects/:id/capture");
  const [, setLocation] = useLocation();
  const projectId = params?.id as string;

  const [photo, setPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
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
   * Compress image to fit in localStorage (~100-200KB base64).
   */
  const compressImage = async (
    base64: string,
    maxW = 800,
    maxH = 600,
    quality = 0.6
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxW) {
              height = Math.round((height * maxW) / width);
              width = maxW;
            }
          } else {
            if (height > maxH) {
              width = Math.round((width * maxH) / height);
              height = maxH;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(base64); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = base64;
    });
  };

  /**
   * Process a File or Blob into a compressed base64 photo.
   */
  const processImageFile = (file: File | Blob) => {
    if (file.size > 20 * 1024 * 1024) {
      setError("La imagen es muy grande (máximo 20MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64);
        setPhoto(compressed);
        setError(null);
      } catch {
        setError("Error al procesar la imagen");
      }
    };
    reader.readAsDataURL(file);
  };

  /**
   * Handle file selected via the upload input.
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  /**
   * Handle file selected via the camera input (capture="environment").
   */
  const handleCameraFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = "";
  };

  /**
   * Try to open the native camera via getUserMedia (works on mobile browsers).
   * Falls back to file input with capture="environment" if getUserMedia fails.
   */
  const handleCameraStart = async () => {
    setError(null);
    // Check if getUserMedia is available
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
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
        // If it's a permission/device error, fall through to file input
        console.warn("[Capture] getUserMedia failed:", err?.name, err?.message);
      }
    }
    // Fallback: use file input with capture attribute
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

  const handleContinue = async () => {
    if (!photo) {
      setError("Por favor captura o sube una foto");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);

      const compressed = await compressImage(photo, 800, 600, 0.5);
      console.log("[Capture] Compressed size:", compressed.length, "chars");

      let imageSaved = false;
      try {
        localStorage.setItem(`captureImage_${projectId}`, compressed);
        imageSaved = true;
      } catch {
        try {
          const smaller = await compressImage(photo, 600, 450, 0.3);
          localStorage.setItem(`captureImage_${projectId}`, smaller);
          imageSaved = true;
        } catch {
          console.error("[Capture] Cannot save image to localStorage");
        }
      }

      const updatedProject = {
        ...project,
        captureImage: imageSaved ? "__stored_separately__" : compressed,
        status: "captured",
        updatedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem(`project_${projectId}`, JSON.stringify(updatedProject));
      } catch {
        sessionStorage.setItem(`project_${projectId}`, JSON.stringify(updatedProject));
      }

      const verifyImage = localStorage.getItem(`captureImage_${projectId}`);
      const verifyProject = localStorage.getItem(`project_${projectId}`);

      if (verifyImage || verifyProject) {
        setLocation(`/projects/${projectId}/design`);
      } else {
        setError("Error al guardar la foto. Intenta de nuevo.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la foto");
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
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Paso 1: Captura</h1>
            <p className="text-xs md:text-sm text-gray-600">Proyecto: {project.name}</p>
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

            <div className="space-y-4">
              {photo ? (
                /* ── Photo preview ── */
                <div className="space-y-4">
                  <div className="border-2 border-green-200 rounded-lg overflow-hidden bg-green-50 p-4">
                    <img
                      src={photo}
                      alt="Captura"
                      className="w-full h-96 object-cover rounded-lg"
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
                    className="w-full h-96 bg-black rounded-lg object-cover"
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
                /* ── Initial choice buttons ── */
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">

                    {/* ── Camera button ── */}
                    <Button
                      onClick={handleCameraStart}
                      size="lg"
                      className="h-32 flex flex-col items-center justify-center gap-2"
                    >
                      <Camera className="w-8 h-8" />
                      <span>Usar Cámara</span>
                    </Button>

                    {/* ── Upload button — uses label trick so it ALWAYS opens the picker ── */}
                    <label
                      htmlFor="upload-photo-input"
                      className="h-32 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <Upload className="w-8 h-8 text-gray-600" />
                      <span className="font-medium text-gray-700">Subir Foto</span>
                      <input
                        id="upload-photo-input"
                        ref={uploadInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {/* Hidden camera-capture input (fallback for getUserMedia failures) */}
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
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Consejo:</strong> Toma la foto desde un ángulo elevado para
                capturar toda el área. Asegúrate de que haya buena iluminación.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
