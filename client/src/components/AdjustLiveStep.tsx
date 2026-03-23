/**
 * Component: AdjustLiveStep
 * ============================================================================
 * PRODUCTION VERSION
 *
 * Features:
 * 1. AI Inpainting — click "Borrar con AI" on an obstacle → backend erases it
 *    from the actual photo using DALL-E 2 and returns the cleaned image.
 * 2. Drag & Drop from Inventory — drag a plant from the inventory panel and
 *    drop it anywhere on the canvas. It appears at the exact drop position.
 * 3. Click to add from inventory — click "Usar" on any plant to add it.
 * 4. AI Assistant — natural language: "limpia el terreno", "pon una palmera",
 *    "cuánto cuesta", "quita la caseta".
 * 5. Responsive — mobile / tablet / desktop layouts.
 */

import React, {
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { ImprovedLiveCanvas } from "./ImprovedLiveCanvas";
import { MaterialEditor } from "./MaterialEditor";
import { InventoryPanel } from "./InventoryPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Save,
  Undo2,
  Redo2,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Loader2,
  Wand2,
} from "lucide-react";
import { useLiveInteraction } from "@/hooks/useLiveInteraction";
import { useDesignSync } from "@/hooks/useDesignSync";
import { useInventory } from "@/hooks/useInventory";
import { DesignData, AdjustLiveData } from "@shared/workflow-persistence-types";
import { AIDesignAssistant } from "./AIDesignAssistant";
import { Obstacle } from "./ObstacleDetector";
import { trpc } from "@/lib/trpc";
import { saveImage, loadImage } from "@/lib/imageStorage";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdjustLiveStepProps {
  projectId: string;
  initialDesign: DesignData;
  onComplete?: (adjustmentData: AdjustLiveData) => void;
  onCancel?: () => void;
}

// ─── Device detection ────────────────────────────────────────────────────────

function useDeviceType(): "mobile" | "tablet" | "desktop" {
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1200;
    if (w < 640) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  });

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w < 640) setDevice("mobile");
      else if (w < 1024) setDevice("tablet");
      else setDevice("desktop");
    };
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return device;
}

// ─── Resolve capture image ───────────────────────────────────────────────────

function resolveCaptureImageSync(
  projectId: string,
  initialDesign: DesignData
): string {
  // Only check in-memory initialDesign — localStorage is no longer used for images
  if (initialDesign?.captureImage && initialDesign.captureImage !== "__stored_separately__") {
    return initialDesign.captureImage;
  }
  // Fallback: check localStorage (legacy, small images only)
  try {
    const stored = localStorage.getItem(`captureImage_${projectId}`);
    if (stored && stored !== "__stored_separately__") return stored;
  } catch {}
  return "";
}

// ─── Inpainting API call (via tRPC) ─────────────────────────────────────────
// callInpaintAPI is now defined inside the component using trpc.inpaint.cleanTerrain

// ─── Main Component ──────────────────────────────────────────────────────────

export const AdjustLiveStep: React.FC<AdjustLiveStepProps> = ({
  projectId,
  initialDesign,
  onComplete,
  onCancel,
}) => {
  const device = useDeviceType();
  const [activeTab, setActiveTab] = useState<
    "canvas" | "materials" | "inventory"
  >("canvas");
  const [userNotes, setUserNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQuotation, setShowQuotation] = useState(true);

  // ─── Background image (can be updated by inpainting) ───
  const originalCaptureImageSync = useMemo(
    () => resolveCaptureImageSync(projectId, initialDesign),
    [projectId, initialDesign]
  );
  const [backgroundImage, setBackgroundImage] = useState(originalCaptureImageSync);

  // Load image from IndexedDB asynchronously (iOS Safari stores images there)
  useEffect(() => {
    if (backgroundImage) return; // already loaded from sync source
    loadImage(`captureImage_${projectId}`)
      .then((img) => {
        if (img) setBackgroundImage(img);
      })
      .catch(() => {});
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Obstacle state ───
  const [detectedObstacles, setDetectedObstacles] = useState<Obstacle[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showObstacles, setShowObstacles] = useState(true);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  // ─── Inpainting state ───
  const [inpaintingObstacleId, setInpaintingObstacleId] = useState<
    string | null
  >(null);
  const [inpaintError, setInpaintError] = useState<string | null>(null);

  // ─── Canvas drop zone ref ───
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // ─── tRPC mutations ───
  const inpaintMutation = trpc.inpaint.cleanTerrain.useMutation();
  const detectMutation = trpc.inpaint.detectObstacles.useMutation();

  const liveInteraction = useLiveInteraction();
  const designSync = useDesignSync(projectId, {
    autoSaveInterval: 2000,
    debounceDelay: 500,
    enableOfflineMode: true,
  });
  const { getInventoryItem } = useInventory();

  // ─── Load initial design ───
  useEffect(() => {
    if (initialDesign?.plants) {
      designSync.updateDesignState({
        objects: initialDesign.plants.map((p) => ({
          id: p.id,
          type: p.type,
          x: p.x,
          y: p.y,
          metadata: p.metadata,
        })),
        materials: initialDesign.materials.reduce(
          (acc, m) => {
            acc[m.id] = m.type;
            return acc;
          },
          {} as Record<string, string>
        ),
      });
    }
  }, [initialDesign]);

  // ─── Quotation ───
  const currentQuotation = useMemo(() => {
    const objs = designSync.designState.objects.filter(
      (o) => o.type !== "obstacle"
    );
    const plantsCost = objs.reduce((sum, obj) => {
      const inventoryId = obj.metadata?.inventoryId as string;
      if (inventoryId) {
        const item = getInventoryItem(inventoryId);
        return sum + (item?.price || 0);
      }
      return sum + (obj.cost || 0);
    }, 0);
    const materialsCost =
      Object.keys(designSync.designState.materials).length * 50;
    const laborCost =
      objs.length * 10 +
      Object.keys(designSync.designState.materials).length * 20;
    const totalCost = plantsCost + materialsCost + laborCost;
    const margin = 0.3;
    const finalPrice = totalCost * (1 + margin);
    return {
      plantsCost,
      materialsCost,
      laborCost,
      totalCost,
      margin,
      finalPrice,
    };
  }, [
    designSync.designState.objects,
    designSync.designState.materials,
    getInventoryItem,
  ]);

  // ─── Detect obstacles via Claude Vision (backend) ───
  const handleDetect = useCallback(async () => {
    if (!backgroundImage) {
      setDetectionError("No se encontró la imagen del terreno.");
      return;
    }
    setIsDetecting(true);
    setDetectionError(null);
    try {
      const result = await detectMutation.mutateAsync({
        imageBase64: backgroundImage,
      });
      // Claude returns coords in actual image pixels.
      // Map them to the 800x600 internal canvas coordinate space.
      const { obstacles: rawObstacles, imageWidth, imageHeight } = result;
      const scaleX = 800 / (imageWidth || 800);
      const scaleY = 600 / (imageHeight || 600);
      const mapped: Obstacle[] = rawObstacles.map((o, idx) => ({
        id: `obs-${Date.now()}-${idx}`,
        x: o.x * scaleX,
        y: o.y * scaleY,
        width: o.width * scaleX,
        height: o.height * scaleY,
        label: o.label,
        confidence: o.confidence ?? 0.9,
        type: "obstacle" as const,
      }));
      setDetectedObstacles(mapped);
      setShowObstacles(true);
    } catch (err: any) {
      setDetectionError(err.message || "Error al detectar obstáculos");
    } finally {
      setIsDetecting(false);
    }
  }, [backgroundImage, detectMutation]);

  // ─── Remove obstacle (marker only) ───
  const handleObstacleRemove = useCallback((obstacleId: string) => {
    setDetectedObstacles((prev) => prev.filter((o) => o.id !== obstacleId));
  }, []);

  // ─── Clear all obstacles ───
  const handleClearAllObstacles = useCallback(() => {
    setDetectedObstacles([]);
  }, []);

  // ─── Toggle visibility ───
  const handleToggleVisibility = useCallback(() => {
    setShowObstacles((prev) => !prev);
  }, []);

  // ─── AI Inpainting: erase obstacle from the actual photo ───
  const handleInpaintObstacle = useCallback(
    async (obstacleId: string) => {
      const obstacle = detectedObstacles.find((o) => o.id === obstacleId);
      if (!obstacle || !backgroundImage) return;

      setInpaintingObstacleId(obstacleId);
      setInpaintError(null);

      try {
        const result = await inpaintMutation.mutateAsync({
          imageBase64: backgroundImage,
          obstacles: [obstacle].map((o) => ({
            x: o.x, y: o.y, width: o.width, height: o.height, label: o.label,
          })),
          coordSpace: "canvas800x600",
        });
        const cleanedImage = result.imageBase64;
        // Update the background image with the cleaned version
        setBackgroundImage(cleanedImage);
        // Save to IndexedDB (no size limit on iOS Safari)
        saveImage(`captureImage_${projectId}`, cleanedImage).catch(() => {});
        // Remove the obstacle marker
        setDetectedObstacles((prev) => prev.filter((o) => o.id !== obstacleId));
      } catch (err: any) {
        setInpaintError(
          err.message || "Error al borrar el objeto de la foto"
        );
      } finally {
        setInpaintingObstacleId(null);
      }
    },
    [detectedObstacles, backgroundImage, projectId, inpaintMutation]
  );

  // ─── AI Inpainting: erase ALL obstacles from the photo ───
  const handleInpaintAll = useCallback(async () => {
    if (detectedObstacles.length === 0 || !backgroundImage) return;

    setInpaintingObstacleId("all");
    setInpaintError(null);

    try {
      const result = await inpaintMutation.mutateAsync({
        imageBase64: backgroundImage,
        obstacles: detectedObstacles.map((o) => ({
          x: o.x, y: o.y, width: o.width, height: o.height, label: o.label,
        })),
        coordSpace: "canvas800x600",
      });
      const cleanedImage = result.imageBase64;
      setBackgroundImage(cleanedImage);
      // Save to IndexedDB (no size limit on iOS Safari)
      saveImage(`captureImage_${projectId}`, cleanedImage).catch(() => {});
      setDetectedObstacles([]);
    } catch (err: any) {
      setInpaintError(err.message || "Error al limpiar el terreno");
    } finally {
      setInpaintingObstacleId(null);
    }
  }, [detectedObstacles, backgroundImage, projectId]);

  // ─── Add plant from inventory (click) ───
  const handleSelectPlantFromInventory = useCallback(
    (inventoryItemId: string) => {
      const item = getInventoryItem(inventoryItemId);
      if (!item) return;
      const newPlant = {
        id: `plant-${Date.now()}`,
        type: item.type,
        x: 150 + Math.random() * 200,
        y: 150 + Math.random() * 200,
        radius: 25,
        name: item.name,
        cost: item.price,
        metadata: {
          inventoryId: item.id,
          scientificName: item.scientificName,
          imageUrl: item.imageUrl,
          name: item.name,
        },
      };
      designSync.addObject(newPlant);
      setActiveTab("canvas");
    },
    [getInventoryItem, designSync]
  );

  // ─── Drop plant from inventory onto canvas ───
  const handleCanvasDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;

      let plantData: {
        type: string;
        id: string | number;
        name: string;
        imageUrl?: string;
        price?: number;
      };
      try {
        plantData = JSON.parse(data);
      } catch {
        return;
      }

      if (plantData.type !== "plant") return;

      // Calculate drop position relative to canvas (0-800 x 0-600 internal)
      const container = canvasContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      const scaleX = 800 / rect.width;
      const scaleY = 600 / rect.height;
      const canvasX = relX * scaleX;
      const canvasY = relY * scaleY;

      const item = getInventoryItem(String(plantData.id));
      const newPlant = {
        id: `plant-${Date.now()}`,
        type: item?.type || "tree",
        x: canvasX,
        y: canvasY,
        radius: 25,
        name: plantData.name,
        cost: plantData.price || item?.price || 0,
        metadata: {
          inventoryId: String(plantData.id),
          imageUrl: plantData.imageUrl || item?.imageUrl,
          name: plantData.name,
        },
      };
      designSync.addObject(newPlant);
      setActiveTab("canvas");
    },
    [getInventoryItem, designSync]
  );

  // ─── Canvas objects change ───
  const handleObjectsChange = useCallback(
    (objs: any[]) => {
      const plantObjs = objs.filter((o) => o.type !== "obstacle");
      designSync.updateDesignState({
        objects: plantObjs.map((obj) => ({
          id: obj.id,
          type: obj.type,
          x: obj.x,
          y: obj.y,
          name: (obj.metadata?.name as string) || obj.type,
          cost: (obj.metadata?.price as number) || 0,
          metadata: obj.metadata,
        })),
      });
    },
    [designSync]
  );

  // ─── Complete ───
  const handleComplete = useCallback(async () => {
    try {
      setIsSubmitting(true);
      const adjustmentData: AdjustLiveData = {
        changes: liveInteraction.state.history.map((action, index) => ({
          id: `change-${index}`,
          timestamp: Date.now(),
          type: action.type as any,
          objectId: undefined,
          oldValue: undefined,
          newValue: undefined,
          description: `${action.type}: cambio realizado`,
        })),
        finalDesign: {
          ...initialDesign,
          captureImage: backgroundImage,
          plants: designSync.designState.objects
            .filter((o) => o.type !== "obstacle")
            .map((obj) => ({
              id: obj.id,
              type: obj.type,
              x: obj.x,
              y: obj.y,
              radius: 20,
              name: obj.name || obj.type,
              cost: obj.cost || 0,
              metadata: obj.metadata,
            })),
          materials: Object.entries(designSync.designState.materials).map(
            ([id, type]) => ({
              id,
              type: type as any,
              polygon: [],
              area: 1,
              cost: 50,
            })
          ),
          quotation: currentQuotation,
          timestamp: Date.now(),
        },
        userNotes,
        timestamp: Date.now(),
      };
      await designSync.manualSync();
      onComplete?.(adjustmentData);
    } catch (error) {
      console.error("Error al completar ajuste:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    liveInteraction,
    designSync,
    initialDesign,
    userNotes,
    onComplete,
    currentQuotation,
    backgroundImage,
  ]);

  // ─── Derived state ───
  const visibleObstacles = showObstacles ? detectedObstacles : [];
  const plantObjects = useMemo(
    () =>
      designSync.designState.objects
        .filter((obj) => obj.type !== "obstacle")
        .map((obj) => ({ ...obj, radius: 25 })),
    [designSync.designState.objects]
  );
  const plantCount = designSync.designState.objects.filter(
    (o) => o.type !== "obstacle"
  ).length;
  const isInpainting = inpaintingObstacleId !== null;

  // ─── Obstacle Panel ───────────────────────────────────────────────────────
  const obstaclePanelJSX = (
    <div className="space-y-2">
      <h3 className="font-semibold text-xs sm:text-sm text-gray-700">
        Detección de Terreno
      </h3>

      {/* Detect button */}
      <Button
        onClick={handleDetect}
        disabled={isDetecting || isInpainting}
        size="sm"
        className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs h-8"
      >
        {isDetecting ? (
          <>
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Detectando...
          </>
        ) : (
          "🔍 Detectar Obstáculos"
        )}
      </Button>

      {detectionError && (
        <p className="text-xs text-red-500">{detectionError}</p>
      )}

      {inpaintError && (
        <p className="text-xs text-red-500">{inpaintError}</p>
      )}

      {/* Obstacle list */}
      {detectedObstacles.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">
              {detectedObstacles.length} obstáculo
              {detectedObstacles.length !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleVisibility}
                className="h-6 px-2 text-[10px]"
              >
                {showObstacles ? "Ocultar" : "Mostrar"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAllObstacles}
                className="h-6 px-2 text-[10px]"
              >
                Quitar todos
              </Button>
            </div>
          </div>

          {/* Clean with AI button */}
          <Button
            onClick={handleInpaintAll}
            disabled={isInpainting}
            size="sm"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs h-8"
          >
            {isInpainting && inpaintingObstacleId === "all" ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Limpiando terreno...
              </>
            ) : (
              <>
                <Wand2 className="w-3 h-3 mr-1" />
                Limpiar terreno con AI
              </>
            )}
          </Button>

          {/* Individual obstacle list */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {detectedObstacles.map((obs, idx) => (
              <div
                key={obs.id}
                className="flex items-center justify-between bg-gray-50 rounded p-1.5 text-[10px] gap-1"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-gray-700 truncate block">
                    {idx + 1}. {obs.label}
                  </span>
                  <span className="text-gray-400">
                    {Math.round(obs.confidence * 100)}% confianza
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  {/* Erase from photo with AI */}
                  <button
                    onClick={() => handleInpaintObstacle(obs.id)}
                    disabled={isInpainting}
                    className="text-purple-600 hover:text-purple-800 disabled:opacity-40 p-0.5"
                    title="Borrar de la foto con AI"
                  >
                    {inpaintingObstacleId === obs.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3" />
                    )}
                  </button>
                  {/* Remove marker only */}
                  <button
                    onClick={() => handleObstacleRemove(obs.id)}
                    disabled={isInpainting}
                    className="text-red-400 hover:text-red-600 disabled:opacity-40 p-0.5"
                    title="Quitar marcador"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ─── Quotation Panel ──────────────────────────────────────────────────────
  const quotationJSX = (
    <Card className="border-none shadow-sm bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader
        className="pb-2 cursor-pointer"
        onClick={() =>
          device !== "desktop" && setShowQuotation(!showQuotation)
        }
      >
        <CardTitle className="text-sm sm:text-base flex items-center justify-between text-green-800">
          <span>Cotización en Tiempo Real</span>
          {device !== "desktop" &&
            (showQuotation ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            ))}
        </CardTitle>
      </CardHeader>
      {(showQuotation || device === "desktop") && (
        <CardContent className="space-y-2 pt-0">
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Plantas ({plantCount}):</span>
              <span className="font-semibold">
                ${currentQuotation.plantsCost.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Materiales:</span>
              <span className="font-semibold">
                ${currentQuotation.materialsCost.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Mano de Obra:</span>
              <span className="font-semibold">
                ${currentQuotation.laborCost.toFixed(2)}
              </span>
            </div>
            <div className="border-t pt-1 flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-semibold">
                ${currentQuotation.totalCost.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Margen (30%):</span>
              <span className="font-semibold">
                $
                {(
                  currentQuotation.totalCost * currentQuotation.margin
                ).toFixed(2)}
              </span>
            </div>
          </div>
          <div className="border-t pt-2 flex justify-between items-center">
            <span className="text-base sm:text-lg font-bold text-green-900">
              Total:
            </span>
            <span className="text-xl sm:text-2xl font-bold text-green-600">
              ${currentQuotation.finalPrice.toFixed(2)}
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  );

  // ─── Canvas ───────────────────────────────────────────────────────────────
  const canvasJSX = (
    <div
      ref={canvasContainerRef}
      className="w-full h-full min-h-[250px] sm:min-h-[350px] lg:min-h-[450px] relative"
      onDrop={handleCanvasDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {isInpainting && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-lg">
          <div className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-xl">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            <p className="text-sm font-medium text-gray-700">
              AI limpiando el terreno...
            </p>
            <p className="text-xs text-gray-400">Esto puede tomar 10-20 seg</p>
          </div>
        </div>
      )}
      <ImprovedLiveCanvas
        backgroundImage={backgroundImage}
        objects={plantObjects}
        obstacles={visibleObstacles}
        onObjectsChange={handleObjectsChange}
        onSelectionChange={(selected) => {
          if (selected.length > 0) liveInteraction.selectObject(selected[0]);
        }}
        onObstacleDelete={handleObstacleRemove}
      />
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen max-h-screen bg-gray-50 overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between bg-white px-3 py-2 sm:px-4 sm:py-3 shadow-sm shrink-0 z-10">
        <div className="min-w-0">
          <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate">
            Ajustar Diseño
          </h2>
          <p className="text-gray-500 text-[10px] sm:text-xs hidden sm:block">
            Arrastra plantas al canvas · Toca obstáculos para borrarlos con AI
          </p>
        </div>
        <div className="flex gap-1 sm:gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => liveInteraction.undo()}
            disabled={liveInteraction.state.history.length === 0}
            className="h-8 px-2 text-xs"
          >
            <Undo2 className="w-3 h-3 sm:mr-1" />
            <span className="hidden sm:inline">Deshacer</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => liveInteraction.redo()}
            disabled={
              liveInteraction.state.historyIndex >=
              liveInteraction.state.history.length - 1
            }
            className="h-8 px-2 text-xs"
          >
            <Redo2 className="w-3 h-3 sm:mr-1" />
            <span className="hidden sm:inline">Rehacer</span>
          </Button>
          <Button
            onClick={handleComplete}
            disabled={isSubmitting}
            size="sm"
            className="bg-green-600 hover:bg-green-700 h-8 px-2 sm:px-3 text-xs"
          >
            <Save className="w-3 h-3 sm:mr-1" />
            <span className="hidden sm:inline">
              {isSubmitting ? "Guardando..." : "Finalizar"}
            </span>
            <span className="sm:hidden">{isSubmitting ? "..." : "OK"}</span>
          </Button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      {device === "desktop" ? (
        /* DESKTOP: 3-column */
        <div className="flex-1 flex overflow-hidden">
          {/* Left: obstacles */}
          <div className="w-56 xl:w-64 bg-white border-r overflow-y-auto p-3 shrink-0">
            {obstaclePanelJSX}
          </div>

          {/* Center: canvas + tabs */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as any)}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="grid w-full grid-cols-3 bg-white border-b rounded-none h-9">
                <TabsTrigger value="canvas" className="text-xs">
                  Canvas
                </TabsTrigger>
                <TabsTrigger value="materials" className="text-xs">
                  Materiales
                </TabsTrigger>
                <TabsTrigger
                  value="inventory"
                  className="text-xs flex items-center gap-1"
                >
                  <ShoppingBag className="w-3 h-3" /> Plantas
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="canvas"
                className="flex-1 mt-0 overflow-hidden p-2"
              >
                {canvasJSX}
              </TabsContent>

              <TabsContent
                value="materials"
                className="flex-1 mt-0 overflow-auto p-4"
              >
                <MaterialEditor onApplyMaterial={() => {}} onCleanArea={() => {}} />
              </TabsContent>

              <TabsContent
                value="inventory"
                className="flex-1 mt-0 overflow-hidden"
              >
                <InventoryPanel
                  onSelectPlant={handleSelectPlantFromInventory}
                  showCart={false}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: quotation + notes */}
          <div className="w-56 xl:w-64 bg-white border-l overflow-y-auto p-3 shrink-0 space-y-3">
            {quotationJSX}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold">Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full p-2 text-xs border rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  rows={3}
                  placeholder="Notas del diseño..."
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : device === "tablet" ? (
        /* TABLET: canvas + right sidebar */
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as any)}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="grid w-full grid-cols-3 bg-white border-b rounded-none h-9">
                <TabsTrigger value="canvas" className="text-xs">
                  Canvas
                </TabsTrigger>
                <TabsTrigger value="materials" className="text-xs">
                  Materiales
                </TabsTrigger>
                <TabsTrigger
                  value="inventory"
                  className="text-xs flex items-center gap-1"
                >
                  <ShoppingBag className="w-3 h-3" /> Plantas
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="canvas"
                className="flex-1 mt-0 overflow-hidden p-2"
              >
                {canvasJSX}
              </TabsContent>

              <TabsContent
                value="materials"
                className="flex-1 mt-0 overflow-auto p-3"
              >
                <MaterialEditor onApplyMaterial={() => {}} onCleanArea={() => {}} />
              </TabsContent>

              <TabsContent
                value="inventory"
                className="flex-1 mt-0 overflow-hidden"
              >
                <InventoryPanel
                  onSelectPlant={handleSelectPlantFromInventory}
                  showCart={false}
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="w-52 bg-white border-l overflow-y-auto p-2 shrink-0 space-y-2">
            {obstaclePanelJSX}
            {quotationJSX}
          </div>
        </div>
      ) : (
        /* MOBILE: stacked */
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">{canvasJSX}</div>
          <div className="px-2 pb-2">{quotationJSX}</div>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="px-2 pb-2"
          >
            <TabsList className="grid w-full grid-cols-3 bg-white h-9">
              <TabsTrigger value="canvas" className="text-[10px]">
                Obstáculos
              </TabsTrigger>
              <TabsTrigger value="materials" className="text-[10px]">
                Materiales
              </TabsTrigger>
              <TabsTrigger
                value="inventory"
                className="text-[10px] flex items-center gap-1"
              >
                <ShoppingBag className="w-3 h-3" /> Plantas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="canvas" className="mt-2">
              {obstaclePanelJSX}
            </TabsContent>

            <TabsContent value="materials" className="mt-2">
              <MaterialEditor onApplyMaterial={() => {}} onCleanArea={() => {}} />
            </TabsContent>

            <TabsContent value="inventory" className="mt-2">
              <InventoryPanel
                onSelectPlant={handleSelectPlantFromInventory}
                showCart={false}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* AI ASSISTANT */}
      <AIDesignAssistant
        projectId={projectId}
        obstacles={detectedObstacles}
        onDetectObstacles={handleDetect}
        onRemoveObstacle={handleObstacleRemove}
        onClearAllObstacles={handleClearAllObstacles}
        onRemoveObstacleByName={(name: string) => {
          setDetectedObstacles((prev) => {
            const nameLower = name.toLowerCase();
            return prev.filter(
              (o) => !o.label.toLowerCase().includes(nameLower)
            );
          });
        }}
        onKeepObstaclesByName={(names: string[]) => {
          setDetectedObstacles((prev) =>
            prev.filter((o) =>
              names.some((n) =>
                o.label.toLowerCase().includes(n.toLowerCase())
              )
            )
          );
        }}
        onInpaintAll={handleInpaintAll}
        captureImage={backgroundImage}
      />
    </div>
  );
};
