/**
 * ============================================================================
 * DESIGN CANVAS COMPONENT
 * ============================================================================
 * Realistic plant visualization with PNG images, shadows, and BEFORE/AFTER mode
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import type {
  RenderConfig,
  BeforeAfterConfig,
  PlantRenderInfo,
  ScaleConfig,
  ViewportInfo,
  RenderStats,
  IPadOptimization,
} from "@shared/visualization-types";
import {
  createScaleConfig,
  transformPosition,
  metersToPixels,
  applyZoom,
  applyPan,
  constrainOffset,
  calculateFitZoom,
  getViewportInfo,
  calculateCanvasDimensions,
  calculatePlantBounds,
  isPointInCircle,
  calculateDistance,
} from "@shared/visualization-utils";

interface DesignCanvasProps {
  config: RenderConfig;
  beforeAfterConfig?: BeforeAfterConfig;
  onPlantSelect?: (plantId: string) => void;
  onInteraction?: (type: string, data: any) => void;
  fullscreen?: boolean;
  optimizeForIPad?: boolean;
}

export const DesignCanvas: React.FC<DesignCanvasProps> = ({
  config,
  beforeAfterConfig,
  onPlantSelect,
  onInteraction,
  fullscreen = false,
  optimizeForIPad = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState<ScaleConfig>(config.scale);
  const [stats, setStats] = useState<RenderStats>({
    fps: 0,
    frameTime: 0,
    plantCount: 0,
    imagesCached: 0,
    memoryUsage: 0,
    lastRenderTime: 0,
  });
  const [selectedPlants, setSelectedPlants] = useState<Set<string>>(new Set());
  const [hoveredPlant, setHoveredPlant] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<ViewportInfo | null>(null);

  // Refs para animación
  const animationFrameRef = useRef<number | undefined>(undefined);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const lastFrameTimeRef = useRef<number>(Date.now());
  const fpsCounterRef = useRef<number>(0);

  /**
   * Cargar imagen de planta
   */
  const loadPlantImage = useCallback(
    async (url: string): Promise<HTMLImageElement | null> => {
      // Verificar caché
      if (imageCache.current.has(url)) {
        return imageCache.current.get(url) || null;
      }

      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          imageCache.current.set(url, img);
          resolve(img);
        };
        img.onerror = () => {
          console.error(`Failed to load image: ${url}`);
          resolve(null);
        };
        img.src = url;
      });
    },
    []
  );

  /**
   * Dibujar sombra de planta
   */
  const drawPlantShadow = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      plant: PlantRenderInfo,
      bounds: { x: number; y: number; width: number; height: number }
    ) => {
      if (!config.showShadows) return;

      const shadow = plant.shadow;
      ctx.save();

      // Configurar sombra
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur;
      ctx.shadowOffsetX = shadow.offsetX;
      ctx.shadowOffsetY = shadow.offsetY;

      // Dibujar rectángulo para generar sombra
      ctx.fillStyle = "rgba(0, 0, 0, 0)";
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

      ctx.restore();
    },
    [config.showShadows]
  );

  /**
   * Dibujar planta
   */
  const drawPlant = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      plant: PlantRenderInfo,
      image: HTMLImageElement | null
    ) => {
      if (!image) return;

      const bounds = calculatePlantBounds(plant, scale);
      const isSelected = selectedPlants.has(plant.id);
      const isHovered = hoveredPlant === plant.id;

      // Dibujar sombra
      drawPlantShadow(ctx, plant, bounds);

      ctx.save();

      // Aplicar transformaciones
      ctx.globalAlpha = plant.opacity;
      ctx.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      ctx.rotate((plant.rotation * Math.PI) / 180);
      ctx.translate(-bounds.width / 2, -bounds.height / 2);

      // Dibujar imagen
      ctx.drawImage(image, 0, 0, bounds.width, bounds.height);

      // Dibujar borde si está seleccionada
      if (isSelected) {
        ctx.strokeStyle = "#ff6b6b";
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, bounds.width, bounds.height);
      }

      // Dibujar borde si está resaltada
      if (isHovered) {
        ctx.strokeStyle = "#4dabf7";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, bounds.width, bounds.height);
      }

      ctx.restore();

      // Dibujar etiqueta si está habilitada
      if (config.showLabels) {
        ctx.save();
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.fillText(plant.id, bounds.x + bounds.width / 2, bounds.y - 5);
        ctx.restore();
      }
    },
    [scale, selectedPlants, hoveredPlant, config.showLabels, drawPlantShadow]
  );

  /**
   * Dibujar terreno
   */
  const drawTerrain = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const terrain = config.terrain;

      // Dibujar fondo
      ctx.fillStyle = terrain.backgroundColor;
      ctx.fillRect(0, 0, scale.canvasWidth, scale.canvasHeight);

      // Dibujar zonas
      terrain.zones.forEach((zone) => {
        ctx.save();
        ctx.fillStyle = zone.color;
        ctx.beginPath();

        zone.polygon.forEach((point, index) => {
          const pos = transformPosition(point.x, point.y, scale);
          if (index === 0) {
            ctx.moveTo(pos.screenX, pos.screenY);
          } else {
            ctx.lineTo(pos.screenX, pos.screenY);
          }
        });

        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });

      // Dibujar grid
      if (config.showGrid && terrain.gridVisible) {
        ctx.save();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.lineWidth = 1;

        const gridSpacingPixels = metersToPixels(terrain.gridSpacing, scale);
        const startX = Math.floor(scale.offsetX / gridSpacingPixels) * gridSpacingPixels;
        const startY = Math.floor(scale.offsetY / gridSpacingPixels) * gridSpacingPixels;

        // Líneas verticales
        for (let x = startX; x < scale.canvasWidth; x += gridSpacingPixels) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, scale.canvasHeight);
          ctx.stroke();
        }

        // Líneas horizontales
        for (let y = startY; y < scale.canvasHeight; y += gridSpacingPixels) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(scale.canvasWidth, y);
          ctx.stroke();
        }

        ctx.restore();
      }
    },
    [config, scale]
  );

  /**
   * Renderizar frame
   */
  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startTime = performance.now();

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar terreno
    drawTerrain(ctx);

    // Cargar y dibujar plantas
    const plantsByZIndex = [...config.plants].sort((a, b) => a.zIndex - b.zIndex);

    for (const plant of plantsByZIndex) {
      const image = await loadPlantImage(plant.image.url);
      drawPlant(ctx, plant, image);
    }

    // Calcular estadísticas
    const frameTime = performance.now() - startTime;
    fpsCounterRef.current++;

    setStats((prev) => ({
      ...prev,
      frameTime,
      plantCount: config.plants.length,
      imagesCached: imageCache.current.size,
      lastRenderTime: frameTime,
    }));
  }, [config, drawTerrain, drawPlant, loadPlantImage]);

  /**
   * Loop de animación
   */
  const animate = useCallback(() => {
    render();
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [render]);

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

      // Buscar planta bajo el clic
      for (let i = config.plants.length - 1; i >= 0; i--) {
        const plant = config.plants[i];
        const bounds = calculatePlantBounds(plant, scale);

        if (
          x >= bounds.x &&
          x <= bounds.x + bounds.width &&
          y >= bounds.y &&
          y <= bounds.y + bounds.height
        ) {
          if (e.ctrlKey || e.metaKey) {
            // Multi-selección
            setSelectedPlants((prev) => {
              const newSet = new Set(prev);
              if (newSet.has(plant.id)) {
                newSet.delete(plant.id);
              } else {
                newSet.add(plant.id);
              }
              return newSet;
            });
          } else {
            // Selección simple
            setSelectedPlants(new Set([plant.id]));
          }

          onPlantSelect?.(plant.id);
          onInteraction?.("select", { plantId: plant.id });
          return;
        }
      }

      // Deseleccionar si no se hizo clic en ninguna planta
      setSelectedPlants(new Set());
    },
    [config.plants, scale, onPlantSelect, onInteraction]
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

      // Si está arrastrando, hacer pan
      if (isDragging && dragStart) {
        const deltaX = x - dragStart.x;
        const deltaY = y - dragStart.y;

        setScale((prev) => constrainOffset(applyPan(prev, deltaX, deltaY)));
        setDragStart({ x, y });
        onInteraction?.("pan", { deltaX, deltaY });
        return;
      }

      // Buscar planta bajo el ratón
      let hoveredId: string | null = null;
      for (let i = config.plants.length - 1; i >= 0; i--) {
        const plant = config.plants[i];
        const bounds = calculatePlantBounds(plant, scale);

        if (
          x >= bounds.x &&
          x <= bounds.x + bounds.width &&
          y >= bounds.y &&
          y <= bounds.y + bounds.height
        ) {
          hoveredId = plant.id;
          break;
        }
      }

      setHoveredPlant(hoveredId);
      canvas.style.cursor = hoveredId ? "pointer" : "grab";
    },
    [isDragging, dragStart, config.plants, scale, onInteraction]
  );

  /**
   * Manejar rueda del ratón (zoom)
   */
  const handleCanvasWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const centerX = e.clientX - rect.left;
      const centerY = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((prev) => applyZoom(prev, zoomFactor, centerX, centerY));

      onInteraction?.("zoom", { zoomFactor });
    },
    []
  );

  /**
   * Manejar mouse down
   */
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    },
    []
  );

  /**
   * Manejar mouse up
   */
  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  /**
   * Manejar resize
   */
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const newViewport = getViewportInfo(canvas);
      if (newViewport) {
        setViewport(newViewport);
      }

      // Actualizar dimensiones del canvas
      if (optimizeForIPad) {
        const dims = calculateCanvasDimensions(
          newViewport.width,
          newViewport.height,
          newViewport.devicePixelRatio
        );
        canvas.width = dims.width;
        canvas.height = dims.height;
        canvas.style.width = `${newViewport.width}px`;
        canvas.style.height = `${newViewport.height}px`;
      } else {
        canvas.width = newViewport.width;
        canvas.height = newViewport.height;
      }

      // Ajustar escala
      setScale((prev) => ({
        ...prev,
        canvasWidth: newViewport.width,
        canvasHeight: newViewport.height,
      }));
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, [optimizeForIPad]);

  /**
   * Iniciar animación
   */
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate]);

  return (
    <div
      style={{
        width: fullscreen ? "100vw" : "100%",
        height: fullscreen ? "100vh" : "100%",
        overflow: "hidden",
        backgroundColor: "#f5f5f5",
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
          display: "block",
          width: "100%",
          height: "100%",
          cursor: "grab",
          touchAction: "none",
        }}
      />

      {/* Mostrar estadísticas en modo debug */}
      {process.env.NODE_ENV === "development" && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            color: "#fff",
            padding: "10px",
            fontSize: "12px",
            fontFamily: "monospace",
            borderRadius: "4px",
          }}
        >
          <div>FPS: {stats.fps.toFixed(1)}</div>
          <div>Frame: {stats.frameTime.toFixed(1)}ms</div>
          <div>Plants: {stats.plantCount}</div>
          <div>Cache: {stats.imagesCached}</div>
        </div>
      )}
    </div>
  );
};

export default DesignCanvas;
