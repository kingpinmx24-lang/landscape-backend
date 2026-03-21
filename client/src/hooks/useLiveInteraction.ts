/**
 * Hook: useLiveInteraction
 * ============================================================================
 * Gestión de estado para interacción en vivo del canvas
 */

import { useReducer, useCallback, useRef, useEffect } from "react";
import {
  LiveInteractionState,
  LiveInteractionConfig,
  LiveActionType,
  SelectionMode,
  DEFAULT_LIVE_INTERACTION_CONFIG,
  SelectedObject,
  MoveData,
  DeleteData,
  ChangeTypeData,
  DuplicateData,
  ApplyMaterialData,
  CleanAreaData,
  ValidationResult,
} from "../../../shared/live-interaction-types";

/**
 * Acciones del reducer
 */
type Action =
  | { type: "SELECT_OBJECT"; payload: SelectedObject }
  | { type: "DESELECT_ALL" }
  | { type: "START_DRAG"; payload: { x: number; y: number } }
  | { type: "UPDATE_DRAG"; payload: { x: number; y: number } }
  | { type: "END_DRAG" }
  | { type: "MOVE_OBJECT"; payload: MoveData }
  | { type: "DELETE_OBJECT"; payload: DeleteData }
  | { type: "CHANGE_TYPE"; payload: ChangeTypeData }
  | { type: "DUPLICATE_OBJECT"; payload: DuplicateData }
  | { type: "APPLY_MATERIAL"; payload: ApplyMaterialData }
  | { type: "CLEAN_AREA"; payload: CleanAreaData }
  | { type: "SHOW_FLOATING_CONTROLS"; payload: { x: number; y: number } }
  | { type: "HIDE_FLOATING_CONTROLS" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | undefined }
  | { type: "RESET" };

/**
 * Estado inicial
 */
const initialState: LiveInteractionState = {
  selectedObjects: [],
  selectionMode: SelectionMode.NONE,
  isDragging: false,
  showFloatingControls: false,
  history: [],
  historyIndex: -1,
  isLoading: false,
  lastUpdate: Date.now(),
};

/**
 * Reducer
 */
function liveInteractionReducer(
  state: LiveInteractionState,
  action: Action
): LiveInteractionState {
  switch (action.type) {
    case "SELECT_OBJECT": {
      const isAlreadySelected = state.selectedObjects.some(
        (obj: SelectedObject) => obj.id === action.payload.id
      );

      if (isAlreadySelected) {
        return state;
      }

      return {
        ...state,
        selectedObjects: [action.payload],
        selectionMode: SelectionMode.SINGLE,
        showFloatingControls: true,
        floatingControlsX: action.payload.x,
        floatingControlsY: action.payload.y,
        lastUpdate: Date.now(),
      };
    }

    case "DESELECT_ALL": {
      return {
        ...state,
        selectedObjects: [],
        selectionMode: SelectionMode.NONE,
        showFloatingControls: false,
        lastUpdate: Date.now(),
      };
    }

    case "START_DRAG": {
      return {
        ...state,
        isDragging: true,
        dragStartX: action.payload.x,
        dragStartY: action.payload.y,
        dragOffsetX: 0,
        dragOffsetY: 0,
      };
    }

    case "UPDATE_DRAG": {
      if (!state.isDragging || state.dragStartX === undefined || state.dragStartY === undefined) {
        return state;
      }

      return {
        ...state,
        dragOffsetX: action.payload.x - state.dragStartX,
        dragOffsetY: action.payload.y - state.dragStartY,
      };
    }

    case "END_DRAG": {
      return {
        ...state,
        isDragging: false,
        dragStartX: undefined,
        dragStartY: undefined,
        dragOffsetX: undefined,
        dragOffsetY: undefined,
      };
    }

    case "MOVE_OBJECT": {
      // Agregar a historial
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({
        type: LiveActionType.MOVE,
        timestamp: Date.now(),
        data: action.payload as unknown as Record<string, unknown>,
        previousState: {
          selectedObjects: state.selectedObjects,
        },
      });

      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        lastUpdate: Date.now(),
      };
    }

    case "DELETE_OBJECT": {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({
        type: LiveActionType.DELETE,
        timestamp: Date.now(),
        data: action.payload as unknown as Record<string, unknown>,
        previousState: {
          selectedObjects: state.selectedObjects,
        },
      });

      return {
        ...state,
        selectedObjects: state.selectedObjects.filter(
          (obj: SelectedObject) => obj.id !== action.payload.objectId
        ),
        history: newHistory,
        historyIndex: newHistory.length - 1,
        showFloatingControls: false,
        lastUpdate: Date.now(),
      };
    }

    case "CHANGE_TYPE": {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({
        type: LiveActionType.CHANGE_TYPE,
        timestamp: Date.now(),
        data: action.payload as unknown as Record<string, unknown>,
        previousState: {
          selectedObjects: state.selectedObjects,
        },
      });

      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        lastUpdate: Date.now(),
      };
    }

    case "DUPLICATE_OBJECT": {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({
        type: LiveActionType.DUPLICATE,
        timestamp: Date.now(),
        data: action.payload as unknown as Record<string, unknown>,
        previousState: {
          selectedObjects: state.selectedObjects,
        },
      });

      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        lastUpdate: Date.now(),
      };
    }

    case "APPLY_MATERIAL": {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({
        type: LiveActionType.APPLY_MATERIAL,
        timestamp: Date.now(),
        data: action.payload as unknown as Record<string, unknown>,
      });

      return {
        ...state,
        selectedMaterial: action.payload.material,
        selectedArea: action.payload.area,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        lastUpdate: Date.now(),
      };
    }

    case "CLEAN_AREA": {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({
        type: LiveActionType.CLEAN_AREA,
        timestamp: Date.now(),
        data: action.payload as unknown as Record<string, unknown>,
      });

      return {
        ...state,
        selectedObjects: state.selectedObjects.filter(
          (obj: SelectedObject) => !action.payload.objectsRemoved.includes(obj.id)
        ),
        history: newHistory,
        historyIndex: newHistory.length - 1,
        lastUpdate: Date.now(),
      };
    }

    case "SHOW_FLOATING_CONTROLS": {
      return {
        ...state,
        showFloatingControls: true,
        floatingControlsX: action.payload.x,
        floatingControlsY: action.payload.y,
      };
    }

    case "HIDE_FLOATING_CONTROLS": {
      return {
        ...state,
        showFloatingControls: false,
      };
    }

    case "UNDO": {
      if (state.historyIndex <= 0) {
        return state;
      }

      return {
        ...state,
        historyIndex: state.historyIndex - 1,
        lastUpdate: Date.now(),
      };
    }

    case "REDO": {
      if (state.historyIndex >= state.history.length - 1) {
        return state;
      }

      return {
        ...state,
        historyIndex: state.historyIndex + 1,
        lastUpdate: Date.now(),
      };
    }

    case "SET_LOADING": {
      return {
        ...state,
        isLoading: action.payload,
      };
    }

    case "SET_ERROR": {
      return {
        ...state,
        error: action.payload,
      };
    }

    case "RESET": {
      return initialState;
    }

    default:
      return state;
  }
}

/**
 * Hook useLiveInteraction
 */
export function useLiveInteraction(
  config: Partial<LiveInteractionConfig> = {}
) {
  const [state, dispatch] = useReducer(
    liveInteractionReducer,
    initialState
  ) as [LiveInteractionState, React.Dispatch<Action>];

  const finalConfig: LiveInteractionConfig = {
    ...DEFAULT_LIVE_INTERACTION_CONFIG,
    ...config,
  };

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * Seleccionar objeto
   */
  const selectObject = useCallback((object: SelectedObject) => {
    dispatch({ type: "SELECT_OBJECT", payload: object });
  }, []);

  /**
   * Deseleccionar todos
   */
  const deselectAll = useCallback(() => {
    dispatch({ type: "DESELECT_ALL" });
  }, []);

  /**
   * Iniciar arrastre
   */
  const startDrag = useCallback((x: number, y: number) => {
    dispatch({ type: "START_DRAG", payload: { x, y } });
  }, []);

  /**
   * Actualizar arrastre
   */
  const updateDrag = useCallback((x: number, y: number) => {
    dispatch({ type: "UPDATE_DRAG", payload: { x, y } });
  }, []);

  /**
   * Finalizar arrastre
   */
  const endDrag = useCallback(() => {
    dispatch({ type: "END_DRAG" });
  }, []);

  /**
   * Mover objeto
   */
  const moveObject = useCallback((moveData: MoveData) => {
    dispatch({ type: "MOVE_OBJECT", payload: moveData });
  }, []);

  /**
   * Eliminar objeto
   */
  const deleteObject = useCallback((deleteData: DeleteData) => {
    dispatch({ type: "DELETE_OBJECT", payload: deleteData });
  }, []);

  /**
   * Cambiar tipo
   */
  const changeType = useCallback((changeTypeData: ChangeTypeData) => {
    dispatch({ type: "CHANGE_TYPE", payload: changeTypeData });
  }, []);

  /**
   * Duplicar objeto
   */
  const duplicateObject = useCallback((duplicateData: DuplicateData) => {
    dispatch({ type: "DUPLICATE_OBJECT", payload: duplicateData });
  }, []);

  /**
   * Aplicar material
   */
  const applyMaterial = useCallback((materialData: ApplyMaterialData) => {
    dispatch({ type: "APPLY_MATERIAL", payload: materialData });
  }, []);

  /**
   * Limpiar área
   */
  const cleanArea = useCallback((cleanData: CleanAreaData) => {
    dispatch({ type: "CLEAN_AREA", payload: cleanData });
  }, []);

  /**
   * Mostrar controles flotantes
   */
  const showFloatingControls = useCallback((x: number, y: number) => {
    dispatch({ type: "SHOW_FLOATING_CONTROLS", payload: { x, y } });
  }, []);

  /**
   * Ocultar controles flotantes
   */
  const hideFloatingControls = useCallback(() => {
    dispatch({ type: "HIDE_FLOATING_CONTROLS" });
  }, []);

  /**
   * Deshacer
   */
  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  /**
   * Rehacer
   */
  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  /**
   * Establecer cargando
   */
  const setLoading = useCallback((isLoading: boolean) => {
    dispatch({ type: "SET_LOADING", payload: isLoading });
  }, []);

  /**
   * Establecer error
   */
  const setError = useCallback((error: string | undefined) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  /**
   * Resetear estado
   */
  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  /**
   * Validar movimiento
   */
  const validateMove = useCallback(
    (fromX: number, fromY: number, toX: number, toY: number): ValidationResult => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];

      if (!finalConfig.validateBeforeMove) {
        return { isValid: true, errors, warnings, suggestions };
      }

      // Validar que el objeto no salga del canvas
      if (toX < 0 || toY < 0) {
        errors.push("El objeto no puede moverse fuera del canvas");
      }

      // Validar distancia mínima
      const distance = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
      if (distance > 500) {
        warnings.push("Movimiento muy grande detectado");
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
      };
    },
    [finalConfig.validateBeforeMove]
  );

  /**
   * Puede deshacer
   */
  const canUndo = state.historyIndex > 0;

  /**
   * Puede rehacer
   */
  const canRedo = state.historyIndex < state.history.length - 1;

  /**
   * Limpiar timeout de auto-guardado
   */
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Estado
    state,
    config: finalConfig,

    // Métodos de selección
    selectObject,
    deselectAll,

    // Métodos de movimiento
    startDrag,
    updateDrag,
    endDrag,
    moveObject,

    // Métodos de edición
    deleteObject,
    changeType,
    duplicateObject,

    // Métodos de material
    applyMaterial,
    cleanArea,

    // Métodos de UI
    showFloatingControls,
    hideFloatingControls,

    // Métodos de historial
    undo,
    redo,
    canUndo,
    canRedo,

    // Métodos de estado
    setLoading,
    setError,
    reset,

    // Validación
    validateMove,
  };
}
