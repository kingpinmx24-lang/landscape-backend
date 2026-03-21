/*
 * Component: ObstacleDetector
 * ============================================================================
 * Display-only component that shows the obstacle list and controls.
 * Detection logic lives in the parent (AdjustLiveStep) to avoid state desync.
 *
 * Props:
 * - obstacles: list of detected obstacles (managed by parent)
 * - isDetecting: whether detection is in progress
 * - onDetect: trigger detection in parent
 * - onRemove: remove a single obstacle
 * - onClearAll: remove all obstacles
 * - onToggleVisibility: toggle obstacle visibility on canvas
 * - showObstacles: whether obstacles are visible on canvas
 */

import React from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertTriangle, Trash2, Eye, EyeOff, Eraser, Loader2 } from "lucide-react";

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "structure" | "vegetation" | "debris" | "furniture" | "unknown";
  confidence: number;
  label: string;
}

interface ObstacleDetectorProps {
  obstacles: Obstacle[];
  isDetecting: boolean;
  showObstacles: boolean;
  error?: string | null;
  onDetect: () => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onToggleVisibility: () => void;
}

// ─── Pixel classification (exported for use by parent) ───
export function classifyPixel(r: number, g: number, b: number): string {
  const brightness = (r + g + b) / 3;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);

  if (brightness > 160 && b > r && b > g - 20) return "sky";
  if (brightness > 180 && saturation < 40) return "wall";
  if (brightness > 120 && brightness < 210 && saturation < 60) return "ground";
  if (g > r && g > b && g > 60 && saturation > 30) return "vegetation";
  if (saturation > 80) return "colored_object";
  if (brightness < 90) return "dark_object";
  return "ground";
}

// ─── Flood fill for connected components (exported for use by parent) ───
export function floodFill(
  grid: string[][],
  visited: boolean[][],
  startRow: number,
  startCol: number,
  targetTypes: Set<string>,
  rows: number,
  cols: number
): Array<[number, number]> {
  const stack: Array<[number, number]> = [[startRow, startCol]];
  const region: Array<[number, number]> = [];
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
    if (visited[r][c]) continue;
    if (!targetTypes.has(grid[r][c])) continue;
    visited[r][c] = true;
    region.push([r, c]);
    stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
  }
  return region;
}

// ─── Classify an obstacle region (exported for use by parent) ───
export function classifyObstacle(
  dominantType: string,
  area: number,
  aspectRatio: number
): { type: Obstacle["type"]; label: string } {
  if (dominantType === "vegetation") {
    return { type: "vegetation", label: "Vegetación / Planta" };
  }
  if (dominantType === "colored_object") {
    return area > 15
      ? { type: "structure", label: "Estructura / Contenedor" }
      : { type: "debris", label: "Objeto / Escombro" };
  }
  if (dominantType === "dark_object") {
    if (area > 25 && aspectRatio > 2) return { type: "structure", label: "Estructura Metálica" };
    if (area > 20) return { type: "structure", label: "Estructura / Caseta" };
    if (area > 8) return { type: "furniture", label: "Mueble / Objeto" };
    return { type: "debris", label: "Escombro / Material" };
  }
  return { type: "unknown", label: "Obstáculo" };
}

// ─── Full detection function (exported for use by parent) ───
export function runObstacleDetection(
  imageUrl: string,
  width: number,
  height: number
): Promise<Obstacle[]> {
  return new Promise((resolve, reject) => {
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      reject(new Error("No se pudo crear contexto 2D"));
      return;
    }

    const img = new Image();
    // Only set crossOrigin for remote URLs, NOT for data: URLs
    if (imageUrl.startsWith("http")) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => {
      try {
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const cellSize = 20;
        const cols = Math.ceil(width / cellSize);
        const rows = Math.ceil(height / cellSize);
        const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill("ground"));

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const counts: Record<string, number> = {};
            const sx = col * cellSize;
            const sy = row * cellSize;
            const ex = Math.min(sx + cellSize, width);
            const ey = Math.min(sy + cellSize, height);

            for (let y = sy; y < ey; y += 2) {
              for (let x = sx; x < ex; x += 2) {
                const idx = (y * width + x) * 4;
                const cls = classifyPixel(data[idx], data[idx + 1], data[idx + 2]);
                counts[cls] = (counts[cls] || 0) + 1;
              }
            }

            let maxCount = 0;
            let dominant = "ground";
            for (const [cls, count] of Object.entries(counts)) {
              if (count > maxCount) { maxCount = count; dominant = cls; }
            }
            grid[row][col] = dominant;
          }
        }

        const obstacleTypes = new Set(["dark_object", "colored_object", "vegetation"]);
        const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
        const regions: Array<{ cells: Array<[number, number]>; dominantType: string }> = [];

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            if (!visited[row][col] && obstacleTypes.has(grid[row][col])) {
              const region = floodFill(grid, visited, row, col, obstacleTypes, rows, cols);
              if (region.length >= 4) {
                const typeCounts: Record<string, number> = {};
                for (const [r, c] of region) {
                  const t = grid[r][c];
                  typeCounts[t] = (typeCounts[t] || 0) + 1;
                }
                let maxC = 0;
                let domType = "dark_object";
                for (const [t, c] of Object.entries(typeCounts)) {
                  if (c > maxC) { maxC = c; domType = t; }
                }
                regions.push({ cells: region, dominantType: domType });
              }
            }
          }
        }

        regions.sort((a, b) => b.cells.length - a.cells.length);
        const result: Obstacle[] = [];
        const timestamp = Date.now();

        for (const region of regions.slice(0, 15)) {
          let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
          for (const [r, c] of region.cells) {
            if (r < minRow) minRow = r;
            if (r > maxRow) maxRow = r;
            if (c < minCol) minCol = c;
            if (c > maxCol) maxCol = c;
          }

          const ox = minCol * cellSize;
          const oy = minRow * cellSize;
          const ow = (maxCol - minCol + 1) * cellSize;
          const oh = (maxRow - minRow + 1) * cellSize;

          if (oy < height * 0.15) continue;

          const area = region.cells.length;
          const aspectRatio = ow / Math.max(oh, 1);
          const { type, label } = classifyObstacle(region.dominantType, area, aspectRatio);
          const coverage = area / (rows * cols);
          const confidence = Math.min(0.95, 0.5 + coverage * 10);

          result.push({
            id: `obs-${timestamp}-${result.length}`,
            x: ox + ow / 2,
            y: oy + oh / 2,
            width: ow,
            height: oh,
            type,
            confidence,
            label,
          });
        }

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (e) => {
      reject(new Error(`No se pudo cargar la imagen`));
    };

    img.src = imageUrl;
  });
}

// ─── Display component ───
const typeIcons: Record<string, string> = {
  structure: "🏗️",
  vegetation: "🌿",
  debris: "🪨",
  furniture: "🪑",
  unknown: "❓",
};

export function ObstacleDetector({
  obstacles,
  isDetecting,
  showObstacles,
  error,
  onDetect,
  onRemove,
  onClearAll,
  onToggleVisibility,
}: ObstacleDetectorProps) {
  return (
    <div className="space-y-3">
      {/* Controls */}
      <Card className="shadow-sm">
        <CardHeader className="pb-1 px-3 pt-3">
          <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
            Detector de Obstáculos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-3 pb-3">
          <p className="text-[10px] sm:text-xs text-gray-500">
            Detecta estructuras y objetos. Elimínalos para dejar espacio.
          </p>
          <div className="flex gap-1.5">
            <Button
              onClick={onDetect}
              disabled={isDetecting}
              size="sm"
              className="flex-1 bg-orange-600 hover:bg-orange-700 h-8 text-xs"
            >
              {isDetecting ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Analizando...
                </>
              ) : (
                "Detectar"
              )}
            </Button>
            {obstacles.length > 0 && (
              <Button
                onClick={onToggleVisibility}
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
              >
                {showObstacles ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>

          {/* Error message */}
          {error && (
            <Alert className="bg-red-50 border-red-200 py-1.5 px-2">
              <AlertDescription className="text-red-700 text-[10px] sm:text-xs">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Count badge */}
          {obstacles.length > 0 && (
            <Alert className="bg-blue-50 border-blue-200 py-1.5 px-2">
              <AlertDescription className="text-blue-800 text-[10px] sm:text-xs">
                <strong>{obstacles.length}</strong> obstáculo{obstacles.length !== 1 ? "s" : ""} detectado{obstacles.length !== 1 ? "s" : ""}.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Obstacle list */}
      {showObstacles && obstacles.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-2 space-y-1.5 max-h-[250px] overflow-y-auto">
            {obstacles.map((obs, idx) => (
              <div
                key={obs.id}
                className="flex items-center justify-between gap-1 p-1.5 rounded border bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs font-medium truncate">
                    {typeIcons[obs.type] || "❓"} {idx + 1}. {obs.label}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-gray-400">
                    {obs.width}x{obs.height}px · {(obs.confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <Button
                  onClick={() => onRemove(obs.id)}
                  size="sm"
                  variant="destructive"
                  className="h-6 px-1.5 text-[10px] shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}

            {obstacles.length > 1 && (
              <Button
                onClick={onClearAll}
                variant="outline"
                size="sm"
                className="w-full text-red-600 hover:text-red-700 h-7 text-xs gap-1"
              >
                <Eraser className="w-3 h-3" />
                Eliminar Todos ({obstacles.length})
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
