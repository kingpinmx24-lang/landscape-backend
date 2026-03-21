/**
 * Component: FloatingControls
 * ============================================================================
 * Controles flotantes para edición rápida de objetos seleccionados
 */

import React, { useCallback, useState } from "react";
import { SelectedObject } from "../../../shared/live-interaction-types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Copy, Edit, ChevronDown } from "lucide-react";

interface FloatingControlsProps {
  x: number;
  y: number;
  selectedObject: SelectedObject | null;
  onDelete?: (objectId: string) => void;
  onDuplicate?: (object: SelectedObject) => void;
  onChangeType?: (objectId: string, newType: string) => void;
  availableTypes?: string[];
  isVisible: boolean;
}

/**
 * Tipos de plantas disponibles
 */
const DEFAULT_PLANT_TYPES = [
  "flowering",
  "shrub",
  "tree",
  "groundcover",
  "decorative",
];

/**
 * Componente FloatingControls
 */
export const FloatingControls: React.FC<FloatingControlsProps> = ({
  x,
  y,
  selectedObject,
  onDelete,
  onDuplicate,
  onChangeType,
  availableTypes = DEFAULT_PLANT_TYPES,
  isVisible,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Manejar eliminación
   */
  const handleDelete = useCallback(() => {
    if (selectedObject && onDelete) {
      onDelete(selectedObject.id);
      setIsOpen(false);
    }
  }, [selectedObject, onDelete]);

  /**
   * Manejar duplicación
   */
  const handleDuplicate = useCallback(() => {
    if (selectedObject && onDuplicate) {
      onDuplicate(selectedObject);
      setIsOpen(false);
    }
  }, [selectedObject, onDuplicate]);

  /**
   * Manejar cambio de tipo
   */
  const handleChangeType = useCallback(
    (newType: string) => {
      if (selectedObject && onChangeType) {
        onChangeType(selectedObject.id, newType);
        setIsOpen(false);
      }
    },
    [selectedObject, onChangeType]
  );

  if (!isVisible || !selectedObject) {
    return null;
  }

  // Ajustar posición para que no salga del viewport
  let adjustedX = x;
  let adjustedY = y;

  if (adjustedX + 200 > window.innerWidth) {
    adjustedX = window.innerWidth - 220;
  }
  if (adjustedY + 150 > window.innerHeight) {
    adjustedY = window.innerHeight - 170;
  }

  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2"
      style={{
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
      }}
    >
      <div className="flex flex-col gap-1">
        {/* Botón Mover */}
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-xs"
          disabled
        >
          <span className="text-gray-500">Arrastra para mover</span>
        </Button>

        {/* Botón Cambiar Tipo */}
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="justify-between text-xs"
            >
              <span>Cambiar tipo</span>
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            {availableTypes.map((type) => (
              <DropdownMenuItem
                key={type}
                onClick={() => handleChangeType(type)}
                className="text-xs"
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Botón Duplicar */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleDuplicate}
          className="justify-start text-xs"
        >
          <Copy className="w-3 h-3 mr-1" />
          Duplicar
        </Button>

        {/* Botón Eliminar */}
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          className="justify-start text-xs"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Eliminar
        </Button>

        {/* Información del objeto */}
        <div className="text-xs text-gray-500 border-t pt-1 mt-1">
          <div>ID: {selectedObject.id.substring(0, 8)}</div>
          <div>Tipo: {selectedObject.type}</div>
          <div>
            Pos: ({Math.round(selectedObject.x)}, {Math.round(selectedObject.y)})
          </div>
        </div>
      </div>
    </div>
  );
};
