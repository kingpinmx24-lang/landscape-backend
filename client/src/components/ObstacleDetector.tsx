/*
 * ============================================================================
 * Component: ObstacleDetector
 * ============================================================================
 * Detecta obstáculos (árboles, estructuras) en la imagen del terreno
 */

import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertTriangle, Trash2, Eye, EyeOff } from "lucide-react";

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "tree" | "structure" | "rock" | "water" | "unknown";
  confidence: number;
  label: string;
}

interface ObstacleDetectorProps {
  imageUrl?: string;
  width: number;
  height: number;
  onObstaclesDetected?: (obstacles: Obstacle[]) => void;
  onObstacleRemove?: (obstacleId: string) => void;
}

export function ObstacleDetector({
  imageUrl,
  width,
  height,
  onObstaclesDetected,
  onObstacleRemove,
}: ObstacleDetectorProps) {
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showObstacles, setShowObstacles] = useState(true);
  const [selectedObstacle, setSelectedObstacle] = useState<string | null>(null);

  // Simular detección de obstáculos basada en análisis de imagen
  const detectObstacles = async () => {
    if (!imageUrl) return;

    setIsDetecting(true);

    try {
      // Simular análisis de imagen (en producción usarías ML.js o TensorFlow.js)
      const detectedObstacles: Obstacle[] = [];

      // Análisis simulado: detectar áreas oscuras (árboles) y claras (estructuras)
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;

          // Analizar píxeles para detectar obstáculos
          const pixelMap = new Map<string, number>();

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = (r + g + b) / 3;

            // Detectar áreas oscuras (árboles)
            if (brightness < 100) {
              const pixelIndex = i / 4;
              const x = pixelIndex % width;
              const y = Math.floor(pixelIndex / width);
              const key = `${Math.floor(x / 20)}_${Math.floor(y / 20)}`;
              pixelMap.set(key, (pixelMap.get(key) || 0) + 1);
            }
          }

          // Agrupar píxeles en obstáculos
          const processedCells = new Set<string>();
          pixelMap.forEach((count, key) => {
            if (count > 50 && !processedCells.has(key)) {
              const [cellX, cellY] = key.split("_").map(Number);
              const x = cellX * 20;
              const y = cellY * 20;

              detectedObstacles.push({
                id: `obstacle-${Date.now()}-${Math.random()}`,
                x,
                y,
                width: 60,
                height: 60,
                type: "tree",
                confidence: Math.random() * 0.4 + 0.6, // 60-100%
                label: "Árbol/Obstáculo",
              });

              processedCells.add(key);
            }
          });

          setObstacles(detectedObstacles);
          onObstaclesDetected?.(detectedObstacles);
        };
        img.src = imageUrl;
      }
    } catch (error) {
      console.error("Error detectando obstáculos:", error);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleRemoveObstacle = (obstacleId: string) => {
    const updatedObstacles = obstacles.filter((o) => o.id !== obstacleId);
    setObstacles(updatedObstacles);
    onObstacleRemove?.(obstacleId);
    setSelectedObstacle(null);
  };

  const handleClearAll = () => {
    setObstacles([]);
    setSelectedObstacle(null);
  };

  if (!imageUrl) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Detection Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Detector de Obstáculos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Detecta automáticamente árboles, estructuras y otros obstáculos en la imagen.
            Puedes eliminarlos para dejar espacio para tus plantas.
          </p>

          <div className="flex gap-2">
            <Button
              onClick={detectObstacles}
              disabled={isDetecting}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              {isDetecting ? "Detectando..." : "Detectar Obstáculos"}
            </Button>
            <Button
              onClick={() => setShowObstacles(!showObstacles)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {showObstacles ? (
                <>
                  <Eye className="w-4 h-4" />
                  Ocultar
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4" />
                  Mostrar
                </>
              )}
            </Button>
          </div>

          {obstacles.length > 0 && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-800">
                Se detectaron <strong>{obstacles.length}</strong> obstáculos. Selecciona uno
                para eliminarlo.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Obstacles List */}
      {obstacles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Obstáculos Detectados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {obstacles.map((obstacle, idx) => (
              <div
                key={obstacle.id}
                onClick={() => setSelectedObstacle(obstacle.id)}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedObstacle === obstacle.id
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 bg-gray-50 hover:border-gray-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">
                      {idx + 1}. {obstacle.label}
                    </p>
                    <p className="text-xs text-gray-600">
                      Posición: ({obstacle.x.toFixed(0)}, {obstacle.y.toFixed(0)}) •
                      Confianza: {(obstacle.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveObstacle(obstacle.id);
                    }}
                    size="sm"
                    variant="destructive"
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}

            {obstacles.length > 0 && (
              <Button
                onClick={handleClearAll}
                variant="outline"
                className="w-full text-red-600 hover:text-red-700"
              >
                Eliminar Todos
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Visualization Overlay */}
      {showObstacles && obstacles.length > 0 && (
        <div className="relative bg-gray-100 rounded-lg overflow-hidden">
          <img
            src={imageUrl}
            alt="Terreno con obstáculos"
            className="w-full h-auto opacity-60"
          />
          <svg
            className="absolute inset-0 w-full h-full"
            style={{
              width: "100%",
              height: "auto",
              aspectRatio: `${width} / ${height}`,
            }}
          >
            {obstacles.map((obstacle) => (
              <g key={obstacle.id}>
                <rect
                  x={obstacle.x}
                  y={obstacle.y}
                  width={obstacle.width}
                  height={obstacle.height}
                  fill="rgba(255, 107, 107, 0.3)"
                  stroke={selectedObstacle === obstacle.id ? "#ff6b6b" : "#ff8a80"}
                  strokeWidth="2"
                  rx="4"
                />
                <text
                  x={obstacle.x + obstacle.width / 2}
                  y={obstacle.y + obstacle.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ff6b6b"
                  fontSize="12"
                  fontWeight="bold"
                >
                  ✕
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}
