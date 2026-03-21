/**
 * Component: DirectedInputPanel
 * ============================================================================
 * Panel para entrada dirigida del usuario (control humano del diseño)
 */

import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Send, Lightbulb } from "lucide-react";

interface DirectedInputPanelProps {
  onAddPlants?: (plantType: string, quantity: number, location: string) => void;
  onChangeMaterial?: (material: string, location: string) => void;
  onCustomRequest?: (request: string) => void;
  isLoading?: boolean;
  error?: string;
  success?: string;
}

/**
 * Tipos de plantas disponibles
 */
const PLANT_TYPES = [
  { id: "flowering", name: "Flores", icon: "🌸" },
  { id: "shrub", name: "Arbustos", icon: "🌿" },
  { id: "tree", name: "Árboles", icon: "🌳" },
  { id: "groundcover", name: "Cobertura", icon: "🍀" },
  { id: "decorative", name: "Decorativo", icon: "✨" },
];

/**
 * Materiales disponibles
 */
const MATERIALS = [
  { id: "grass", name: "Pasto" },
  { id: "soil", name: "Tierra" },
  { id: "concrete", name: "Concreto" },
  { id: "gravel", name: "Grava" },
];

/**
 * Sugerencias de entrada
 */
const SUGGESTIONS = [
  "Quiero más pasto en el frente",
  "Agregar 3 árboles en la esquina",
  "Cambiar a grava en el lateral",
  "Más flores coloridas aquí",
  "Limpiar esta área",
  "Hacer el diseño más denso",
];

/**
 * Componente DirectedInputPanel
 */
export const DirectedInputPanel: React.FC<DirectedInputPanelProps> = ({
  onAddPlants,
  onChangeMaterial,
  onCustomRequest,
  isLoading = false,
  error,
  success,
}) => {
  const [mode, setMode] = useState<"plants" | "material" | "custom">("plants");
  const [plantType, setPlantType] = useState<string>("flowering");
  const [quantity, setQuantity] = useState<number>(1);
  const [location, setLocation] = useState<string>("");
  const [material, setMaterial] = useState<string>("grass");
  const [customRequest, setCustomRequest] = useState<string>("");

  /**
   * Manejar agregar plantas
   */
  const handleAddPlants = useCallback(() => {
    if (!location.trim()) {
      return;
    }

    if (onAddPlants) {
      onAddPlants(plantType, quantity, location);
      setLocation("");
      setQuantity(1);
    }
  }, [plantType, quantity, location, onAddPlants]);

  /**
   * Manejar cambio de material
   */
  const handleChangeMaterial = useCallback(() => {
    if (!location.trim()) {
      return;
    }

    if (onChangeMaterial) {
      onChangeMaterial(material, location);
      setLocation("");
    }
  }, [material, location, onChangeMaterial]);

  /**
   * Manejar solicitud personalizada
   */
  const handleCustomRequest = useCallback(() => {
    if (!customRequest.trim()) {
      return;
    }

    if (onCustomRequest) {
      onCustomRequest(customRequest);
      setCustomRequest("");
    }
  }, [customRequest, onCustomRequest]);

  /**
   * Aplicar sugerencia
   */
  const applySuggestion = useCallback((suggestion: string) => {
    setCustomRequest(suggestion);
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Control Manual del Diseño</CardTitle>
        <CardDescription>
          Instrucciones en lenguaje natural para modificar el diseño
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tabs de modo */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setMode("plants")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mode === "plants"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Agregar Plantas
          </button>
          <button
            onClick={() => setMode("material")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mode === "material"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Cambiar Material
          </button>
          <button
            onClick={() => setMode("custom")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mode === "custom"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Solicitud Personalizada
          </button>
        </div>

        {/* Modo: Agregar Plantas */}
        {mode === "plants" && (
          <div className="space-y-4">
            {/* Tipo de planta */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de planta:</label>
              <Select value={plantType} onValueChange={setPlantType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANT_TYPES.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.icon} {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cantidad */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Cantidad:</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-1 border rounded hover:bg-gray-50"
                >
                  −
                </button>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="text-center"
                  min="1"
                  max="50"
                />
                <button
                  onClick={() => setQuantity(Math.min(50, quantity + 1))}
                  className="px-3 py-1 border rounded hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </div>

            {/* Ubicación */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Ubicación:</label>
              <Input
                placeholder="Ej: frente, esquina, lateral derecho..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {/* Botón de acción */}
            <Button
              onClick={handleAddPlants}
              disabled={!location.trim() || isLoading}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-2" />
              {isLoading ? "Agregando..." : "Agregar Plantas"}
            </Button>
          </div>
        )}

        {/* Modo: Cambiar Material */}
        {mode === "material" && (
          <div className="space-y-4">
            {/* Material */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Nuevo material:</label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIALS.map((mat) => (
                    <SelectItem key={mat.id} value={mat.id}>
                      {mat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ubicación */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Ubicación:</label>
              <Input
                placeholder="Ej: frente, esquina, lateral derecho..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {/* Botón de acción */}
            <Button
              onClick={handleChangeMaterial}
              disabled={!location.trim() || isLoading}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-2" />
              {isLoading ? "Cambiando..." : "Cambiar Material"}
            </Button>
          </div>
        )}

        {/* Modo: Solicitud Personalizada */}
        {mode === "custom" && (
          <div className="space-y-4">
            {/* Textarea */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tu solicitud:</label>
              <Textarea
                placeholder="Describe lo que quieres cambiar en el diseño..."
                value={customRequest}
                onChange={(e) => setCustomRequest(e.target.value)}
                rows={4}
              />
            </div>

            {/* Sugerencias */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Lightbulb className="w-3 h-3" />
                Sugerencias:
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => applySuggestion(suggestion)}
                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Botón de acción */}
            <Button
              onClick={handleCustomRequest}
              disabled={!customRequest.trim() || isLoading}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-2" />
              {isLoading ? "Procesando..." : "Enviar Solicitud"}
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Éxito */}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
            ✓ {success}
          </div>
        )}

        {/* Información */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          <div className="font-semibold mb-1">💡 Consejos:</div>
          <ul className="space-y-1 list-disc list-inside">
            <li>Sé específico con las ubicaciones</li>
            <li>Indica cantidades claras</li>
            <li>Describe cambios de forma natural</li>
            <li>El sistema respetará tu selección manual</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
