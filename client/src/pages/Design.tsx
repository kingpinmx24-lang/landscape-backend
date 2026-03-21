import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function Design() {
  const [, params] = useRoute("/projects/:id/design");
  const [, setLocation] = useLocation();
  const projectId = params?.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const project = projectId
    ? JSON.parse(localStorage.getItem(`project_${projectId}`) || "{}")
    : null;

  if (!project || !project.id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Proyecto no encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">No se pudo cargar el proyecto.</p>
            <Button onClick={() => setLocation("/projects/new")}>
              Crear nuevo proyecto
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project.captureImage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Foto no capturada</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">Debes capturar una foto primero.</p>
            <Button onClick={() => setLocation(`/projects/${projectId}/capture`)}>
              Volver a capturar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleContinue = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const updatedProject = {
        ...project,
        status: "designed",
        updatedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem(`project_${projectId}`, JSON.stringify(updatedProject));
      } catch (storageErr) {
        sessionStorage.setItem(`project_${projectId}`, JSON.stringify(updatedProject));
      }

      setTimeout(() => {
        setLocation(`/projects/${projectId}/adjust`);
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al continuar";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Paso 3: Diseño</h1>
            <p className="text-sm text-gray-600">
              Proyecto: {project.name}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Foto capturada */}
          <Card>
            <CardHeader>
              <CardTitle>Foto Capturada</CardTitle>
              <CardDescription>
                Imagen del terreno
              </CardDescription>
            </CardHeader>
            <CardContent>
              <img
                src={project.captureImage}
                alt="Terreno capturado"
                className="w-full h-96 object-cover rounded-lg border border-gray-200"
              />
            </CardContent>
          </Card>

          {/* Información del análisis */}
          <Card>
            <CardHeader>
              <CardTitle>Análisis del Terreno</CardTitle>
              <CardDescription>
                Información detectada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Proyecto</h3>
                  <p className="text-sm text-gray-600">{project.name}</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Cliente</h3>
                  <p className="text-sm text-gray-600">{project.clientName}</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Dirección</h3>
                  <p className="text-sm text-gray-600">{project.address}</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    ℹ️ El análisis automático de zonas se ejecutará en el siguiente paso.
                  </p>
                </div>

                <Button
                  onClick={handleContinue}
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    "Continuar a Ajuste en Vivo"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
