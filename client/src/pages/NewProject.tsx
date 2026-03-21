import React, { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2 } from "lucide-react";

/**
 * Página de creación de nuevo proyecto
 */
export default function NewProject() {
  const { user } = useAuth();
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectName.trim() || !clientName.trim() || !address.trim()) {
      setError("Por favor completa todos los campos requeridos");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // En producción, esto sería una llamada a tRPC
      // const result = await trpc.projects.create.mutate({
      //   name: projectName,
      //   clientName,
      //   address,
      //   notes,
      // });

      // Simulación - crear proyecto localmente
      const projectId = Math.random().toString(36).substr(2, 9);
      
      // Guardar en localStorage
      const newProject = {
        id: projectId,
        name: projectName,
        clientName,
        address,
        notes,
        createdAt: new Date().toISOString(),
        status: "draft",
      };

      localStorage.setItem(`project_${projectId}`, JSON.stringify(newProject));

      // Redirigir al flujo de captura
      window.location.href = `/projects/${projectId}/capture`;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al crear proyecto";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 md:py-6 flex items-center gap-2 md:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Nuevo Proyecto</h1>
            <p className="text-xs md:text-sm text-gray-600">Crea un nuevo proyecto de paisajismo</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Información del Proyecto</CardTitle>
            <CardDescription>
              Completa los detalles básicos para comenzar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProject} className="space-y-6">
              {/* Error message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Nombre del proyecto */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Nombre del Proyecto *
                </label>
                <Input
                  placeholder="Ej: Jardín Frontal Casa López"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {/* Nombre del cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Nombre del Cliente *
                </label>
                <Input
                  placeholder="Ej: Juan López"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {/* Dirección */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Dirección *
                </label>
                <Input
                  placeholder="Ej: Calle Principal 123, Ciudad"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Notas Adicionales
                </label>
                <Textarea
                  placeholder="Ej: Cliente prefiere plantas de bajo mantenimiento, presupuesto máximo $5000"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isLoading}
                  rows={4}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.history.back()}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear Proyecto"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Paso 1: Captura</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Tomarás una foto del terreno con la cámara de tu dispositivo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Paso 2: Análisis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                El sistema detectará automáticamente las zonas (tierra, pasto, concreto)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Paso 3: Diseño</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Se generará una propuesta automática que podrás ajustar en vivo
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
