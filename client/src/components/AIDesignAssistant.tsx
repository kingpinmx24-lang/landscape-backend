/*
 * ============================================================================
 * Component: AIDesignAssistant — PRODUCTION VERSION
 * ============================================================================
 * AI assistant that ACTUALLY controls the design system.
 *
 * KEY FIX: Uses useRef for obstacles/objects so closures always have
 * the latest state. No more stale closure bugs.
 *
 * Supports:
 *   - "detecta obstáculos"
 *   - "quítame la caseta"
 *   - "borra la estructura metálica y las sillas"
 *   - "deja la casita, limpia lo demás"
 *   - "borra todos los obstáculos"
 *   - "limpia el terreno"
 *   - "limpia con AI" / "borra con AI" → AI inpainting
 *   - "agrega una palmera"
 *   - "cuántos obstáculos hay?"
 * ============================================================================
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { Obstacle } from "./ObstacleDetector";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actionSummary?: string;
}

export interface AIDesignAssistantProps {
  projectId?: string;
  objects?: Array<{ id: string; type: string; x: number; y: number; metadata?: Record<string, unknown> }>;
  obstacles: Obstacle[];
  totalPrice?: number;
  terrainArea?: number;
  captureImage?: string;
  onDetectObstacles: () => void;
  onRemoveObstacle: (id: string) => void;
  onRemoveObstacleByName: (nameFragment: string) => void;
  onKeepObstaclesByName?: (names: string[]) => void;
  onClearAllObstacles: () => void;
  onInpaintAll?: () => void;
  onAddPlant?: (plantName: string) => void;
  onAddMaterial?: (materialName: string) => void;
}

// ─── Intent Parser ────────────────────────────────────────────────────────────
// Always receives fresh obstacles from ref, never stale closures.

interface ParseResult {
  response: string;
  actions: Array<{ type: string; payload?: string }>;
}

function parseIntent(input: string, obstacles: Obstacle[]): ParseResult {
  const lower = input.toLowerCase().trim();

  // ── Detect ──
  if (
    lower.includes("detecta") || lower.includes("detectar") ||
    lower.includes("escanea") || lower.includes("analiza") ||
    lower.includes("detect") || lower.includes("busca obstáculo") ||
    lower.includes("busca obstaculo")
  ) {
    return {
      response: "Escaneando el terreno en busca de obstáculos...",
      actions: [{ type: "detect_obstacles" }],
    };
  }

  // ── AI Inpainting ──
  if (
    lower.includes("limpia con ai") || lower.includes("borra con ai") ||
    lower.includes("limpiar con ai") || lower.includes("borrar con ai") ||
    lower.includes("quita con ai") || lower.includes("quitar con ai") ||
    lower.includes("inpaint") || lower.includes("borrar de la foto") ||
    lower.includes("borra de la foto") || lower.includes("eliminar de la foto") ||
    lower.includes("elimina de la foto") || lower.includes("limpiar la foto") ||
    lower.includes("limpia la foto") || lower.includes("borrar objetos") ||
    lower.includes("borra objetos") || lower.includes("quitar de la foto") ||
    lower.includes("quita de la foto")
  ) {
    if (obstacles.length === 0) {
      return {
        response: "No hay obstáculos detectados. Primero escribe 'detecta obstáculos'.",
        actions: [],
      };
    }
    return {
      response: `Usando AI para borrar ${obstacles.length} objeto${obstacles.length > 1 ? "s" : ""} de la foto del terreno... Esto puede tomar 15-20 segundos.`,
      actions: [{ type: "inpaint_all" }],
    };
  }

  // ── Clear ALL (marker only) ──
  if (
    lower.includes("limpia el terreno") ||
    lower.includes("limpia todo") || lower.includes("limpiar todo") ||
    lower.includes("borra todo") || lower.includes("borrar todo") ||
    lower.includes("elimina todo") || lower.includes("eliminar todo") ||
    lower.includes("quita todo") || lower.includes("quitar todo") ||
    lower.includes("borra todos") || lower.includes("elimina todos") ||
    lower.includes("quita todos") || lower.includes("quitar todos") ||
    lower.includes("borrar todos los obstáculo") ||
    lower.includes("eliminar todos los obstáculo") ||
    lower.includes("quitar todos los obstáculo") ||
    lower.includes("borrar todos los obstaculo") ||
    lower.includes("eliminar todos los obstaculo") ||
    lower.includes("quitar todos los obstaculo")
  ) {
    if (obstacles.length === 0) {
      return {
        response: "No hay obstáculos detectados. Primero escribe 'detecta obstáculos'.",
        actions: [],
      };
    }
    return {
      response: `Limpiando el terreno: eliminando ${obstacles.length} obstáculo${obstacles.length > 1 ? "s" : ""}...\n\nNota: Esto solo quita los marcadores. Para borrar los objetos de la foto usa "limpia con AI".`,
      actions: [{ type: "clear_all_obstacles" }],
    };
  }

  // ── Keep some, remove rest ──
  // "deja la casita, limpia lo demás" / "conserva X, borra el resto"
  const keepPatterns = [
    /(?:deja|conserva|guarda|mantén|mantén|mantener|dejar|conservar)\s+(?:el|la|los|las|un|una|ese|esa)?\s*(.+?)(?:,|y)?\s*(?:limpia|borra|elimina|quita|remueve)\s+(?:lo demás|el resto|los demás|todo lo demás|el resto)/i,
    /(?:limpia|borra|elimina|quita)\s+(?:lo demás|el resto|todo)\s+(?:pero|excepto|menos|salvo)\s+(?:el|la|los|las|un|una|ese|esa)?\s*(.+)/i,
  ];

  for (const pattern of keepPatterns) {
    const match = input.match(pattern);
    if (match) {
      const keepFragment = match[1].trim().toLowerCase();
      if (obstacles.length === 0) {
        return {
          response: "No hay obstáculos detectados. Primero escribe 'detecta obstáculos'.",
          actions: [],
        };
      }

      // Find the obstacle to keep
      const toKeep = obstacles.find(
        (obs) =>
          obs.label.toLowerCase().includes(keepFragment) ||
          obs.type.toLowerCase().includes(keepFragment) ||
          keepFragment.includes(obs.label.toLowerCase().split(" ")[0]) ||
          keepFragment.includes(obs.type.toLowerCase().split(" ")[0])
      );

      if (!toKeep) {
        const list = obstacles.map((o, i) => `${i + 1}. ${o.label}`).join("\n");
        return {
          response: `No encontré "${keepFragment}" entre los obstáculos.\n\nObstáculos detectados:\n${list}\n\nDime el nombre exacto de cuál conservar.`,
          actions: [],
        };
      }

      const toRemove = obstacles.filter((o) => o.id !== toKeep.id);
      return {
        response: `Conservando "${toKeep.label}" y eliminando los otros ${toRemove.length} obstáculo${toRemove.length > 1 ? "s" : ""}...`,
        actions: toRemove.map((o) => ({ type: "remove_obstacle", payload: o.id })),
      };
    }
  }

  // ── Remove specific obstacle(s) by name ──
  const removePatterns = [
    /(?:borra|elimina|quita|quítame|quitame|remueve|remove|delete)\s+(?:el|la|los|las|un|una|ese|esa|esos|esas)?\s*(.+)/i,
  ];

  for (const pattern of removePatterns) {
    const match = input.match(pattern);
    if (match) {
      const target = match[1].trim().toLowerCase();

      // Don't match "todos" here
      if (target.startsWith("todo") || target.startsWith("all")) continue;

      if (obstacles.length === 0) {
        return {
          response: "No hay obstáculos detectados. Primero escribe 'detecta obstáculos'.",
          actions: [],
        };
      }

      // Support multiple targets: "borra la caseta y la estructura"
      const targets = target.split(/\s+y\s+|\s*,\s*/);
      const found: Obstacle[] = [];

      for (const t of targets) {
        const trimmed = t.trim();
        // Exact or partial match
        const matched = obstacles.find(
          (obs) =>
            obs.label.toLowerCase().includes(trimmed) ||
            obs.type.toLowerCase().includes(trimmed) ||
            trimmed.includes(obs.label.toLowerCase().split(" ")[0]) ||
            trimmed.includes(obs.type.toLowerCase().split(" ")[0])
        );
        if (matched && !found.find((f) => f.id === matched.id)) {
          found.push(matched);
        }
      }

      if (found.length > 0) {
        const names = found.map((o) => `"${o.label}"`).join(", ");
        return {
          response: `Eliminando ${names} del terreno...`,
          actions: found.map((o) => ({ type: "remove_obstacle", payload: o.id })),
        };
      }

      // Try by number: "borra el 3"
      const numMatch = target.match(/(\d+)/);
      if (numMatch) {
        const idx = parseInt(numMatch[1]) - 1;
        if (idx >= 0 && idx < obstacles.length) {
          return {
            response: `Eliminando obstáculo #${idx + 1}: "${obstacles[idx].label}"...`,
            actions: [{ type: "remove_obstacle", payload: obstacles[idx].id }],
          };
        }
      }

      // Not found — list available
      const list = obstacles.map((o, i) => `${i + 1}. ${o.label}`).join("\n");
      return {
        response: `No encontré "${target}" entre los obstáculos detectados.\n\nObstáculos en el terreno:\n${list}\n\nPuedes decir:\n• "borra el 1"\n• "borra la caseta"\n• "borra todos"`,
        actions: [],
      };
    }
  }

  // ── Add plant ──
  const addMatch = input.match(/(?:agrega|añade|pon|coloca|add)\s+(?:una?\s+)?(.+)/i);
  if (addMatch) {
    const plantName = addMatch[1].trim();
    if (!plantName.toLowerCase().includes("obstáculo") && !plantName.toLowerCase().includes("obstaculo")) {
      return {
        response: `Agregando "${plantName}" al diseño...`,
        actions: [{ type: "add_plant", payload: plantName }],
      };
    }
  }

  // ── Status ──
  if (
    lower.includes("cuántos") || lower.includes("cuantos") ||
    lower.includes("estado") || lower.includes("resumen") ||
    lower.includes("qué hay") || lower.includes("que hay") ||
    lower.includes("lista") || lower.includes("status")
  ) {
    if (obstacles.length === 0) {
      return {
        response: "No hay obstáculos detectados en el terreno.\n\nEscribe 'detecta obstáculos' para escanear el terreno.",
        actions: [],
      };
    }
    const list = obstacles.map((o, i) => `${i + 1}. ${o.label} (${Math.round(o.confidence * 100)}% confianza)`).join("\n");
    return {
      response: `Obstáculos en el terreno (${obstacles.length}):\n\n${list}\n\nPuedes decir:\n• "borra la caseta"\n• "deja la casita, limpia lo demás"\n• "limpia con AI" — borra de la foto\n• "borra todos"`,
      actions: [],
    };
  }

  // ── Help ──
  if (lower.includes("ayuda") || lower.includes("help") || lower.includes("qué puedes") || lower.includes("que puedes")) {
    return {
      response:
        "Puedo controlar el terreno directamente. Ejemplos:\n\n" +
        "• \"Detecta obstáculos\" — escanea el terreno\n" +
        "• \"Quítame la caseta\" — elimina marcador\n" +
        "• \"Borra la estructura y las sillas\" — elimina varios\n" +
        "• \"Deja la casita, limpia lo demás\" — conserva uno\n" +
        "• \"Limpia el terreno\" — quita todos los marcadores\n" +
        "• \"Limpia con AI\" — borra objetos de la FOTO con IA\n" +
        "• \"Borra el 3\" — elimina por número\n" +
        "• \"Cuántos obstáculos hay?\" — muestra lista\n" +
        "• \"Agrega una palmera\" — añade planta",
      actions: [],
    };
  }

  // ── Fallback ──
  return {
    response:
      "No entendí el comando. Prueba:\n\n" +
      "• \"Detecta obstáculos\"\n" +
      "• \"Quítame la caseta\"\n" +
      "• \"Limpia el terreno\"\n" +
      "• \"Limpia con AI\" — borra objetos de la foto\n\n" +
      "Escribe \"ayuda\" para ver todos los comandos.",
    actions: [],
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AIDesignAssistant({
  projectId,
  objects = [],
  obstacles,
  totalPrice = 0,
  captureImage,
  onDetectObstacles,
  onRemoveObstacle,
  onRemoveObstacleByName,
  onKeepObstaclesByName,
  onClearAllObstacles,
  onInpaintAll,
  onAddPlant,
  onAddMaterial,
}: AIDesignAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "¡Hola! Controlo el diseño directamente. Prueba:\n\n" +
        "• \"Detecta obstáculos\"\n" +
        "• \"Quítame la caseta\"\n" +
        "• \"Limpia con AI\" — borra objetos de la foto\n" +
        "• \"Deja la casita, limpia lo demás\"\n\n" +
        "Escribe \"ayuda\" para ver todos los comandos.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── CRITICAL: useRef so closures always have fresh obstacles ──
  const obstaclesRef = useRef<Obstacle[]>(obstacles);
  const objectsRef = useRef(objects);
  useEffect(() => { obstaclesRef.current = obstacles; }, [obstacles]);
  useEffect(() => { objectsRef.current = objects; }, [objects]);

  // Callbacks refs to avoid stale closures
  const onDetectRef = useRef(onDetectObstacles);
  const onRemoveRef = useRef(onRemoveObstacle);
  const onClearRef = useRef(onClearAllObstacles);
  const onAddPlantRef = useRef(onAddPlant);
  const onInpaintAllRef = useRef(onInpaintAll);
  useEffect(() => { onDetectRef.current = onDetectObstacles; }, [onDetectObstacles]);
  useEffect(() => { onRemoveRef.current = onRemoveObstacle; }, [onRemoveObstacle]);
  useEffect(() => { onClearRef.current = onClearAllObstacles; }, [onClearAllObstacles]);
  useEffect(() => { onAddPlantRef.current = onAddPlant; }, [onAddPlant]);
  useEffect(() => { onInpaintAllRef.current = onInpaintAll; }, [onInpaintAll]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Execute parsed actions using refs (always fresh)
  const executeActions = useCallback((actions: Array<{ type: string; payload?: string }>) => {
    for (const action of actions) {
      console.log(`[AI] Executing: ${action.type}`, action.payload || "");
      switch (action.type) {
        case "detect_obstacles":
          onDetectRef.current();
          break;
        case "remove_obstacle":
          if (action.payload) onRemoveRef.current(action.payload);
          break;
        case "clear_all_obstacles":
          onClearRef.current();
          break;
        case "inpaint_all":
          if (onInpaintAllRef.current) onInpaintAllRef.current();
          break;
        case "add_plant":
          if (action.payload && onAddPlantRef.current) onAddPlantRef.current(action.payload);
          break;
      }
    }
  }, []);

  const processCommand = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    // Use ref for always-fresh obstacles
    const currentObstacles = obstaclesRef.current;
    const { response, actions } = parseIntent(text, currentObstacles);

    // Execute actions immediately
    if (actions.length > 0) {
      executeActions(actions);
    }

    // Brief delay for UX
    await new Promise((r) => setTimeout(r, 250));

    const actionSummary = actions.length > 0
      ? `${actions.length} acción${actions.length > 1 ? "es" : ""} ejecutada${actions.length > 1 ? "s" : ""}`
      : undefined;

    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response,
        timestamp: new Date(),
        actionSummary,
      },
    ]);

    // Follow-up after detection
    if (actions.some((a) => a.type === "detect_obstacles")) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `followup-${Date.now()}`,
            role: "assistant",
            content:
              `Detección completada. Ahora puedes decir:\n` +
              `• "Cuántos obstáculos hay?" — ver la lista\n` +
              `• "Quítame la caseta" — eliminar marcador\n` +
              `• "Limpia con AI" — borrar objetos de la foto`,
            timestamp: new Date(),
          },
        ]);
      }, 2500);
    }

    // Follow-up after inpainting
    if (actions.some((a) => a.type === "inpaint_all")) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `inpaint-followup-${Date.now()}`,
            role: "assistant",
            content:
              `La AI está procesando la foto. Cuando termine verás el terreno limpio.\n` +
              `Luego puedes:\n` +
              `• "Agrega una palmera" — añadir plantas\n` +
              `• "Cuánto cuesta?" — ver cotización`,
            timestamp: new Date(),
          },
        ]);
      }, 1000);
    }

    setIsProcessing(false);
  }, [isProcessing, executeActions]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    processCommand(text);
  }, [input, processCommand]);

  const quickActions = [
    { label: "Detecta obstáculos", icon: "🔍" },
    { label: "Lista de obstáculos", icon: "📋" },
    { label: "Limpia con AI", icon: "🪄" },
    { label: "Limpia el terreno", icon: "🗑" },
    { label: "Ayuda", icon: "❓" },
  ];

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full p-3 sm:p-4 shadow-lg hover:shadow-xl transition-all z-40 flex items-center gap-2"
        >
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="hidden sm:inline text-sm font-semibold">AI Asistente</span>
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-xl shadow-2xl flex flex-col z-50"
          style={{ maxHeight: "min(600px, calc(100vh - 2rem))" }}>

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 rounded-t-xl flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <div>
                <h3 className="font-semibold text-sm">AI Asistente</h3>
                <p className="text-[10px] text-blue-200">
                  {obstacles.length > 0
                    ? `${obstacles.length} obstáculo${obstacles.length > 1 ? "s" : ""} detectado${obstacles.length > 1 ? "s" : ""}`
                    : "Controla el diseño con comandos"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 p-1.5 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 min-h-0" style={{ maxHeight: "320px" }}>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">{msg.content}</p>
                  {msg.actionSummary && (
                    <div className="mt-1.5 pt-1.5 border-t border-current/10">
                      <span className="text-[10px] opacity-70 flex items-center gap-1">
                        ⚡ {msg.actionSummary}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 px-3 py-2 rounded-xl rounded-bl-sm shadow-sm">
                  <div className="flex gap-1.5 items-center">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                    <span className="text-xs text-gray-500">Procesando...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          <div className="px-3 py-2 border-t bg-white flex gap-1.5 flex-wrap shrink-0">
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                onClick={() => processCommand(qa.label)}
                disabled={isProcessing}
                className="text-[10px] sm:text-xs bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <span>{qa.icon}</span> {qa.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="border-t p-2.5 bg-white rounded-b-xl flex gap-2 shrink-0">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Escribe un comando..."
              className="flex-1 text-xs sm:text-sm h-9"
              disabled={isProcessing}
            />
            <Button
              onClick={handleSend}
              disabled={isProcessing || !input.trim()}
              size="sm"
              className="h-9 px-3 bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
