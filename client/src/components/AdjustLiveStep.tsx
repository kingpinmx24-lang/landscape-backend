/**
 * AdjustLiveStep — Professional AI-Powered Landscape Design Editor
 * ============================================================================
 * FLUJO SIMPLIFICADO:
 *   1. Se muestra la foto del terreno directamente en el canvas
 *   2. Panel lateral con 3 tabs:
 *      - 🤖 IA Asistente: chat donde el usuario ordena el diseño con lenguaje natural
 *      - 🌿 Plantas: inventario con drag & drop al canvas
 *      - 🎨 Materiales: pasto, piedras, grava, etc. con pincel
 *   3. Cotización en tiempo real siempre visible
 *   4. Sin panel de limpieza de obstáculos
 *
 * PRINCIPIO: La IA ejecuta lo que el usuario ordena. El usuario manda.
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Send, Bot, Sparkles, Trash2, Undo2,
  Save, ChevronDown, ChevronUp, Layers, ShoppingBag,
  Paintbrush, Plus, CheckCircle2, DollarSign, Leaf,
} from "lucide-react";
import { ImprovedLiveCanvas } from "./ImprovedLiveCanvas";
import { trpc } from "@/lib/trpc";
import { useDesignSync } from "@/hooks/useDesignSync";
import { useInventory } from "@/hooks/useInventory";
import { saveImage, loadImage } from "@/lib/imageStorage";
import { SelectedObject } from "../../../shared/live-interaction-types";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdjustLiveStepProps {
  projectId: string;
  initialDesign: any;
  onComplete?: (adjustmentData: any) => void;
  onCancel?: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actionsCount?: number;
}

// ─── Materials catalog ────────────────────────────────────────────────────────
const MATERIALS = [
  { id: "grass",        label: "Pasto",           icon: "🌿", color: "#4ade80", pricePerM2: 15 },
  { id: "river_stones", label: "Piedras de Río",  icon: "🪨", color: "#94a3b8", pricePerM2: 35 },
  { id: "gravel",       label: "Grava",           icon: "⬜", color: "#d1d5db", pricePerM2: 25 },
  { id: "soil",         label: "Tierra",          icon: "🟫", color: "#92400e", pricePerM2: 10 },
  { id: "mulch",        label: "Mulch",           icon: "🪵", color: "#78350f", pricePerM2: 20 },
  { id: "concrete",     label: "Concreto",        icon: "🔲", color: "#9ca3af", pricePerM2: 80 },
];

// ─── Plant fallback images ────────────────────────────────────────────────────
function getPlantFallbackImage(type: string): string {
  const map: Record<string, string> = {
    tree: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=200&q=80",
    shrub: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200&q=80",
    flower: "https://images.unsplash.com/photo-1490750967868-88df5691cc0c?w=200&q=80",
    grass: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&q=80",
    palm: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=200&q=80",
    succulent: "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=200&q=80",
    groundcover: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200&q=80",
  };
  return map[type] || map.tree;
}

// ─── Image storage helpers ────────────────────────────────────────────────────
function resolveCaptureImageSync(projectId: string, initialDesign: any): string {
  if (initialDesign?.captureImage && initialDesign.captureImage !== "__stored_separately__"
    && initialDesign.captureImage.startsWith("data:"))
    return initialDesign.captureImage;
  try {
    const ss = sessionStorage.getItem(`captureImage_${projectId}`);
    if (ss && ss.startsWith("data:")) return ss;
  } catch {}
  try {
    const ls = localStorage.getItem(`captureImage_${projectId}`);
    if (ls && ls.startsWith("data:")) return ls;
  } catch {}
  return "";
}

// ─── Device detection ─────────────────────────────────────────────────────────
function useDeviceType(): "mobile" | "tablet" | "desktop" {
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    if (w < 768) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  });
  useEffect(() => {
    const handler = () => {
      const w = window.innerWidth;
      if (w < 768) setDevice("mobile");
      else if (w < 1024) setDevice("tablet");
      else setDevice("desktop");
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return device;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const AdjustLiveStep: React.FC<AdjustLiveStepProps> = ({
  projectId,
  initialDesign,
  onComplete,
}) => {
  const device = useDeviceType();
  const isMobile = device === "mobile";

  // ─── Active panel tab ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"ai" | "plants" | "materials">("ai");

  // ─── Background image ─────────────────────────────────────────────────────
  const originalImage = useMemo(() => resolveCaptureImageSync(projectId, initialDesign), [projectId, initialDesign]);
  const [backgroundImage, setBackgroundImage] = useState(originalImage);

  useEffect(() => {
    if (backgroundImage) return;
    loadImage(`captureImage_${projectId}`)
      .then((img) => { if (img) setBackgroundImage(img); })
      .catch(() => {});
  }, [projectId]); // eslint-disable-line

  // ─── Design state ─────────────────────────────────────────────────────────
  const designSync = useDesignSync(projectId, { autoSaveInterval: 2000, debounceDelay: 500, enableOfflineMode: true });
  const { inventory, getInventoryItem, filteredInventory, loadInventory } = useInventory();
  const [appliedMaterials, setAppliedMaterials] = useState<Record<string, string>>({});
  const [selectedMaterial, setSelectedMaterial] = useState<string>("grass");
  const [userNotes, setUserNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQuotation, setShowQuotation] = useState(false);
  const [plantSearch, setPlantSearch] = useState("");
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // ─── AI Chat state ────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "¡Hola! Soy tu asistente de diseño de paisajismo. Puedes ordenarme cosas como:\n\n• \"Pon pasto en todo el terreno\"\n• \"Agrega 3 palmeras en el centro\"\n• \"Diseña el borde con piedras de río\"\n• \"¿Qué plantas recomiendas para esta zona?\"\n\nTambién puedes arrastrar plantas del inventario directamente al canvas.",
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const aiDesignChatMutation = trpc.inpaint.aiDesignChat.useMutation();
  const generatePlantImageMutation = trpc.inpaint.generatePlantImage.useMutation();
  const generateTerrainMutation = trpc.inpaint.generateDesign.useMutation();
  const [generatedBackground, setGeneratedBackground] = useState<string>("");
  const [isGeneratingTerrain, setIsGeneratingTerrain] = useState(false);

  // ─── Load inventory on mount ──────────────────────────────────────────────
  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // ─── Load initial design ──────────────────────────────────────────────────
  useEffect(() => {
    if (initialDesign?.plants) {
      designSync.updateDesignState({
        objects: initialDesign.plants.map((p: any) => ({
          id: p.id, type: p.type, x: p.x, y: p.y, metadata: p.metadata,
        })),
        materials: initialDesign.materials?.reduce((acc: any, m: any) => { acc[m.id] = m.type; return acc; }, {}) || {},
      });
    }
  }, [initialDesign]); // eslint-disable-line

  // ─── Scroll chat to bottom ────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ─── AI Chat handler ──────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || isAiLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: msg,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsAiLoading(true);

    try {
      const currentObjects = designSync.designState.objects.map(o => ({
        id: o.id,
        type: o.type,
        x: o.x,
        y: o.y,
        name: (o.metadata?.name as string) || o.type,
        cost: o.cost,
      }));

      const inventoryForAI = inventory.slice(0, 40).map(item => ({
        id: String(item.id),
        name: item.name,
        type: item.type,
        price: item.price,
        imageUrl: item.imageUrl,
        stock: item.stock,
      }));

      const result = await aiDesignChatMutation.mutateAsync({
        message: msg,
        captureImage: backgroundImage || undefined,
        canvasObjects: currentObjects,
        inventory: inventoryForAI,
        appliedMaterials,
      });

      // Execute actions from AI
      let actionsExecuted = 0;
      if (result.actions && result.actions.length > 0) {
        for (const action of result.actions) {
          if (action.type === "add_plant") {
            // 1. Try to find inventory item by ID first, then by name/type match
            let item = action.inventoryId ? getInventoryItem(String(action.inventoryId)) : null;
            if (!item && action.name) {
              const searchTerm = String(action.name).toLowerCase();
              item = inventory.find(inv =>
                inv.name.toLowerCase().includes(searchTerm) ||
                searchTerm.includes(inv.name.toLowerCase()) ||
                inv.type.toLowerCase() === searchTerm
              ) || null;
            }
            if (!item && action.plantType) {
              item = inventory.find(inv => inv.type === action.plantType) || null;
            }

            const x = typeof action.x === "number" ? action.x : 200 + Math.random() * 400;
            const y = typeof action.y === "number" ? action.y : 150 + Math.random() * 300;
            const plantName = action.name || item?.name || "Planta";
            const plantType = item?.type || action.plantType || "tree";

            // 2. Get image: inventory photo > AI generated > Unsplash fallback
            let imageUrl = item?.imageUrl || "";
            if (!imageUrl) {
              try {
                // Call server to generate/fetch real plant image
                const genResult = await generatePlantImageMutation.mutateAsync({
                  plantName,
                  plantType,
                });
                imageUrl = genResult.imageUrl;
              } catch {
                // Last resort: local fallback
                imageUrl = getPlantFallbackImage(plantType);
              }
            }

            designSync.addObject({
              id: `plant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: plantType,
              x,
              y,
              radius: 35,
              name: plantName,
              cost: item?.price || 0,
              metadata: {
                inventoryId: item ? String(item.id) : "",
                imageUrl,
                name: plantName,
              },
            });
            actionsExecuted++;
          } else if (action.type === "apply_material" && action.material) {
            const zone = action.zone || "full";
            const areaId = `material-${zone}-${Date.now()}`;
            setAppliedMaterials(prev => ({ ...prev, [areaId]: action.material }));
            actionsExecuted++;
          } else if (action.type === "remove_objects") {
            const filter = (action.filter || "all").toLowerCase();
            const currentObjs = designSync.designState.objects;
            let kept: typeof currentObjs;
            if (filter === "all") {
              kept = [];
            } else if (filter === "border") {
              kept = currentObjs.filter(o => o.x > 80 && o.x < 720 && o.y > 80 && o.y < 520);
            } else if (filter === "left") {
              kept = currentObjs.filter(o => o.x >= 280);
            } else if (filter === "right") {
              kept = currentObjs.filter(o => o.x <= 520);
            } else if (filter === "center") {
              kept = currentObjs.filter(o => o.x < 280 || o.x > 520);
            } else if (filter === "top") {
              kept = currentObjs.filter(o => o.y >= 200);
            } else if (filter === "bottom") {
              kept = currentObjs.filter(o => o.y <= 400);
            } else if (filter.startsWith("type:")) {
              const typeFilter = filter.replace("type:", "");
              kept = currentObjs.filter(o => !o.type.toLowerCase().includes(typeFilter));
            } else if (filter.startsWith("name:")) {
              const nameFilter = filter.replace("name:", "").toLowerCase();
              kept = currentObjs.filter(o => !((o.metadata?.name as string) || o.type).toLowerCase().includes(nameFilter));
            } else {
              kept = [];
            }
            handleObjectsChange(kept.map(o => ({
              id: o.id,
              type: o.type,
              x: o.x,
              y: o.y,
              radius: (o as any).radius || 35,
              cost: o.cost || 0,
              imageUrl: (o as any).imageUrl || (o.metadata?.imageUrl as string) || "",
              rotation: (o as any).rotation || 0,
              metadata: o.metadata || {},
            })));
            actionsExecuted++;
          } else if (action.type === "generate_terrain" && action.description) {
            setIsGeneratingTerrain(true);
            try {
              // Use terrain photo if available, otherwise use previously generated background
              const baseImage = backgroundImage || generatedBackground || undefined;
              const terrainResult = await generateTerrainMutation.mutateAsync({
                captureImage: baseImage,
                description: action.description,
                materialName: (action as any).materialName || undefined,
              });
              if (terrainResult.success && terrainResult.imageBase64) {
                setGeneratedBackground(terrainResult.imageBase64);
                console.log('[AdjustLiveStep] generate_terrain ✓ success');
              } else if (!terrainResult.success) {
                console.error('[AdjustLiveStep] generate_terrain server error:', terrainResult.error);
                setChatMessages(prev => [...prev, {
                  id: `terrain-err-${Date.now()}`,
                  role: 'assistant' as const,
                  content: `⚠️ No se pudo generar el diseño visual: ${terrainResult.error || 'Error desconocido'}. Las plantas y materiales sí se aplicaron.`,
                  timestamp: new Date(),
                }]);
              }
            } catch (e: any) {
              console.error('[AdjustLiveStep] generate_terrain exception:', e);
              setChatMessages(prev => [...prev, {
                id: `terrain-err-${Date.now()}`,
                role: 'assistant' as const,
                content: `⚠️ Error al generar el diseño visual. Las plantas y materiales sí se aplicaron. Intenta de nuevo si deseas la imagen generada.`,
                timestamp: new Date(),
              }]);
            } finally {
              setIsGeneratingTerrain(false);
            }
            actionsExecuted++;
          }
        }
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.reply || "Listo, he actualizado el diseño.",
        timestamp: new Date(),
        actionsCount: actionsExecuted,
      };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Hubo un error al procesar tu solicitud. Por favor intenta de nuevo.",
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsAiLoading(false);
    }
  }, [chatInput, isAiLoading, designSync, inventory, backgroundImage, appliedMaterials, getInventoryItem, aiDesignChatMutation, generatePlantImageMutation]);

  // ─── Add plant from inventory panel ──────────────────────────────────────
  const handleSelectPlantFromInventory = useCallback(async (inventoryItemId: string) => {
    const item = getInventoryItem(inventoryItemId);
    if (!item) return;
    // Get image: use inventory photo if available, otherwise generate via AI
    let imageUrl = item.imageUrl || "";
    if (!imageUrl) {
      try {
        const genResult = await generatePlantImageMutation.mutateAsync({
          plantName: item.name,
          plantType: item.type,
        });
        imageUrl = genResult.imageUrl;
      } catch {
        imageUrl = getPlantFallbackImage(item.type);
      }
    }
    designSync.addObject({
      id: `plant-${Date.now()}`,
      type: item.type,
      x: 150 + Math.random() * 500,
      y: 150 + Math.random() * 300,
      radius: 35,
      name: item.name,
      cost: item.price,
      metadata: {
        inventoryId: item.id,
        imageUrl,
        name: item.name,
      },
    });
  }, [getInventoryItem, designSync, generatePlantImageMutation]);

  // ─── Drop plant from inventory onto canvas ────────────────────────────────────────────
  const handleCanvasDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    let plantData: { type: string; id: string | number; name: string; imageUrl?: string; price?: number };
    try { plantData = JSON.parse(data); } catch { return; }
    if (plantData.type !== "plant") return;
    const container = canvasContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left) * (800 / rect.width);
    const canvasY = (e.clientY - rect.top) * (600 / rect.height);
    const item = getInventoryItem(String(plantData.id));
    // Get image: use provided > inventory > AI generated > fallback
    let imageUrl = plantData.imageUrl || item?.imageUrl || "";
    if (!imageUrl) {
      try {
        const genResult = await generatePlantImageMutation.mutateAsync({
          plantName: plantData.name,
          plantType: item?.type || "tree",
        });
        imageUrl = genResult.imageUrl;
      } catch {
        imageUrl = getPlantFallbackImage(item?.type || "tree");
      }
    }
    designSync.addObject({
      id: `plant-${Date.now()}`,
      type: item?.type || "tree",
      x: canvasX, y: canvasY,
      radius: 35,
      name: plantData.name,
      cost: plantData.price || item?.price || 0,
      metadata: {
        inventoryId: String(plantData.id),
        imageUrl,
        name: plantData.name,
      },
    });
  }, [getInventoryItem, designSync, generatePlantImageMutation]);

  // ─── Apply material to zone ───────────────────────────────────────────────
  const handleApplyMaterial = useCallback((materialId: string) => {
    const areaId = `material-${materialId}-${Date.now()}`;
    setAppliedMaterials(prev => ({ ...prev, [areaId]: materialId }));
  }, []);

  // ─── Objects change ───────────────────────────────────────────────────────
  const handleObjectsChange = useCallback((objs: any[]) => {
    designSync.updateDesignState({
      objects: objs.map((obj) => ({
        id: obj.id,
        type: obj.type,
        x: obj.x,
        y: obj.y,
        radius: obj.radius,
        rotation: obj.rotation,
        cost: obj.cost,
        // Preserve imageUrl in metadata so it survives serialization
        metadata: obj.imageUrl
          ? { ...(obj.metadata || {}), imageUrl: obj.imageUrl }
          : obj.metadata,
      })),
    });
  }, [designSync]);

  // ─── Quotation ────────────────────────────────────────────────────────────
  const currentQuotation = useMemo(() => {
    const objs = designSync.designState.objects;
    const plantsCost = objs.reduce((sum, obj) => {
      const item = getInventoryItem(obj.metadata?.inventoryId as string);
      return sum + (item?.price || obj.cost || 0);
    }, 0);
    const materialAreas = Object.entries(appliedMaterials);
    const materialsCost = materialAreas.reduce((sum, [, matId]) => {
      const mat = MATERIALS.find((m) => m.id === matId);
      return sum + (mat?.pricePerM2 || 0) * 5;
    }, 0);
    const laborCost = objs.length * 15 + materialAreas.length * 25;
    const totalCost = plantsCost + materialsCost + laborCost;
    return { plantsCost, materialsCost, laborCost, totalCost, finalPrice: totalCost * 1.3 };
  }, [designSync.designState.objects, appliedMaterials, getInventoryItem]);

  // ─── Complete ─────────────────────────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const adjustmentData: any = {
        changes: [],
        finalDesign: {
          ...initialDesign,
          captureImage: backgroundImage,
          plants: designSync.designState.objects.map((obj) => ({
            id: obj.id, type: obj.type, x: obj.x, y: obj.y,
            radius: obj.radius || 20, name: (obj.metadata?.name as string) || obj.type,
            cost: obj.cost || 0, metadata: obj.metadata,
          })),
          materials: Object.entries(appliedMaterials).map(([id, type]) => ({
            id, type: type as any, polygon: [], area: 5,
            cost: (MATERIALS.find((m) => m.id === type)?.pricePerM2 || 0) * 5,
          })),
          quotation: currentQuotation,
          timestamp: Date.now(),
        },
        userNotes,
        timestamp: Date.now(),
      };
      await designSync.manualSync();
      onComplete?.(adjustmentData);
    } catch (err) {
      console.error("Error al completar:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [designSync, initialDesign, userNotes, onComplete, currentQuotation, backgroundImage, appliedMaterials]);

  // ─── Derived ──────────────────────────────────────────────────────────────
  const plantObjects = useMemo(
    () => designSync.designState.objects.map((o) => ({
      ...o,
      // Preserve user-set radius from pinch gestures; default 35 for new plants
      radius: o.radius || 35,
      // Always expose imageUrl at root level so the canvas renderer can find it
      // The image is stored in metadata.imageUrl (base64 or URL from inventory)
      imageUrl: (o as any).imageUrl || (o.metadata?.imageUrl as string) || undefined,
    })),
    [designSync.designState.objects]
  );
  const plantCount = plantObjects.length;

  const filteredPlants = useMemo(() => {
    if (!plantSearch.trim()) return filteredInventory;
    const term = plantSearch.toLowerCase();
    return filteredInventory.filter(p =>
      p.name.toLowerCase().includes(term) ||
      (p.type && p.type.toLowerCase().includes(term))
    );
  }, [filteredInventory, plantSearch]);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Tab selector */}
      <div className="flex border-b border-gray-200 bg-white shrink-0">
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === "ai"
              ? "text-purple-700 border-b-2 border-purple-600 bg-purple-50"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          IA Asistente
        </button>
        <button
          onClick={() => setActiveTab("plants")}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === "plants"
              ? "text-green-700 border-b-2 border-green-600 bg-green-50"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Leaf className="w-3.5 h-3.5" />
          Plantas
          {filteredInventory.length > 0 && (
            <span className="bg-green-100 text-green-700 rounded-full px-1.5 text-[10px] font-bold">
              {filteredInventory.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("materials")}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === "materials"
              ? "text-orange-700 border-b-2 border-orange-600 bg-orange-50"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Paintbrush className="w-3.5 h-3.5" />
          Materiales
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {/* ── AI ASSISTANT TAB ── */}
        {activeTab === "ai" && (
          <div className="flex flex-col h-full">
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center mr-2 shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-purple-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-purple-600 text-white rounded-tr-sm"
                        : "bg-gray-100 text-gray-800 rounded-tl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.actionsCount && msg.actionsCount > 0 && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-green-600 bg-green-50 rounded px-1.5 py-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        {msg.actionsCount} elemento{msg.actionsCount > 1 ? "s" : ""} colocado{msg.actionsCount > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isAiLoading && (
                <div className="flex justify-start">
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center mr-2 shrink-0">
                    <Bot className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div className="bg-gray-100 rounded-xl rounded-tl-sm px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                      <span className="text-xs text-gray-500">Diseñando...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick action chips */}
            <div className="px-3 py-2 border-t border-gray-100 flex gap-1.5 overflow-x-auto shrink-0">
              {[
                "Pon pasto en todo",
                "Agrega palmeras",
                "Diseña el borde",
                "¿Qué recomiendas?",
              ].map((chip) => (
                <button
                  key={chip}
                  onClick={() => { setChatInput(chip); }}
                  className="shrink-0 text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-full px-2.5 py-1 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Chat input */}
            <div className="p-3 border-t border-gray-200 shrink-0">
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  placeholder="Ej: Pon 3 palmeras en el centro..."
                  className="flex-1 text-xs h-9 border-gray-300 focus:border-purple-400"
                  disabled={isAiLoading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isAiLoading}
                  size="sm"
                  className="h-9 w-9 p-0 bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                >
                  {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── PLANTS TAB ── */}
        {activeTab === "plants" && (
          <div className="flex flex-col h-full">
            <div className="p-2 border-b border-gray-100 shrink-0">
              <Input
                value={plantSearch}
                onChange={(e) => setPlantSearch(e.target.value)}
                placeholder="Buscar planta..."
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredPlants.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Leaf className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Sin plantas en inventario</p>
                  <p className="text-[10px] mt-1">Agrega plantas desde /inventory</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredPlants.map((plant) => (
                    <div
                      key={plant.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({
                          type: "plant",
                          id: plant.id,
                          name: plant.name,
                          imageUrl: plant.imageUrl,
                          price: plant.price,
                        }));
                      }}
                      onClick={() => handleSelectPlantFromInventory(String(plant.id))}
                      className="bg-white border border-gray-200 rounded-lg p-2 cursor-pointer hover:border-green-400 hover:shadow-sm transition-all active:scale-95 select-none"
                    >
                      <div className="w-full aspect-square rounded-md overflow-hidden bg-gray-50 mb-1.5">
                        <img
                          src={plant.imageUrl || getPlantFallbackImage(plant.type)}
                          alt={plant.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = getPlantFallbackImage(plant.type); }}
                        />
                      </div>
                      <p className="text-[10px] font-semibold text-gray-800 truncate">{plant.name}</p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[9px] text-gray-500 capitalize">{plant.type}</span>
                        <span className="text-[10px] font-bold text-green-700">${plant.price}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${plant.stock > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                          {plant.stock > 0 ? `${plant.stock} disp.` : "Agotado"}
                        </span>
                        <Plus className="w-3 h-3 text-green-600 ml-auto" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MATERIALS TAB ── */}
        {activeTab === "materials" && (
          <div className="p-3 space-y-3">
            <p className="text-[10px] text-gray-500">Selecciona un material y aplícalo al diseño. La IA también puede aplicar materiales por ti.</p>
            <div className="grid grid-cols-2 gap-2">
              {MATERIALS.map((mat) => (
                <button
                  key={mat.id}
                  onClick={() => { setSelectedMaterial(mat.id); handleApplyMaterial(mat.id); }}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all text-left ${
                    selectedMaterial === mat.id
                      ? "border-orange-400 bg-orange-50"
                      : "border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50"
                  }`}
                >
                  <span className="text-lg">{mat.icon}</span>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-800">{mat.label}</p>
                    <p className="text-[9px] text-gray-500">${mat.pricePerM2}/m²</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Applied materials summary */}
            {Object.keys(appliedMaterials).length > 0 && (
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-2.5">
                <p className="text-[10px] font-semibold text-orange-800 mb-1.5">Materiales aplicados:</p>
                <div className="flex flex-wrap gap-1">
                  {Array.from(new Set(Object.values(appliedMaterials))).map((matId) => {
                    const mat = MATERIALS.find(m => m.id === matId);
                    return mat ? (
                      <span key={matId} className="text-[10px] bg-white border border-orange-200 rounded-full px-2 py-0.5 text-orange-700">
                        {mat.icon} {mat.label}
                      </span>
                    ) : null;
                  })}
                </div>
                <button
                  onClick={() => setAppliedMaterials({})}
                  className="mt-2 text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Limpiar materiales
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ─── Quotation panel ──────────────────────────────────────────────────────
  const quotationPanel = (
    <div className="bg-white border-t border-gray-200 shrink-0">
      <button
        onClick={() => setShowQuotation(!showQuotation)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600" />
          <span className="text-xs font-bold text-gray-800">Cotización</span>
          <span className="text-xs font-bold text-green-700">${currentQuotation.finalPrice.toFixed(0)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">{plantCount} elemento{plantCount !== 1 ? "s" : ""}</span>
          {showQuotation ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronUp className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </button>
      {showQuotation && (
        <div className="px-3 pb-3 space-y-1.5">
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-green-50 rounded p-2">
              <p className="text-gray-500">Plantas</p>
              <p className="font-bold text-green-700">${currentQuotation.plantsCost.toFixed(0)}</p>
            </div>
            <div className="bg-orange-50 rounded p-2">
              <p className="text-gray-500">Materiales</p>
              <p className="font-bold text-orange-700">${currentQuotation.materialsCost.toFixed(0)}</p>
            </div>
            <div className="bg-blue-50 rounded p-2">
              <p className="text-gray-500">Mano de obra</p>
              <p className="font-bold text-blue-700">${currentQuotation.laborCost.toFixed(0)}</p>
            </div>
            <div className="bg-purple-50 rounded p-2">
              <p className="text-gray-500">Total + 30%</p>
              <p className="font-bold text-purple-700">${currentQuotation.finalPrice.toFixed(0)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─── DESKTOP LAYOUT ───────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div className="flex h-screen bg-gray-100 overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <div>
                <h1 className="text-sm font-bold text-gray-900">Editor de Paisajismo</h1>
                <p className="text-[10px] text-gray-500">Arrastra plantas al canvas o usa el asistente de IA</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {plantCount > 0 && (
                <span className="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-1 font-semibold">
                  {plantCount} elemento{plantCount !== 1 ? "s" : ""}
                </span>
              )}
              <Button
                onClick={handleComplete}
                disabled={isSubmitting}
                size="sm"
                className="h-8 px-4 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Guardar Diseño
              </Button>
            </div>
          </div>

          {/* Canvas */}
          <div
            ref={canvasContainerRef}
            className="flex-1 flex items-center justify-center p-4 overflow-hidden relative"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleCanvasDrop}
          >
            {isGeneratingTerrain && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 rounded-lg">
                <Loader2 className="w-10 h-10 text-white animate-spin mb-3" />
                <p className="text-white font-semibold text-sm">Generando diseño con IA...</p>
                <p className="text-white/70 text-xs mt-1">Esto puede tomar hasta 30 segundos</p>
              </div>
            )}
            {(generatedBackground || backgroundImage) ? (
              <ImprovedLiveCanvas
                backgroundImage={generatedBackground || backgroundImage}
                objects={plantObjects}
                onObjectsChange={handleObjectsChange}
                snapToGrid={false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 text-gray-400">
                <Layers className="w-12 h-12 opacity-30" />
                <p className="text-sm">No hay imagen del terreno</p>
                <p className="text-xs">Regresa a la pantalla anterior y captura una foto</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white border-t border-gray-200 px-4 py-2 shrink-0">
            <Input
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="Notas adicionales para el cliente..."
              className="h-8 text-xs border-gray-200"
            />
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden shrink-0">
          <div className="flex-1 overflow-hidden">
            {panelContent}
          </div>
          {quotationPanel}
        </div>
      </div>
    );
  }

  // ─── MOBILE LAYOUT ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-bold text-gray-900">Diseño de Paisaje</span>
        </div>
        <div className="flex items-center gap-2">
          {plantCount > 0 && (
            <span className="text-[10px] bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-semibold">
              {plantCount}
            </span>
          )}
          <Button
            onClick={handleComplete}
            disabled={isSubmitting}
            size="sm"
            className="h-7 px-3 bg-green-600 hover:bg-green-700 text-white text-[11px] font-semibold"
          >
            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
            Guardar
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasContainerRef}
        className="shrink-0 relative"
        style={{ height: "45vw", minHeight: 200, maxHeight: 320 }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleCanvasDrop}
      >
        {isGeneratingTerrain && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50">
            <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
            <p className="text-white text-xs font-semibold">Generando con IA...</p>
          </div>
        )}
        {(generatedBackground || backgroundImage) ? (
          <ImprovedLiveCanvas
            backgroundImage={generatedBackground || backgroundImage}
            objects={plantObjects}
            onObjectsChange={handleObjectsChange}
            snapToGrid={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
            <div className="text-center">
              <Layers className="w-8 h-8 mx-auto mb-1 opacity-30" />
              <p className="text-xs">Sin imagen del terreno</p>
            </div>
          </div>
        )}
      </div>

      {/* Panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {panelContent}
      </div>

      {/* Quotation */}
      {quotationPanel}
    </div>
  );
};
