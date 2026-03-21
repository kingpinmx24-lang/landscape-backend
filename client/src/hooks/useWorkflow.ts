/**
 * ============================================================================
 * USE WORKFLOW HOOK
 * ============================================================================
 * Manages guided workflow state and navigation
 */

import { useCallback, useReducer, useRef } from "react";
import type {
  WorkflowState,
  WorkflowData,
  StepValidation,
  WorkflowConfig,
  NextStepInfo,
  PreviousStepInfo,
} from "@shared/workflow-types";
import { WorkflowStep, StepStatus } from "@shared/workflow-types";

/**
 * Acciones del reducer
 */
type WorkflowAction =
  | { type: "INITIALIZE"; projectId: string; workflowId: string }
  | { type: "SET_CURRENT_STEP"; step: WorkflowStep }
  | { type: "COMPLETE_STEP"; step: WorkflowStep; data: any }
  | { type: "FAIL_STEP"; step: WorkflowStep; error: string }
  | { type: "SKIP_STEP"; step: WorkflowStep }
  | { type: "UPDATE_STEP_DATA"; step: WorkflowStep; data: any }
  | { type: "SET_STEP_STATUS"; step: WorkflowStep; status: StepStatus }
  | { type: "SET_ERROR"; error: string }
  | { type: "CLEAR_ERROR" }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "UPDATE_CONFIG"; config: Partial<WorkflowConfig> }
  | { type: "RESET_WORKFLOW" };

/**
 * Estado inicial del flujo
 */
const createInitialState = (projectId: string, workflowId: string): WorkflowState => ({
  workflowId,
  projectId,
  currentStep: WorkflowStep.SCAN_TERRAIN,
  completedSteps: new Set(),
  failedSteps: new Set(),
  stepStatuses: {
    [WorkflowStep.SCAN_TERRAIN]: StepStatus.PENDING,
    [WorkflowStep.DETECT_ZONES]: StepStatus.PENDING,
    [WorkflowStep.GENERATE_DESIGN]: StepStatus.PENDING,
    [WorkflowStep.ADJUST_LIVE]: StepStatus.PENDING,
    [WorkflowStep.SHOW_QUOTATION]: StepStatus.PENDING,
    [WorkflowStep.SAVE_PROJECT]: StepStatus.PENDING,
    [WorkflowStep.GENERATE_PDF]: StepStatus.PENDING,
  },
  data: {
    projectId,
    workflowId,
    startedAt: Date.now(),
    currentStep: WorkflowStep.SCAN_TERRAIN,
    steps: {},
  } as any,
  config: {
    allowSkipSteps: false,
    allowGoBack: true,
    autoSave: true,
    autoSaveInterval: 30000,
    validateOnNext: true,
    showProgress: true,
    showEstimatedTime: true,
    enableOfflineMode: false,
    maxRetries: 3,
  },
  isLoading: false,
  progress: 0,
  canProceed: false,
  canGoBack: false,
});

/**
 * Orden de pasos
 */
const STEP_ORDER: WorkflowStep[] = [
  WorkflowStep.SCAN_TERRAIN,
  WorkflowStep.DETECT_ZONES,
  WorkflowStep.GENERATE_DESIGN,
  WorkflowStep.ADJUST_LIVE,
  WorkflowStep.SHOW_QUOTATION,
  WorkflowStep.SAVE_PROJECT,
  WorkflowStep.GENERATE_PDF,
];

/**
 * Pasos requeridos (no pueden saltarse)
 */
const REQUIRED_STEPS = new Set([
  WorkflowStep.SCAN_TERRAIN,
  WorkflowStep.DETECT_ZONES,
  WorkflowStep.GENERATE_DESIGN,
  WorkflowStep.SAVE_PROJECT,
  WorkflowStep.GENERATE_PDF,
]);

/**
 * Reducer del flujo
 */
const workflowReducer = (state: WorkflowState, action: WorkflowAction): WorkflowState => {
  switch (action.type) {
    case "INITIALIZE":
      return createInitialState(action.projectId, action.workflowId);

    case "SET_CURRENT_STEP":
      return {
        ...state,
        currentStep: action.step,
        stepStatuses: {
          ...state.stepStatuses,
          [action.step]: StepStatus.IN_PROGRESS,
        },
      };

    case "COMPLETE_STEP": {
      const completedSteps = new Set(state.completedSteps);
      completedSteps.add(action.step);
      const progress = (completedSteps.size / STEP_ORDER.length) * 100;

      return {
        ...state,
        completedSteps,
        stepStatuses: {
          ...state.stepStatuses,
          [action.step]: StepStatus.COMPLETED,
        },
        data: {
          ...state.data,
          [action.step]: action.data,
        },
        progress,
      };
    }

    case "FAIL_STEP": {
      const failedSteps = new Set(state.failedSteps);
      failedSteps.add(action.step);

      return {
        ...state,
        failedSteps,
        stepStatuses: {
          ...state.stepStatuses,
          [action.step]: StepStatus.FAILED,
        },
        error: action.error,
      };
    }

    case "SKIP_STEP": {
      if (REQUIRED_STEPS.has(action.step)) {
        return state; // No permitir saltar pasos requeridos
      }

      return {
        ...state,
        stepStatuses: {
          ...state.stepStatuses,
          [action.step]: StepStatus.SKIPPED,
        },
      };
    }

    case "UPDATE_STEP_DATA":
      return {
        ...state,
        data: {
          ...state.data,
          [action.step]: action.data,
        },
      };

    case "SET_STEP_STATUS":
      return {
        ...state,
        stepStatuses: {
          ...state.stepStatuses,
          [action.step]: action.status,
        },
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.error,
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        error: undefined,
      };

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.loading,
      };

    case "UPDATE_CONFIG":
      return {
        ...state,
        config: {
          ...state.config,
          ...action.config,
        },
      };

    case "RESET_WORKFLOW":
      return createInitialState(state.projectId, state.workflowId);

    default:
      return state;
  }
};

/**
 * Hook useWorkflow
 */
export const useWorkflow = (projectId: string, workflowId: string) => {
  const [state, dispatch] = useReducer(
    workflowReducer,
    { projectId, workflowId },
    (initial) => createInitialState(initial.projectId, initial.workflowId)
  );

  const validationsRef = useRef<Record<WorkflowStep, StepValidation | null>>({
    [WorkflowStep.SCAN_TERRAIN]: null,
    [WorkflowStep.DETECT_ZONES]: null,
    [WorkflowStep.GENERATE_DESIGN]: null,
    [WorkflowStep.ADJUST_LIVE]: null,
    [WorkflowStep.SHOW_QUOTATION]: null,
    [WorkflowStep.SAVE_PROJECT]: null,
    [WorkflowStep.GENERATE_PDF]: null,
  });

  /**
   * Obtener índice del paso actual
   */
  const getCurrentStepIndex = useCallback((): number => {
    return STEP_ORDER.indexOf(state.currentStep);
  }, [state.currentStep]);

  /**
   * Obtener paso siguiente
   */
  const getNextStep = useCallback((): WorkflowStep | null => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex >= STEP_ORDER.length - 1) return null;
    return STEP_ORDER[currentIndex + 1];
  }, [getCurrentStepIndex]);

  /**
   * Obtener paso anterior
   */
  const getPreviousStep = useCallback((): WorkflowStep | null => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex <= 0) return null;
    return STEP_ORDER[currentIndex - 1];
  }, [getCurrentStepIndex]);

  /**
   * Validar paso actual
   */
  const validateCurrentStep = useCallback((): StepValidation => {
    const validation: StepValidation = {
      valid: true,
      errors: [],
      warnings: [],
      canProceed: true,
      requiredFields: [],
    };

    // Validaciones específicas por paso
    switch (state.currentStep) {
      case WorkflowStep.SCAN_TERRAIN:
        if (!state.data.scanTerrain?.imageUrl && !state.data.scanTerrain?.imageFile) {
          validation.errors.push("Terreno no escaneado");
          validation.requiredFields.push("imageUrl");
          validation.canProceed = false;
        }
        break;

      case WorkflowStep.DETECT_ZONES:
        if (!state.data.detectZones?.zones || state.data.detectZones.zones.length === 0) {
          validation.errors.push("Zonas no detectadas");
          validation.requiredFields.push("zones");
          validation.canProceed = false;
        }
        break;

      case WorkflowStep.GENERATE_DESIGN:
        if (!state.data.generateDesign?.plants || state.data.generateDesign.plants.length === 0) {
          validation.errors.push("Diseño no generado");
          validation.requiredFields.push("plants");
          validation.canProceed = false;
        }
        break;

      case WorkflowStep.ADJUST_LIVE:
        if (!state.data.adjustLive?.currentDesign) {
          validation.errors.push("Diseño no disponible para ajustar");
          validation.canProceed = false;
        }
        break;

      case WorkflowStep.SHOW_QUOTATION:
        if (!state.data.showQuotation?.items || state.data.showQuotation.items.length === 0) {
          validation.errors.push("Cotización no disponible");
          validation.requiredFields.push("items");
          validation.canProceed = false;
        }
        break;

      case WorkflowStep.SAVE_PROJECT:
        if (!state.data.saveProject?.projectId) {
          validation.errors.push("Proyecto no guardado");
          validation.requiredFields.push("projectId");
          validation.canProceed = false;
        }
        break;

      case WorkflowStep.GENERATE_PDF:
        if (!state.data.generatePDF?.pdfUrl && !state.data.generatePDF?.pdfFile) {
          validation.errors.push("PDF no generado");
          validation.requiredFields.push("pdfUrl");
          validation.canProceed = false;
        }
        break;
    }

    validation.valid = validation.errors.length === 0;
    validationsRef.current[state.currentStep] = validation;

    return validation;
  }, [state.currentStep, state.data]);

  /**
   * Proceder al siguiente paso
   */
  const proceedToNextStep = useCallback(async (): Promise<boolean> => {
    if (state.config.validateOnNext) {
      const validation = validateCurrentStep();
      if (!validation.canProceed) {
        dispatch({
          type: "SET_ERROR",
          error: `No se puede proceder: ${validation.errors.join(", ")}`,
        });
        return false;
      }
    }

    const nextStep = getNextStep();
    if (!nextStep) {
      dispatch({ type: "SET_ERROR", error: "No hay más pasos" });
      return false;
    }

    // Marcar paso actual como completado
    const stepData =
      state.currentStep === WorkflowStep.SCAN_TERRAIN
        ? state.data.scanTerrain
        : state.currentStep === WorkflowStep.DETECT_ZONES
          ? state.data.detectZones
          : state.currentStep === WorkflowStep.GENERATE_DESIGN
            ? state.data.generateDesign
            : state.currentStep === WorkflowStep.ADJUST_LIVE
              ? state.data.adjustLive
              : state.currentStep === WorkflowStep.SHOW_QUOTATION
                ? state.data.showQuotation
                : state.currentStep === WorkflowStep.SAVE_PROJECT
                  ? state.data.saveProject
                  : state.data.generatePDF;

    dispatch({
      type: "COMPLETE_STEP",
      step: state.currentStep,
      data: stepData,
    });

    // Ir al siguiente paso
    dispatch({ type: "SET_CURRENT_STEP", step: nextStep });
    dispatch({ type: "CLEAR_ERROR" });

    return true;
  }, [state.config.validateOnNext, state.currentStep, state.data, validateCurrentStep, getNextStep]);

  /**
   * Volver al paso anterior
   */
  const goToPreviousStep = useCallback((): boolean => {
    if (!state.config.allowGoBack) {
      dispatch({ type: "SET_ERROR", error: "No se puede volver atrás" });
      return false;
    }

    const previousStep = getPreviousStep();
    if (!previousStep) {
      dispatch({ type: "SET_ERROR", error: "No hay pasos anteriores" });
      return false;
    }

    dispatch({ type: "SET_CURRENT_STEP", step: previousStep });
    dispatch({ type: "CLEAR_ERROR" });

    return true;
  }, [state.config.allowGoBack, getPreviousStep]);

  /**
   * Ir a paso específico
   */
  const goToStep = useCallback((step: WorkflowStep): boolean => {
    const stepIndex = STEP_ORDER.indexOf(step);
    const currentIndex = getCurrentStepIndex();

    if (stepIndex < 0) {
      dispatch({ type: "SET_ERROR", error: "Paso inválido" });
      return false;
    }

    // No permitir saltar pasos requeridos
    if (stepIndex > currentIndex) {
      for (let i = currentIndex + 1; i < stepIndex; i++) {
        const intermediateStep = STEP_ORDER[i];
        if (REQUIRED_STEPS.has(intermediateStep)) {
          dispatch({
            type: "SET_ERROR",
            error: `No se puede saltar el paso requerido: ${intermediateStep}`,
          });
          return false;
        }
      }
    }

    dispatch({ type: "SET_CURRENT_STEP", step });
    dispatch({ type: "CLEAR_ERROR" });

    return true;
  }, [getCurrentStepIndex]);

  /**
   * Completar paso
   */
  const completeStep = useCallback((step: WorkflowStep, data: any) => {
    dispatch({ type: "COMPLETE_STEP", step, data });
  }, []);

  /**
   * Fallar paso
   */
  const failStep = useCallback((step: WorkflowStep, error: string) => {
    dispatch({ type: "FAIL_STEP", step, error });
  }, []);

  /**
   * Saltar paso
   */
  const skipStep = useCallback((step: WorkflowStep): boolean => {
    if (REQUIRED_STEPS.has(step)) {
      dispatch({
        type: "SET_ERROR",
        error: `No se puede saltar el paso requerido: ${step}`,
      });
      return false;
    }

    dispatch({ type: "SKIP_STEP", step });
    return true;
  }, []);

  /**
   * Actualizar datos de paso
   */
  const updateStepData = useCallback((step: WorkflowStep, data: any) => {
    dispatch({ type: "UPDATE_STEP_DATA", step, data });
  }, []);

  /**
   * Obtener información del siguiente paso
   */
  const getNextStepInfo = useCallback((): NextStepInfo | null => {
    const nextStep = getNextStep();
    if (!nextStep) return null;

    const validation = validateCurrentStep();

    return {
      step: nextStep,
      canProceed: validation.canProceed,
      validationErrors: validation.errors,
      reason: validation.errors.length > 0 ? validation.errors[0] : undefined,
    };
  }, [getNextStep, validateCurrentStep]);

  /**
   * Obtener información del paso anterior
   */
  const getPreviousStepInfo = useCallback((): PreviousStepInfo | null => {
    const previousStep = getPreviousStep();
    if (!previousStep) return null;

    return {
      step: previousStep,
      canReturn: state.config.allowGoBack,
      reason: !state.config.allowGoBack ? "No se puede volver atrás" : undefined,
      dataPreserved: true,
    };
  }, [getPreviousStep, state.config.allowGoBack]);

  /**
   * Resetear flujo
   */
  const resetWorkflow = useCallback(() => {
    dispatch({ type: "RESET_WORKFLOW" });
  }, []);

  /**
   * Actualizar configuración
   */
  const updateConfig = useCallback((config: Partial<WorkflowConfig>) => {
    dispatch({ type: "UPDATE_CONFIG", config });
  }, []);

  /**
   * Establecer loading
   */
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_LOADING", loading });
  }, []);

  /**
   * Limpiar error
   */
  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  return {
    state,
    proceedToNextStep,
    goToPreviousStep,
    goToStep,
    completeStep,
    failStep,
    skipStep,
    updateStepData,
    validateCurrentStep,
    getNextStepInfo,
    getPreviousStepInfo,
    getCurrentStepIndex,
    getNextStep,
    getPreviousStep,
    resetWorkflow,
    updateConfig,
    setLoading,
    clearError,
  };
};

export type UseWorkflowReturn = ReturnType<typeof useWorkflow>;
