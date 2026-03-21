/**
 * Surface Editor Component
 * ============================================================================
 * Módulo independiente para edición visual de terreno
 * No modifica componentes existentes
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  SurfaceType,
  SurfaceToolType,
  SurfaceEditorState,
  EditedZone,
} from "@/../../shared/surface-editor-types";
import {
  detectSurfaceTypeByColor,
  floodFillZone,
  pixelsToPolygon,
  calculatePolygonArea,
  applyTextureToZone,
  validateNoPlantIntersection,
  createEditAction,
  applyEditAction,
} from "@/../../shared/surface-editor-utils";

interface SurfaceEditorProps {
  baseImageUrl: string;
  canvasWidth?: number;
  canvasHeight?: number;
  onSurfaceChange?: (zones: Map<string, EditedZone>) => void;
  plantPositions?: Array<{ x: number; y: number; radius: number }>;
}

/**
 * Surface Editor Component
 * Permite editar visualmente el terreno sin afectar el sistema existente
 */
export const SurfaceEditor: React.FC<SurfaceEditorProps> = ({
  baseImageUrl,
  canvasWidth = 800,
  canvasHeight = 600,
  onSurfaceChange,
  plantPositions = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<SurfaceEditorState>({
    baseImageUrl,
    canvasWidth,
    canvasHeight,
    currentTool: SurfaceToolType.SELECT,
    brushSize: 20,
    editedZones: new Map(),
    selectedZoneId: null,
    history: [],
    historyIndex: -1,
    showGrid: false,
    gridSize: 50,
    opacity: 0.7,
    showOriginal: false,
    isDirty: false,
    isSaving: false,
    error: null,
  });

  const [baseImage, setBaseImage] = useState<ImageData | null>(null);
  const [currentImageData, setCurrentImageData] = useState<ImageData | null>(
    null
  );

  /**
   * Cargar imagen base
   */
  useEffect(() => {
    const loadImage = async () => {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("No canvas context");

          ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
          const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
          setBaseImage(imageData);
          setCurrentImageData(imageData);
        };
        img.src = baseImageUrl;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: `Error cargando imagen: ${err}`,
        }));
      }
    };

    loadImage();
  }, [baseImageUrl, canvasWidth, canvasHeight]);

  /**
   * Renderizar canvas
   */
  useEffect(() => {
    if (!canvasRef.current || !currentImageData) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Mostrar imagen actual o original
    const imageToShow = state.showOriginal ? baseImage : currentImageData;
    if (imageToShow) {
      ctx.putImageData(imageToShow, 0, 0);
    }

    // Dibujar grid si está habilitado
    if (state.showGrid) {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvasWidth; x += state.gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
      for (let y = 0; y < canvasHeight; y += state.gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }
    }

    // Dibujar zonas editadas
    for (const zone of Array.from(state.editedZones.values())) {
      if (zone.polygon) {
        ctx.fillStyle =
          zone.id === state.selectedZoneId
            ? "rgba(255, 0, 0, 0.3)"
            : "rgba(0, 255, 0, 0.2)";
        ctx.beginPath();
        ctx.moveTo(zone.polygon[0].x, zone.polygon[0].y);
        for (let i = 1; i < zone.polygon.length; i++) {
          ctx.lineTo(zone.polygon[i].x, zone.polygon[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // Dibujar borde
        ctx.strokeStyle =
          zone.id === state.selectedZoneId ? "red" : "green";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [state, baseImage, currentImageData, canvasWidth, canvasHeight]);

  /**
   * Manejar clic en canvas
   */
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current || !currentImageData) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.floor(e.clientX - rect.left);
      const y = Math.floor(e.clientY - rect.top);

      if (state.currentTool === SurfaceToolType.SELECT) {
        // Seleccionar zona
        const pixels = floodFillZone(currentImageData, x, y, 30);
        const polygon = pixelsToPolygon(pixels);
        const pixelToMeterRatio = 0.1; // 1 píxel = 0.1 metros
        const area = calculatePolygonArea(polygon, pixelToMeterRatio);

        const zoneId = `zone-${Date.now()}`;
        const newZone: EditedZone = {
          id: zoneId,
          type: SurfaceType.SOIL,
          pixels,
          polygon,
          area,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        };

        setState((prev) => ({
          ...prev,
          editedZones: new Map(prev.editedZones).set(zoneId, newZone),
          selectedZoneId: zoneId,
        }));
      }
    },
    [state.currentTool, currentImageData]
  );

  /**
   * Aplicar acción a zona seleccionada
   */
  const applyActionToSelectedZone = useCallback(
    (tool: SurfaceToolType) => {
      if (!state.selectedZoneId || !currentImageData) return;

      const zone = state.editedZones.get(state.selectedZoneId);
      if (!zone) return;

      // Validar que no afecte plantas
      if (!validateNoPlantIntersection(zone.pixels, plantPositions)) {
        setState((prev) => ({
          ...prev,
          error: "No se puede editar esta zona: contiene plantas",
        }));
        return;
      }

      // Crear acción
      const pixels = Array.from(zone.pixels).map((key) => {
        const [x, y] = key.split(",").map(Number);
        return { x, y };
      });

      const action = createEditAction(tool, pixels);

      // Aplicar textura
      let newImageData = currentImageData;
      let newSurfaceType = zone.type;

      if (tool === SurfaceToolType.APPLY_GRASS) {
        newImageData = applyTextureToZone(
          currentImageData,
          zone.pixels,
          SurfaceType.GRASS,
          state.opacity
        );
        newSurfaceType = SurfaceType.GRASS;
      } else if (tool === SurfaceToolType.APPLY_GRAVEL) {
        newImageData = applyTextureToZone(
          currentImageData,
          zone.pixels,
          SurfaceType.GRAVEL,
          state.opacity
        );
        newSurfaceType = SurfaceType.GRAVEL;
      } else if (tool === SurfaceToolType.APPLY_SOIL) {
        newImageData = applyTextureToZone(
          currentImageData,
          zone.pixels,
          SurfaceType.SOIL,
          state.opacity
        );
        newSurfaceType = SurfaceType.SOIL;
      } else if (tool === SurfaceToolType.CLEAN) {
        newImageData = applyTextureToZone(
          currentImageData,
          zone.pixels,
          SurfaceType.SOIL,
          state.opacity * 0.5
        );
        newSurfaceType = SurfaceType.SOIL;
      }

      // Actualizar estado
      const updatedZones = new Map(state.editedZones);
      updatedZones.set(state.selectedZoneId, {
        ...zone,
        type: newSurfaceType,
        modifiedAt: Date.now(),
      });

      setState((prev) => ({
        ...prev,
        currentTool: SurfaceToolType.SELECT,
        editedZones: updatedZones,
        history: [...prev.history.slice(0, prev.historyIndex + 1), action],
        historyIndex: prev.historyIndex + 1,
        isDirty: true,
      }));

      setCurrentImageData(newImageData);

      // Notificar cambios
      if (onSurfaceChange) {
        onSurfaceChange(updatedZones);
      }
    },
    [state, currentImageData, plantPositions, onSurfaceChange]
  );

  /**
   * Deshacer
   */
  const handleUndo = useCallback(() => {
    if (state.historyIndex <= 0) return;

    setState((prev) => ({
      ...prev,
      historyIndex: prev.historyIndex - 1,
    }));

    // Regenerar imagen desde historial
    if (baseImage) {
      let newImageData = new ImageData(
        new Uint8ClampedArray(baseImage.data),
        baseImage.width,
        baseImage.height
      );

      for (let i = 0; i <= state.historyIndex - 1; i++) {
        const action = state.history[i];
        newImageData = applyEditAction(newImageData, action);
      }

      setCurrentImageData(newImageData);
    }
  }, [state, baseImage]);

  /**
   * Rehacer
   */
  const handleRedo = useCallback(() => {
    if (state.historyIndex >= state.history.length - 1) return;

    setState((prev) => ({
      ...prev,
      historyIndex: prev.historyIndex + 1,
    }));

    // Regenerar imagen desde historial
    if (baseImage) {
      let newImageData = new ImageData(
        new Uint8ClampedArray(baseImage.data),
        baseImage.width,
        baseImage.height
      );

      for (let i = 0; i <= state.historyIndex; i++) {
        const action = state.history[i];
        newImageData = applyEditAction(newImageData, action);
      }

      setCurrentImageData(newImageData);
    }
  }, [state, baseImage]);

  return (
    <Card className="w-full p-6 bg-white">
      <div className="space-y-4">
        {/* Título */}
        <h2 className="text-2xl font-bold">Editor de Terreno</h2>

        {/* Canvas */}
        <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            onClick={handleCanvasClick}
            className="w-full cursor-crosshair"
          />
        </div>

        {/* Herramientas */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Button
            variant={state.currentTool === SurfaceToolType.SELECT ? "default" : "outline"}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                currentTool: SurfaceToolType.SELECT,
              }))
            }
          >
            Seleccionar
          </Button>

          <Button
            variant={state.currentTool === SurfaceToolType.APPLY_GRASS ? "default" : "outline"}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                currentTool: SurfaceToolType.APPLY_GRASS,
              }))
            }
          >
            Pasto
          </Button>

          <Button
            variant={state.currentTool === SurfaceToolType.APPLY_GRAVEL ? "default" : "outline"}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                currentTool: SurfaceToolType.APPLY_GRAVEL,
              }))
            }
          >
            Grava
          </Button>

          <Button
            variant={state.currentTool === SurfaceToolType.APPLY_SOIL ? "default" : "outline"}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                currentTool: SurfaceToolType.APPLY_SOIL,
              }))
            }
          >
            Tierra
          </Button>

          <Button
            variant={state.currentTool === SurfaceToolType.CLEAN ? "default" : "outline"}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                currentTool: SurfaceToolType.CLEAN,
              }))
            }
          >
            Limpiar
          </Button>
        </div>

        {/* Acciones */}
        <div className="flex gap-2">
          <Button
            onClick={() => applyActionToSelectedZone(state.currentTool)}
            disabled={!state.selectedZoneId}
            className="flex-1"
          >
            Aplicar
          </Button>

          <Button
            onClick={handleUndo}
            disabled={state.historyIndex <= 0}
            variant="outline"
          >
            ↶ Deshacer
          </Button>

          <Button
            onClick={handleRedo}
            disabled={state.historyIndex >= state.history.length - 1}
            variant="outline"
          >
            ↷ Rehacer
          </Button>
        </div>

        {/* Opciones */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.showGrid}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  showGrid: e.target.checked,
                }))
              }
            />
            Mostrar Grid
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.showOriginal}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  showOriginal: e.target.checked,
                }))
              }
            />
            Mostrar Original
          </label>

          <label className="flex items-center gap-2">
            Opacidad:
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={state.opacity}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  opacity: parseFloat(e.target.value),
                }))
              }
              className="w-24"
            />
          </label>
        </div>

        {/* Estado */}
        {state.error && (
          <div className="p-3 bg-red-100 text-red-800 rounded">
            {state.error}
          </div>
        )}

        {state.isDirty && (
          <div className="p-3 bg-yellow-100 text-yellow-800 rounded">
            Cambios sin guardar
          </div>
        )}

        {/* Información */}
        <div className="text-sm text-gray-600">
          <p>Zonas editadas: {state.editedZones.size}</p>
          <p>Historial: {state.historyIndex + 1} / {state.history.length}</p>
        </div>
      </div>
    </Card>
  );
};

export default SurfaceEditor;
