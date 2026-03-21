/**
 * Component: ClientPresentationStep
 * ============================================================================
 * Paso 5 del flujo: Presentación al cliente
 */

import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle, Download, Share2, Eye } from "lucide-react";
import { DesignData, ClientPresentationData } from "@shared/workflow-persistence-types";
import { useQuotationSync } from "@/hooks/useQuotationSync";

interface ClientPresentationStepProps {
  projectId: string;
  design: DesignData;
  onComplete?: (presentationData: ClientPresentationData) => void;
  onCancel?: () => void;
}

/**
 * Componente ClientPresentationStep
 */
export const ClientPresentationStep: React.FC<ClientPresentationStepProps> = ({
  projectId,
  design,
  onComplete,
  onCancel,
}) => {
  const [clientFeedback, setClientFeedback] = useState("");
  const [clientApproval, setClientApproval] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [presentationMode, setPresentationMode] = useState<"review" | "present">("review");

  const quotationSync = useQuotationSync();

  // Calcular cotización
  React.useEffect(() => {
    quotationSync.updateQuotationImmediate(design);
  }, [design]);

  /**
   * Manejar descarga de PDF
   */
  const handleDownloadPDF = useCallback(async () => {
    try {
      // En producción, esto llamaría a un endpoint para generar PDF
      const quotationData = quotationSync.exportQuotation();
      console.log("Descargando PDF:", quotationData);
      // window.location.href = `/api/projects/${projectId}/export/pdf`;
    } catch (error) {
      console.error("Error al descargar PDF:", error);
    }
  }, [projectId, quotationSync]);

  /**
   * Manejar compartir
   */
  const handleShare = useCallback(async () => {
    try {
      const shareData = {
        title: "Propuesta de Paisajismo",
        text: `Cotización total: $${quotationSync.quotation.finalPrice.toFixed(2)}`,
        url: window.location.href,
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copiar a portapapeles
        const text = `Propuesta de Paisajismo\nCotización: $${quotationSync.quotation.finalPrice.toFixed(2)}\n${window.location.href}`;
        await navigator.clipboard.writeText(text);
        alert("Enlace copiado al portapapeles");
      }
    } catch (error) {
      console.error("Error al compartir:", error);
    }
  }, [quotationSync]);

  /**
   * Manejar aprobación
   */
  const handleApprove = useCallback(async () => {
    try {
      setIsSubmitting(true);
      setClientApproval(true);

      const presentationData: ClientPresentationData = {
        presentedAt: Date.now(),
        presentedBy: "Vendedor",
        clientFeedback,
        clientApproval: true,
        clientNotes: clientFeedback,
      };

      onComplete?.(presentationData);
    } catch (error) {
      console.error("Error al aprobar:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [clientFeedback, onComplete]);

  /**
   * Manejar rechazo
   */
  const handleReject = useCallback(async () => {
    try {
      setIsSubmitting(true);
      setClientApproval(false);

      const presentationData: ClientPresentationData = {
        presentedAt: Date.now(),
        presentedBy: "Vendedor",
        clientFeedback,
        clientApproval: false,
        clientNotes: clientFeedback,
      };

      onComplete?.(presentationData);
    } catch (error) {
      console.error("Error al rechazar:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [clientFeedback, onComplete]);

  const breakdown = quotationSync.getQuotationBreakdown();

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Presentación al Cliente</h2>
          <p className="text-gray-600 text-sm">
            Muestra la propuesta y obtén aprobación del cliente
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-1" />
            Descargar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-1" />
            Compartir
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={presentationMode} onValueChange={(v) => setPresentationMode(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="review">Revisar Propuesta</TabsTrigger>
          <TabsTrigger value="present">Modo Presentación</TabsTrigger>
        </TabsList>

        {/* Tab: Revisar Propuesta */}
        <TabsContent value="review" className="space-y-4">
          {/* Resumen de diseño */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumen del Diseño</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Plantas</p>
                  <p className="text-2xl font-bold text-blue-600">{design.plants.length}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Materiales</p>
                  <p className="text-2xl font-bold text-green-600">{design.materials.length}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">Área Total</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {design.layout.totalArea.toFixed(0)} m²
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Desglose de cotización */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Desglose de Cotización</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Plantas */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Plantas ({breakdown.plants.count})</h4>
                <div className="space-y-1 text-sm">
                  {breakdown.plants.items.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span className="text-gray-600">{item.name}</span>
                      <span className="font-medium">${item.totalCost.toFixed(2)}</span>
                    </div>
                  ))}
                  {breakdown.plants.items.length > 5 && (
                    <p className="text-gray-500 text-xs">
                      +{breakdown.plants.items.length - 5} más...
                    </p>
                  )}
                </div>
              </div>

              {/* Materiales */}
              {breakdown.materials.items.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Materiales ({breakdown.materials.count})</h4>
                  <div className="space-y-1 text-sm">
                    {breakdown.materials.items.map((item) => (
                      <div key={item.id} className="flex justify-between">
                        <span className="text-gray-600">{item.name}</span>
                        <span className="font-medium">${item.totalCost.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumen */}
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span>${breakdown.summary.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Margen (30%)</span>
                  <span>${breakdown.summary.margin.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Impuesto (10%)</span>
                  <span>${breakdown.summary.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Mano de Obra</span>
                  <span>${breakdown.labor.cost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>TOTAL</span>
                  <span className="text-green-600">${breakdown.summary.finalPrice.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feedback del cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Feedback del Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Notas del cliente, cambios solicitados, etc..."
                value={clientFeedback}
                onChange={(e) => setClientFeedback(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isSubmitting || clientApproval === true}
            >
              Rechazado
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isSubmitting || clientApproval === false}
              className="flex-1"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {isSubmitting ? "Procesando..." : "Aprobado"}
            </Button>
          </div>
        </TabsContent>

        {/* Tab: Modo Presentación */}
        <TabsContent value="present" className="space-y-4">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle>Modo Presentación</CardTitle>
              <CardDescription>
                Pantalla completa optimizada para mostrar al cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cotización grande */}
              <div className="bg-white rounded-lg p-8 text-center">
                <p className="text-gray-600 text-lg mb-2">Inversión Total</p>
                <p className="text-6xl font-bold text-green-600 mb-4">
                  ${breakdown.summary.finalPrice.toFixed(2)}
                </p>

                <div className="grid grid-cols-3 gap-4 mt-8">
                  <div>
                    <p className="text-sm text-gray-600">Plantas</p>
                    <p className="text-3xl font-bold">{design.plants.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Materiales</p>
                    <p className="text-3xl font-bold">{design.materials.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Área</p>
                    <p className="text-3xl font-bold">{design.layout.totalArea.toFixed(0)} m²</p>
                  </div>
                </div>
              </div>

              {/* Información de contacto */}
              <div className="bg-white rounded-lg p-6 text-center">
                <p className="text-gray-600 mb-2">¿Preguntas?</p>
                <p className="text-2xl font-semibold">Contacta a tu vendedor</p>
                <p className="text-gray-500 mt-2">Estamos aquí para ayudarte</p>
              </div>

              <Button className="w-full py-6 text-lg" onClick={handleApprove}>
                <CheckCircle className="w-5 h-5 mr-2" />
                Aprobar Propuesta
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Información de aprobación */}
      {clientApproval !== null && (
        <Card className={clientApproval ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle
                className={`w-5 h-5 ${clientApproval ? "text-green-600" : "text-red-600"}`}
              />
              <p className={clientApproval ? "text-green-700" : "text-red-700"}>
                {clientApproval ? "Propuesta aprobada por el cliente" : "Propuesta rechazada"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
