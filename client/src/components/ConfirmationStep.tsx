/**
 * Component: ConfirmationStep
 * ============================================================================
 * Paso 6 del flujo: Confirmación y cierre de venta
 */

import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle, FileText, CreditCard } from "lucide-react";
import { ConfirmationData, ProjectFlowStatus, DesignData } from "@shared/workflow-persistence-types";
import { useQuotationSync } from "@/hooks/useQuotationSync";

interface ConfirmationStepProps {
  projectId: string;
  design: DesignData;
  onComplete?: (confirmationData: ConfirmationData) => void;
  onCancel?: () => void;
}

/**
 * Componente ConfirmationStep
 */
export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  projectId,
  design,
  onComplete,
  onCancel,
}) => {
  const [contractSigned, setContractSigned] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "partial" | "complete">("pending");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const quotationSync = useQuotationSync();

  // Calcular cotización
  React.useEffect(() => {
    quotationSync.updateQuotationImmediate(design);
  }, [design]);

  /**
   * Manejar confirmación
   */
  const handleConfirm = useCallback(async () => {
    try {
      setIsSubmitting(true);

      const confirmationData: ConfirmationData = {
        approvedAt: Date.now(),
        approvedBy: "Vendedor",
        projectStatus: ProjectFlowStatus.APPROVED,
        contractSigned,
        paymentStatus,
        notes,
      };

      setConfirmed(true);
      onComplete?.(confirmationData);
    } catch (error) {
      console.error("Error al confirmar:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [contractSigned, paymentStatus, notes, onComplete]);

  const breakdown = quotationSync.getQuotationBreakdown();

  if (confirmed) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-6 p-4">
        <div className="text-center">
          <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-2">¡Proyecto Confirmado!</h2>
          <p className="text-gray-600 mb-6">
            El proyecto ha sido guardado y está listo para comenzar
          </p>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 max-w-md mx-auto">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">ID del Proyecto:</span>
                <span className="font-semibold">{projectId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estado:</span>
                <span className="font-semibold text-green-600">Aprobado</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Inversión Total:</span>
                <span className="font-bold text-lg">
                  ${breakdown.summary.finalPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha:</span>
                <span className="font-semibold">{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-6">
            Se ha enviado un correo de confirmación al cliente
          </p>

          <Button onClick={() => window.location.href = "/projects"} className="w-full max-w-md">
            Ir a Proyectos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Confirmación del Proyecto</h2>
        <p className="text-gray-600 text-sm">
          Revisa los detalles y confirma para cerrar la venta
        </p>
      </div>

      {/* Resumen final */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumen Final</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Plantas</p>
              <p className="text-2xl font-bold">{design.plants.length}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Materiales</p>
              <p className="text-2xl font-bold">{design.materials.length}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">Área</p>
              <p className="text-2xl font-bold">{design.layout.totalArea.toFixed(0)} m²</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-600">Densidad</p>
              <p className="text-2xl font-bold">{design.layout.plantDensity.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cotización final */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cotización Final</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Plantas</span>
              <span>${breakdown.plants.cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Materiales</span>
              <span>${breakdown.materials.cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Mano de Obra</span>
              <span>${breakdown.labor.cost.toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Subtotal</span>
              <span>${breakdown.summary.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Margen (30%)</span>
              <span>${breakdown.summary.margin.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Impuesto (10%)</span>
              <span>${breakdown.summary.tax.toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-lg font-bold text-green-600">
              <span>TOTAL</span>
              <span>${breakdown.summary.finalPrice.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist de confirmación */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Confirmación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Checkbox
              id="contract"
              checked={contractSigned}
              onCheckedChange={(checked) => setContractSigned(checked as boolean)}
            />
            <label htmlFor="contract" className="flex-1 cursor-pointer">
              <p className="font-medium">Contrato Firmado</p>
              <p className="text-sm text-gray-600">El cliente ha firmado el contrato</p>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Estado de Pago</label>
            <div className="space-y-2">
              {(["pending", "partial", "complete"] as const).map((status) => (
                <label key={status} className="flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50 rounded">
                  <input
                    type="radio"
                    name="payment"
                    value={status}
                    checked={paymentStatus === status}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-4 h-4"
                  />
                  <span className="capitalize">{status === "pending" ? "Pendiente" : status === "partial" ? "Parcial" : "Completo"}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notas Adicionales</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agrega cualquier nota importante..."
              className="w-full p-3 border rounded-lg text-sm"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Información importante */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Información Importante</p>
              <p className="text-sm text-blue-700 mt-1">
                Al confirmar, el proyecto se guardará en la base de datos y se enviará un correo de confirmación al cliente. Este paso es irreversible.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botones de acción */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isSubmitting || !contractSigned}
          className="flex-1"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          {isSubmitting ? "Confirmando..." : "Confirmar Proyecto"}
        </Button>
      </div>
    </div>
  );
};
