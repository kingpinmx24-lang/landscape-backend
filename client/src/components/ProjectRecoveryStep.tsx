/**
 * Component: ProjectRecoveryStep
 * ============================================================================
 * Paso 8 del flujo: Recuperación de proyectos guardados\n */

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Download, Trash2, RotateCcw, Eye } from "lucide-react";
import { WorkflowProject } from "@shared/workflow-persistence-types";
import { useWorkflowPersistence } from "@/hooks/useWorkflowPersistence";

interface ProjectRecoveryStepProps {
  projectId: string;
  onProjectLoaded?: (project: WorkflowProject) => void;
  onCancel?: () => void;
}

/**
 * Componente ProjectRecoveryStep
 */
export const ProjectRecoveryStep: React.FC<ProjectRecoveryStepProps> = ({
  projectId,
  onProjectLoaded,
  onCancel,
}) => {
  const [versions, setVersions] = useState<WorkflowProject[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);

  const persistence = useWorkflowPersistence(projectId);

  /**
   * Cargar historial de versiones
   */
  useEffect(() => {
    const loadVersions = async () => {
      try {
        setIsLoading(true);
        const history = persistence.getVersionHistory();
        setVersions(history);

        // Si hay versiones, seleccionar la más reciente
        if (history.length > 0) {
          setSelectedVersion(history.length - 1);
        }
      } catch (error) {
        console.error("Error al cargar versiones:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadVersions();
  }, [persistence]);

  /**
   * Manejar restauración de versión
   */
  const handleRestore = useCallback(async () => {
    if (selectedVersion === null || !versions[selectedVersion]) return;

    try {
      setIsRestoring(true);
      const version = versions[selectedVersion];
      persistence.restoreVersion(selectedVersion);
      onProjectLoaded?.(version);
    } catch (error) {
      console.error("Error al restaurar versión:", error);
    } finally {
      setIsRestoring(false);
    }
  }, [selectedVersion, versions, persistence, onProjectLoaded]);

  /**
   * Manejar eliminación de versión
   */
  const handleDeleteVersion = useCallback((index: number) => {
    setVersions((prev) => prev.filter((_, i) => i !== index));
    if (selectedVersion === index) {
      setSelectedVersion(null);
    }
  }, [selectedVersion]);

  /**
   * Manejar exportación de versión
   */
  const handleExportVersion = useCallback((index: number) => {
    const version = versions[index];
    const json = JSON.stringify(version, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-${projectId}-v${index}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [versions, projectId]);

  /**
   * Formatear fecha
   */
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  /**
   * Obtener estado del proyecto
   */
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: "bg-gray-100", text: "text-gray-700", label: "Borrador" },
      capturing: { bg: "bg-blue-100", text: "text-blue-700", label: "Capturando" },
      analyzing: { bg: "bg-purple-100", text: "text-purple-700", label: "Analizando" },
      designing: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Diseñando" },
      adjusting: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Ajustando" },
      presenting: { bg: "bg-orange-100", text: "text-orange-700", label: "Presentando" },
      approved: { bg: "bg-green-100", text: "text-green-700", label: "Aprobado" },
      completed: { bg: "bg-green-100", text: "text-green-700", label: "Completado" },
    };

    const config = statusMap[status] || statusMap.draft;
    return (
      <span className={`px-2 py-1 rounded text-sm font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando versiones...</p>
        </div>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 p-4">
        <AlertCircle className="w-16 h-16 text-gray-300" />
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">No hay versiones guardadas</h3>
          <p className="text-gray-600 mb-6">
            No se encontraron versiones previas de este proyecto
          </p>
          <Button onClick={onCancel}>Volver</Button>
        </div>
      </div>
    );
  }

  const selectedVersionData = selectedVersion !== null ? versions[selectedVersion] : null;

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Recuperar Proyecto</h2>
        <p className="text-gray-600 text-sm">
          Selecciona una versión anterior para continuar donde lo dejaste
        </p>
      </div>

      {/* Lista de versiones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historial de Versiones</CardTitle>
          <CardDescription>
            {versions.length} versión{versions.length !== 1 ? "es" : ""} disponible{versions.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {versions.map((version, index) => (
              <button
                key={index}
                onClick={() => setSelectedVersion(index)}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  selectedVersion === index
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">Versión {index + 1}</span>
                      {getStatusBadge(version.status)}
                    </div>
                    <p className="text-sm text-gray-600">
                      {formatDate(version.updatedAt)}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Paso: {version.currentStep} • {version.completedSteps.length} completados
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportVersion(index);
                      }}
                      className="p-2 hover:bg-gray-100 rounded"
                      title="Descargar"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVersion(index);
                      }}
                      className="p-2 hover:bg-red-100 rounded text-red-600"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detalles de versión seleccionada */}
      {selectedVersionData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalles de la Versión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Estado</p>
                <p className="font-semibold">{selectedVersionData.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Paso Actual</p>
                <p className="font-semibold">{selectedVersionData.currentStep}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Pasos Completados</p>
                <p className="font-semibold">{selectedVersionData.completedSteps.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Última Actualización</p>
                <p className="font-semibold text-sm">
                  {formatDate(selectedVersionData.updatedAt)}
                </p>
              </div>
            </div>

            {/* Información de diseño */}
            {selectedVersionData.design && (
              <div className="border-t pt-3">
                <p className="text-sm font-semibold mb-2">Diseño</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Plantas:</span>
                    <span className="ml-2 font-semibold">
                      {selectedVersionData.design.plants.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Materiales:</span>
                    <span className="ml-2 font-semibold">
                      {selectedVersionData.design.materials.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Área:</span>
                    <span className="ml-2 font-semibold">
                      {selectedVersionData.design.layout.totalArea.toFixed(0)} m²
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Precio:</span>
                    <span className="ml-2 font-semibold">
                      ${selectedVersionData.design.quotation.finalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Botones de acción */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isRestoring}>
          Cancelar
        </Button>
        <Button
          onClick={handleRestore}
          disabled={selectedVersion === null || isRestoring}
          className="flex-1"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {isRestoring ? "Restaurando..." : "Restaurar Versión"}
        </Button>
      </div>

      {/* Información */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">Consejo:</p>
              <p>
                Restaurar una versión anterior te permitirá continuar desde donde lo dejaste. 
                Todos los cambios posteriores se perderán.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
