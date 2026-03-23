/**
 * Component: ImprovedLiveCanvas
 * ============================================================================
 * Production-grade canvas with:
 * - HTML overlay divs for obstacles (native click/touch, no coordinate math)
 * - Canvas draws background + plants
 * - Responsive: adapts to container via ResizeObserver
 * - Touch support for mobile/tablet
 * - Drag & drop plants from inventory
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { SelectedObject } from "../../../shared/live-interaction-types";
import { Obstacle } from "./ObstacleDetector";

interface ImprovedLiveCanvasProps {
  backgroundImage?: string;
  objects: SelectedObject[];
  obstacles?: Obstacle[];
  onObjectsChange?: (objects: SelectedObject[]) => void;
  onSelectionChange?: (selected: SelectedObject[]) => void;
  onObstacleDelete?: (obstacleId: string) => void;
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Internal canvas resolution
  const INTERNAL_W = 800;
  const INTERNAL_H = 600;

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [backgroundImg, setBackgroundImg] = useState<HTMLImageElement | null>(null);
  const [imageCache] = useState<Map<string, HTMLImageElement>>(new Map());
  const objectsRef = useRef<SelectedObject[]>(objects);

  // Track which obstacles are being erased (for animation)
  const [erasingIds, setErasingIds] = useState<Set<string>>(new Set());
  const eraserActiveRef = useRef(false);

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
    [getCanvasCoords, hitTestObject, onSelectionChange]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging || !selectedObjectId) return;
      const { x, y } = getCanvasCoords(e.clientX, e.clientY);
      const newX = Math.max(0, Math.min(INTERNAL_W, x - dragOffset.x));
      const newY = Math.max(0, Math.min(INTERNAL_H, y - dragOffset.y));
      const updated = objectsRef.current.map((obj) =>
        obj.id === selectedObjectId ? { ...obj, x: newX, y: newY } : obj
      );
      objectsRef.current = updated;
      onObjectsChange?.(updated);
    },
    [isDragging, selectedObjectId, getCanvasCoords, dragOffset, onObjectsChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ─── Touch handlers for canvas ───
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
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
    [getCanvasCoords, hitTestObject, onSelectionChange]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDragging || !selectedObjectId) return;
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
    [isDragging, selectedObjectId, getCanvasCoords, dragOffset, onObjectsChange]
  );

  const handleTouchEnd = useCallback(() => {
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
      eraserActiveRef.current = true;
      const id = hitTestObstacleAtPoint(e.clientX, e.clientY);
      if (id) eraseObstacle(id);
    },
    [hitTestObstacleAtPoint, eraseObstacle]
  );

  const handleEraserPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!eraserActiveRef.current) return;
      const id = hitTestObstacleAtPoint(e.clientX, e.clientY);
      if (id) eraseObstacle(id);
    },
    [hitTestObstacleAtPoint, eraseObstacle]
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
        style={{ touchAction: "none", cursor: "crosshair" }}
      />

      {/* ─── Obstacle Overlay ─── */}
      {obstacles.length > 0 && (
        <div
          ref={overlayRef}
          className="absolute top-0 left-0 w-full rounded-lg overflow-hidden"
          style={{
            aspectRatio: `${INTERNAL_W} / ${INTERNAL_H}`,
            pointerEvents: "auto",
            cursor: "crosshair",
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
                    : "border-red-500 bg-red-500/20 hover:bg-red-500/40 hover:border-red-600"
                }`}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  transition: isErasing ? "all 0.2s ease-out" : "border-color 0.15s, background-color 0.15s",
                  zIndex: 10,
                }}
                title={`${obs.label} (${(obs.confidence * 100).toFixed(0)}%)`}
              >
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] font-bold whitespace-nowrap px-1 py-0.5 rounded shadow pointer-events-none bg-red-600 text-white">
                  {obs.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Hint bar ─── */}
      {obstacles.length > 0 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none z-20">
          <div className="bg-black/60 text-white text-[10px] sm:text-xs px-3 py-1 rounded-full">
            Toca los obstáculos marcados para borrarlos con IA
          </div>
        </div>
      )}
    </div>
  );
};
