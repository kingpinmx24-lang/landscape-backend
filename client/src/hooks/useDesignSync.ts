/**
 * Hook: useDesignSync
 * ============================================================================
 * Sincronización en tiempo real de cambios del diseño
 */

import { useCallback, useRef, useEffect, useState } from "react";

interface DesignState {
  objects: Array<{ id: string; x: number; y: number; type: string; name?: string; cost?: number; radius?: number; rotation?: number; scale?: number; metadata?: Record<string, unknown> }>;
  materials: Record<string, string>;
  quotation: {
    totalCost: number;
    itemCount: number;
    density: number;
  };
}

interface DesignSyncConfig {
  autoSaveInterval?: number;
  debounceDelay?: number;
  enableOfflineMode?: boolean;
}

/**
 * Hook useDesignSync
 */
export function useDesignSync(
  projectId: string,
  config: DesignSyncConfig = {}
) {
  const {
    autoSaveInterval = 2000,
    debounceDelay = 500,
    enableOfflineMode = true,
  } = config;

  const [designState, setDesignState] = useState<DesignState>({
    objects: [],
    materials: {},
    quotation: {
      totalCost: 0,
      itemCount: 0,
      density: 0,
    },
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [syncError, setSyncError] = useState<string | undefined>();
  const [isDirty, setIsDirty] = useState(false);

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * Calcular cotización
   */
  const calculateQuotation = useCallback((state: DesignState) => {
    const itemCount = state.objects.length;
    const totalCost = state.objects.reduce((sum) => {
      // Estimar costo por tipo de planta
      const baseCost = 25;
      return sum + baseCost;
    }, 0);

    // Calcular densidad (objetos por metro cuadrado)
    const canvasArea = 1000 * 1000; // 1000x1000 metros
    const density = (itemCount / canvasArea) * 10000;

    return {
      totalCost,
      itemCount,
      density: Math.round(density * 100) / 100,
    };
  }, []);

  /**
   * Actualizar estado del diseño
   */
  const updateDesignState = useCallback(
    (updates: Partial<DesignState>) => {
      setDesignState((prev) => {
        const newState: DesignState = { ...prev, ...updates };
        newState.quotation = calculateQuotation(newState);
        return newState;
      });
      setIsDirty(true);
      setSyncError(undefined);
    },
    [calculateQuotation]
  );

  /**
   * Agregar objeto (functional update to avoid stale closure)
   */
  const addObject = useCallback(
    (object: { id: string; x: number; y: number; type: string; name?: string; cost?: number; radius?: number; rotation?: number; scale?: number; metadata?: Record<string, unknown> }) => {
      setDesignState((prev) => {
        // Avoid duplicates
        if (prev.objects.some((o) => o.id === object.id)) return prev;
        const newState = { ...prev, objects: [...prev.objects, object] };
        newState.quotation = calculateQuotation(newState);
        return newState;
      });
      setIsDirty(true);
      setSyncError(undefined);
    },
    [calculateQuotation]
  );

  /**
   * Actualizar objeto (functional update to avoid stale closure)
   */
  const updateObject = useCallback(
    (objectId: string, updates: Partial<{ x: number; y: number; type: string; name?: string; cost?: number; radius?: number; rotation?: number; scale?: number; metadata?: Record<string, unknown> }>) => {
      setDesignState((prev) => {
        const newState = {
          ...prev,
          objects: prev.objects.map((obj) =>
            obj.id === objectId ? { ...obj, ...updates } : obj
          ),
        };
        newState.quotation = calculateQuotation(newState);
        return newState;
      });
      setIsDirty(true);
      setSyncError(undefined);
    },
    [calculateQuotation]
  );

  /**
   * Eliminar objeto (functional update to avoid stale closure)
   */
  const deleteObject = useCallback(
    (objectId: string) => {
      setDesignState((prev) => {
        const filtered = prev.objects.filter((obj) => obj.id !== objectId);
        if (filtered.length === prev.objects.length) {
          console.warn(`[useDesignSync] deleteObject: id "${objectId}" not found in ${prev.objects.length} objects`);
          return prev; // Nothing changed
        }
        console.log(`[useDesignSync] deleteObject: removed "${objectId}", ${prev.objects.length} → ${filtered.length}`);
        const newState = { ...prev, objects: filtered };
        newState.quotation = calculateQuotation(newState);
        return newState;
      });
      setIsDirty(true);
      setSyncError(undefined);
    },
    [calculateQuotation]
  );

  /**
   * Aplicar material (functional update to avoid stale closure)
   */
  const applyMaterial = useCallback(
    (areaId: string, material: string) => {
      setDesignState((prev) => {
        const newState = {
          ...prev,
          materials: { ...prev.materials, [areaId]: material },
        };
        newState.quotation = calculateQuotation(newState);
        return newState;
      });
      setIsDirty(true);
      setSyncError(undefined);
    },
    [calculateQuotation]
  );

  /**
   * Sincronizar con backend
   */
  const syncToBackendImpl = useCallback(
    async (state: DesignState) => {
      if (!projectId) return;

      setIsSyncing(true);
      try {
        // Simular llamada a backend
        // En producción, esto sería una llamada a tRPC
        await new Promise((resolve) => setTimeout(resolve, 500));

        setLastSyncTime(Date.now());
        setIsDirty(false);
        setSyncError(undefined);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error de sincronización";
        setSyncError(errorMessage);

        if (!enableOfflineMode) {
          throw error;
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [projectId, enableOfflineMode]
  );

  /**
   * Sincronizar con debounce
   */
  const syncToBackend = useCallback(
    (state: DesignState) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        void syncToBackendImpl(state);
      }, debounceDelay);
    },
    [syncToBackendImpl, debounceDelay]
  );

  /**
   * Auto-save
   */
  useEffect(() => {
    if (!isDirty) return;

    // Cancelar timeout anterior
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Establecer nuevo timeout
    autoSaveTimeoutRef.current = setTimeout(() => {
      syncToBackend(designState);
    }, autoSaveInterval);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [isDirty, designState, autoSaveInterval, syncToBackend]);

  /**
   * Sincronizar manualmente
   */
  const manualSync = useCallback(async () => {
    void syncToBackendImpl(designState);
  }, [designState, syncToBackendImpl]);

  /**
   * Limpiar timeouts
   */
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Cargar estado desde localStorage (offline mode)
   */
  useEffect(() => {
    if (!enableOfflineMode || !projectId) return;

    try {
      const stored = localStorage.getItem(`design_${projectId}`);
      if (stored) {
        const parsedState = JSON.parse(stored) as DesignState;
        setDesignState(parsedState);
      }
    } catch (error) {
      console.error("Error loading design state from localStorage:", error);
    }
  }, [projectId, enableOfflineMode]);

  /**
   * Guardar estado en localStorage
   */
  useEffect(() => {
    if (!enableOfflineMode || !projectId) return;

    try {
      localStorage.setItem(`design_${projectId}`, JSON.stringify(designState));
    } catch (error) {
      console.error("Error saving design state to localStorage:", error);
    }
  }, [designState, projectId, enableOfflineMode]);

  return {
    // Estado
    designState,
    isSyncing,
    isDirty,
    lastSyncTime,
    syncError,

    // Métodos
    updateDesignState,
    addObject,
    updateObject,
    deleteObject,
    applyMaterial,
    manualSync,

    // Utilidades
    calculateQuotation,
  };
}
