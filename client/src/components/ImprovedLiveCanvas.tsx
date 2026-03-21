/*
 * Component: ImprovedLiveCanvas
 * ============================================================================
 * Canvas mejorado con arrastrar de imágenes, selección, y detector de terreno
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { SelectedObject } from "../../../shared/live-interaction-types";
import { analyzeTerrainImage, TerrainAnalysis } from "../../../shared/terrain-detection";

interface ImprovedLiveCanvasProps {
  width: number;
  height: number;
  backgroundImage?: string;
  objects: SelectedObject[];
  onObjectsChange?: (objects: SelectedObject[]) => void;
  onTerrainAnalysis?: (analysis: TerrainAnalysis) => void;
  gridSize?: number;
  snapToGrid?: boolean;
}

export const ImprovedLiveCanvas: React.FC<ImprovedLiveCanvasProps> = ({
  width,
  height,
  backgroundImage,
  objects,
  onObjectsChange,
  onTerrainAnalysis,
  gridSize = 20,
  snapToGrid = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentObjects, setCurrentObjects] = useState<SelectedObject[]>(objects);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [backgroundImg, setBackgroundImg] = useState<HTMLImageElement | null>(null);
  const [imageCache, setImageCache] = useState<Map<string, HTMLImageElement>>(
    new Map()
  );

  // Cargar imagen de fondo
  useEffect(() => {
    if (backgroundImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setBackgroundImg(img);

        // Analizar terreno
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const analysis = analyzeTerrainImage(imageData);
          if (onTerrainAnalysis) {
            onTerrainAnalysis(analysis);
          }
        }
      };
      img.src = backgroundImage;
    }
  }, [backgroundImage, onTerrainAnalysis]);

  // Precargar imágenes de objetos
  useEffect(() => {
    const newCache = new Map(imageCache);
    currentObjects.forEach((obj) => {
      if (obj.imageUrl && !newCache.has(obj.imageUrl)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          newCache.set(obj.imageUrl!, img);
          setImageCache(new Map(newCache));
        };
        img.src = obj.imageUrl;
      }
    });
  }, [currentObjects, imageCache]);

  // Encontrar objeto en posición
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

  // Aplicar snap a grid
  const snapToGridValue = useCallback(
    (value: number): number => {
      if (!snapToGrid) return value;
      return Math.round(value / gridSize) * gridSize;
    },
    [snapToGrid, gridSize]
  );

  // Manejar mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const obj = getObjectAtPosition(x, y);
      if (obj) {
        setSelectedObjectId(obj.id);
        setIsDragging(true);
        setDragStart({ x, y });
        canvas.style.cursor = "grabbing";
      }
    },
    [getObjectAtPosition]
  );

  // Manejar mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (isDragging && dragStart && selectedObjectId) {
        const deltaX = x - dragStart.x;
        const deltaY = y - dragStart.y;

        setCurrentObjects((prev) =>
          prev.map((obj) => {
            if (obj.id === selectedObjectId) {
              const newX = snapToGridValue(obj.x + deltaX);
              const newY = snapToGridValue(obj.y + deltaY);

              // Validar límites
              if (newX >= obj.radius && newX <= width - obj.radius &&
                  newY >= obj.radius && newY <= height - obj.radius) {
                return { ...obj, x: newX, y: newY };
              }
            }
            return obj;
          })
        );

        setDragStart({ x, y });
      } else {
        // Cambiar cursor si está sobre un objeto
        if (getObjectAtPosition(x, y)) {
          canvas.style.cursor = "grab";
        } else {
          canvas.style.cursor = "default";
        }
      }
    },
    [isDragging, dragStart, selectedObjectId, snapToGridValue, width, height, getObjectAtPosition]
  );

  // Manejar mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = "default";
    }
  }, []);

  // Manejar clic
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDragging) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const obj = getObjectAtPosition(x, y);
      if (obj) {
        setSelectedObjectId(obj.id);
      } else {
        setSelectedObjectId(null);
      }
    },
    [isDragging, getObjectAtPosition]
  );

  // Manejar drag over
  const handleDragOver = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // Manejar drop
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      try {
        const data = e.dataTransfer.getData("application/json");
        if (!data) return;

        const plantData = JSON.parse(data);
        if (plantData.type !== "plant") return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = snapToGridValue(e.clientX - rect.left);
        const y = snapToGridValue(e.clientY - rect.top);

        const radius = 30;
        if (x >= radius && x <= width - radius && y >= radius && y <= height - radius) {
          const newObject: SelectedObject = {
            id: `plant-${Date.now()}`,
            x,
            y,
            radius,
            type: "plant",
            imageUrl: plantData.imageUrl,
            metadata: {
              price: plantData.price,
              inventoryId: plantData.id,
              name: plantData.name,
            },
          };

          const updatedObjects = [...currentObjects, newObject];
          setCurrentObjects(updatedObjects);
          setSelectedObjectId(newObject.id);

          if (onObjectsChange) {
            onObjectsChange(updatedObjects);
          }
        }
      } catch (error) {
        console.error("Error al procesar drop:", error);
      }
    },
    [currentObjects, snapToGridValue, width, height, onObjectsChange]
  );

  // Renderizar canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Limpiar canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Dibujar imagen de fondo
    if (backgroundImg) {
      ctx.drawImage(backgroundImg, 0, 0, width, height);
    }

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
      const isSelected = selectedObjectId === obj.id;

      if (obj.imageUrl && imageCache.has(obj.imageUrl)) {
        const img = imageCache.get(obj.imageUrl)!;
        ctx.save();
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(
          img,
          obj.x - obj.radius,
          obj.y - obj.radius,
          obj.radius * 2,
          obj.radius * 2
        );
        ctx.restore();
      } else {
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
  }, [currentObjects, selectedObjectId, backgroundImg, imageCache, width, height, gridSize, snapToGrid]);

  // Notificar cambios
  useEffect(() => {
    if (onObjectsChange) {
      onObjectsChange(currentObjects);
    }
  }, [currentObjects, onObjectsChange]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="border-2 border-dashed border-gray-300 rounded-lg cursor-default bg-white"
      style={{ touchAction: "none" }}
    />
  );
};
