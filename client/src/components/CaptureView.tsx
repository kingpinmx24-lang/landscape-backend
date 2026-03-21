import React, { useEffect, useRef, useState } from "react";
import { useCaptureDevice, getDeviceModel, isSafari } from "../hooks/useCaptureDevice";
import { useMeasurement, formatMeasurement } from "../hooks/useMeasurement";
import type { CaptureMode, Point3D } from "../../../shared/capture-types";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Loader2 } from "lucide-react";

interface CaptureViewProps {
  projectId: number;
  onCapture?: (data: any) => void;
}

/**
 * Componente principal para captura de terreno con WebAR
 */
export function CaptureView({ projectId, onCapture }: CaptureViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { capabilities, arState, loading, error, isARSupported, hasLiDAR } =
    useCaptureDevice();
  const {
    selectedPoints,
    measurements,
    currentMeasurement,
    addPoint,
    clearMeasurements,
  } = useMeasurement();

  const [cameraActive, setCameraActive] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("measurement" as CaptureMode);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Iniciar cámara
  useEffect(() => {
    if (!cameraActive) return;

    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          setStream(mediaStream);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraActive, stream]);

  // Manejar clicks en video para seleccionar puntos
  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoRef.current || captureMode !== "measurement") return;

    const rect = videoRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Normalizar a coordenadas 3D (asumiendo plano Z=0)
    const point: Point3D = {
      x: (x / rect.width) * 10, // Escala de 0-10 metros
      y: (y / rect.height) * 10,
      z: 0,
    };

    addPoint(point);
  };

  // Capturar foto
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;

    ctx.drawImage(videoRef.current, 0, 0);

    // Convertir a blob
    canvasRef.current.toBlob((blob) => {
      if (blob && onCapture) {
        onCapture({
          projectId,
          image: blob,
          measurements,
          deviceModel: getDeviceModel(),
          hasLiDAR,
          timestamp: Date.now(),
        });
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-red-50 border-red-200">
        <h3 className="font-semibold text-red-900">Error</h3>
        <p className="text-red-700">{error}</p>
      </Card>
    );
  }

  const supportsAR = isARSupported && isSafari();

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Captura de Terreno</h2>
          <p className="text-sm text-gray-400">
            {getDeviceModel()} {hasLiDAR ? "✓ LiDAR" : ""}
          </p>
        </div>
        <div className="text-sm">
          {supportsAR ? "🔵 WebAR" : "📷 Cámara"}
        </div>
      </div>

      {/* Video/Camera Feed */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {cameraActive ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              onClick={handleVideoClick}
              className="w-full h-full object-cover cursor-crosshair"
            />

            {/* Overlay de puntos seleccionados */}
            {selectedPoints.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {selectedPoints.map((point, idx) => (
                  <div
                    key={idx}
                    className="absolute w-4 h-4 bg-red-500 rounded-full border-2 border-white"
                    style={{
                      left: `${(point.x / 10) * 100}%`,
                      top: `${(point.y / 10) * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                ))}
              </div>
            )}

            {/* Información de medición */}
            {currentMeasurement && (
              <div className="absolute bottom-20 left-4 right-4 bg-black/80 text-white p-4 rounded-lg">
                <p className="text-sm text-gray-300">Distancia:</p>
                <p className="text-2xl font-bold">
                  {formatMeasurement(currentMeasurement)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Confianza: {(currentMeasurement.confidence * 100).toFixed(0)}%
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <p className="text-lg mb-4">Cámara inactiva</p>
              <p className="text-sm">Presiona "Iniciar" para comenzar</p>
            </div>
          </div>
        )}
      </div>

      {/* Canvas oculto para captura */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Controles */}
      <div className="bg-gray-900 text-white p-4 space-y-3">
        {/* Modo de captura */}
        <div className="flex gap-2">
          <Button
            variant={captureMode === "measurement" ? "default" : "outline"}
            onClick={() => setCaptureMode("measurement" as CaptureMode)}
            className="flex-1"
          >
            Medición
          </Button>
          <Button
            variant={captureMode === "terrain_detection" ? "default" : "outline"}
            onClick={() => setCaptureMode("terrain_detection" as CaptureMode)}
            className="flex-1"
          >
            Terreno
          </Button>
          <Button
            variant={captureMode === "zone_drawing" ? "default" : "outline"}
            onClick={() => setCaptureMode("zone_drawing" as CaptureMode)}
            className="flex-1"
          >
            Zonas
          </Button>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2">
          <Button
            onClick={() => setCameraActive(!cameraActive)}
            className="flex-1"
            variant={cameraActive ? "destructive" : "default"}
          >
            {cameraActive ? "Detener" : "Iniciar"}
          </Button>
          <Button
            onClick={handleCapture}
            disabled={!cameraActive}
            className="flex-1"
          >
            Capturar
          </Button>
        </div>

        {/* Información de mediciones */}
        {measurements.length > 0 && (
          <div className="bg-gray-800 p-3 rounded text-sm">
            <p className="text-gray-300 mb-2">
              Mediciones: {measurements.length}
            </p>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {measurements.map((m, idx) => (
                <p key={idx} className="text-gray-400">
                  {idx + 1}. {formatMeasurement(m)}
                </p>
              ))}
            </div>
            <Button
              onClick={clearMeasurements}
              variant="outline"
              size="sm"
              className="w-full mt-2"
            >
              Limpiar
            </Button>
          </div>
        )}

        {/* Información del dispositivo */}
        <div className="text-xs text-gray-400 border-t border-gray-700 pt-2">
          <p>WebXR: {isARSupported ? "✓" : "✗"}</p>
          <p>LiDAR: {hasLiDAR ? "✓" : "✗"}</p>
          <p>WebGL: {capabilities?.supportsWebGL ? "✓" : "✗"}</p>
        </div>
      </div>
    </div>
  );
}
