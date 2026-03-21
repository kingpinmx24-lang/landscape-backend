/**
 * ============================================================================
 * PROJECT STORE - GLOBAL STATE MANAGEMENT WITH ZUSTAND
 * ============================================================================
 * 
 * Gestiona el estado global del proyecto con sincronización automática
 * y persistencia en backend.
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { CompleteProjectPersistence, PersistedDesign, PersistedQuotation, PersistedWorkflow } from "../../../shared/persistence-types";

/**
 * ============================================================================
 * STORE STATE
 * ============================================================================
 */

interface ProjectStoreState {
  // Project data
  project: CompleteProjectPersistence | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // UI state
  selectedObjectIds: string[];
  currentTool: "select" | "move" | "rotate" | "scale" | "delete" | "measure" | null;
  showGrid: boolean;
  showMeasurements: boolean;
  gridSize: number;

  // Sync state
  lastSyncedAt: number | null;
  hasUnsavedChanges: boolean;
  autoSaveEnabled: boolean;
  autoSaveInterval: number;

  // Actions
  loadProject: (projectId: number) => Promise<void>;
  saveProject: () => Promise<void>;
  createProject: (data: Partial<CompleteProjectPersistence>) => Promise<void>;
  updateTerrain: (terrain: CompleteProjectPersistence["terrain"]) => void;
  updateDesign: (design: PersistedDesign) => void;
  updateQuotation: (quotation: PersistedQuotation) => void;
  updateWorkflow: (workflow: PersistedWorkflow) => void;
  selectObject: (id: string, multi?: boolean) => void;
  deselectObject: (id: string) => void;
  clearSelection: () => void;
  setCurrentTool: (tool: ProjectStoreState["currentTool"]) => void;
  setAutoSave: (enabled: boolean) => void;
  resetProject: () => void;
  setError: (error: string | null) => void;
}

/**
 * ============================================================================
 * STORE CREATION
 * ============================================================================
 */

export const useProjectStore = create<ProjectStoreState>()(
  devtools(
    persist(
      (set: any, get: any) => ({
        // Initial state
        project: null as CompleteProjectPersistence | null,
        isLoading: false as boolean,
        isSaving: false as boolean,
        error: null as string | null,
        selectedObjectIds: [] as string[],
        currentTool: null as any,
        showGrid: true as boolean,
        showMeasurements: true as boolean,
        gridSize: 0.5 as number,
        lastSyncedAt: null as number | null,
        hasUnsavedChanges: false as boolean,
        autoSaveEnabled: true as boolean,
        autoSaveInterval: 2000 as number, // 2 segundos

        /**
         * Load project from backend
         */
        loadProject: async (projectId: number) => {
          set({ isLoading: true, error: null });
          try {
            const response = await fetch(`/api/projects/${projectId}`);
            if (!response.ok) {
              throw new Error(`Failed to load project: ${response.statusText}`);
            }
            const data = await response.json();
            
            if (!data.success) {
              throw new Error(data.error || "Failed to load project");
            }

            set({
              project: data.data,
              isLoading: false,
              hasUnsavedChanges: false,
              lastSyncedAt: Date.now(),
              error: null,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            set({ error: errorMessage, isLoading: false });
            throw error;
          }
        },

        /**
         * Save project to backend
         */
        saveProject: async () => {
          const { project } = get();
          if (!project) {
            set({ error: "No project to save" });
            return;
          }

          set({ isSaving: true, error: null });
          try {
            const method = project.id ? "PATCH" : "POST";
            const url = project.id ? `/api/projects/${project.id}` : "/api/projects";

            const response = await fetch(url, {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(project),
            });

            if (!response.ok) {
              throw new Error(`Failed to save project: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data.success) {
              throw new Error(data.error || "Failed to save project");
            }

            set({
              project: data.data,
              isSaving: false,
              hasUnsavedChanges: false,
              lastSyncedAt: Date.now(),
              error: null,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            set({ error: errorMessage, isSaving: false });
            throw error;
          }
        },

        /**
         * Create new project
         */
        createProject: async (data: Partial<CompleteProjectPersistence>) => {
          set({ isLoading: true, error: null });
          try {
            const response = await fetch("/api/projects", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });

            if (!response.ok) {
              throw new Error(`Failed to create project: ${response.statusText}`);
            }

            const result = await response.json();
            if (!result.success) {
              throw new Error(result.error || "Failed to create project");
            }

            set({
              project: result.data,
              isLoading: false,
              hasUnsavedChanges: false,
              lastSyncedAt: Date.now(),
              error: null,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            set({ error: errorMessage, isLoading: false });
            throw error;
          }
        },

        /**
         * Update terrain
         */
        updateTerrain: (terrain: CompleteProjectPersistence["terrain"]) => {
          set((state: ProjectStoreState) => ({
            project: state.project ? { ...state.project, terrain } : null,
            hasUnsavedChanges: true,
          }));
        },

        /**
         * Update design
         */
        updateDesign: (design: PersistedDesign) => {
          set((state: ProjectStoreState) => ({
            project: state.project ? { ...state.project, design } : null,
            hasUnsavedChanges: true,
          }));
        },

        /**
         * Update quotation
         */
        updateQuotation: (quotation: PersistedQuotation) => {
          set((state: ProjectStoreState) => ({
            project: state.project ? { ...state.project, quotation } : null,
            hasUnsavedChanges: true,
          }));
        },

        /**
         * Update workflow
         */
        updateWorkflow: (workflow: PersistedWorkflow) => {
          set((state: ProjectStoreState) => ({
            project: state.project ? { ...state.project, workflow } : null,
            hasUnsavedChanges: true,
          }));
        },

        /**
         * Select object
         */
        selectObject: (id: string, multi = false) => {
          set((state: ProjectStoreState) => ({
            selectedObjectIds: multi
              ? [...state.selectedObjectIds, id]
              : [id],
          }));
        },

        /**
         * Deselect object
         */
        deselectObject: (id: string) => {
          set((state: ProjectStoreState) => ({
            selectedObjectIds: state.selectedObjectIds.filter((objId: string) => objId !== id),
          }));
        },

        /**
         * Clear selection
         */
        clearSelection: () => {
          set({ selectedObjectIds: [] });
        },

        /**
         * Set current tool
         */
        setCurrentTool: (tool: ProjectStoreState["currentTool"]) => {
          set({ currentTool: tool });
        },

        /**
         * Set autosave
         */
        setAutoSave: (enabled: boolean) => {
          set({ autoSaveEnabled: enabled });
        },

        /**
         * Reset project
         */
        resetProject: () => {
          set({
            project: null,
            selectedObjectIds: [],
            currentTool: null,
            hasUnsavedChanges: false,
            error: null,
            lastSyncedAt: null,
          });
        },

        /**
         * Set error
         */
        setError: (error: string | null) => {
          set({ error });
        },
      }),
      {
        name: "project-store",
        version: 1,
      }
    )
  )
);

/**
 * ============================================================================
 * AUTOSAVE HOOK
 * ============================================================================
 */

export function useAutoSave() {
  const { project, hasUnsavedChanges, autoSaveEnabled, saveProject } = useProjectStore();

  // Autosave con debounce
  const handleAutoSave = async () => {
    if (hasUnsavedChanges && autoSaveEnabled && project) {
      try {
        await saveProject();
      } catch (error) {
        console.error("Autosave failed:", error);
      }
    }
  };

  return { handleAutoSave, hasUnsavedChanges, autoSaveEnabled };
}

/**
 * ============================================================================
 * SELECTORS
 * ============================================================================
 */

export const selectProject = (state: ProjectStoreState) => state.project;
export const selectIsLoading = (state: ProjectStoreState) => state.isLoading;
export const selectIsSaving = (state: ProjectStoreState) => state.isSaving;
export const selectError = (state: ProjectStoreState) => state.error;
export const selectSelectedObjects = (state: ProjectStoreState) => state.selectedObjectIds;
export const selectCurrentTool = (state: ProjectStoreState) => state.currentTool;
export const selectHasUnsavedChanges = (state: ProjectStoreState) => state.hasUnsavedChanges;
export const selectAutoSaveEnabled = (state: ProjectStoreState) => state.autoSaveEnabled;
