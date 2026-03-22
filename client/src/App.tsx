import React, { useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useRoute } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Projects from "./pages/Projects";
import NewProject from "./pages/NewProject";
import Capture from "./pages/Capture";
import Design from "./pages/Design";
import { AdjustLiveStep } from "./components/AdjustLiveStep";
import { ClientPresentationStep } from "./components/ClientPresentationStep";
import { ConfirmationStep } from "./components/ConfirmationStep";
import InventoryAdmin from "./pages/InventoryAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { useLocation } from "wouter";
import { DesignData } from "@shared/workflow-persistence-types";
import { loadImage } from "./lib/imageStorage";
import { Loader2 } from "lucide-react";

const DEFAULT_DESIGN: DesignData = {
  plants: [],
  materials: [],
  layout: {
    totalArea: 0,
    plantDensity: 0,
    spacing: 0,
  },
  quotation: {
    plantsCost: 0,
    materialsCost: 0,
    laborCost: 0,
    totalCost: 0,
    margin: 0.3,
    finalPrice: 0,
  },
  timestamp: Date.now(),
};

/**
 * Hook: load capture image from IndexedDB (primary) or localStorage (fallback).
 * Returns [imageUrl, isLoading].
 */
function useCaptureImage(projectId: string, project: any): [string | undefined, boolean] {
  const [captureImage, setCaptureImage] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    loadImage(`captureImage_${projectId}`)
      .then((img) => {
        if (img) {
          setCaptureImage(img);
        } else if (
          project?.captureImage &&
          typeof project.captureImage === "string" &&
          project.captureImage.startsWith("data:")
        ) {
          setCaptureImage(project.captureImage);
        } else if (project?.capture?.imageUrl?.startsWith("data:")) {
          setCaptureImage(project.capture.imageUrl);
        } else if (project?.capture?.imageBase64?.startsWith("data:")) {
          setCaptureImage(project.capture.imageBase64);
        }
      })
      .catch((err) => console.error("[useCaptureImage] failed:", err))
      .finally(() => setLoading(false));
  }, [projectId]);

  return [captureImage, loading];
}

function AdjustLivePageRoute() {
  const [, params] = useRoute("/projects/:id/adjust");
  const [, setLocation] = useLocation();
  const projectId = params?.id as string;

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
            <p className="text-gray-600 mb-4">El proyecto no existe o ha sido eliminado.</p>
            <Button onClick={() => setLocation("/")} className="w-full">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [captureImage, imageLoading] = useCaptureImage(projectId, project);

  if (imageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600" />
          <p className="text-gray-600">Cargando foto del terreno...</p>
        </div>
      </div>
    );
  }

  if (!captureImage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Foto no encontrada</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">No se pudo cargar la foto del terreno.</p>
            <Button onClick={() => setLocation(`/projects/${projectId}/capture`)} className="w-full">
              Volver a capturar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdjustLiveStep
      projectId={projectId}
      initialDesign={{
        ...(project.design || DEFAULT_DESIGN),
        captureImage,
      }}
      onComplete={(adjustmentData) => {
        const updatedProject = {
          ...project,
          design: adjustmentData.finalDesign,
          adjustments: adjustmentData,
          status: "adjusting",
        };
        localStorage.setItem(`project_${projectId}`, JSON.stringify(updatedProject));
        setLocation(`/projects/${projectId}/presentation`);
      }}
      onCancel={() => setLocation(`/projects/${projectId}/design`)}
    />
  );
}

function PresentationPageRoute() {
  const [, params] = useRoute("/projects/:id/presentation");
  const [, setLocation] = useLocation();
  const projectId = params?.id as string;

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
            <p className="text-gray-600 mb-4">El proyecto no existe o ha sido eliminado.</p>
            <Button onClick={() => setLocation("/")} className="w-full">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ClientPresentationStep
      projectId={projectId}
      design={project.design || DEFAULT_DESIGN}
      onComplete={(presentationData) => {
        const completedProject = {
          ...project,
          status: "presenting",
          presentation: presentationData,
        };
        localStorage.setItem(`project_${projectId}`, JSON.stringify(completedProject));
        setLocation(`/projects/${projectId}/confirmation`);
      }}
      onCancel={() => setLocation(`/projects/${projectId}/adjust`)}
    />
  );
}

function ConfirmationPageRoute() {
  const [, params] = useRoute("/projects/:id/confirmation");
  const [, setLocation] = useLocation();
  const projectId = params?.id as string;

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
            <p className="text-gray-600 mb-4">El proyecto no existe o ha sido eliminado.</p>
            <Button onClick={() => setLocation("/")} className="w-full">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ConfirmationStep
      projectId={projectId}
      design={project.design || DEFAULT_DESIGN}
      onComplete={(confirmationData) => {
        const confirmedProject = {
          ...project,
          status: "completed",
          completedAt: Date.now(),
          confirmation: confirmationData,
        };
        localStorage.setItem(`project_${projectId}`, JSON.stringify(confirmedProject));
        setLocation("/projects");
      }}
      onCancel={() => setLocation(`/projects/${projectId}/presentation`)}
    />
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/projects"} component={Projects} />
      <Route path={"/projects/new"} component={NewProject} />
      <Route path={"/projects/:id/capture"} component={Capture} />
      <Route path={"/projects/:id/design"} component={Design} />
      <Route path={"/projects/:id/adjust"} component={AdjustLivePageRoute} />
      <Route path={"/projects/:id/presentation"} component={PresentationPageRoute} />
      <Route path={"/projects/:id/confirmation"} component={ConfirmationPageRoute} />
      <Route path={"/inventory"} component={InventoryAdmin} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
