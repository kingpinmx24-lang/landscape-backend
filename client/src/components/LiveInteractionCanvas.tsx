/**
 * Component: LiveInteractionCanvas
 * ============================================================================
 * Canvas para interacción en vivo con selección y movimiento de objetos
 */

import React, { useRef, useEffect, useCallback, useState } from "react";
import { useLiveInteraction } from "@/hooks/useLiveInteraction";
import { SelectedObject, MoveData } from "../../../shared/live-interaction-types";

interface LiveInteractionCanvasProps {
  width: number;
  height: number;
  objects: SelectedObject[];
  onObjectsChange?: (objects: SelectedObject[]) => void;
  onSelectionChange?: (selected: SelectedObject[]) => void;
  gridSize?: number;
  snapToGrid?: boolean;
  respectCollisions?: boolean;
  onError?: (error: string) => void;
}

/**
 * Componente LiveInteractionCanvas
 */
export const LiveInteractionCanvas: React.FC<LiveInteractionCanvasProps> = ({
  width,
  height,
  objects,
  onObjectsChange,
  onSelectionChange,
  gridSize = 20,
  snapToGrid = true,
  respectCollisions = true,
  onError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    state,
    selectObject,
    deselectAll,
    startDrag,
    updateDrag,
    endDrag,
    moveObject,
    showFloatingControls,
    hideFloatingControls,
  } = useLiveInteraction({
    gridSize,
    snapToGrid,
    respectCollisions,
  });

  const [currentObjects, setCurrentObjects] = useState<SelectedObject[]>(objects);
  const draggedObjectRef = useRef<SelectedObject | null>(null);

  /**
   * Actualizar objetos cuando cambian las props
   */
  useEffect(() => {
    setCurrentObjects(objects);
  }, [objects]);

  /**
   * Notificar cambios de selección
   */
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(state.selectedObjects);
    }
  }, [state.selectedObjects, onSelectionChange]);

  /**
   * Notificar cambios de objetos
   */
  useEffect(() => {
    if (onObjectsChange) {
      onObjectsChange(currentObjects);
    }
  }, [currentObjects, onObjectsChange]);

  /**
   * Encontrar objeto en posición
   */
  const getObjectAtPosition = useCallback(
    (x: number, y: number): SelectedObject | null => {
      for (let i = currentObjects.length - 1; i >= 0; i--) {
        const obj = currentObjects[i];
        const distance = Math.sqrt((x - obj.x) ** 2 + (y - obj.y) ** 2);
        if (distance <= obj.radius) {
          return obj;
        }
      }
      return null;
    },
    [currentObjects]
  );

  /**
   * Aplicar snap a grid
   */
  const snapToGridValue = useCallback(
    (value: number): number => {
      if (!snapToGrid) return value;
      return Math.round(value / gridSize) * gridSize;
    },
    [snapToGrid, gridSize]
  );

  /**
   * Manejar click en canvas
   */
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const clickedObject = getObjectAtPosition(x, y);

      if (clickedObject) {
        selectObject(clickedObject);
        showFloatingControls(x, y);
      } else {
        deselectAll();
        hideFloatingControls();
      }
    },
    [getObjectAtPosition, selectObject, deselectAll, showFloatingControls, hideFloatingControls]
  );

  /**
   * Manejar mouse down para iniciar arrastre
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const clickedObject = getObjectAtPosition(x, y);

      if (clickedObject && state.selectedObjects.some((obj) => obj.id === clickedObject.id)) {
        draggedObjectRef.current = clickedObject;
        startDrag(x, y);
      }
    },
    [getObjectAtPosition, state.selectedObjects, startDrag]
  );

  /**
   * Manejar mouse move para arrastre
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (!state.isDragging || !draggedObjectRef.current) {
        // Cambiar cursor si está sobre un objeto
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (getObjectAtPosition(x, y)) {
          canvas.style.cursor = "grab";
        } else {
          canvas.style.cursor = "default";
        }
        return;
      }

      canvas.style.cursor = "grabbing";

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      updateDrag(x, y);

      // Actualizar posición del objeto en tiempo real
      if (state.dragOffsetX !== undefined && state.dragOffsetY !== undefined) {
        const newX = draggedObjectRef.current.x + state.dragOffsetX;
        const newY = draggedObjectRef.current.y + state.dragOffsetY;

        const snappedX = snapToGridValue(newX);
        const snappedY = snapToGridValue(newY);

        // Validar límites
        if (snappedX >= 0 && snappedX <= width && snappedY >= 0 && snappedY <= height) {
          setCurrentObjects((prev) =>
            prev.map((obj) =>
              obj.id === draggedObjectRef.current!.id
                ? { ...obj, x: snappedX, y: snappedY }
                : obj
            )
          );
        }
      }
    },
    [state.isDragging, state.dragOffsetX, state.dragOffsetY, getObjectAtPosition, updateDrag, snapToGridValue, width, height]
  );

  /**
   * Manejar mouse up para finalizar arrastre
   */
  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!state.isDragging || !draggedObjectRef.current) return;

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = "default";
      }

      const movedObject = draggedObjectRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (!rect) return;

      const finalX = e.clientX - rect.left;
      const finalY = e.clientY - rect.top;

      const snappedX = snapToGridValue(finalX);
      const snappedY = snapToGridValue(finalY);

      // Registrar movimiento
      moveObject({
        objectId: movedObject.id,
        fromX: movedObject.x,
        fromY: movedObject.y,
        toX: snappedX,
        toY: snappedY,
        snappedToGrid: snapToGrid,
      } as MoveData);

      endDrag();
      draggedObjectRef.current = null;
    },
    [state.isDragging, moveObject, endDrag, snapToGridValue, snapToGrid]
  );

  /**
   * Renderizar canvas
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Limpiar canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Dibujar grid
    if (snapToGrid) {
      ctx.strokeStyle = "#f0f0f0";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Dibujar objetos
    currentObjects.forEach((obj) => {
      const isSelected = state.selectedObjects.some((s) => s.id === obj.id);

      // Si tiene imagen, renderizar imagen
      if (obj.imageUrl) {
        const img = new Image();
        img.src = obj.imageUrl;
        // Dibujar imagen circular (asumiendo que ya está cargada o se cargará)
        ctx.save();
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
        ctx.clip();
        try {
          ctx.drawImage(
            img,
            obj.x - obj.radius,
            obj.y - obj.radius,
            obj.radius * 2,
            obj.radius * 2
          );
        } catch (e) {
          // Fallback si la imagen no carga
          ctx.fillStyle = isSelected ? "#FF6B6B" : "#4ECDC4";
          ctx.fill();
        }
        ctx.restore();
      } else {
        // Dibujar círculo de color si no tiene imagen
        ctx.fillStyle = isSelected ? "#FF6B6B" : "#4ECDC4";
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dibujar bounding box si está seleccionado
      if (isSelected) {
        ctx.strokeStyle = "#FF6B6B";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Dibujar handles
        const handleSize = 8;
        ctx.fillStyle = "#FF6B6B";
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
          const hx = obj.x + Math.cos(angle) * obj.radius;
          const hy = obj.y + Math.sin(angle) * obj.radius;
          ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        }
      }

      // Dibujar etiqueta
      ctx.fillStyle = "#000000";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
      ctx.shadowBlur = 3;
      ctx.fillText(obj.type.substring(0, 3).toUpperCase(), obj.x, obj.y);
    });
  }, [currentObjects, state.selectedObjects, width, height, gridSize, snapToGrid]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="border border-gray-300 rounded-lg cursor-default bg-white"
        style={{ display: "block" }}
      />
      {state.error && (
        <div className="mt-2 p-2 bg-red-100 text-red-700 rounded text-sm">
          {state.error}
        </div>
      )}
    </div>
  );
};
