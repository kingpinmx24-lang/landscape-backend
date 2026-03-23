/**
 * Component: ImprovedLiveCanvas
 * ============================================================================
 * Production-grade canvas with:
 * - FREEHAND PAINT ERASER: user paints mask with finger/mouse → AI inpainting
 * - HTML overlay divs for obstacles (native click/touch, no coordinate math)
 * - Canvas only draws background + plants
 * - Responsive: adapts to container via ResizeObserver
 * - Touch support for mobile/tablet
 * - Drag & drop plants from inventory
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { SelectedObject } from "../../../shared/live-interaction-types";
import { Obstacle } from "./ObstacleDetector";
import { Loader2 } from "lucide-react";

interface ImprovedLiveCanvasProps {
  backgroundImage?: string;
  objects: SelectedObject[];
  obstacles?: Obstacle[];
  onObjectsChange?: (objects: SelectedObject[]) => void;
  onSelectionChange?: (selected: SelectedObject[]) => void;
  onObstacleDelete?: (obstacleId: string) => void;
  onInpaintMask?: (imageBase64: string, maskBase64: string) => Promise<string>;
  onImageUpdated?: (newImageBase64: string) => void;
  gridSize?: number;
  snapToGrid?: boolean;
}

export const ImprovedLiveCanvas: React.FC<ImprovedLiveCanvasProps> = ({
  backgroundImage,
  objects,
  obstacles = [],
  onObjectsChange,
  onSelectionChange,
  onObstacleDelete,
  onInpaintMask,
  onImageUpdated,
  gridSize = 20,
  snapToGrid = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);

  // Internal canvas resolution
  const INTERNAL_W = 800;
  const INTERNAL_H = 600;

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [backgroundImg, setBackgroundImg] = useState<HTMLImageElement | null>(null);
  const [imageCache] = useState<Map<string, HTMLImageElement>>(new Map());
  const objectsRef = useRef<SelectedObject[]>(objects);

  // Eraser modes: "none" | "obstacle" | "paint"
  const [eraserMode, setEraserMode] = useState<"none" | "obstacle" | "paint">("none");
  const [brushSize, setBrushSize] = useState(40);
  const [isPainting, setIsPainting] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Track which obstacles are being erased (for animation)
  const [erasingIds, setErasingIds] = useState<Set<string>>(new Set());
  const eraserActiveRef = useRef(false);
  const isPaintingRef = useRef(false);

  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  // ─── Load background image ───
  useEffect(() => {
    if (!backgroundImage) return;
    const img = new Image();
    if (backgroundImage.startsWith("http")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => setBackgroundImg(img);
    img.onerror = () => console.error("[Canvas] Failed to load background image");
    img.src = backgroundImage;
  }, [backgroundImage]);

  // ─── Preload object images ───
  useEffect(() => {
    objects.forEach((obj) => {
      const url = obj.imageUrl || (obj.metadata?.imageUrl as string);
      if (url && !imageCache.has(url)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          imageCache.set(url, img);
        };
        img.src = url;
      }
    });
  }, [objects, imageCache]);

  // ─── Initialize mask canvas ───
  useEffect(() => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const ctx = mask.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, INTERNAL_W, INTERNAL_H);
    setHasMask(false);
  }, [backgroundImage]); // Reset mask when image changes

  // ─── Canvas coordinate helpers ───
  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = INTERNAL_W / rect.width;
    const scaleY = INTERNAL_H / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  // ─── Paint mask stroke ───
  const paintMaskAt = useCallback((clientX: number, clientY: number) => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const ctx = mask.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(clientX, clientY);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255, 60, 60, 0.75)";
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    setHasMask(true);
  }, [getCanvasCoords, brushSize]);

  // ─── Clear mask ───
  const clearMask = useCallback(() => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const ctx = mask.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, INTERNAL_W, INTERNAL_H);
    setHasMask(false);
    setApplyError(null);
  }, []);

  // ─── Apply inpainting ───
  const applyInpaint = useCallback(async () => {
    if (!hasMask || !backgroundImage || !onInpaintMask) return;
    const mask = maskCanvasRef.current;
    const mainCanvas = canvasRef.current;
    if (!mask || !mainCanvas) return;

    setIsApplying(true);
    setApplyError(null);

    try {
      // Get the background image as base64 from the canvas
      const bgCanvas = document.createElement("canvas");
      bgCanvas.width = INTERNAL_W;
      bgCanvas.height = INTERNAL_H;
      const bgCtx = bgCanvas.getContext("2d");
      if (!bgCtx) throw new Error("No canvas context");

      if (backgroundImg) {
        bgCtx.drawImage(backgroundImg, 0, 0, INTERNAL_W, INTERNAL_H);
      }
      const imageBase64 = bgCanvas.toDataURL("image/png");

      // Get the mask as B&W base64 (white = erase, black = keep)
      // The painted mask uses red strokes for visibility — convert to white for the API
      const maskCanvas2 = document.createElement("canvas");
      maskCanvas2.width = INTERNAL_W;
      maskCanvas2.height = INTERNAL_H;
      const maskCtx2 = maskCanvas2.getContext("2d");
      if (!maskCtx2) throw new Error("No mask context");
      // Start with black background
      maskCtx2.fillStyle = "black";
      maskCtx2.fillRect(0, 0, INTERNAL_W, INTERNAL_H);
      // Draw the painted mask (red strokes) on top
      maskCtx2.drawImage(mask, 0, 0);
      // Convert any non-black pixel to white (handles red, white, or any color strokes)
      const maskData = maskCtx2.getImageData(0, 0, INTERNAL_W, INTERNAL_H);
      for (let i = 0; i < maskData.data.length; i += 4) {
        const r = maskData.data[i];
        const g = maskData.data[i + 1];
        const b = maskData.data[i + 2];
        const a = maskData.data[i + 3];
        // If the pixel has any color (not pure black with full alpha), make it white
        if (a > 10 && (r > 30 || g > 30 || b > 30)) {
          maskData.data[i] = 255;
          maskData.data[i + 1] = 255;
          maskData.data[i + 2] = 255;
          maskData.data[i + 3] = 255;
        } else {
          maskData.data[i] = 0;
          maskData.data[i + 1] = 0;
          maskData.data[i + 2] = 0;
          maskData.data[i + 3] = 255;
        }
      }
      maskCtx2.putImageData(maskData, 0, 0);
      const maskBase64 = maskCanvas2.toDataURL("image/png");

      const resultBase64 = await onInpaintMask(imageBase64, maskBase64);

      // Apply the result image to the canvas immediately
      if (resultBase64 && resultBase64.startsWith("data:")) {
        const newImg = new Image();
        newImg.onload = () => {
          setBackgroundImg(newImg);
        };
        newImg.src = resultBase64;
        // Notify parent so it can persist the new image
        onImageUpdated?.(resultBase64);
      }

      // Clear the mask after successful inpainting
      clearMask();
      setEraserMode("none");
    } catch (err: any) {
      setApplyError(err?.message || "Error al procesar la imagen");
    } finally {
      setIsApplying(false);
    }
  }, [hasMask, backgroundImage, backgroundImg, onInpaintMask, clearMask]);

  // ─── Hit test: which object is at canvas coords ───
  const hitTestObject = useCallback(
    (x: number, y: number): SelectedObject | null => {
      const objs = objectsRef.current;
      for (let i = objs.length - 1; i >= 0; i--) {
        const obj = objs[i];
        const r = (obj.radius || 25) + 5;
        if (Math.hypot(x - obj.x, y - obj.y) <= r) return obj;
      }
      return null;
    },
    []
  );

  // ─── ERASER: hit test obstacle overlays by pixel position ───
  const hitTestObstacleAtPoint = useCallback(
    (clientX: number, clientY: number): string | null => {
      if (!overlayRef.current) return null;
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      let node: Element | null = el;
      while (node && node !== overlayRef.current) {
        const id = node.getAttribute("data-obstacle-id");
        if (id) return id;
        node = node.parentElement;
      }
      return null;
    },
    []
  );

  // ─── Erase obstacle by id (with fade animation) ───
  const eraseObstacle = useCallback(
    (id: string) => {
      setErasingIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setTimeout(() => {
        onObstacleDelete?.(id);
        setErasingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 200);
    },
    [onObstacleDelete]
  );

  // ─── Mouse handlers for canvas ───
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (eraserMode === "paint") {
        isPaintingRef.current = true;
        setIsPainting(true);
        paintMaskAt(e.clientX, e.clientY);
        return;
      }
      if (eraserMode === "obstacle") return;
      const { x, y } = getCanvasCoords(e.clientX, e.clientY);
      const hit = hitTestObject(x, y);
      if (hit) {
        setSelectedObjectId(hit.id);
        setIsDragging(true);
        setDragOffset({ x: x - hit.x, y: y - hit.y });
        onSelectionChange?.([hit]);
      } else {
        setSelectedObjectId(null);
        onSelectionChange?.([]);
      }
    },
    [eraserMode, getCanvasCoords, hitTestObject, onSelectionChange, paintMaskAt]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (eraserMode === "paint" && isPaintingRef.current) {
        paintMaskAt(e.clientX, e.clientY);
        return;
      }
      if (!isDragging || !selectedObjectId || eraserMode !== "none") return;
      const { x, y } = getCanvasCoords(e.clientX, e.clientY);
      const newX = Math.max(0, Math.min(INTERNAL_W, x - dragOffset.x));
      const newY = Math.max(0, Math.min(INTERNAL_H, y - dragOffset.y));
      const updated = objectsRef.current.map((obj) =>
        obj.id === selectedObjectId ? { ...obj, x: newX, y: newY } : obj
      );
      objectsRef.current = updated;
      onObjectsChange?.(updated);
    },
    [isDragging, selectedObjectId, eraserMode, getCanvasCoords, dragOffset, onObjectsChange, paintMaskAt]
  );

  const handleMouseUp = useCallback(() => {
    isPaintingRef.current = false;
    setIsPainting(false);
    setIsDragging(false);
  }, []);

  // ─── Touch handlers for canvas ───
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (eraserMode === "paint") {
        e.preventDefault();
        isPaintingRef.current = true;
        setIsPainting(true);
        const touch = e.touches[0];
        paintMaskAt(touch.clientX, touch.clientY);
        return;
      }
      if (eraserMode === "obstacle") return;
      const touch = e.touches[0];
      const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
      const hit = hitTestObject(x, y);
      if (hit) {
        setSelectedObjectId(hit.id);
        setIsDragging(true);
        setDragOffset({ x: x - hit.x, y: y - hit.y });
        onSelectionChange?.([hit]);
      }
    },
    [eraserMode, getCanvasCoords, hitTestObject, onSelectionChange, paintMaskAt]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (eraserMode === "paint" && isPaintingRef.current) {
        e.preventDefault();
        const touch = e.touches[0];
        paintMaskAt(touch.clientX, touch.clientY);
        return;
      }
      if (!isDragging || !selectedObjectId || eraserMode !== "none") return;
      e.preventDefault();
      const touch = e.touches[0];
      const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
      const newX = Math.max(0, Math.min(INTERNAL_W, x - dragOffset.x));
      const newY = Math.max(0, Math.min(INTERNAL_H, y - dragOffset.y));
      const updated = objectsRef.current.map((obj) =>
        obj.id === selectedObjectId ? { ...obj, x: newX, y: newY } : obj
      );
      objectsRef.current = updated;
      onObjectsChange?.(updated);
    },
    [isDragging, selectedObjectId, eraserMode, getCanvasCoords, dragOffset, onObjectsChange, paintMaskAt]
  );

  const handleTouchEnd = useCallback(() => {
    isPaintingRef.current = false;
    setIsPainting(false);
    setIsDragging(false);
  }, []);

  // ─── Drag & drop from inventory ───
  const handleDragOver = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const { x, y } = getCanvasCoords(e.clientX, e.clientY);
      try {
        const data = JSON.parse(e.dataTransfer.getData("application/json"));
        if (data?.type === "plant") {
          const newObj: SelectedObject = {
            id: `plant-${Date.now()}`,
            type: data.plantType || "plant",
            x,
            y,
            radius: 25,
            imageUrl: data.imageUrl,
            metadata: data.metadata || {},
          };
          const updated = [...objectsRef.current, newObj];
          objectsRef.current = updated;
          onObjectsChange?.(updated);
        }
      } catch {}
    },
    [getCanvasCoords, onObjectsChange]
  );

  // ─── OBSTACLE ERASER: overlay touch/mouse handlers ───
  const handleEraserPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (eraserMode !== "obstacle") return;
      eraserActiveRef.current = true;
      const id = hitTestObstacleAtPoint(e.clientX, e.clientY);
      if (id) eraseObstacle(id);
    },
    [eraserMode, hitTestObstacleAtPoint, eraseObstacle]
  );

  const handleEraserPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (eraserMode !== "obstacle" || !eraserActiveRef.current) return;
      const id = hitTestObstacleAtPoint(e.clientX, e.clientY);
      if (id) eraseObstacle(id);
    },
    [eraserMode, hitTestObstacleAtPoint, eraseObstacle]
  );

  const handleEraserPointerUp = useCallback(() => {
    eraserActiveRef.current = false;
  }, []);

  // ─── Draw canvas ───
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, INTERNAL_W, INTERNAL_H);

    // Background
    if (backgroundImg) {
      ctx.drawImage(backgroundImg, 0, 0, INTERNAL_W, INTERNAL_H);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, INTERNAL_H);
      grad.addColorStop(0, "#e8f5e9");
      grad.addColorStop(1, "#c8e6c9");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);
    }

    // Draw plant objects
    objects.forEach((obj) => {
      const r = obj.radius || 25;
      const imgUrl = obj.imageUrl || (obj.metadata?.imageUrl as string);
      const cachedImg = imgUrl ? imageCache.get(imgUrl) : null;

      if (cachedImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(cachedImg, obj.x - r, obj.y - r, r * 2, r * 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2);
        ctx.fillStyle = obj.id === selectedObjectId ? "#4CAF50" : "#66BB6A";
        ctx.fill();
        ctx.strokeStyle = obj.id === selectedObjectId ? "#1B5E20" : "#2E7D32";
        ctx.lineWidth = obj.id === selectedObjectId ? 3 : 2;
        ctx.stroke();
      }

      if (obj.id === selectedObjectId) {
        ctx.strokeStyle = "#1565C0";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const label = (obj.metadata?.name as string) || obj.type || "";
      if (label) {
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(obj.x - 30, obj.y + r + 2, 60, 14);
        ctx.fillStyle = "#fff";
        ctx.fillText(label.substring(0, 12), obj.x, obj.y + r + 12);
      }
    });
  }, [objects, selectedObjectId, backgroundImg, imageCache]);

  // ─── Compute obstacle overlay positions ───
  const obstacleOverlays = useMemo(() => {
    return obstacles.map((obs) => {
      const leftPct = ((obs.x - obs.width / 2) / INTERNAL_W) * 100;
      const topPct = ((obs.y - obs.height / 2) / INTERNAL_H) * 100;
      const widthPct = (obs.width / INTERNAL_W) * 100;
      const heightPct = (obs.height / INTERNAL_H) * 100;
      return {
        obs,
        leftPct: Math.max(0, leftPct),
        topPct: Math.max(0, topPct),
        widthPct: Math.min(100 - Math.max(0, leftPct), widthPct),
        heightPct: Math.min(100 - Math.max(0, topPct), heightPct),
      };
    });
  }, [obstacles]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[250px] relative select-none">

      {/* ─── Toolbar ─── */}
      <div className="absolute top-2 right-2 z-40 flex flex-col gap-1 items-end">
        {/* Paint eraser button */}
        {onInpaintMask && (
          <button
            onClick={() => {
              setEraserMode((v) => v === "paint" ? "none" : "paint");
              clearMask();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg transition-all active:scale-95 ${
              eraserMode === "paint"
                ? "bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-1"
                : "bg-white/90 text-gray-700 border border-gray-300 hover:bg-blue-50 hover:border-blue-400"
            }`}
            title="Pintar zona a borrar con IA"
          >
            <span className="text-base">✏️</span>
            <span>{eraserMode === "paint" ? "Pintando..." : "Borrar zona"}</span>
          </button>
        )}

        {/* Obstacle eraser button */}
        {obstacles.length > 0 && (
          <button
            onClick={() => setEraserMode((v) => v === "obstacle" ? "none" : "obstacle")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg transition-all active:scale-95 ${
              eraserMode === "obstacle"
                ? "bg-orange-500 text-white ring-2 ring-orange-300 ring-offset-1"
                : "bg-white/90 text-gray-700 border border-gray-300 hover:bg-orange-50 hover:border-orange-400"
            }`}
            title="Borrar marcadores de obstáculos"
          >
            <span className="text-base">🧹</span>
            <span>{eraserMode === "obstacle" ? "Borrando..." : "Borrador"}</span>
          </button>
        )}
      </div>

      {/* ─── Paint mode controls ─── */}
      {eraserMode === "paint" && (
        <div className="absolute top-2 left-2 z-40 bg-white/95 rounded-xl shadow-lg p-2 flex flex-col gap-2 min-w-[160px]">
          <div className="text-xs font-bold text-blue-700">✏️ Pinta la zona a borrar</div>

          {/* Brush size */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-12">Tamaño:</span>
            <input
              type="range"
              min={10}
              max={100}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="flex-1 h-1.5 accent-blue-600"
            />
            <span className="text-[10px] text-gray-500 w-6">{brushSize}</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-1">
            <button
              onClick={clearMask}
              disabled={!hasMask}
              className="flex-1 text-[10px] py-1 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 font-medium"
            >
              Limpiar
            </button>
            <button
              onClick={applyInpaint}
              disabled={!hasMask || isApplying}
              className="flex-1 text-[10px] py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 font-bold flex items-center justify-center gap-1"
            >
              {isApplying ? (
                <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Borrando...</>
              ) : (
                "✨ Borrar"
              )}
            </button>
          </div>

          {applyError && (
            <p className="text-[10px] text-red-500">{applyError}</p>
          )}
        </div>
      )}

      {/* ─── Canvas: background + plants ─── */}
      <canvas
        ref={canvasRef}
        width={INTERNAL_W}
        height={INTERNAL_H}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="w-full h-auto rounded-lg shadow-inner block"
        style={{
          touchAction: "none",
          cursor: eraserMode === "paint" ? "crosshair" : eraserMode === "obstacle" ? "none" : "crosshair",
        }}
      />

      {/* ─── Mask canvas overlay (always in DOM, visibility toggled) ─── */}
      <canvas
        ref={maskCanvasRef}
        width={INTERNAL_W}
        height={INTERNAL_H}
        className="absolute top-0 left-0 w-full h-auto rounded-lg pointer-events-none"
        style={{
          opacity: eraserMode === "paint" ? 0.55 : 0,
          mixBlendMode: "normal",
          display: "block",
        }}
      />

      {/* ─── Applying overlay ─── */}
      {isApplying && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 rounded-lg">
          <div className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-xl">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm font-bold text-gray-800">Borrando zona...</p>
            <p className="text-xs text-gray-400">IA procesando la imagen</p>
          </div>
        </div>
      )}

      {/* ─── Obstacle Overlay ─── */}
      {obstacles.length > 0 && (
        <div
          ref={overlayRef}
          className="absolute top-0 left-0 w-full rounded-lg overflow-hidden"
          style={{
            aspectRatio: `${INTERNAL_W} / ${INTERNAL_H}`,
            pointerEvents: eraserMode === "obstacle" ? "auto" : "none",
            cursor: eraserMode === "obstacle" ? "crosshair" : "default",
          }}
          onPointerDown={handleEraserPointerDown}
          onPointerMove={handleEraserPointerMove}
          onPointerUp={handleEraserPointerUp}
          onPointerLeave={handleEraserPointerUp}
        >
          {obstacleOverlays.map(({ obs, leftPct, topPct, widthPct, heightPct }) => {
            const isErasing = erasingIds.has(obs.id);
            return (
              <div
                key={obs.id}
                data-obstacle-id={obs.id}
                className={`absolute border-2 border-dashed transition-all ${
                  isErasing
                    ? "border-orange-400 bg-orange-400/60 scale-110 opacity-0"
                    : eraserMode === "obstacle"
                    ? "border-orange-400 bg-orange-400/25 hover:bg-orange-400/50 hover:border-orange-500"
                    : "border-red-500 bg-red-500/20"
                }`}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  pointerEvents: eraserMode === "obstacle" ? "auto" : "none",
                  transition: isErasing ? "all 0.2s ease-out" : "border-color 0.15s, background-color 0.15s",
                  zIndex: 10,
                }}
                title={`${obs.label} (${(obs.confidence * 100).toFixed(0)}%)`}
              >
                <span
                  className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] font-bold whitespace-nowrap px-1 py-0.5 rounded shadow pointer-events-none ${
                    eraserMode === "obstacle" ? "bg-orange-500 text-white" : "bg-red-600 text-white"
                  }`}
                >
                  {obs.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Hint bar ─── */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none z-20">
        {eraserMode === "paint" ? (
          <div className="bg-blue-600/90 text-white text-[10px] sm:text-xs px-3 py-1.5 rounded-full font-semibold shadow-lg flex items-center gap-1.5">
            ✏️ Pinta la zona a borrar · luego toca <strong>Borrar</strong>
          </div>
        ) : eraserMode === "obstacle" ? (
          <div className="bg-orange-500/90 text-white text-[10px] sm:text-xs px-3 py-1.5 rounded-full font-semibold shadow-lg flex items-center gap-1.5 animate-pulse">
            🧹 Arrastra el dedo sobre los obstáculos para borrarlos
          </div>
        ) : obstacles.length > 0 ? (
          <div className="bg-black/60 text-white text-[10px] sm:text-xs px-3 py-1 rounded-full">
            Toca 🧹 Borrador para eliminar obstáculos · ✏️ Borrar zona para editar la foto
          </div>
        ) : null}
      </div>
    </div>
  );
};
