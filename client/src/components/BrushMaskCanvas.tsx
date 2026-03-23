/**
 * BrushMaskCanvas — Professional brush-based mask painting tool
 * ============================================================================
 * Allows the user to paint over a terrain photo to mark areas for AI inpainting.
 * Features:
 *  - Adjustable brush size (8–120px)
 *  - Erase mode to remove painted areas
 *  - Undo/redo stack (up to 20 states)
 *  - Semi-transparent red overlay showing painted mask
 *  - Exports mask as base64 PNG for inpainting
 *  - Touch and mouse support
 */
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Eraser, Paintbrush, RotateCcw, Trash2 } from "lucide-react";

export interface BrushMaskCanvasHandle {
  /** Export the mask as a base64 PNG data URL (white = area to inpaint) */
  getMaskBase64: () => string | null;
  /** Check if any mask has been painted */
  hasMask: () => boolean;
  /** Clear the entire mask */
  clear: () => void;
  /** Paint AI obstacle bounding boxes onto the mask */
  paintObstacles: (
    obstacles: Array<{ x: number; y: number; width: number; height: number }>,
    coordSpace: "image" | "canvas800x600"
  ) => void;
}

interface BrushMaskCanvasProps {
  /** Background terrain photo as base64 or URL */
  backgroundImage: string;
  /** Called whenever the mask changes */
  onChange?: (hasMask: boolean) => void;
  /** Canvas internal width */
  width?: number;
  /** Canvas internal height */
  height?: number;
}

const INTERNAL_W = 800;
const INTERNAL_H = 600;
const MAX_HISTORY = 20;

export const BrushMaskCanvas = forwardRef<
  BrushMaskCanvasHandle,
  BrushMaskCanvasProps
>(({ backgroundImage, onChange, width = INTERNAL_W, height = INTERNAL_H }, ref) => {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [brushSize, setBrushSize] = useState(40);
  const [isEraseMode, setIsEraseMode] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // ─── Load background image ───
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas || !backgroundImage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
    };
    img.src = backgroundImage;
  }, [backgroundImage, width, height]);

  // ─── Save history snapshot ───
  const saveSnapshot = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const snapshot = ctx.getImageData(0, 0, width, height);
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(snapshot);
      return newHistory.slice(-MAX_HISTORY);
    });
    setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex, width, height]);

  // ─── Undo ───
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) {
      // Clear to empty
      const canvas = maskCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      setHistoryIndex(-1);
      setHistory([]);
      onChange?.(false);
      return;
    }
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
    onChange?.(true);
  }, [history, historyIndex, width, height, onChange]);

  // ─── Clear mask ───
  const handleClear = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    setHistory([]);
    setHistoryIndex(-1);
    onChange?.(false);
  }, [width, height, onChange]);

  // ─── Get canvas coordinates from client coordinates ───
  const getCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = maskCanvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [width, height]
  );

  // ─── Draw a stroke between two points ───
  const drawStroke = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const canvas = maskCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.save();
      if (isEraseMode) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "rgba(255, 50, 50, 0.85)";
      }
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
      onChange?.(true);
    },
    [brushSize, isEraseMode, onChange]
  );

  // ─── Mouse handlers ───
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setIsPainting(true);
      const pt = getCoords(e.clientX, e.clientY);
      lastPoint.current = pt;
      // Draw a dot at the starting point
      drawStroke(pt, pt);
    },
    [getCoords, drawStroke]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isPainting || !lastPoint.current) return;
      const pt = getCoords(e.clientX, e.clientY);
      drawStroke(lastPoint.current, pt);
      lastPoint.current = pt;
    },
    [isPainting, getCoords, drawStroke]
  );

  const handleMouseUp = useCallback(() => {
    if (isPainting) {
      setIsPainting(false);
      lastPoint.current = null;
      saveSnapshot();
    }
  }, [isPainting, saveSnapshot]);

  // ─── Touch handlers ───
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setIsPainting(true);
      const touch = e.touches[0];
      const pt = getCoords(touch.clientX, touch.clientY);
      lastPoint.current = pt;
      drawStroke(pt, pt);
    },
    [getCoords, drawStroke]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (!isPainting || !lastPoint.current) return;
      const touch = e.touches[0];
      const pt = getCoords(touch.clientX, touch.clientY);
      drawStroke(lastPoint.current, pt);
      lastPoint.current = pt;
    },
    [isPainting, getCoords, drawStroke]
  );

  const handleTouchEnd = useCallback(() => {
    if (isPainting) {
      setIsPainting(false);
      lastPoint.current = null;
      saveSnapshot();
    }
  }, [isPainting, saveSnapshot]);

  // ─── Expose handle methods ───
  useImperativeHandle(
    ref,
    () => ({
      getMaskBase64: () => {
        const maskCanvas = maskCanvasRef.current;
        if (!maskCanvas) return null;
        // Create a white-on-black mask for inpainting
        const offscreen = document.createElement("canvas");
        offscreen.width = width;
        offscreen.height = height;
        const ctx = offscreen.getContext("2d");
        if (!ctx) return null;
        // Black background
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);
        // Draw painted areas as white
        ctx.globalCompositeOperation = "source-over";
        const maskCtx = maskCanvas.getContext("2d");
        if (!maskCtx) return null;
        const maskData = maskCtx.getImageData(0, 0, width, height);
        const outData = ctx.getImageData(0, 0, width, height);
        for (let i = 0; i < maskData.data.length; i += 4) {
          const alpha = maskData.data[i + 3];
          if (alpha > 30) {
            outData.data[i] = 255;
            outData.data[i + 1] = 255;
            outData.data[i + 2] = 255;
            outData.data[i + 3] = 255;
          }
        }
        ctx.putImageData(outData, 0, 0);
        return offscreen.toDataURL("image/png");
      },

      hasMask: () => {
        const canvas = maskCanvasRef.current;
        if (!canvas) return false;
        const ctx = canvas.getContext("2d");
        if (!ctx) return false;
        const data = ctx.getImageData(0, 0, width, height).data;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 30) return true;
        }
        return false;
      },

      clear: handleClear,

      paintObstacles: (obstacles, coordSpace) => {
        const canvas = maskCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(255, 50, 50, 0.85)";
        obstacles.forEach((obs) => {
          let x = obs.x;
          let y = obs.y;
          let w = obs.width;
          let h = obs.height;
          if (coordSpace === "canvas800x600") {
            // coords are already in 800x600 space
            x = obs.x - obs.width / 2;
            y = obs.y - obs.height / 2;
            w = obs.width;
            h = obs.height;
          } else {
            // image space — scale to canvas
            x = (obs.x - obs.width / 2) * (width / (width));
            y = (obs.y - obs.height / 2) * (height / (height));
            w = obs.width;
            h = obs.height;
          }
          // Add 15% padding
          const padX = w * 0.15;
          const padY = h * 0.15;
          ctx.fillRect(
            Math.max(0, x - padX),
            Math.max(0, y - padY),
            Math.min(width - x + padX, w + padX * 2),
            Math.min(height - y + padY, h + padY * 2)
          );
        });
        ctx.restore();
        onChange?.(true);
        saveSnapshot();
      },
    }),
    [width, height, handleClear, onChange, saveSnapshot]
  );

  return (
    <div ref={containerRef} className="flex flex-col gap-2 w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap bg-white/90 backdrop-blur rounded-lg px-3 py-2 shadow border border-gray-200">
        {/* Mode toggle */}
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={!isEraseMode ? "default" : "outline"}
            onClick={() => setIsEraseMode(false)}
            className={`h-8 px-3 text-xs gap-1 ${!isEraseMode ? "bg-red-500 hover:bg-red-600 text-white" : ""}`}
          >
            <Paintbrush className="w-3 h-3" />
            Pincel
          </Button>
          <Button
            size="sm"
            variant={isEraseMode ? "default" : "outline"}
            onClick={() => setIsEraseMode(true)}
            className={`h-8 px-3 text-xs gap-1 ${isEraseMode ? "bg-gray-700 hover:bg-gray-800 text-white" : ""}`}
          >
            <Eraser className="w-3 h-3" />
            Borrador
          </Button>
        </div>

        {/* Brush size */}
        <div className="flex items-center gap-2 flex-1 min-w-[120px]">
          <span className="text-[10px] text-gray-500 whitespace-nowrap">Tamaño:</span>
          <Slider
            min={8}
            max={120}
            step={4}
            value={[brushSize]}
            onValueChange={([v]) => setBrushSize(v)}
            className="flex-1"
          />
          <span className="text-[10px] text-gray-600 w-6 text-right">{brushSize}</span>
        </div>

        {/* Undo & Clear */}
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={handleUndo}
            disabled={historyIndex < 0}
            className="h-8 px-2 text-xs gap-1"
            title="Deshacer"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleClear}
            className="h-8 px-2 text-xs gap-1 text-red-500 hover:text-red-700"
            title="Limpiar máscara"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Canvas stack */}
      <div className="relative w-full rounded-lg overflow-hidden shadow-md border border-gray-300"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {/* Background photo */}
        <canvas
          ref={bgCanvasRef}
          width={width}
          height={height}
          className="absolute inset-0 w-full h-full"
        />
        {/* Mask overlay (transparent red brush strokes) */}
        <canvas
          ref={maskCanvasRef}
          width={width}
          height={height}
          className="absolute inset-0 w-full h-full"
          style={{
            cursor: isEraseMode
              ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${Math.max(12, brushSize / 4)}' height='${Math.max(12, brushSize / 4)}' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='none' stroke='%23666' stroke-width='2'/%3E%3C/svg%3E") ${Math.max(6, brushSize / 8)} ${Math.max(6, brushSize / 8)}, crosshair`
              : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${Math.max(12, brushSize / 4)}' height='${Math.max(12, brushSize / 4)}' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='rgba(255,50,50,0.5)' stroke='%23ff3232' stroke-width='2'/%3E%3C/svg%3E") ${Math.max(6, brushSize / 8)} ${Math.max(6, brushSize / 8)}, crosshair`,
            touchAction: "none",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        {/* Brush size preview circle (shown when not painting) */}
        {!isPainting && (
          <div className="absolute bottom-2 right-2 pointer-events-none">
            <div
              className={`rounded-full border-2 ${isEraseMode ? "border-gray-500 bg-gray-200/50" : "border-red-500 bg-red-400/40"}`}
              style={{
                width: Math.max(8, brushSize / 4),
                height: Math.max(8, brushSize / 4),
              }}
            />
          </div>
        )}
      </div>

      {/* Hint */}
      <p className="text-[10px] text-gray-400 text-center">
        Pinta en rojo las áreas a limpiar · Usa el borrador para corregir · La IA borrará solo las áreas pintadas
      </p>
    </div>
  );
});

BrushMaskCanvas.displayName = "BrushMaskCanvas";
