/**
 * ============================================================================
 * WORKFLOW TYPES
 * ============================================================================
 * Types for guided landscape design workflow
 */

/**
 * Pasos del flujo
 */
export enum WorkflowStep {
  SCAN_TERRAIN = "scan_terrain",
  DETECT_ZONES = "detect_zones",
  GENERATE_DESIGN = "generate_design",
  ADJUST_LIVE = "adjust_live",
  SHOW_QUOTATION = "show_quotation",
  SAVE_PROJECT = "save_project",
  GENERATE_PDF = "generate_pdf",
}

/**
 * Estado de un paso
 */
export enum StepStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  SKIPPED = "skipped",
}

/**
 * Información de un paso
 */
export interface StepInfo {
  step: WorkflowStep;
  status: StepStatus;
  title: string;
  description: string;
  isRequired: boolean;
  canSkip: boolean;
  completedAt?: number;
  errorMessage?: string;
  data?: any;
}

/**
 * Datos de paso 1: Escanear terreno
 */
export interface ScanTerrainData {
  imageUrl?: string;
  imageFile?: File;
  capturedAt?: number;
  deviceInfo?: {
    hasLiDAR: boolean;
    deviceType: string;
    cameraResolution: string;
  };
  terrainDimensions?: {
    width: number;
    height: number;
    unit: string;
  };
}

/**
 * Datos de paso 2: Detectar zonas
 */
export interface DetectZonesData {
  zones: Array<{
    id: string;
    type: "soil" | "grass" | "concrete";
    polygon: Array<{ x: number; y: number }>;
    area: number;
    color: string;
  }>;
  detectionMethod: "auto" | "manual" | "hybrid";
  confidence: number;
  detectedAt?: number;
}

/**
 * Datos de paso 3: Generar diseño
 */
export interface GenerateDesignData {
  designType: "balanced" | "premium" | "high_profit";
  plants: Array<{
    id: string;
    plantId: string;
    x: number;
    y: number;
    quantity: number;
    cost: number;
    margin: number;
  }>;
  totalArea: number;
  totalCost: number;
  totalMargin: number;
  generatedAt?: number;
}

/**
 * Datos de paso 4: Ajustar en vivo
 */
export interface AdjustLiveData {
  modifications: Array<{
    id: string;
    type: "add" | "remove" | "move" | "modify";
    timestamp: number;
    data: any;
  }>;
  currentDesign: GenerateDesignData;
  lastModifiedAt?: number;
  modificationCount: number;
}

/**
 * Datos de paso 5: Mostrar cotización
 */
export interface ShowQuotationData {
  quotationId: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  margin: number;
  marginPercentage: number;
  validUntil?: number;
  notes?: string;
}

/**
 * Datos de paso 6: Guardar proyecto
 */
export interface SaveProjectData {
  projectId: string;
  projectName: string;
  projectDescription?: string;
  savedAt?: number;
  backupUrl?: string;
  version: number;
  status: "draft" | "saved" | "published";
}

/**
 * Datos de paso 7: Generar PDF
 */
export interface GeneratePDFData {
  pdfUrl?: string;
  pdfFile?: Blob;
  generatedAt?: number;
  fileName: string;
  fileSize?: number;
  pages: number;
  includeDesign: boolean;
  includeQuotation: boolean;
  includeMeasures: boolean;
  includeSignature: boolean;
}

/**
 * Datos del flujo completo
 */
export interface WorkflowData {
  projectId: string;
  workflowId: string;
  startedAt: number;
  completedAt?: number;
  currentStep: WorkflowStep;
  steps: Record<WorkflowStep, StepInfo>;
  scanTerrain?: ScanTerrainData;
  detectZones?: DetectZonesData;
  generateDesign?: GenerateDesignData;
  adjustLive?: AdjustLiveData;
  showQuotation?: ShowQuotationData;
  saveProject?: SaveProjectData;
  generatePDF?: GeneratePDFData;
}

/**
 * Validación de paso
 */
export interface StepValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  canProceed: boolean;
  requiredFields: string[];
}

/**
 * Configuración de flujo
 */
export interface WorkflowConfig {
  allowSkipSteps: boolean;
  allowGoBack: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  validateOnNext: boolean;
  showProgress: boolean;
  showEstimatedTime: boolean;
  enableOfflineMode: boolean;
  maxRetries: number;
}

/**
 * Evento de flujo
 */
export interface WorkflowEvent {
  type: "step_completed" | "step_failed" | "step_skipped" | "workflow_completed" | "workflow_failed";
  step: WorkflowStep;
  timestamp: number;
  data?: any;
  error?: string;
}

/**
 * Estado del flujo
 */
export interface WorkflowState {
  workflowId: string;
  projectId: string;
  currentStep: WorkflowStep;
  completedSteps: Set<WorkflowStep>;
  failedSteps: Set<WorkflowStep>;
  stepStatuses: Record<WorkflowStep, StepStatus>;
  data: WorkflowData;
  config: WorkflowConfig;
  isLoading: boolean;
  error?: string;
  progress: number;
  canProceed: boolean;
  canGoBack: boolean;
}

/**
 * Información de validación de paso
 */
export interface StepValidationInfo {
  step: WorkflowStep;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  completionPercentage: number;
}

/**
 * Información de progreso del flujo
 */
export interface WorkflowProgress {
  currentStep: WorkflowStep;
  totalSteps: number;
  completedSteps: number;
  progressPercentage: number;
  estimatedTimeRemaining?: number;
  steps: Array<{
    step: WorkflowStep;
    status: StepStatus;
    title: string;
    isRequired: boolean;
  }>;
}

/**
 * Información de resultado del flujo
 */
export interface WorkflowResult {
  success: boolean;
  workflowId: string;
  projectId: string;
  completedAt: number;
  duration: number;
  stepsCompleted: WorkflowStep[];
  stepsFailed: WorkflowStep[];
  stepsSkipped: WorkflowStep[];
  finalData: WorkflowData;
  pdfUrl?: string;
  errors: string[];
  warnings: string[];
}

/**
 * Información de paso anterior
 */
export interface PreviousStepInfo {
  step: WorkflowStep;
  canReturn: boolean;
  reason?: string;
  dataPreserved: boolean;
}

/**
 * Información de paso siguiente
 */
export interface NextStepInfo {
  step: WorkflowStep;
  canProceed: boolean;
  validationErrors: string[];
  reason?: string;
  estimatedTime?: number;
}

/**
 * Información de resumen del flujo
 */
export interface WorkflowSummary {
  projectName: string;
  projectDescription?: string;
  terrainImage?: string;
  zones: Array<{
    type: string;
    area: number;
    percentage: number;
  }>;
  designType: string;
  plantCount: number;
  totalArea: number;
  totalCost: number;
  totalMargin: number;
  quotationTotal: number;
  startedAt: number;
  completedAt?: number;
  duration?: number;
}

/**
 * Información de error del flujo
 */
export interface WorkflowError {
  step: WorkflowStep;
  errorCode: string;
  errorMessage: string;
  timestamp: number;
  recoverable: boolean;
  suggestedAction?: string;
  details?: any;
}

/**
 * Información de estadísticas del flujo
 */
export interface WorkflowStats {
  totalWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  averageDuration: number;
  averageStepsCompleted: number;
  mostCommonFailureStep: WorkflowStep;
  mostSkippedStep: WorkflowStep;
  successRate: number;
}
