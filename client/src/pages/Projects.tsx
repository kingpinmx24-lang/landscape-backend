import React, { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Edit, Eye } from "lucide-react";

interface Project {
  id: string;
  name: string;
  clientName: string;
  address: string;
  createdAt: string;
  status: string;
}

/**
 * Página de lista de proyectos
 */
export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Cargar proyectos del localStorage
    const loadProjects = () => {
      try {
        const allProjects: Project[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("project_")) {
            const projectData = localStorage.getItem(key);
            if (projectData) {
              allProjects.push(JSON.parse(projectData));
            }
          }
        }
        setProjects(allProjects.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      } catch (err) {
        console.error("Error loading projects:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, []);

  const handleDeleteProject = (projectId: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este proyecto?")) {
      localStorage.removeItem(`project_${projectId}`);
      setProjects(projects.filter(p => p.id !== projectId));
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      capturing: "bg-blue-100 text-blue-800",
      analyzing: "bg-purple-100 text-purple-800",
      designing: "bg-indigo-100 text-indigo-800",
      adjusting: "bg-yellow-100 text-yellow-800",
      presenting: "bg-orange-100 text-orange-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return colors[status] || colors.draft;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = "/"}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mis Proyectos</h1>
              <p className="text-sm text-gray-600">Gestiona tus proyectos de paisajismo</p>
            </div>
          </div>
          <Button onClick={() => window.location.href = "/projects/new"}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Proyecto
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-600">Cargando proyectos...</p>
          </div>
        ) : projects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-gray-600 mb-4">No tienes proyectos aún</p>
              <Button onClick={() => window.location.href = "/projects/new"}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Primer Proyecto
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {project.name}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusBadge(project.status)}`}>
                          {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Cliente:</strong> {project.clientName}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Dirección:</strong> {project.address}
                      </p>
                      <p className="text-xs text-gray-500">
                        Creado: {new Date(project.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = `/projects/${project.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = `/projects/${project.id}/edit`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteProject(project.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
