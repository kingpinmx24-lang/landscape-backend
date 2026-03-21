/*
 * ============================================================================
 * Component: AIDesignAssistant
 * ============================================================================
 * Asistente flotante con IA para sugerir plantas y materiales
 */

import React, { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { SelectedObject } from "../../../shared/live-interaction-types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIDesignAssistantProps {
  objects: SelectedObject[];
  totalPrice: number;
  terrainArea?: number;
  onAddPlant?: (plant: any) => void;
  onAddMaterial?: (material: string) => void;
}

export function AIDesignAssistant({
  objects,
  totalPrice,
  terrainArea = 100,
  onAddPlant,
  onAddMaterial,
}: AIDesignAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "¡Hola! Soy tu asistente de diseño. Puedo ayudarte a:\n• Sugerir plantas según el clima\n• Recomendar materiales para el suelo\n• Optimizar el diseño para máxima rentabilidad\n• Ajustar presupuesto\n\n¿Qué necesitas?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateAssistantResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();

    // Sugerencias de plantas
    if (
      lowerMessage.includes("planta") ||
      lowerMessage.includes("árbol") ||
      lowerMessage.includes("flor")
    ) {
      const suggestions = [
        "Rosa - $25 (Ideal para bordes, requiere sol)",
        "Oak Tree - $150 (Sombra, punto focal)",
        "Lavanda - $30 (Bajo mantenimiento, fragante)",
        "Boxwood - $40 (Setos, forma)",
        "Perennial Grass - $20 (Cobertura, bajo costo)",
      ];
      return `Basándome en tu diseño actual (${objects.length} plantas, $${totalPrice.toFixed(2)}), te sugiero:\n\n${suggestions.join("\n")}\n\n¿Cuál te interesa agregar?`;
    }

    // Sugerencias de materiales
    if (
      lowerMessage.includes("suelo") ||
      lowerMessage.includes("material") ||
      lowerMessage.includes("tierra")
    ) {
      return `Para un terreno de ${terrainArea}m², te recomiendo:\n\n• Pasto: $50 (Natural, requiere riego)\n• Grava: $30 (Bajo mantenimiento)\n• Concreto: $80 (Duradero, moderno)\n• Mulch: $25 (Económico, aislante)\n• Piedra: $60 (Premium, elegante)\n\n¿Cuál prefieres?`;
    }

    // Optimización de presupuesto
    if (
      lowerMessage.includes("presupuesto") ||
      lowerMessage.includes("costo") ||
      lowerMessage.includes("precio")
    ) {
      const currentBudget = totalPrice;
      const suggestions =
        currentBudget < 100
          ? "Tu presupuesto es bajo. Te sugiero agregar plantas económicas como Lavanda ($30) o Pasto ($20)."
          : currentBudget < 500
            ? "Buen presupuesto. Puedes agregar árboles medianos como Oak Tree ($150)."
            : "Excelente presupuesto. Considera agregar árboles premium y materiales de calidad.";

      return `Presupuesto actual: $${currentBudget.toFixed(2)}\n\n${suggestions}\n\n¿Quieres ajustar algo?`;
    }

    // Respuesta por defecto
    return `Entendido. Basándome en tu proyecto actual:\n\n• Plantas: ${objects.length}\n• Presupuesto: $${totalPrice.toFixed(2)}\n• Área: ${terrainArea}m²\n\n¿Qué cambios te gustaría hacer? Puedo ayudarte con:\n- Agregar más plantas\n- Cambiar materiales del suelo\n- Optimizar el diseño\n- Ajustar presupuesto`;
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Agregar mensaje del usuario
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simular delay de respuesta
    setTimeout(() => {
      const assistantResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: generateAssistantResponse(input),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantResponse]);
      setIsLoading(false);
    }, 500);
  };

  const handleQuickSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all z-40 flex items-center gap-2"
        >
          <Sparkles className="w-6 h-6" />
          <span className="hidden sm:inline text-sm font-semibold">Asistente</span>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-2xl flex flex-col z-50 h-[600px] max-h-[calc(100vh-3rem)]">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-semibold">Asistente de Diseño</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-blue-800 p-1 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-800 border border-gray-200 px-4 py-2 rounded-lg rounded-bl-none">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions */}
          <div className="px-4 py-2 border-t bg-white space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleQuickSuggestion("Sugiere plantas")}
                className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded transition-colors"
              >
                🌿 Plantas
              </button>
              <button
                onClick={() => handleQuickSuggestion("Qué materiales recomiendas")}
                className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded transition-colors"
              >
                🌍 Materiales
              </button>
              <button
                onClick={() => handleQuickSuggestion("Optimiza el presupuesto")}
                className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-2 py-1 rounded transition-colors"
              >
                💰 Presupuesto
              </button>
              <button
                onClick={() => handleQuickSuggestion("Mejora el diseño")}
                className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded transition-colors"
              >
                ✨ Diseño
              </button>
            </div>
          </div>

          {/* Input */}
          <div className="border-t p-3 bg-white rounded-b-lg flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Escribe tu pregunta..."
              className="text-sm"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              size="sm"
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
