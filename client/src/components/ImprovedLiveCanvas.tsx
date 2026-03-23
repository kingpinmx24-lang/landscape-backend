/**
 * ImprovedLiveCanvas — Professional 60fps Canvas v3
 * ============================================================================
 * Features:
 *  - requestAnimationFrame draw loop (60fps, smooth)
 *  - ROBUST touch support:
 *      • Single-finger drag to move selected plant
 *      • Two-finger pinch to scale (works even without pre-selection)
 *      • Two-finger rotate
 *  - Selection with animated blue outline + glow
 *  - Large floating toolbar (finger-friendly): scale slider, delete, duplicate
 *  - Snap-to-grid (optional, togglable)
 *  - Drag & drop from inventory panel
 *  - Plant images with transparent background support
 *  - Scale range: 10–200px radius for large trees/palms
 */

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { SelectedObject } from "../../../shared/live-interaction-types";

interface ImprovedLiveCanvasProps {
  backgroundImage?: string;
  objects: SelectedObject[];
  onObjectsChange?: (objects: SelectedObject[]) => void;
  onSelectionChange?: (selected: SelectedObject[]) => void;
  gridSize?: number;
  snapToGrid?: boolean;
}

const INTERNAL_W = 800;
const INTERNAL_H = 600;
const MIN_RADIUS = 10;
const MAX_RADIUS = 200;

function snapVal(v: number, grid: number, snap: boolean): number {
  if (!snap || grid <= 0) return v;
  return Math.round(v / grid) * grid;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export const ImprovedLiveCanvas: React.FC<ImprovedLiveCanvasProps> = ({
  backgroundImage,
  objects,
  onObjectsChange,
  onSelectionChange,
  gridSize = 20,
  snapToGrid = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(snapToGrid);
  const [backgroundImg, setBackgroundImg] = useState<HTMLImageElement | null>(null);
  const [imageCache] = useState<Map<string, HTMLImageElement>>(new Map());

  // Refs for RAF loop (avoid stale closures)
  const objectsRef = useRef<SelectedObject[]>(objects);
  const selectedIdRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const backgroundImgRef = useRef<HTMLImageElement | null>(null);
  const imageCacheRef = useRef(imageCache);
  const snapRef = useRef(snapEnabled);
  const gridRef = useRef(gridSize);
  const frameRef = useRef(0);

  // Touch state refs
  const touchStateRef = useRef<{
    mode: 'none' | 'drag' | 'pinch';
    id: string | null;
    // drag
    dragOffsetX: number;
    dragOffsetY: number;
    // pinch
    startDist: number;
    startRadius: number;
    startAngle: number;
    startRotation: number;
    // pinch center
    centerX: number;
    centerY: number;
  }>({
    mode: 'none',
    id: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    startDist: 0,
    startRadius: 30,
    startAngle: 0,
    startRotation: 0,
    centerX: 0,
    centerY: 0,
  });

  // Keep refs in sync
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { backgroundImgRef.current = backgroundImg; }, [backgroundImg]);
  useEffect(() => { snapRef.current = snapEnabled; }, [snapEnabled]);
  useEffect(() => { gridRef.current = gridSize; }, [gridSize]);

  // ─── Load background image ───
  useEffect(() => {
    if (!backgroundImage) return;
    const img = new Image();
    if (backgroundImage.startsWith("http")) img.crossOrigin = "anonymous";
    img.onload = () => setBackgroundImg(img);
    img.onerror = () => console.error("[Canvas] Failed to load background");
    img.src = backgroundImage;
  }, [backgroundImage]);

  // ─── Preload object images ───
  // Converts base64 data URLs to Blob URLs for reliable canvas rendering
  const blobUrlCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    objects.forEach((obj) => {
      const url = obj.imageUrl || (obj.metadata?.imageUrl as string);
      if (!url) return;

      // Use a stable cache key (first 100 chars for base64, full URL otherwise)
      const cacheKey = url.startsWith('data:') ? url.substring(0, 100) : url;

      if (imageCache.has(cacheKey)) return;

      const img = new Image();

      const onLoad = () => {
        imageCache.set(cacheKey, img);
        imageCacheRef.current = imageCache;
      };

      img.onload = onLoad;
      img.onerror = (e) => {
        console.warn('[Canvas] Failed to load image:', cacheKey.substring(0, 60), e);
      };

      if (url.startsWith('data:')) {
        // Convert base64 to Blob URL for reliable loading
        try {
          const [header, b64] = url.split(',');
          const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: mime });
          const blobUrl = URL.createObjectURL(blob);
          blobUrlCache.current.set(cacheKey, blobUrl);
          img.src = blobUrl;
        } catch (err) {
          // Fallback: use data URL directly
          img.src = url;
        }
      } else {
        img.crossOrigin = 'anonymous';
        img.src = url;
      }
    });
  }, [objects, imageCache]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    const blobCache = blobUrlCache.current;
    return () => {
      blobCache.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
    };
  }, []);

  // ─── RAF Draw Loop ───
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      frameRef.current++;
      ctx.clearRect(0, 0, INTERNAL_W, INTERNAL_H);

      // Background
      const bg = backgroundImgRef.current;
      if (bg) {
        ctx.drawImage(bg, 0, 0, INTERNAL_W, INTERNAL_H);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, INTERNAL_H);
        grad.addColorStop(0, "#e8f5e9");
        grad.addColorStop(1, "#c8e6c9");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);
      }

      // Snap grid overlay
      if (snapRef.current && gridRef.current > 0) {
        ctx.strokeStyle = "rgba(100,149,237,0.15)";
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= INTERNAL_W; x += gridRef.current) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, INTERNAL_H); ctx.stroke();
        }
        for (let y = 0; y <= INTERNAL_H; y += gridRef.current) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(INTERNAL_W, y); ctx.stroke();
        }
      }

      // Draw objects
      const objs = objectsRef.current;
      const selId = selectedIdRef.current;

      objs.forEach((obj) => {
        const r = obj.radius || 30;
        const imgUrl = obj.imageUrl || (obj.metadata?.imageUrl as string);
        const imgCacheKey = imgUrl
          ? (imgUrl.startsWith('data:') ? imgUrl.substring(0, 100) : imgUrl)
          : null;
        const cachedImg = imgCacheKey ? imageCacheRef.current.get(imgCacheKey) : null;
        const isSelected = obj.id === selId;
        const rotation = (obj as any).rotation || 0;

        ctx.save();
        ctx.translate(obj.x, obj.y);
        if (rotation) ctx.rotate(rotation);

        if (isSelected) {
          const pulse = 0.5 + 0.5 * Math.sin(frameRef.current * 0.08);
          ctx.shadowColor = `rgba(30,136,229,${0.6 + pulse * 0.4})`;
          ctx.shadowBlur = 14 + pulse * 10;
        }

        if (cachedImg) {
          const aspect = cachedImg.naturalWidth / cachedImg.naturalHeight;
          const drawW = r * 2 * (aspect >= 1 ? 1 : aspect);
          const drawH = r * 2 * (aspect >= 1 ? 1 / aspect : 1);
          ctx.drawImage(cachedImg, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? "#4CAF50" : "#66BB6A";
          ctx.fill();
          ctx.strokeStyle = isSelected ? "#1B5E20" : "#2E7D32";
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.stroke();
        }

        ctx.restore();

        // Selection outline (animated dashed) — drawn without rotation for clarity
        if (isSelected) {
          const pulse = 0.5 + 0.5 * Math.sin(frameRef.current * 0.08);
          ctx.save();
          ctx.strokeStyle = `rgba(30,136,229,${0.8 + pulse * 0.2})`;
          ctx.lineWidth = 2.5;
          const dashOffset = (frameRef.current * 0.5) % 16;
          ctx.setLineDash([8, 8]);
          ctx.lineDashOffset = -dashOffset;
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, r + 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        // Label
        const label = (obj.metadata?.name as string) || obj.type || "";
        if (label) {
          ctx.font = "bold 10px system-ui, Arial";
          ctx.textAlign = "center";
          const tw = ctx.measureText(label.substring(0, 16)).width + 10;
          ctx.fillStyle = "rgba(0,0,0,0.70)";
          ctx.beginPath();
          ctx.roundRect(obj.x - tw / 2, obj.y + r + 4, tw, 16, 4);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.fillText(label.substring(0, 16), obj.x, obj.y + r + 14);
        }
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ─── Canvas coordinate helpers ───
  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (INTERNAL_W / rect.width),
      y: (clientY - rect.top) * (INTERNAL_H / rect.height),
    };
  }, []);

  // ─── Hit test ───
  const hitTestObject = useCallback((x: number, y: number): SelectedObject | null => {
    const objs = objectsRef.current;
    for (let i = objs.length - 1; i >= 0; i--) {
      const obj = objs[i];
      const r = (obj.radius || 30) + 10;
      if (dist2(x, y, obj.x, obj.y) <= r) return obj;
    }
    return null;
  }, []);

  // ─── Mouse handlers ───
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const hit = hitTestObject(x, y);
    if (hit) {
      setSelectedId(hit.id);
      selectedIdRef.current = hit.id;
      isDraggingRef.current = true;
      dragOffsetRef.current = { x: x - hit.x, y: y - hit.y };
      onSelectionChange?.([hit]);
    } else {
      setSelectedId(null);
      selectedIdRef.current = null;
      onSelectionChange?.([]);
    }
  }, [getCanvasCoords, hitTestObject, onSelectionChange]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || !selectedIdRef.current) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const rawX = x - dragOffsetRef.current.x;
    const rawY = y - dragOffsetRef.current.y;
    const newX = snapVal(Math.max(0, Math.min(INTERNAL_W, rawX)), gridRef.current, snapRef.current);
    const newY = snapVal(Math.max(0, Math.min(INTERNAL_H, rawY)), gridRef.current, snapRef.current);
    const updated = objectsRef.current.map((obj) =>
      obj.id === selectedIdRef.current ? { ...obj, x: newX, y: newY } : obj
    );
    objectsRef.current = updated;
    onObjectsChange?.(updated);
  }, [getCanvasCoords, onObjectsChange]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // ─── ROBUST Touch handlers ───
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ts = touchStateRef.current;

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const { x, y } = getCanvasCoords(t.clientX, t.clientY);
      const hit = hitTestObject(x, y);

      if (hit) {
        ts.mode = 'drag';
        ts.id = hit.id;
        ts.dragOffsetX = x - hit.x;
        ts.dragOffsetY = y - hit.y;
        setSelectedId(hit.id);
        selectedIdRef.current = hit.id;
        isDraggingRef.current = true;
        onSelectionChange?.([hit]);
      } else {
        ts.mode = 'none';
        ts.id = null;
        setSelectedId(null);
        selectedIdRef.current = null;
        isDraggingRef.current = false;
        onSelectionChange?.([]);
      }
    } else if (e.touches.length === 2) {
      // Pinch — works on currently selected OR the object under the fingers
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;
      const { x: cx, y: cy } = getCanvasCoords(midX, midY);

      // Try to find object under pinch center, or use currently selected
      let targetId = selectedIdRef.current;
      const hitAtCenter = hitTestObject(cx, cy);
      if (hitAtCenter) targetId = hitAtCenter.id;

      if (targetId) {
        const sel = objectsRef.current.find(o => o.id === targetId);
        if (sel) {
          const startDist = dist2(t1.clientX, t1.clientY, t2.clientX, t2.clientY);
          const startAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
          ts.mode = 'pinch';
          ts.id = targetId;
          ts.startDist = startDist;
          ts.startRadius = sel.radius || 30;
          ts.startAngle = startAngle;
          ts.startRotation = (sel as any).rotation || 0;
          ts.centerX = cx;
          ts.centerY = cy;
          setSelectedId(targetId);
          selectedIdRef.current = targetId;
          isDraggingRef.current = false;
          onSelectionChange?.([sel]);
        }
      }
    }
  }, [getCanvasCoords, hitTestObject, onSelectionChange]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ts = touchStateRef.current;
    if (!ts.id) return;

    if (ts.mode === 'drag' && e.touches.length === 1) {
      const t = e.touches[0];
      const { x, y } = getCanvasCoords(t.clientX, t.clientY);
      const rawX = x - ts.dragOffsetX;
      const rawY = y - ts.dragOffsetY;
      const newX = snapVal(Math.max(0, Math.min(INTERNAL_W, rawX)), gridRef.current, snapRef.current);
      const newY = snapVal(Math.max(0, Math.min(INTERNAL_H, rawY)), gridRef.current, snapRef.current);
      const updated = objectsRef.current.map((obj) =>
        obj.id === ts.id ? { ...obj, x: newX, y: newY } : obj
      );
      objectsRef.current = updated;
      onObjectsChange?.(updated);

    } else if (ts.mode === 'pinch' && e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = dist2(t1.clientX, t1.clientY, t2.clientX, t2.clientY);
      const currentAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);

      const scale = currentDist / (ts.startDist || 1);
      const newR = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, ts.startRadius * scale));
      const deltaAngle = currentAngle - ts.startAngle;
      const newRotation = ts.startRotation + deltaAngle;

      const updated = objectsRef.current.map((obj) =>
        obj.id === ts.id
          ? { ...obj, radius: Math.round(newR), rotation: newRotation }
          : obj
      );
      objectsRef.current = updated;
      onObjectsChange?.(updated);
    }
  }, [getCanvasCoords, onObjectsChange]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ts = touchStateRef.current;
    if (e.touches.length === 0) {
      ts.mode = 'none';
      isDraggingRef.current = false;
    } else if (e.touches.length === 1 && ts.mode === 'pinch') {
      // Transition from pinch back to drag
      const t = e.touches[0];
      const { x, y } = getCanvasCoords(t.clientX, t.clientY);
      const sel = objectsRef.current.find(o => o.id === ts.id);
      if (sel) {
        ts.mode = 'drag';
        ts.dragOffsetX = x - sel.x;
        ts.dragOffsetY = y - sel.y;
        isDraggingRef.current = true;
      }
    }
  }, [getCanvasCoords]);

  // ─── Drag & drop from inventory ───
  const handleDragOver = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data?.type === "plant") {
        const newObj: SelectedObject = {
          id: `plant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: data.plantType || "plant",
          x: snapVal(x, gridRef.current, snapRef.current),
          y: snapVal(y, gridRef.current, snapRef.current),
          radius: 35,
          imageUrl: data.imageUrl,
          metadata: data.metadata || {},
        };
        const updated = [...objectsRef.current, newObj];
        objectsRef.current = updated;
        onObjectsChange?.(updated);
        setSelectedId(newObj.id);
        selectedIdRef.current = newObj.id;
        onSelectionChange?.([newObj]);
      }
    } catch (err) {
      console.error("[Canvas] Drop parse error:", err);
    }
  }, [getCanvasCoords, onObjectsChange, onSelectionChange]);

  // ─── Action toolbar handlers ───
  const selectedObject = useMemo(
    () => objects.find((o) => o.id === selectedId) || null,
    [objects, selectedId]
  );

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    const updated = objectsRef.current.filter((o) => o.id !== selectedId);
    objectsRef.current = updated;
    onObjectsChange?.(updated);
    setSelectedId(null);
    selectedIdRef.current = null;
    onSelectionChange?.([]);
  }, [selectedId, onObjectsChange, onSelectionChange]);

  const handleDuplicate = useCallback(() => {
    if (!selectedId) return;
    const sel = objectsRef.current.find((o) => o.id === selectedId);
    if (!sel) return;
    const copy: SelectedObject = {
      ...sel,
      id: `plant-${Date.now()}-copy`,
      x: Math.min(INTERNAL_W - 10, sel.x + 50),
      y: Math.min(INTERNAL_H - 10, sel.y + 50),
    };
    const updated = [...objectsRef.current, copy];
    objectsRef.current = updated;
    onObjectsChange?.(updated);
    setSelectedId(copy.id);
    selectedIdRef.current = copy.id;
    onSelectionChange?.([copy]);
  }, [selectedId, onObjectsChange, onSelectionChange]);

  const handleScaleChange = useCallback((newRadius: number) => {
    if (!selectedId) return;
    const updated = objectsRef.current.map((o) =>
      o.id === selectedId ? { ...o, radius: newRadius } : o
    );
    objectsRef.current = updated;
    onObjectsChange?.(updated);
  }, [selectedId, onObjectsChange]);

  const handleRotate = useCallback((deltaRad: number) => {
    if (!selectedId) return;
    const updated = objectsRef.current.map((o) =>
      o.id === selectedId ? { ...o, rotation: (((o as any).rotation || 0) + deltaRad) } : o
    );
    objectsRef.current = updated;
    onObjectsChange?.(updated);
  }, [selectedId, onObjectsChange]);

  // ─── Selected object screen position for toolbar ───
  // Toolbar is always fixed at the bottom of the canvas — never covers the plant
  const toolbarPos = useMemo(() => {
    if (!selectedObject) return null;
    return { bottom: 8 };
  }, [selectedObject]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[250px] relative select-none">
      {/* ─── Canvas ─── */}
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
        style={{ touchAction: "none", cursor: isDraggingRef.current ? "grabbing" : "crosshair" }}
      />

      {/* ─── Floating Action Toolbar — fixed at bottom, never covers plant ─── */}
      {selectedObject && toolbarPos && (
        <div
          className="absolute z-30 bg-white/97 backdrop-blur-sm rounded-2xl shadow-2xl border border-blue-200 px-3 py-2"
          style={{
            left: "50%",
            bottom: `${toolbarPos.bottom}px`,
            transform: "translateX(-50%)",
            pointerEvents: "auto",
            minWidth: "220px",
          }}
        >
          {/* Plant name */}
          <div className="text-center text-xs font-semibold text-gray-700 mb-2 truncate max-w-[200px]">
            {(selectedObject.metadata?.name as string) || selectedObject.type || "Planta"}
          </div>

          {/* Size slider */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-gray-500 w-8">Tam.</span>
            <input
              type="range"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              value={selectedObject.radius || 30}
              onChange={(e) => handleScaleChange(Number(e.target.value))}
              className="flex-1 h-4 accent-blue-500"
              style={{ touchAction: "none" }}
            />
            <span className="text-[10px] text-gray-500 w-8 text-right">{selectedObject.radius || 30}px</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 justify-center flex-wrap">
            {/* Scale down */}
            <button
              onPointerDown={(e) => { e.stopPropagation(); handleScaleChange(Math.max(MIN_RADIUS, (selectedObject.radius || 30) - 10)); }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 text-gray-700 text-xl font-bold"
              title="Reducir"
            >−</button>

            {/* Scale up */}
            <button
              onPointerDown={(e) => { e.stopPropagation(); handleScaleChange(Math.min(MAX_RADIUS, (selectedObject.radius || 30) + 10)); }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 text-gray-700 text-xl font-bold"
              title="Agrandar"
            >+</button>

            <div className="w-px h-7 bg-gray-200" />

            {/* Rotate Left */}
            <button
              onPointerDown={(e) => { e.stopPropagation(); handleRotate(-Math.PI / 12); }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-50 active:bg-amber-100 text-amber-700 text-lg"
              title="Girar izquierda 15°"
            >↺</button>

            {/* Rotate Right */}
            <button
              onPointerDown={(e) => { e.stopPropagation(); handleRotate(Math.PI / 12); }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-50 active:bg-amber-100 text-amber-700 text-lg"
              title="Girar derecha 15°"
            >↻</button>

            <div className="w-px h-7 bg-gray-200" />

            {/* Duplicate */}
            <button
              onPointerDown={(e) => { e.stopPropagation(); handleDuplicate(); }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 active:bg-blue-100 text-blue-600"
              title="Duplicar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            </button>

            {/* Delete */}
            <button
              onPointerDown={(e) => { e.stopPropagation(); handleDelete(); }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 active:bg-red-100 text-red-500"
              title="Eliminar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ─── Snap toggle ─── */}
      <div className="absolute top-2 right-2 z-20">
        <button
          onClick={() => setSnapEnabled(!snapEnabled)}
          className={`text-[10px] px-2 py-1 rounded-lg border font-medium transition-all shadow-sm ${
            snapEnabled
              ? "bg-blue-500 text-white border-blue-600"
              : "bg-white/80 text-gray-600 border-gray-300 hover:bg-white"
          }`}
        >
          {snapEnabled ? "⊞ Snap ON" : "⊞ Snap"}
        </button>
      </div>

      {/* ─── Bottom hint (only when nothing selected) ─── */}
      {!selectedObject && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none z-20">
          <div className="bg-black/45 text-white text-[10px] px-3 py-1.5 rounded-full shadow">
            Arrastra plantas al canvas · Toca para seleccionar
          </div>
        </div>
      )}
    </div>
  );
};
