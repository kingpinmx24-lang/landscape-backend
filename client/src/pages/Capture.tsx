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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

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
   * Compress image to a reasonable size for localStorage.
   * Target: ~100-200KB base64 string.
   */
  const compressImage = async (base64: string, maxW = 800, maxH = 600, quality = 0.6): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Scale down proportionally
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
          if (!ctx) {
            resolve(base64);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", quality);
          resolve(compressed);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image for compression"));
      img.src = base64;
    });
  };

  const handleCameraStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      setError("No se pudo acceder a la cámara");
    }
  };

  const handleCameraCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        const photoData = canvasRef.current.toDataURL("image/jpeg", 0.8);
        setPhoto(photoData);
        setIsCameraActive(false);
        if (videoRef.current.srcObject) {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach((track) => track.stop());
        }
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      } catch (err) {
        setError("Error al procesar la imagen");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleContinue = async () => {
    if (!photo) {
      setError("Por favor captura o sube una foto");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Compress aggressively to fit in localStorage
      const compressed = await compressImage(photo, 800, 600, 0.5);
      console.log("[Capture] Compressed image size:", compressed.length, "chars");

      // Strategy: save image in a SEPARATE localStorage key to avoid quota issues
      // Also save in the project object as a fallback
      let imageSaved = false;

      // First: try saving image separately
      try {
        localStorage.setItem(`captureImage_${projectId}`, compressed);
        console.log("[Capture] Image saved to captureImage_" + projectId);
        imageSaved = true;
      } catch (e1) {
        console.warn("[Capture] Failed to save image separately, trying smaller compression");
        // Try even more aggressive compression
        try {
          const smaller = await compressImage(photo, 600, 450, 0.3);
          localStorage.setItem(`captureImage_${projectId}`, smaller);
          console.log("[Capture] Smaller image saved to captureImage_" + projectId);
          imageSaved = true;
        } catch (e2) {
          console.error("[Capture] Cannot save image to localStorage at all");
        }
      }

      // Second: update project metadata (without the image to keep it small)
      const updatedProject = {
        ...project,
        captureImage: imageSaved ? "__stored_separately__" : compressed,
        status: "captured",
        updatedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem(`project_${projectId}`, JSON.stringify(updatedProject));
        console.log("[Capture] Project metadata saved");
      } catch (e3) {
        // If even metadata fails, try sessionStorage
        sessionStorage.setItem(`project_${projectId}`, JSON.stringify(updatedProject));
        console.warn("[Capture] Used sessionStorage for project metadata");
      }

      // Verify the save worked
      const verifyImage = localStorage.getItem(`captureImage_${projectId}`);
      const verifyProject = localStorage.getItem(`project_${projectId}`);
      console.log("[Capture] Verification - image key exists:", !!verifyImage, "project exists:", !!verifyProject);

      if (verifyImage || verifyProject) {
        setLocation(`/projects/${projectId}/design`);
      } else {
        setError("Error al guardar la foto. Intenta de nuevo.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al guardar la foto";
      setError(message);
      console.error("[Capture] Error:", err);
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

            <div className="space-y-4">
              {photo ? (
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
                      {isLoading ? "Guardando..." : "Continuar"}
                    </Button>
                  </div>
                </div>
              ) : isCameraActive ? (
                <div className="space-y-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-96 bg-black rounded-lg object-cover"
                  />
                  <canvas ref={canvasRef} style={{ display: "none" }} />
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCameraActive(false);
                        if (videoRef.current?.srcObject) {
                          const tracks = (
                            videoRef.current.srcObject as MediaStream
                          ).getTracks();
                          tracks.forEach((track) => track.stop());
                        }
                      }}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCameraCapture}
                      className="flex-1"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Capturar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Button
                      onClick={handleCameraStart}
                      size="lg"
                      className="h-32 flex flex-col items-center justify-center gap-2"
                    >
                      <Camera className="w-8 h-8" />
                      <span>Usar Cámara</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-32 flex flex-col items-center justify-center gap-2"
                    >
                      <Upload className="w-8 h-8" />
                      <span>Subir Foto</span>
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
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
