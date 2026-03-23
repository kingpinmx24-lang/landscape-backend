/*
 * ============================================================================
 * Component: AIDesignAssistant — Smart Sales Advisor v3
 * ============================================================================
 * The AI is a PRODUCTIVE ASSISTANT, not an autonomous agent.
 *
 * PRINCIPLES:
 *   1. The USER decides everything — what to erase, what to plant, where to put it
 *   2. The AI SUGGESTS, ANALYZES, and GUIDES — never auto-places
 *   3. Strict prompts: obstacle commands execute directly, design advice uses Claude
 *   4. Helps close sales in the field with smart recommendations
 *
 * CAPABILITIES:
 *   — Terrain analysis: "¿qué ves en este terreno?"
 *   — Obstacle control: detect, remove, keep, inpaint
 *   — Design advice: "¿qué plantas van bien aquí?" (from inventory)
 *   — Material advice: "¿qué material recomiendas para el piso?"
 *   — Cost analysis: "¿cuánto costaría este diseño?"
 *   — Sales pitch: "dame argumentos para vender este proyecto"
 *   — Step-by-step guide: "¿cómo empiezo?"
 * ============================================================================
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sparkles, X, Send, Loader2, Bot } from "lucide-react";
import { Obstacle } from "./ObstacleDetector";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actionSummary?: string;
  isTyping?: boolean;
}

export interface AIDesignAssistantProps {
  projectId?: string;
  objects?: Array<{ id: string; type: string; x: number; y: number; metadata?: Record<string, unknown> }>;
  obstacles: Obstacle[];
  totalPrice?: number;
  terrainArea?: number;
  captureImage?: string;
  inventoryItems?: Array<{ id: string | number; name: string; price: number; imageUrl?: string; category?: string }>;
  onDetectObstacles: () => void;
  onRemoveObstacle: (id: string) => void;
  onRemoveObstacleByName: (nameFragment: string) => void;
  onKeepObstaclesByName?: (names: string[]) => void;
  onClearAllObstacles: () => void;
  onInpaintAll?: () => void;
  onAddPlant?: (plantName: string) => void;
  onAddMaterial?: (materialName: string) => void;
}

// ─── Direct Command Parser (no AI needed for these) ──────────────────────────
interface ParseResult {
  response: string;
  actions: Array<{ type: string; payload?: string }>;
  needsAI?: boolean; // true = forward to Claude for intelligent response
}

function parseDirectCommand(input: string, obstacles: Obstacle[]): ParseResult | null {
  const lower = input.toLowerCase().trim();

  // ── Detect obstacles ──
  if (
    lower.includes("detecta") || lower.includes("detect") ||
    lower.includes("escanea") || lower.includes("scan") ||
    lower.includes("analiza el terreno") || lower.includes("qué hay en") ||
    lower.includes("que hay en") || lower.includes("identifica obstáculos") ||
    lower.includes("identifica obstaculo") || lower.includes("busca obstáculos") ||
    lower.includes("busca obstaculo")
  ) {
    return {
      response: "Escaneando el terreno con IA... Espera un momento.",
      actions: [{ type: "detect_obstacles" }],
    };
  }

  // ── Inpaint / erase from photo ──
  if (
    lower.includes("limpia con ai") || lower.includes("limpiar con ai") ||
    lower.includes("borrar con ai") || lower.includes("borra con ai") ||
    lower.includes("quita con ai") || lower.includes("inpaint") ||
    lower.includes("borrar de la foto") || lower.includes("borra de la foto") ||
    lower.includes("eliminar de la foto") || lower.includes("elimina de la foto") ||
    lower.includes("limpiar la foto") || lower.includes("limpia la foto") ||
    lower.includes("borrar objetos") || lower.includes("borra objetos") ||
    lower.includes("quitar de la foto") || lower.includes("quita de la foto") ||
    lower.includes("borra con ia") || lower.includes("limpia con ia")
  ) {
    if (obstacles.length === 0) {
      return {
        response: "No hay obstáculos detectados. Primero escribe \"detecta obstáculos\" para escanear el terreno.",
        actions: [],
      };
    }
    return {
      response: `Usando IA para borrar ${obstacles.length} objeto${obstacles.length > 1 ? "s" : ""} de la foto del terreno...\n\nEsto puede tomar 15-30 segundos. La IA llenará el área con terreno limpio y vacío — sin plantas, sin objetos. Después TÚ decides qué colocar.`,
      actions: [{ type: "inpaint_all" }],
    };
  }

  // ── Clear all markers ──
  if (
    lower.includes("limpia el terreno") || lower.includes("limpia todo") ||
    lower.includes("limpiar todo") || lower.includes("borra todo") ||
    lower.includes("borrar todo") || lower.includes("elimina todo") ||
    lower.includes("quita todo") || lower.includes("borra todos") ||
    lower.includes("elimina todos") || lower.includes("quita todos") ||
    lower.includes("borrar todos los obstáculo") || lower.includes("eliminar todos los obstáculo") ||
    lower.includes("borrar todos los obstaculo") || lower.includes("quitar todos")
  ) {
    if (obstacles.length === 0) {
      return {
        response: "No hay obstáculos detectados. El terreno ya está limpio.",
        actions: [],
      };
    }
    return {
      response: `Quitando ${obstacles.length} marcador${obstacles.length > 1 ? "es" : ""} del terreno.\n\nNota: Esto solo quita los marcadores visuales. Para borrar los objetos de la FOTO usa "limpia con AI".`,
      actions: [{ type: "clear_all_obstacles" }],
    };
  }

  // ── Keep some, remove rest ──
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
          response: "No hay obstáculos detectados. Primero escribe \"detecta obstáculos\".",
          actions: [],
        };
      }
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
      if (target.startsWith("todo") || target.startsWith("all")) continue;
      if (obstacles.length === 0) {
        return {
          response: "No hay obstáculos detectados. Primero escribe \"detecta obstáculos\".",
          actions: [],
        };
      }
      const targets = target.split(/\s+y\s+|\s*,\s*/);
      const found: Obstacle[] = [];
      for (const t of targets) {
        const trimmed = t.trim();
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
      const list = obstacles.map((o, i) => `${i + 1}. ${o.label}`).join("\n");
      return {
        response: `No encontré "${target}" entre los obstáculos.\n\nObstáculos en el terreno:\n${list}\n\nPuedes decir:\n• "borra el 1"\n• "borra la caseta"\n• "borra todos"`,
        actions: [],
      };
    }
  }

  // ── Status / list ──
  if (
    lower.includes("cuántos") || lower.includes("cuantos") ||
    lower.includes("estado") || lower.includes("resumen") ||
    lower.includes("qué hay") || lower.includes("que hay") ||
    lower.includes("lista") || lower.includes("status") ||
    lower === "obstáculos" || lower === "obstaculo"
  ) {
    if (obstacles.length === 0) {
      return {
        response: "No hay obstáculos detectados en el terreno.\n\nEscribe \"detecta obstáculos\" para escanear.",
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
  if (lower === "ayuda" || lower === "help" || lower.includes("qué puedes") || lower.includes("que puedes") || lower.includes("cómo funciona") || lower.includes("como funciona")) {
    return {
      response:
        "Soy tu asesor de diseño. Controlo el terreno Y te doy consejos inteligentes.\n\n" +
        "CONTROL DE TERRENO:\n" +
        "• \"Detecta obstáculos\" — escanea el terreno\n" +
        "• \"Quítame la caseta\" — elimina marcador\n" +
        "• \"Limpia el terreno\" — quita todos los marcadores\n" +
        "• \"Limpia con AI\" — borra objetos de la FOTO\n" +
        "• \"Deja la casita, limpia lo demás\"\n\n" +
        "ASESORÍA DE DISEÑO:\n" +
        "• \"¿Qué plantas van bien aquí?\"\n" +
        "• \"¿Qué material recomendas para el piso?\"\n" +
        "• \"¿Cuánto costaría este diseño?\"\n" +
        "• \"Dame argumentos para vender este proyecto\"\n" +
        "• \"¿Cómo empiezo el diseño?\"\n\n" +
        "RECUERDA: Yo sugiero, TÚ decides qué colocar y dónde.",
      actions: [],
    };
  }

  // Not a direct command — needs AI
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AIDesignAssistant({
  projectId,
  objects = [],
  obstacles,
  totalPrice = 0,
  terrainArea,
  captureImage,
  inventoryItems = [],
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
        "¡Hola! Soy tu asesor de diseño de jardines.\n\n" +
        "Puedo ayudarte a:\n" +
        "• Detectar y borrar obstáculos del terreno\n" +
        "• Sugerir plantas y materiales para tu proyecto\n" +
        "• Calcular costos y armar tu propuesta de venta\n\n" +
        "TÚ decides qué colocar — yo te asesoro.\n\n" +
        "Escribe \"ayuda\" para ver todos los comandos.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fresh refs to avoid stale closures
  const obstaclesRef = useRef<Obstacle[]>(obstacles);
  const objectsRef = useRef(objects);
  const inventoryRef = useRef(inventoryItems);
  useEffect(() => { obstaclesRef.current = obstacles; }, [obstacles]);
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { inventoryRef.current = inventoryItems; }, [inventoryItems]);

  const onDetectRef = useRef(onDetectObstacles);
  const onRemoveRef = useRef(onRemoveObstacle);
  const onClearRef = useRef(onClearAllObstacles);
  const onInpaintAllRef = useRef(onInpaintAll);
  const onAddPlantRef = useRef(onAddPlant);
  useEffect(() => { onDetectRef.current = onDetectObstacles; }, [onDetectObstacles]);
  useEffect(() => { onRemoveRef.current = onRemoveObstacle; }, [onRemoveObstacle]);
  useEffect(() => { onClearRef.current = onClearAllObstacles; }, [onClearAllObstacles]);
  useEffect(() => { onInpaintAllRef.current = onInpaintAll; }, [onInpaintAll]);
  useEffect(() => { onAddPlantRef.current = onAddPlant; }, [onAddPlant]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const executeActions = useCallback((actions: Array<{ type: string; payload?: string }>) => {
    for (const action of actions) {
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

  // ── Call Claude for intelligent design advice ──
  const callClaudeAdvisor = useCallback(async (userMessage: string): Promise<string> => {
    const currentObstacles = obstaclesRef.current;
    const currentObjects = objectsRef.current;
    const currentInventory = inventoryRef.current;

    const systemPrompt = `Eres un asesor experto en diseño de jardines y paisajismo. Tu rol es ASISTIR al usuario, no tomar decisiones por él.

REGLAS ESTRICTAS:
1. NUNCA coloques plantas automáticamente — solo SUGIERE y el usuario decide
2. NUNCA modifiques el diseño sin permiso explícito del usuario
3. Cuando sugieras plantas, menciona las del inventario disponible primero
4. Sé conciso y práctico — el usuario está en campo con un cliente
5. Habla en español, tono profesional pero amigable
6. Si el usuario pregunta por costos, usa los precios del inventario
7. Ayuda a CERRAR VENTAS — da argumentos concretos y visuales

CONTEXTO ACTUAL:
- Obstáculos detectados: ${currentObstacles.length > 0 ? currentObstacles.map(o => o.label).join(", ") : "ninguno"}
- Plantas colocadas en diseño: ${currentObjects.length}
- Costo actual del diseño: $${totalPrice.toLocaleString()}
- Área del terreno: ${terrainArea ? `${terrainArea} m²` : "no especificada"}
- Inventario disponible: ${currentInventory.length > 0
  ? currentInventory.slice(0, 10).map(i => `${i.name} ($${i.price})`).join(", ")
  : "no cargado aún"}

IMPORTANTE: 
- Si el usuario pregunta qué plantas usar, sugiere específicamente del inventario disponible
- Si pregunta por materiales, sugiere: pasto, grava, tierra, piedras de río, concreto, mulch
- Si pregunta por costos, calcula basándote en el inventario y área
- Si pide argumentos de venta, da 3-5 puntos concretos y visuales
- NUNCA digas "voy a agregar" o "coloqué" — siempre di "puedes agregar" o "te sugiero"`;

    try {
      const response = await fetch("/api/trpc/ai.chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "0": {
            json: {
              message: userMessage,
              systemPrompt,
              model: "claude-opus-4-6",
            }
          }
        }),
      });

      if (!response.ok) throw new Error(`API error ${response.status}`);
      const data = await response.json();
      const result = data?.[0]?.result?.data?.json;
      if (result?.reply) return result.reply;
      throw new Error("No reply in response");
    } catch (err) {
      // Fallback: intelligent local response based on context
      return buildLocalAdvisorResponse(userMessage, currentObstacles, currentObjects, currentInventory, totalPrice, terrainArea);
    }
  }, [totalPrice, terrainArea]);

  // ── Local fallback advisor (no API needed) ──
  function buildLocalAdvisorResponse(
    msg: string,
    obs: Obstacle[],
    objs: typeof objects,
    inv: typeof inventoryItems,
    price: number,
    area?: number
  ): string {
    const lower = msg.toLowerCase();

    if (lower.includes("planta") || lower.includes("árbol") || lower.includes("arbol") || lower.includes("vegeta") || lower.includes("qué poner") || lower.includes("que poner")) {
      const invList = inv.length > 0
        ? `\nDe tu inventario disponible:\n${inv.slice(0, 6).map(i => `• ${i.name} — $${i.price}`).join("\n")}`
        : "\n(Carga tu inventario para ver plantas disponibles)";
      return `Para este terreno te sugiero considerar:\n\n• Árboles de sombra en el perímetro (privacidad y frescura)\n• Arbustos medianos como divisores de zonas\n• Pasto o grava en las zonas centrales\n• Plantas de bajo mantenimiento para mayor valor de venta${invList}\n\nDrag & drop desde el panel de inventario para colocarlas donde quieras.`;
    }

    if (lower.includes("material") || lower.includes("piso") || lower.includes("suelo") || lower.includes("pasto") || lower.includes("grava")) {
      return `Materiales recomendados según el uso:\n\n• **Pasto natural** — zonas de recreo, jardín principal\n• **Grava decorativa** — caminos, zonas de bajo mantenimiento\n• **Piedras de río** — bordes, detalles decorativos\n• **Tierra preparada** — zonas de siembra\n• **Concreto** — accesos, estacionamiento\n• **Mulch** — base de árboles, jardines formales\n\nUsa el tab "Materiales" para aplicar texturas sobre el terreno.`;
    }

    if (lower.includes("costo") || lower.includes("precio") || lower.includes("cuánto") || lower.includes("cuanto") || lower.includes("presupuesto") || lower.includes("cotización")) {
      const plantsCost = objs.length * 500;
      const materialsCost = area ? area * 50 : 2000;
      const laborCost = (plantsCost + materialsCost) * 0.3;
      const total = plantsCost + materialsCost + laborCost;
      return `Estimado de costos para este proyecto:\n\n• Plantas (${objs.length} unidades): $${plantsCost.toLocaleString()}\n• Materiales${area ? ` (${area} m²)` : ""}: $${materialsCost.toLocaleString()}\n• Mano de obra (30%): $${Math.round(laborCost).toLocaleString()}\n\n**Total estimado: $${Math.round(total).toLocaleString()}**\n\nEste es un estimado. El precio final depende de las plantas y materiales específicos que elijas.`;
    }

    if (lower.includes("vender") || lower.includes("venta") || lower.includes("argumento") || lower.includes("convencer") || lower.includes("cliente")) {
      return `Argumentos de venta para este proyecto:\n\n1. **Plusvalía inmediata** — Un jardín bien diseñado aumenta el valor de la propiedad 10-15%\n2. **Visualización en tiempo real** — El cliente ve exactamente cómo quedará antes de invertir\n3. **Bajo mantenimiento** — Diseño con plantas nativas y materiales duraderos\n4. **Personalización total** — Cada elemento fue elegido por el cliente\n5. **Inversión con retorno** — El jardín se paga solo en satisfacción y valor de reventa\n\nMuéstrale el diseño en pantalla y deja que él mueva las plantas donde quiera.`;
    }

    if (lower.includes("empez") || lower.includes("cómo") || lower.includes("como") || lower.includes("pasos") || lower.includes("proceso")) {
      return `Proceso recomendado:\n\n1. **Detecta obstáculos** — escribe "detecta obstáculos"\n2. **Limpia el terreno** — decide qué quitar, usa "limpia con AI" para borrar de la foto\n3. **Aplica materiales** — tab "Materiales", elige pasto/grava/etc y pinta el área\n4. **Coloca plantas** — arrastra desde el panel de inventario\n5. **Ajusta posiciones** — mueve con el dedo hasta que quede perfecto\n6. **Presenta al cliente** — muéstrale el diseño en pantalla\n\nRecuerda: TÚ controlas todo. La IA solo te asiste.`;
    }

    return `Entiendo tu pregunta sobre "${msg}".\n\nPuedo ayudarte con:\n• Sugerencias de plantas para este terreno\n• Recomendaciones de materiales\n• Estimado de costos\n• Argumentos de venta\n• Guía paso a paso del proceso\n\n¿Qué necesitas específicamente?`;
  }

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

    const currentObstacles = obstaclesRef.current;

    // Try direct command first (no AI needed)
    const directResult = parseDirectCommand(text, currentObstacles);

    if (directResult) {
      // Execute actions immediately
      if (directResult.actions.length > 0) {
        executeActions(directResult.actions);
      }

      await new Promise((r) => setTimeout(r, 200));

      const actionSummary = directResult.actions.length > 0
        ? `${directResult.actions.length} acción${directResult.actions.length > 1 ? "es" : ""} ejecutada${directResult.actions.length > 1 ? "s" : ""}`
        : undefined;

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: directResult.response,
          timestamp: new Date(),
          actionSummary,
        },
      ]);

      // Follow-up messages
      if (directResult.actions.some((a) => a.type === "detect_obstacles")) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `followup-${Date.now()}`,
              role: "assistant",
              content: "Detección completada. Ahora puedes:\n• \"Cuántos obstáculos hay?\" — ver lista\n• \"Quítame la caseta\" — eliminar marcador\n• \"Limpia con AI\" — borrar de la foto\n\nRecuerda: TÚ decides qué quitar.",
              timestamp: new Date(),
            },
          ]);
        }, 2500);
      }

      if (directResult.actions.some((a) => a.type === "inpaint_all")) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `inpaint-followup-${Date.now()}`,
              role: "assistant",
              content: "La IA está borrando los obstáculos de la foto. El resultado será terreno limpio y vacío.\n\nCuando termine, TÚ decides:\n• Arrastra plantas desde el inventario\n• Aplica materiales (pasto, grava, etc.)\n• Mueve todo con el dedo hasta que quede perfecto",
              timestamp: new Date(),
            },
          ]);
        }, 1000);
      }

    } else {
      // Not a direct command — use AI advisor
      // Show typing indicator
      const typingId = `typing-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: typingId, role: "assistant", content: "...", timestamp: new Date(), isTyping: true },
      ]);

      try {
        const aiResponse = await callClaudeAdvisor(text);
        setMessages((prev) => prev.filter((m) => m.id !== typingId));
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: aiResponse,
            timestamp: new Date(),
          },
        ]);
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== typingId));
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: "No pude procesar esa consulta. Prueba con:\n• \"¿Qué plantas van bien aquí?\"\n• \"¿Cuánto costaría este diseño?\"\n• \"Dame argumentos de venta\"\n• \"Ayuda\" — ver todos los comandos",
            timestamp: new Date(),
          },
        ]);
      }
    }

    setIsProcessing(false);
  }, [isProcessing, executeActions, callClaudeAdvisor]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    processCommand(text);
  }, [input, processCommand]);

  const quickActions = [
    { label: "Detecta obstáculos", icon: "🔍" },
    { label: "Limpia con AI", icon: "🪄" },
    { label: "¿Qué plantas van bien?", icon: "🌿" },
    { label: "¿Cuánto costaría?", icon: "💰" },
    { label: "Argumentos de venta", icon: "🎯" },
    { label: "Ayuda", icon: "❓" },
  ];

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 active:from-blue-800 active:to-indigo-900 text-white rounded-full p-3 sm:p-4 shadow-lg hover:shadow-xl transition-all z-40 flex items-center gap-2"
        >
          <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="hidden sm:inline text-sm font-semibold">Asesor IA</span>
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-xl shadow-2xl flex flex-col z-50"
          style={{ maxHeight: "min(600px, calc(100vh - 2rem))" }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 rounded-t-xl flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <div>
                <h3 className="font-semibold text-sm">Asesor de Diseño IA</h3>
                <p className="text-[10px] text-blue-200">
                  {obstacles.length > 0
                    ? `${obstacles.length} obstáculo${obstacles.length > 1 ? "s" : ""} detectado${obstacles.length > 1 ? "s" : ""} · $${totalPrice.toLocaleString()} en diseño`
                    : "Sugiero · Tú decides · Cierras la venta"}
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
          <div
            className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 min-h-0"
            style={{ maxHeight: "320px" }}
          >
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : msg.isTyping
                      ? "bg-white text-gray-400 border border-gray-200 rounded-bl-sm shadow-sm animate-pulse"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
                  }`}
                >
                  {msg.isTyping ? (
                    <div className="flex gap-1 items-center py-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">{msg.content}</p>
                  )}
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
                <span>{qa.icon}</span>
                <span className="hidden sm:inline">{qa.label}</span>
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
              placeholder="Pregunta o da un comando..."
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
