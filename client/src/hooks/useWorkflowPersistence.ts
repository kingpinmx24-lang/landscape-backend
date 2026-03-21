/**
 * Hook: useWorkflowPersistence
 * ============================================================================
 * Persistencia completa del flujo de trabajo
 */

import { useCallback, useRef, useEffect, useState } from "react";
import { WorkflowProject, ProjectFlowStatus, SaveResult, RecoveryResult, SyncState } from "@shared/workflow-persistence-types";
import { WorkflowStep } from "@shared/workflow-types";

interface PersistenceConfig {
  autoSave: boolean;
  autoSaveInterval: number;
  enableOfflineMode: boolean;
  enableVersioning: boolean;
  maxVersions: number;
}

/**
 * Hook useWorkflowPersistence
 */
export function useWorkflowPersistence(projectId: string, config: Partial<PersistenceConfig> = {}) {
  const {
    autoSave = true,
    autoSaveInterval = 5000,
    enableOfflineMode = true,
    enableVersioning = true,
    maxVersions = 10,
  } = config;

  const [project, setProject] = useState<WorkflowProject | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSyncTime: 0,
    syncError: undefined,
    pendingChanges: 0,
    isDirty: false,
  });

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const versionHistoryRef = useRef<WorkflowProject[]>([]);

  /**
   * Guardar proyecto en backend
   */
  const saveToBackend = useCallback(async (projectData: WorkflowProject): Promise<SaveResult> => {
    try {
      setSyncState((prev) => ({ ...prev, isSyncing: true }));

      // En producción, esto sería una llamada a tRPC
      // const result = await trpc.projects.saveWorkflow.mutate(projectData);

      // Simulación
      await new Promise((resolve) => setTimeout(resolve, 500));

      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: Date.now(),
        syncError: undefined,
        isDirty: false,
        pendingChanges: 0,
      }));

      return {
        success: true,
        projectId: projectData.projectId.toString(),
        workflowId: projectData.workflowId,
        message: "Proyecto guardado exitosamente",
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error al guardar";
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        syncError: errorMessage,
      }));

      return {
        success: false,
        projectId: projectData.projectId.toString(),
        workflowId: projectData.workflowId,
        message: errorMessage,
        timestamp: Date.now(),
      };
    }
  }, []);

  /**
   * Guardar en localStorage (modo offline)
   */
  const saveToLocalStorage = useCallback((projectData: WorkflowProject) => {
    try {
      const key = `workflow_${projectId}`;
      localStorage.setItem(key, JSON.stringify(projectData));

      // Guardar en historial de versiones
      if (enableVersioning) {
        const historyKey = `workflow_history_${projectId}`;
        const history = JSON.parse(localStorage.getItem(historyKey) || "[]") as WorkflowProject[];
        history.push(projectData);

        // Mantener solo las últimas N versiones
        if (history.length > maxVersions) {
          history.shift();
        }

        localStorage.setItem(historyKey, JSON.stringify(history));
      }
    } catch (error) {
      console.error("Error al guardar en localStorage:", error);
    }
  }, [projectId, enableVersioning, maxVersions]);

  /**
   * Guardar proyecto (backend + localStorage)
   */
  const saveProject = useCallback(
    async (projectData: WorkflowProject): Promise<SaveResult> => {
      try {
        // Guardar en localStorage primero (offline mode)
        if (enableOfflineMode) {
          saveToLocalStorage(projectData);
        }

        // Intentar guardar en backend
        const result = await saveToBackend(projectData);

        if (result.success) {
          setProject(projectData);
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error al guardar";
        return {
          success: false,
          projectId: projectData.projectId.toString(),
          workflowId: projectData.workflowId,
          message: errorMessage,
          timestamp: Date.now(),
        };
      }
    },
    [enableOfflineMode, saveToLocalStorage, saveToBackend]
  );

  /**
   * Recuperar proyecto desde localStorage
   */
  const recoverFromLocalStorage = useCallback((): WorkflowProject | null => {
    try {
      const key = `workflow_${projectId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored) as WorkflowProject;
      }
    } catch (error) {
      console.error("Error al recuperar de localStorage:", error);
    }
    return null;
  }, [projectId]);

  /**
   * Recuperar proyecto desde backend
   */
  const recoverFromBackend = useCallback(async (): Promise<RecoveryResult | null> => {
    try {
      setSyncState((prev) => ({ ...prev, isSyncing: true }));

      // En producción, esto sería una llamada a tRPC
      // const result = await trpc.projects.getWorkflow.query({ projectId });

      // Simulación
      await new Promise((resolve) => setTimeout(resolve, 500));

      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: Date.now(),
      }));

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error al recuperar";
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        syncError: errorMessage,
      }));

      return null;
    }
  }, []);

  /**
   * Recuperar proyecto (backend + localStorage)
   */
  const recoverProject = useCallback(async (): Promise<RecoveryResult | null> => {
    try {
      // Intentar recuperar del backend primero
      const backendResult = await recoverFromBackend();
      if (backendResult?.success) {
        setProject(backendResult.project);
        return backendResult;
      }

      // Fallback: recuperar de localStorage
      if (enableOfflineMode) {
        const localProject = recoverFromLocalStorage();
        if (localProject) {
          setProject(localProject);
          return {
            success: true,
            project: localProject,
            message: "Proyecto recuperado desde almacenamiento local",
            timestamp: Date.now(),
          };
        }
      }

      return null;
    } catch (error) {
      console.error("Error al recuperar proyecto:", error);
      return null;
    }
  }, [recoverFromBackend, enableOfflineMode, recoverFromLocalStorage]);

  /**
   * Actualizar proyecto
   */
  const updateProject = useCallback((updates: Partial<WorkflowProject>) => {
    setProject((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updates, updatedAt: Date.now() };
      setSyncState((state) => ({
        ...state,
        isDirty: true,
        pendingChanges: state.pendingChanges + 1,
      }));
      return updated;
    });
  }, []);

  /**
   * Auto-save
   */
  useEffect(() => {
    if (!autoSave || !project) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      if (syncState.isDirty) {
        void saveProject(project);
      }
    }, autoSaveInterval);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [autoSave, project, autoSaveInterval, syncState.isDirty, saveProject]);

  /**
   * Obtener historial de versiones
   */
  const getVersionHistory = useCallback((): WorkflowProject[] => {
    try {
      const historyKey = `workflow_history_${projectId}`;
      const stored = localStorage.getItem(historyKey);
      if (stored) {
        return JSON.parse(stored) as WorkflowProject[];
      }
    } catch (error) {
      console.error("Error al obtener historial:", error);
    }
    return [];
  }, [projectId]);

  /**
   * Restaurar versión anterior
   */
  const restoreVersion = useCallback(
    (versionIndex: number) => {
      const history = getVersionHistory();
      if (versionIndex >= 0 && versionIndex < history.length) {
        const version = history[versionIndex];
        setProject(version);
        setSyncState((prev) => ({
          ...prev,
          isDirty: true,
        }));
      }
    },
    [getVersionHistory]
  );

  /**
   * Limpiar proyecto
   */
  const clearProject = useCallback(() => {
    try {
      const key = `workflow_${projectId}`;
      localStorage.removeItem(key);
      setProject(null);
      setSyncState({
        isSyncing: false,
        lastSyncTime: 0,
        syncError: undefined,
        pendingChanges: 0,
        isDirty: false,
      });
    } catch (error) {
      console.error("Error al limpiar proyecto:", error);
    }
  }, [projectId]);

  /**
   * Exportar proyecto como JSON
   */
  const exportProject = useCallback((): string => {
    if (!project) return "";
    return JSON.stringify(project, null, 2);
  }, [project]);

  /**
   * Importar proyecto desde JSON
   */
  const importProject = useCallback(async (jsonData: string): Promise<boolean> => {
    try {
      const imported = JSON.parse(jsonData) as WorkflowProject;
      const result = await saveProject(imported);
      return result.success;
    } catch (error) {
      console.error("Error al importar proyecto:", error);
      return false;
    }
  }, [saveProject]);

  return {
    // Estado
    project,
    syncState,

    // Métodos
    saveProject,
    recoverProject,
    updateProject,
    clearProject,
    getVersionHistory,
    restoreVersion,
    exportProject,
    importProject,

    // Utilidades
    saveToLocalStorage,
    recoverFromLocalStorage,
  };
}
