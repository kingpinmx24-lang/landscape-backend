/**
 * ============================================================================
 * WORKFLOW CONTAINER COMPONENT
 * ============================================================================
 * Main container for guided workflow orchestration
 */

import React, { useEffect, useState } from "react";
import { useWorkflow } from "@/hooks/useWorkflow";
import { WorkflowStep } from "@shared/workflow-types";
import type { UseWorkflowReturn } from "@/hooks/useWorkflow";

interface WorkflowContainerProps {
  projectId: string;
  workflowId: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

/**
 * Información de paso para UI
 */
const STEP_INFO = {
  [WorkflowStep.SCAN_TERRAIN]: {
    title: "1. Escanear Terreno",
    description: "Captura una imagen del terreno usando la cámara",
    icon: "📷",
    isRequired: true,
  },
  [WorkflowStep.DETECT_ZONES]: {
    title: "2. Detectar Zonas",
    description: "Detecta automáticamente zonas de tierra, pasto y cemento",
    icon: "🔍",
    isRequired: true,
  },
  [WorkflowStep.GENERATE_DESIGN]: {
    title: "3. Generar Diseño",
    description: "Genera diseño automático optimizado para ganancias",
    icon: "🎨",
    isRequired: true,
  },
  [WorkflowStep.ADJUST_LIVE]: {
    title: "4. Ajustar en Vivo",
    description: "Ajusta el diseño de forma interactiva",
    icon: "✏️",
    isRequired: false,
  },
  [WorkflowStep.SHOW_QUOTATION]: {
    title: "5. Mostrar Cotización",
    description: "Visualiza la cotización con costos y márgenes",
    icon: "💰",
    isRequired: false,
  },
  [WorkflowStep.SAVE_PROJECT]: {
    title: "6. Guardar Proyecto",
    description: "Guarda el proyecto en la base de datos",
    icon: "💾",
    isRequired: true,
  },
  [WorkflowStep.GENERATE_PDF]: {
    title: "7. Generar PDF",
    description: "Genera PDF profesional para presentar al cliente",
    icon: "📄",
    isRequired: true,
  },
};

/**
 * Componente de barra de progreso
 */
const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div style={{ width: "100%", height: "8px", backgroundColor: "#e0e0e0", borderRadius: "4px", overflow: "hidden" }}>
    <div
      style={{
        width: `${progress}%`,
        height: "100%",
        backgroundColor: "#4dabf7",
        transition: "width 0.3s ease",
      }}
    />
  </div>
);

/**
 * Componente de indicador de paso
 */
const StepIndicator: React.FC<{
  steps: WorkflowStep[];
  currentStep: WorkflowStep;
  completedSteps: Set<WorkflowStep>;
  failedSteps: Set<WorkflowStep>;
  onStepClick: (step: WorkflowStep) => void;
}> = ({ steps, currentStep, completedSteps, failedSteps, onStepClick }) => (
  <div
    style={{
      display: "flex",
      gap: "8px",
      padding: "16px",
      backgroundColor: "#f5f5f5",
      borderRadius: "8px",
      overflowX: "auto",
    }}
  >
    {steps.map((step, index) => {
      const isCompleted = completedSteps.has(step);
      const isFailed = failedSteps.has(step);
      const isCurrent = currentStep === step;
      const info = STEP_INFO[step];

      return (
        <button
          key={step}
          onClick={() => onStepClick(step)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            padding: "12px",
            minWidth: "100px",
            backgroundColor: isCurrent ? "#4dabf7" : isCompleted ? "#51cf66" : isFailed ? "#ff6b6b" : "#fff",
            color: isCurrent || isCompleted || isFailed ? "#fff" : "#000",
            border: "1px solid #ddd",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: isCurrent ? "600" : "400",
            transition: "all 0.2s ease",
          }}
        >
          <span style={{ fontSize: "20px" }}>{info.icon}</span>
          <span>{index + 1}</span>
          {isCompleted && <span>✓</span>}
          {isFailed && <span>✗</span>}
        </button>
      );
    })}
  </div>
);

/**
 * Componente de contenedor de paso
 */
const StepContent: React.FC<{
  step: WorkflowStep;
  children: React.ReactNode;
}> = ({ step, children }) => {
  const info = STEP_INFO[step];

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "600" }}>
          {info.icon} {info.title}
        </h2>
        <p style={{ margin: "0", color: "#666", fontSize: "14px" }}>{info.description}</p>
      </div>

      <div style={{ minHeight: "300px", marginBottom: "24px" }}>{children}</div>
    </div>
  );
};

/**
 * Componente de controles de navegación
 */
const NavigationControls: React.FC<{
  canGoBack: boolean;
  canProceed: boolean;
  isLoading: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSkip?: () => void;
  canSkip?: boolean;
}> = ({ canGoBack, canProceed, isLoading, onPrevious, onNext, onSkip, canSkip }) => (
  <div
    style={{
      display: "flex",
      gap: "12px",
      padding: "16px 24px",
      backgroundColor: "#f5f5f5",
      borderTop: "1px solid #ddd",
      justifyContent: "space-between",
    }}
  >
    <button
      onClick={onPrevious}
      disabled={!canGoBack || isLoading}
      style={{
        padding: "10px 20px",
        backgroundColor: canGoBack && !isLoading ? "#fff" : "#e0e0e0",
        color: canGoBack && !isLoading ? "#000" : "#999",
        border: "1px solid #ddd",
        borderRadius: "4px",
        cursor: canGoBack && !isLoading ? "pointer" : "not-allowed",
        fontSize: "14px",
        fontWeight: "500",
      }}
    >
      ← Anterior
    </button>

    <div style={{ display: "flex", gap: "12px" }}>
      {canSkip && (
        <button
          onClick={onSkip}
          disabled={isLoading}
          style={{
            padding: "10px 20px",
            backgroundColor: "#fff",
            color: "#666",
            border: "1px solid #ddd",
            borderRadius: "4px",
            cursor: isLoading ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          Saltar
        </button>
      )}

      <button
        onClick={onNext}
        disabled={!canProceed || isLoading}
        style={{
          padding: "10px 20px",
          backgroundColor: canProceed && !isLoading ? "#4dabf7" : "#ccc",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: canProceed && !isLoading ? "pointer" : "not-allowed",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        {isLoading ? "Procesando..." : "Siguiente →"}
      </button>
    </div>
  </div>
);

/**
 * Componente principal del flujo guiado
 */
export const WorkflowContainer: React.FC<WorkflowContainerProps> = ({
  projectId,
  workflowId,
  onComplete,
  onError,
}) => {
  const workflow = useWorkflow(projectId, workflowId);
  const [stepContent, setStepContent] = useState<React.ReactNode>(null);

  const STEPS = Object.values(WorkflowStep);

  /**
   * Manejar clic en paso
   */
  const handleStepClick = (step: WorkflowStep) => {
    const success = workflow.goToStep(step);
    if (!success && workflow.state.error) {
      onError?.(workflow.state.error);
    }
  };

  /**
   * Manejar siguiente paso
   */
  const handleNext = async () => {
    workflow.setLoading(true);
    const success = await workflow.proceedToNextStep();
    workflow.setLoading(false);

    if (!success && workflow.state.error) {
      onError?.(workflow.state.error);
    }

    // Verificar si es el último paso
    if (workflow.state.currentStep === WorkflowStep.GENERATE_PDF && success) {
      onComplete?.(workflow.state.data);
    }
  };

  /**
   * Manejar paso anterior
   */
  const handlePrevious = () => {
    const success = workflow.goToPreviousStep();
    if (!success && workflow.state.error) {
      onError?.(workflow.state.error);
    }
  };

  /**
   * Manejar saltar paso
   */
  const handleSkip = () => {
    const success = workflow.skipStep(workflow.state.currentStep);
    if (!success && workflow.state.error) {
      onError?.(workflow.state.error);
    } else if (success) {
      handleNext();
    }
  };

  /**
   * Renderizar contenido del paso
   */
  useEffect(() => {
    // Aquí se renderizaría el contenido específico de cada paso
    // Por ahora, mostramos un placeholder
    const content = (
      <div style={{ textAlign: "center", color: "#666" }}>
        <p>Contenido del paso: {workflow.state.currentStep}</p>
        <p>Datos: {JSON.stringify(workflow.state.data, null, 2)}</p>
      </div>
    );

    setStepContent(content);
  }, [workflow.state.currentStep, workflow.state.data]);

  const nextStepInfo = workflow.getNextStepInfo();
  const previousStepInfo = workflow.getPreviousStepInfo();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "#fff",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #ddd" }}>
        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#666" }}>Progreso</span>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#666" }}>
              {workflow.state.completedSteps.size + 1} de {STEPS.length}
            </span>
          </div>
          <ProgressBar progress={workflow.state.progress} />
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator
        steps={STEPS}
        currentStep={workflow.state.currentStep}
        completedSteps={workflow.state.completedSteps}
        failedSteps={workflow.state.failedSteps}
        onStepClick={handleStepClick}
      />

      {/* Error Message */}
      {workflow.state.error && (
        <div
          style={{
            padding: "12px 24px",
            backgroundColor: "#ffe0e0",
            color: "#c92a2a",
            borderBottom: "1px solid #ffc9c9",
            fontSize: "14px",
          }}
        >
          ⚠️ {workflow.state.error}
        </div>
      )}

      {/* Step Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <StepContent step={workflow.state.currentStep}>{stepContent}</StepContent>
      </div>

      {/* Navigation Controls */}
      <NavigationControls
        canGoBack={previousStepInfo?.canReturn ?? false}
        canProceed={nextStepInfo?.canProceed ?? false}
        isLoading={workflow.state.isLoading}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onSkip={STEP_INFO[workflow.state.currentStep].isRequired ? undefined : handleSkip}
        canSkip={!STEP_INFO[workflow.state.currentStep].isRequired}
      />
    </div>
  );
};

export default WorkflowContainer;
