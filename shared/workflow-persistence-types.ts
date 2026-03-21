/**
 * Workflow Persistence Types
 * ============================================================================
 * Tipos para persistencia completa del flujo de trabajo
 */

import { WorkflowStep } from "./workflow-types";

/**
 * Estado de un proyecto en el flujo
 */
export enum ProjectFlowStatus {
  DRAFT = "draft",
  CAPTURING = "capturing",
  ANALYZING = "analyzing",
  DESIGNING = "designing",
  ADJUSTING = "adjusting",
  PRESENTING = "presenting",
  APPROVED = "approved",
  REJECTED = "rejected",
  COMPLETED = "completed",
}

/**
 * Datos de captura (paso 1)
 */
export interface CaptureData {
  imageUrl: string;
  imageBase64?: string;
  timestamp: number;
  deviceModel?: string;
  hasLiDAR?: boolean;
  cameraType?: string;
  measurements?: {
    width?: number;
    height?: number;
    area?: number;
  };
}

/**
 * Zona detectada (paso 2)
 */
export interface DetectedZone {
  id: string;
  type: "soil" | "grass" | "concrete" | "water" | "other";
  polygon: Array<{ x: number; y: number }>;
  area: number;
  color: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * Datos de análisis (paso 2)
 */
export interface AnalysisData {
  zones: DetectedZone[];
  totalArea: number;
  terrainType: string;
  sunExposure?: "full" | "partial" | "shade";
  soilQuality?: "poor" | "fair" | "good" | "excellent";
  drainageLevel?: "poor" | "fair" | "good";
  timestamp: number;
}

/**
 * Objeto de planta en el diseño
 */
export interface PlantObject {
  id: string;
  type: string;
  x: number;
  y: number;
  radius: number;
  rotation?: number;
  scale?: number;
  name: string;
  cost: number;
  zone?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Material de área
 */
export interface MaterialArea {
  id: string;
  type: "soil" | "grass" | "concrete" | "gravel";
  polygon: Array<{ x: number; y: number }>;
  area: number;
  cost: number;
}

/**
 * Datos de diseño (paso 3)
 */
export interface DesignData {
  plants: PlantObject[];
  materials: MaterialArea[];
  layout: {
    totalArea: number;
    plantDensity: number;
    spacing: number;
  };
  quotation: {
    plantsCost: number;
    materialsCost: number;
    laborCost: number;
    totalCost: number;
    margin: number;
    finalPrice: number;
  };
  timestamp: number;
}

/**
 * Cambios realizados en ajuste en vivo (paso 4)
 */
export interface LiveAdjustmentChange {
  id: string;
  timestamp: number;
  type: "move" | "delete" | "add" | "changeMaterial" | "changeType";
  objectId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  description: string;
}

/**
 * Datos de ajuste en vivo (paso 4)
 */
export interface AdjustLiveData {
  changes: LiveAdjustmentChange[];
  finalDesign: DesignData;
  userNotes?: string;
  timestamp: number;
}

/**
 * Datos de presentación al cliente (paso 5)
 */
export interface ClientPresentationData {
  presentedAt: number;
  presentedBy?: string;
  clientFeedback?: string;
  clientApproval?: boolean;
  clientNotes?: string;
}

/**
 * Datos de confirmación (paso 6)
 */
export interface ConfirmationData {
  approvedAt: number;
  approvedBy?: string;
  projectStatus: ProjectFlowStatus;
  contractSigned?: boolean;
  paymentStatus?: "pending" | "partial" | "complete";
  notes?: string;
}

/**
 * Proyecto completo con persistencia
 */
export interface WorkflowProject {
  // Identificadores
  id: string;
  projectId: number;
  userId: string;
  workflowId: string;

  // Estado
  status: ProjectFlowStatus;
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
  failedSteps: WorkflowStep[];

  // Datos de cada paso
  capture?: CaptureData;
  analysis?: AnalysisData;
  design?: DesignData;
  adjustments?: AdjustLiveData;
  presentation?: ClientPresentationData;
  confirmation?: ConfirmationData;

  // Metadatos
  createdAt: number;
  updatedAt: number;
  completedAt?: number;

  // Historial
  history: Array<{
    step: WorkflowStep;
    timestamp: number;
    status: "started" | "completed" | "failed" | "skipped";
    error?: string;
  }>;

  // Recuperación
  version: number;
  checksum?: string;
}

/**
 * Resultado de guardado
 */
export interface SaveResult {
  success: boolean;
  projectId: string;
  workflowId: string;
  message: string;
  timestamp: number;
}

/**
 * Resultado de recuperación
 */
export interface RecoveryResult {
  success: boolean;
  project: WorkflowProject;
  message: string;
  timestamp: number;
}

/**
 * Validación de paso
 */
export interface StepValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  canProceed: boolean;
}

/**
 * Configuración de persistencia
 */
export interface PersistenceConfig {
  autoSave: boolean;
  autoSaveInterval: number;
  enableOfflineMode: boolean;
  enableVersioning: boolean;
  maxVersions: number;
  encryptData: boolean;
}

/**
 * Estado de sincronización
 */
export interface SyncState {
  isSyncing: boolean;
  lastSyncTime: number;
  syncError?: string;
  pendingChanges: number;
  isDirty: boolean;
}

/**
 * Estadísticas del flujo
 */
export interface WorkflowStats {
  totalProjects: number;
  completedProjects: number;
  approvedProjects: number;
  averageTimePerStep: Record<WorkflowStep, number>;
  mostCommonAdjustments: string[];
  averageQuotation: number;
  conversionRate: number;
}
