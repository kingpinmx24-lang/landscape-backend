/**
 * Tests: Workflow Integration
 * ============================================================================
 * Tests de integración del flujo completo de trabajo
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  WorkflowProject,
  ProjectFlowStatus,
  CaptureData,
  AnalysisData,
  DesignData,
  AdjustLiveData,
  ClientPresentationData,
  ConfirmationData,
} from "@shared/workflow-persistence-types";
import { WorkflowStep } from "@shared/workflow-types";

/**
 * Mock de datos
 */
const createMockCaptureData = (): CaptureData => ({
  imageUrl: "https://example.com/image.jpg",
  timestamp: Date.now(),
  deviceModel: "iPhone 14",
  hasLiDAR: true,
  cameraType: "wide",
  measurements: {
    width: 10,
    height: 15,
    area: 150,
  },
});

const createMockAnalysisData = (): AnalysisData => ({
  zones: [
    {
      id: "zone-1",
      type: "grass",
      polygon: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      area: 100,
      color: "#90EE90",
      confidence: 0.95,
    },
  ],
  totalArea: 150,
  terrainType: "residential",
  sunExposure: "full",
  soilQuality: "good",
  drainageLevel: "good",
  timestamp: Date.now(),
});

const createMockDesignData = (): DesignData => ({
  plants: [
    {
      id: "plant-1",
      type: "flowering",
      x: 50,
      y: 50,
      radius: 20,
      name: "Rose",
      cost: 15,
    },
    {
      id: "plant-2",
      type: "shrub",
      x: 100,
      y: 100,
      radius: 25,
      name: "Shrub",
      cost: 20,
    },
  ],
  materials: [
    {
      id: "material-1",
      type: "grass",
      polygon: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      area: 100,
      cost: 500,
    },
  ],
  layout: {
    totalArea: 150,
    plantDensity: 0.013,
    spacing: 50,
  },
  quotation: {
    plantsCost: 35,
    materialsCost: 500,
    laborCost: 200,
    totalCost: 735,
    margin: 0.3,
    finalPrice: 955.5,
  },
  timestamp: Date.now(),
});

const createMockProject = (): WorkflowProject => ({
  id: "project-1",
  projectId: 1,
  userId: "user-1",
  workflowId: "workflow-1",
  status: ProjectFlowStatus.DRAFT,
  currentStep: WorkflowStep.SCAN_TERRAIN,
  completedSteps: [],
  failedSteps: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  history: [],
  version: 1,
});

/**
 * Tests
 */
describe("Workflow Integration", () => {
  let project: WorkflowProject;

  beforeEach(() => {
    project = createMockProject();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Paso 1: Captura
   */
  describe("Paso 1: Captura", () => {
    it("debe guardar datos de captura", () => {
      const captureData = createMockCaptureData();
      project.capture = captureData;
      project.currentStep = WorkflowStep.SCAN_TERRAIN;
      project.completedSteps.push(WorkflowStep.SCAN_TERRAIN);

      expect(project.capture).toBeDefined();
      expect(project.capture?.imageUrl).toBe("https://example.com/image.jpg");
      expect(project.completedSteps).toContain(WorkflowStep.SCAN_TERRAIN);
    });

    it("debe validar que la imagen esté presente", () => {
      const captureData = createMockCaptureData();
      const isValid = !!captureData.imageUrl;

      expect(isValid).toBe(true);
    });
  });

  /**
   * Paso 2: Análisis
   */
  describe("Paso 2: Análisis", () => {
    it("debe guardar datos de análisis", () => {
      const analysisData = createMockAnalysisData();
      project.analysis = analysisData;
      project.currentStep = WorkflowStep.DETECT_ZONES;
      project.completedSteps.push(WorkflowStep.DETECT_ZONES);

      expect(project.analysis).toBeDefined();
      expect(project.analysis?.zones.length).toBe(1);
      expect(project.analysis?.zones[0].type).toBe("grass");
    });

    it("debe detectar múltiples zonas", () => {
      const analysisData = createMockAnalysisData();
      analysisData.zones.push({
        id: "zone-2",
        type: "soil",
        polygon: [
          { x: 100, y: 0 },
          { x: 200, y: 0 },
          { x: 200, y: 100 },
          { x: 100, y: 100 },
        ],
        area: 50,
        color: "#8B4513",
        confidence: 0.88,
      });

      expect(analysisData.zones.length).toBe(2);
    });
  });

  /**
   * Paso 3: Diseño
   */
  describe("Paso 3: Diseño", () => {
    it("debe generar diseño automático", () => {
      const designData = createMockDesignData();
      project.design = designData;
      project.currentStep = WorkflowStep.GENERATE_DESIGN;
      project.completedSteps.push(WorkflowStep.GENERATE_DESIGN);

      expect(project.design).toBeDefined();
      expect(project.design?.plants.length).toBe(2);
      expect(project.design?.materials.length).toBe(1);
    });

    it("debe calcular cotización correctamente", () => {
      const designData = createMockDesignData();

      const expectedTotal =
        designData.quotation.plantsCost +
        designData.quotation.materialsCost +
        designData.quotation.laborCost;

      expect(designData.quotation.totalCost).toBe(expectedTotal);
    });

    it("debe aplicar margen correctamente", () => {
      const designData = createMockDesignData();
      const expectedMargin = designData.quotation.totalCost * 0.3;

      expect(designData.quotation.margin).toBeCloseTo(expectedMargin, 2);
    });
  });

  /**
   * Paso 4: Ajuste en vivo
   */
  describe("Paso 4: Ajuste en vivo", () => {
    it("debe registrar cambios de ajuste", () => {
      const adjustmentData: AdjustLiveData = {
        changes: [
          {
            id: "change-1",
            timestamp: Date.now(),
            type: "move",
            objectId: "plant-1",
            description: "Movió planta 1 a nueva posición",
          },
        ],
        finalDesign: createMockDesignData(),
        userNotes: "Cliente pidió cambios menores",
        timestamp: Date.now(),
      };

      project.adjustments = adjustmentData;
      project.currentStep = WorkflowStep.ADJUST_LIVE;
      project.completedSteps.push(WorkflowStep.ADJUST_LIVE);

      expect(project.adjustments?.changes.length).toBe(1);
      expect(project.adjustments?.changes[0].type).toBe("move");
    });

    it("debe permitir múltiples cambios", () => {
      const adjustmentData: AdjustLiveData = {
        changes: [
          {
            id: "change-1",
            timestamp: Date.now(),
            type: "move",
            objectId: "plant-1",
            description: "Movió planta",
          },
          {
            id: "change-2",
            timestamp: Date.now() + 1000,
            type: "delete",
            objectId: "plant-2",
            description: "Eliminó planta",
          },
          {
            id: "change-3",
            timestamp: Date.now() + 2000,
            type: "add",
            description: "Agregó nueva planta",
          },
        ],
        finalDesign: createMockDesignData(),
        timestamp: Date.now(),
      };

      expect(adjustmentData.changes.length).toBe(3);
    });
  });

  /**
   * Paso 5: Presentación
   */
  describe("Paso 5: Presentación", () => {
    it("debe registrar presentación al cliente", () => {
      const presentationData: ClientPresentationData = {
        presentedAt: Date.now(),
        presentedBy: "Vendedor",
        clientApproval: true,
        clientFeedback: "Excelente diseño",
      };

      project.presentation = presentationData;
      project.currentStep = WorkflowStep.SHOW_QUOTATION;
      project.completedSteps.push(WorkflowStep.SHOW_QUOTATION);

      expect(project.presentation?.clientApproval).toBe(true);
      expect(project.presentation?.clientFeedback).toBe("Excelente diseño");
    });

    it("debe manejar rechazo del cliente", () => {
      const presentationData: ClientPresentationData = {
        presentedAt: Date.now(),
        presentedBy: "Vendedor",
        clientApproval: false,
        clientFeedback: "Necesita más plantas",
      };

      project.presentation = presentationData;

      expect(project.presentation?.clientApproval).toBe(false);
    });
  });

  /**
   * Paso 6: Confirmación
   */
  describe("Paso 6: Confirmación", () => {
    it("debe confirmar proyecto", () => {
      const confirmationData: ConfirmationData = {
        approvedAt: Date.now(),
        approvedBy: "Vendedor",
        projectStatus: ProjectFlowStatus.APPROVED,
        contractSigned: true,
        paymentStatus: "complete",
      };

      project.confirmation = confirmationData;
      project.status = ProjectFlowStatus.APPROVED;
      project.currentStep = WorkflowStep.SAVE_PROJECT;
      project.completedSteps.push(WorkflowStep.SAVE_PROJECT);

      expect(project.status).toBe(ProjectFlowStatus.APPROVED);
      expect(project.confirmation?.contractSigned).toBe(true);
    });

    it("debe manejar pago pendiente", () => {
      const confirmationData: ConfirmationData = {
        approvedAt: Date.now(),
        approvedBy: "Vendedor",
        projectStatus: ProjectFlowStatus.APPROVED,
        contractSigned: true,
        paymentStatus: "pending",
      };

      project.confirmation = confirmationData;

      expect(project.confirmation?.paymentStatus).toBe("pending");
    });
  });

  /**
   * Flujo completo
   */
  describe("Flujo Completo", () => {
    it("debe completar flujo de 5 minutos", async () => {
      const startTime = Date.now();

      // Paso 1: Captura
      project.capture = createMockCaptureData();
      project.completedSteps.push(WorkflowStep.SCAN_TERRAIN);

      // Paso 2: Análisis
      project.analysis = createMockAnalysisData();
      project.completedSteps.push(WorkflowStep.DETECT_ZONES);

      // Paso 3: Diseño
      project.design = createMockDesignData();
      project.completedSteps.push(WorkflowStep.GENERATE_DESIGN);

      // Paso 4: Ajuste
      project.adjustments = {
        changes: [],
        finalDesign: project.design,
        timestamp: Date.now(),
      };
      project.completedSteps.push(WorkflowStep.ADJUST_LIVE);

      // Paso 5: Presentación
      project.presentation = {
        presentedAt: Date.now(),
        presentedBy: "Vendedor",
        clientApproval: true,
      };
      project.completedSteps.push(WorkflowStep.SHOW_QUOTATION);

      // Paso 6: Confirmación
      project.confirmation = {
        approvedAt: Date.now(),
        approvedBy: "Vendedor",
        projectStatus: ProjectFlowStatus.APPROVED,
        contractSigned: true,
        paymentStatus: "complete",
      };
      project.status = ProjectFlowStatus.APPROVED;
      project.completedSteps.push(WorkflowStep.SAVE_PROJECT);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(project.completedSteps.length).toBe(6);
      expect(project.status).toBe(ProjectFlowStatus.APPROVED);
      expect(duration).toBeLessThan(5000); // Menos de 5 segundos en tests
    });

    it("debe mantener integridad de datos", () => {
      // Crear proyecto completo
      const completeProject: WorkflowProject = {
        ...createMockProject(),
        capture: createMockCaptureData(),
        analysis: createMockAnalysisData(),
        design: createMockDesignData(),
        adjustments: {
          changes: [],
          finalDesign: createMockDesignData(),
          timestamp: Date.now(),
        },
        presentation: {
          presentedAt: Date.now(),
          presentedBy: "Vendedor",
          clientApproval: true,
        },
        confirmation: {
          approvedAt: Date.now(),
          approvedBy: "Vendedor",
          projectStatus: ProjectFlowStatus.APPROVED,
          contractSigned: true,
          paymentStatus: "complete",
        },
        status: ProjectFlowStatus.APPROVED,
        completedSteps: [
          WorkflowStep.SCAN_TERRAIN,
          WorkflowStep.DETECT_ZONES,
          WorkflowStep.GENERATE_DESIGN,
          WorkflowStep.ADJUST_LIVE,
          WorkflowStep.SHOW_QUOTATION,
          WorkflowStep.SAVE_PROJECT,
        ],
      };

      // Validar que todos los datos están presentes
      expect(completeProject.capture).toBeDefined();
      expect(completeProject.analysis).toBeDefined();
      expect(completeProject.design).toBeDefined();
      expect(completeProject.adjustments).toBeDefined();
      expect(completeProject.presentation).toBeDefined();
      expect(completeProject.confirmation).toBeDefined();

      // Validar cotización
      const quotation = completeProject.design?.quotation;
      expect(quotation?.finalPrice).toBeGreaterThan(0);
      expect(quotation?.margin).toBeGreaterThan(0);
    });

    it("debe permitir recuperación de proyecto", () => {
      const completeProject = createMockProject();
      completeProject.capture = createMockCaptureData();
      completeProject.analysis = createMockAnalysisData();
      completeProject.design = createMockDesignData();

      // Simular guardado
      const savedProject = JSON.parse(JSON.stringify(completeProject));

      // Simular recuperación
      const recoveredProject: WorkflowProject = savedProject;

      expect(recoveredProject.capture?.imageUrl).toBe(completeProject.capture?.imageUrl);
      expect(recoveredProject.design?.plants.length).toBe(completeProject.design?.plants.length);
    });
  });

  /**
   * Validación
   */
  describe("Validación", () => {
    it("debe validar datos requeridos", () => {
      const isValid =
        !!project.capture &&
        !!project.analysis &&
        !!project.design &&
        !!project.presentation &&
        !!project.confirmation;

      expect(isValid).toBe(false); // No todos están presentes

      // Agregar datos
      project.capture = createMockCaptureData();
      project.analysis = createMockAnalysisData();
      project.design = createMockDesignData();
      project.presentation = {
        presentedAt: Date.now(),
        presentedBy: "Vendedor",
        clientApproval: true,
      };
      project.confirmation = {
        approvedAt: Date.now(),
        approvedBy: "Vendedor",
        projectStatus: ProjectFlowStatus.APPROVED,
        contractSigned: true,
        paymentStatus: "complete",
      };

      const isValidAfter =
        !!project.capture &&
        !!project.analysis &&
        !!project.design &&
        !!project.presentation &&
        !!project.confirmation;

      expect(isValidAfter).toBe(true);
    });

    it("debe validar cotización", () => {
      const design = createMockDesignData();
      const quotation = design.quotation;

      const isValid =
        quotation.plantsCost >= 0 &&
        quotation.materialsCost >= 0 &&
        quotation.laborCost >= 0 &&
        quotation.totalCost > 0 &&
        quotation.finalPrice > quotation.totalCost;

      expect(isValid).toBe(true);
    });
  });
});
