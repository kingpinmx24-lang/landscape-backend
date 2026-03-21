/**
 * ============================================================================
 * USE EDITOR STATE HOOK
 * ============================================================================
 * Manages editor state and actions
 */

import { useCallback, useReducer, useRef } from "react";
import type {
  EditorState,
  EditorAction,
  ActionHistory,
  SnapConfig,
  Guide,
  MeasureInfo,
  TransformInProgress,
  EditorConfig,
} from "@shared/editor-types";
import { EditorTool, TransformMode } from "@shared/editor-types";

/**
 * Acciones del editor
 */
type EditorReducerAction =
  | { type: "SET_TOOL"; tool: EditorTool }
  | { type: "SET_TRANSFORM_MODE"; mode: TransformMode }
  | { type: "SELECT_OBJECT"; objectId: string; multi?: boolean }
  | { type: "DESELECT_OBJECT"; objectId: string }
  | { type: "CLEAR_SELECTION" }
  | { type: "SET_HOVERED"; objectId?: string }
  | { type: "ADD_MEASURE"; measure: MeasureInfo }
  | { type: "REMOVE_MEASURE"; measureId: string }
  | { type: "ADD_GUIDE"; guide: Guide }
  | { type: "REMOVE_GUIDE"; guideId: string }
  | { type: "UPDATE_SNAP"; snap: Partial<SnapConfig> }
  | { type: "ADD_ACTION"; action: EditorAction }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_DIRTY"; dirty: boolean }
  | { type: "SET_LOCKED"; locked: boolean };

/**
 * Estado inicial del editor
 */
const createInitialState = (): EditorState => ({
  currentTool: EditorTool.SELECT,
  transformMode: TransformMode.NONE,
  selectedObjects: new Set(),
  selectedHandles: [],
  measures: [],
  guides: [],
  snap: {
    enabled: true,
    gridSize: 0.5,
    snapToGrid: true,
    snapToObjects: true,
    snapToGuides: true,
    snapDistance: 10,
    showGrid: true,
    showGuides: false,
  },
  history: {
    actions: [],
    currentIndex: -1,
    maxSize: 100,
  },
  isDirty: false,
  isLocked: false,
});

/**
 * Reducer del editor
 */
const editorReducer = (state: EditorState, action: EditorReducerAction): EditorState => {
  switch (action.type) {
    case "SET_TOOL":
      return {
        ...state,
        currentTool: action.tool,
        transformMode: TransformMode.NONE,
      };

    case "SET_TRANSFORM_MODE":
      return {
        ...state,
        transformMode: action.mode,
      };

    case "SELECT_OBJECT": {
      const newSelected = new Set(state.selectedObjects);
      if (action.multi) {
        if (newSelected.has(action.objectId)) {
          newSelected.delete(action.objectId);
        } else {
          newSelected.add(action.objectId);
        }
      } else {
        newSelected.clear();
        newSelected.add(action.objectId);
      }
      return {
        ...state,
        selectedObjects: newSelected,
        isDirty: true,
      };
    }

    case "DESELECT_OBJECT": {
      const newSelected = new Set(state.selectedObjects);
      newSelected.delete(action.objectId);
      return {
        ...state,
        selectedObjects: newSelected,
      };
    }

    case "CLEAR_SELECTION":
      return {
        ...state,
        selectedObjects: new Set(),
      };

    case "SET_HOVERED":
      return {
        ...state,
        hoveredObject: action.objectId,
      };

    case "ADD_MEASURE":
      return {
        ...state,
        measures: [...state.measures, action.measure],
        isDirty: true,
      };

    case "REMOVE_MEASURE":
      return {
        ...state,
        measures: state.measures.filter((m) => m.id !== action.measureId),
        isDirty: true,
      };

    case "ADD_GUIDE":
      return {
        ...state,
        guides: [...state.guides, action.guide],
        isDirty: true,
      };

    case "REMOVE_GUIDE":
      return {
        ...state,
        guides: state.guides.filter((g) => g.id !== action.guideId),
        isDirty: true,
      };

    case "UPDATE_SNAP":
      return {
        ...state,
        snap: {
          ...state.snap,
          ...action.snap,
        },
      };

    case "ADD_ACTION": {
      const newHistory = {
        ...state.history,
        actions: state.history.actions.slice(0, state.history.currentIndex + 1),
        currentIndex: state.history.currentIndex + 1,
      };
      newHistory.actions.push(action.action);

      if (newHistory.actions.length > newHistory.maxSize) {
        newHistory.actions.shift();
        newHistory.currentIndex--;
      }

      return {
        ...state,
        history: newHistory,
        isDirty: true,
      };
    }

    case "UNDO": {
      if (state.history.currentIndex <= 0) return state;
      return {
        ...state,
        history: {
          ...state.history,
          currentIndex: state.history.currentIndex - 1,
        },
      };
    }

    case "REDO": {
      if (state.history.currentIndex >= state.history.actions.length - 1) return state;
      return {
        ...state,
        history: {
          ...state.history,
          currentIndex: state.history.currentIndex + 1,
        },
      };
    }

    case "SET_DIRTY":
      return {
        ...state,
        isDirty: action.dirty,
      };

    case "SET_LOCKED":
      return {
        ...state,
        isLocked: action.locked,
      };

    default:
      return state;
  }
};

/**
 * Hook useEditorState
 */
export const useEditorState = (config?: Partial<EditorConfig>) => {
  const [state, dispatch] = useReducer(editorReducer, createInitialState());
  const transformInProgressRef = useRef<TransformInProgress | null>(null);

  const setTool = useCallback((tool: EditorTool) => {
    dispatch({ type: "SET_TOOL", tool });
  }, []);

  const setTransformMode = useCallback((mode: TransformMode) => {
    dispatch({ type: "SET_TRANSFORM_MODE", mode });
  }, []);

  const selectObject = useCallback((objectId: string, multi = false) => {
    dispatch({ type: "SELECT_OBJECT", objectId, multi });
  }, []);

  const deselectObject = useCallback((objectId: string) => {
    dispatch({ type: "DESELECT_OBJECT", objectId });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: "CLEAR_SELECTION" });
  }, []);

  const setHovered = useCallback((objectId?: string) => {
    dispatch({ type: "SET_HOVERED", objectId });
  }, []);

  const addMeasure = useCallback((measure: MeasureInfo) => {
    dispatch({ type: "ADD_MEASURE", measure });
  }, []);

  const removeMeasure = useCallback((measureId: string) => {
    dispatch({ type: "REMOVE_MEASURE", measureId });
  }, []);

  const addGuide = useCallback((guide: Guide) => {
    dispatch({ type: "ADD_GUIDE", guide });
  }, []);

  const removeGuide = useCallback((guideId: string) => {
    dispatch({ type: "REMOVE_GUIDE", guideId });
  }, []);

  const updateSnap = useCallback((snap: Partial<SnapConfig>) => {
    dispatch({ type: "UPDATE_SNAP", snap });
  }, []);

  const addAction = useCallback((action: EditorAction) => {
    dispatch({ type: "ADD_ACTION", action });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  const setDirty = useCallback((dirty: boolean) => {
    dispatch({ type: "SET_DIRTY", dirty });
  }, []);

  const setLocked = useCallback((locked: boolean) => {
    dispatch({ type: "SET_LOCKED", locked });
  }, []);

  const setTransformInProgress = useCallback((transform: TransformInProgress | null) => {
    transformInProgressRef.current = transform;
  }, []);

  const getTransformInProgress = useCallback(() => {
    return transformInProgressRef.current;
  }, []);

  return {
    state,
    setTool,
    setTransformMode,
    selectObject,
    deselectObject,
    clearSelection,
    setHovered,
    addMeasure,
    removeMeasure,
    addGuide,
    removeGuide,
    updateSnap,
    addAction,
    undo,
    redo,
    setDirty,
    setLocked,
    setTransformInProgress,
    getTransformInProgress,
  };
};

export type UseEditorStateReturn = ReturnType<typeof useEditorState>;
