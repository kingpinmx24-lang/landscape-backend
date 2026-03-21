/**
 * ============================================================================
 * EDITOR CANVAS COMPONENT
 * ============================================================================
 * Professional landscape design editor with transformation tools
 */

import React, { useRef, useState, useCallback, useEffect } from "react";
import type { EditorConfig } from "@shared/editor-types";
import { EditorTool, TransformMode } from "@shared/editor-types";
import {
  moveObject,
  rotateObject,
  scaleObject,
  snapToGrid,
  calculateDistance,
  calculateAngle,
  normalizeAngle,
  isPointInRect,
  getTransformCenter,
} from "@shared/editor-transform";
import type { UseEditorStateReturn } from "@/hooks/useEditorState";
import { useEditorState } from "@/hooks/useEditorState";

interface EditorCanvasProps {
  config?: Partial<EditorConfig>;
  onObjectsChange?: (changes: any) => void;
  onToolChange?: (tool: EditorTool) => void;
  fullscreen?: boolean;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  config,
  onObjectsChange,
  onToolChange,
  fullscreen = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorState = useEditorState(config);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [lastMousePos, setLastMousePos] = useState<{ x: number; y: number } | null>(null);

  // Configuración por defecto
  const editorConfig: EditorConfig = {
    gridSize: 0.5,
    snapDistance: 10,
    showGrid: true,
    showMeasures: true,
    showGuides: true,
    precision: 2,
    minScale: 0.1,
    maxScale: 10,
    rotationStep: 15,
    moveStep: 0.1,
    scaleStep: 0.1,
    enableUndo: true,
    maxHistorySize: 100,
    theme: "light",
    ...config,
  };

  /**
   * Dibujar grid
   */
  const drawGrid = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!editorState.state.snap.showGrid) return;

      const gridSize = editorState.state.snap.gridSize * 50; // Escala para visualización
      ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
      ctx.lineWidth = 1;

      // Líneas verticales
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Líneas horizontales
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    },
    [editorState.state.snap.showGrid, editorState.state.snap.gridSize]
  );

  /**
   * Dibujar medidas
   */
  const drawMeasures = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!editorConfig.showMeasures) return;

    ctx.font = "12px monospace";
    ctx.fillStyle = "#666";
    ctx.textAlign = "center";

    editorState.state.measures.forEach((measure) => {
      if (!measure.visible) return;

      // Dibujar línea de medida
      if (measure.points.length >= 2) {
        const p1 = measure.points[0];
        const p2 = measure.points[1];

        ctx.strokeStyle = "#4dabf7";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(p1.x * 50, p1.y * 50);
        ctx.lineTo(p2.x * 50, p2.y * 50);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dibujar etiqueta
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        ctx.fillText(
          `${measure.value.toFixed(editorConfig.precision)} ${measure.unit}`,
          midX * 50,
          midY * 50 - 10
        );
      }
    });
  }, [editorState.state.measures, editorConfig.showMeasures, editorConfig.precision]);

  /**
   * Dibujar guías
   */
  const drawGuides = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!editorConfig.showGuides) return;

    editorState.state.guides.forEach((guide) => {
      if (!guide.visible) return;

      ctx.strokeStyle = guide.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      if (guide.type === "vertical") {
        const x = guide.position * 50;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      } else {
        const y = guide.position * 50;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    });
  }, [editorState.state.guides, editorConfig.showGuides]);

  /**
   * Renderizar frame
   */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Limpiar canvas
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);

    // Dibujar grid
    drawGrid(ctx, width, height);

    // Dibujar guías
    drawGuides(ctx, width, height);

    // Dibujar medidas
    drawMeasures(ctx);

    // Dibujar información de herramienta actual
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#666";
    ctx.fillText(`Tool: ${editorState.state.currentTool}`, 10, 20);
    ctx.fillText(`Selected: ${editorState.state.selectedObjects.size}`, 10, 35);
  }, [drawGrid, drawGuides, drawMeasures, editorState.state.currentTool, editorState.state.selectedObjects.size]);

  /**
   * Manejar clic en canvas
   */
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Lógica según herramienta actual
      switch (editorState.state.currentTool) {
        case EditorTool.SELECT:
          // Seleccionar objeto
          if (e.ctrlKey || e.metaKey) {
            // Multi-selección
          } else {
            editorState.clearSelection();
          }
          break;

        case EditorTool.MEASURE:
          // Agregar punto de medida
          break;

        case EditorTool.DELETE:
          // Eliminar objeto seleccionado
          break;

        default:
          break;
      }
    },
    [editorState]
  );

  /**
   * Manejar movimiento del ratón
   */
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setLastMousePos({ x, y });

      if (isDragging && dragStart) {
        const deltaX = x - dragStart.x;
        const deltaY = y - dragStart.y;

        // Aplicar transformación según herramienta
        switch (editorState.state.currentTool) {
          case EditorTool.MOVE:
            editorState.setTransformMode(TransformMode.MOVING);
            break;

          case EditorTool.ROTATE:
            editorState.setTransformMode(TransformMode.ROTATING);
            break;

          case EditorTool.SCALE:
            editorState.setTransformMode(TransformMode.SCALING);
            break;

          default:
            break;
        }
      }
    },
    [isDragging, dragStart, editorState]
  );

  /**
   * Manejar mouse down
   */
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  /**
   * Manejar mouse up
   */
  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
    editorState.setTransformMode(TransformMode.NONE);
  }, [editorState]);

  /**
   * Manejar rueda del ratón (zoom)
   */
  const handleCanvasWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // Implementar zoom
  }, []);

  /**
   * Manejar teclas
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Delete":
        case "Backspace":
          // Eliminar objetos seleccionados
          editorState.state.selectedObjects.forEach((id) => {
            // Eliminar
          });
          break;

        case "z":
          if (e.ctrlKey || e.metaKey) {
            if (e.shiftKey) {
              editorState.redo();
            } else {
              editorState.undo();
            }
          }
          break;

        case "1":
          editorState.setTool(EditorTool.SELECT);
          break;

        case "2":
          editorState.setTool(EditorTool.MOVE);
          break;

        case "3":
          editorState.setTool(EditorTool.ROTATE);
          break;

        case "4":
          editorState.setTool(EditorTool.SCALE);
          break;

        case "5":
          editorState.setTool(EditorTool.DELETE);
          break;

        case "6":
          editorState.setTool(EditorTool.MEASURE);
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorState]);

  /**
   * Loop de renderizado
   */
  useEffect(() => {
    const animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [render]);

  /**
   * Manejar resize
   */
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      style={{
        width: fullscreen ? "100vw" : "100%",
        height: fullscreen ? "100vh" : "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseDown={handleCanvasMouseDown}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleCanvasWheel}
        style={{
          flex: 1,
          display: "block",
          cursor: "crosshair",
          touchAction: "none",
          backgroundColor: "#fff",
        }}
      />

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "12px",
          backgroundColor: "#f5f5f5",
          borderTop: "1px solid #ddd",
          flexWrap: "wrap",
        }}
      >
        {Object.values(EditorTool).map((tool) => (
          <button
            key={tool}
            onClick={() => editorState.setTool(tool as EditorTool)}
            style={{
              padding: "8px 12px",
              backgroundColor:
                editorState.state.currentTool === tool ? "#4dabf7" : "#fff",
              color: editorState.state.currentTool === tool ? "#fff" : "#000",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: editorState.state.currentTool === tool ? "600" : "400",
            }}
          >
            {tool.toUpperCase()}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Snap toggle */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
          }}
        >
          <input
            type="checkbox"
            checked={editorState.state.snap.snapToGrid}
            onChange={(e) =>
              editorState.updateSnap({ snapToGrid: e.target.checked })
            }
          />
          Snap to Grid
        </label>

        {/* Grid toggle */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
          }}
        >
          <input
            type="checkbox"
            checked={editorState.state.snap.showGrid}
            onChange={(e) =>
              editorState.updateSnap({ showGrid: e.target.checked })
            }
          />
          Show Grid
        </label>
      </div>
    </div>
  );
};

export default EditorCanvas;
