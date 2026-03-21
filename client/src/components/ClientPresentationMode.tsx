/**
 * Client Presentation Mode
 * ============================================================================
 * Modo limpio y profesional para presentar diseño al cliente
 * Oculta toda interfaz técnica, muestra solo lo esencial
 */

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ClientModeState,
  ClientPresentationData,
  PresentationConfig,
  DEFAULT_PRESENTATION_CONFIG,
} from "@/../../shared/client-mode-types";

interface ClientPresentationModeProps {
  data: ClientPresentationData;
  config?: Partial<PresentationConfig>;
  onConfirm?: () => void;
  onCancel?: () => void;
  onDownloadPDF?: () => void;
}

/**
 * Componente de modo cliente
 * Presentación limpia y profesional sin distracciones
 */
export const ClientPresentationMode: React.FC<ClientPresentationModeProps> = ({
  data,
  config = {},
  onConfirm,
  onCancel,
  onDownloadPDF,
}) => {
  const finalConfig = { ...DEFAULT_PRESENTATION_CONFIG, ...config };

  const [state, setState] = useState<ClientModeState>({
    isActive: true,
    showBeforeAfter: true,
    sliderPosition: 50,
    autoPlayAnimation: finalConfig.autoPlayBeforeAfter,
    animationDuration: finalConfig.autoPlayDuration,
    showPrice: true,
    priceDisplayMode: "total",
  });

  const [autoPlayTimer, setAutoPlayTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  /**
   * Auto-play animación BEFORE/AFTER
   */
  useEffect(() => {
    if (!state.autoPlayAnimation || !state.showBeforeAfter) {
      if (autoPlayTimer) clearInterval(autoPlayTimer);
      return;
    }

    const timer = setInterval(() => {
      setState((prev) => ({
        ...prev,
        sliderPosition:
          prev.sliderPosition >= 100 ? 0 : prev.sliderPosition + 2,
      }));
    }, 50);

    setAutoPlayTimer(timer);

    return () => clearInterval(timer);
  }, [state.autoPlayAnimation, state.showBeforeAfter, autoPlayTimer]);

  /**
   * Formatear precio
   */
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: data.currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-auto"
      style={{
        backgroundColor: finalConfig.backgroundColor,
        color: finalConfig.textColor,
        fontFamily: finalConfig.fontFamily,
      }}
    >
      {/* Header con logo y botón volver */}
      <div
        className="flex items-center justify-between p-6 border-b"
        style={{ borderColor: `${finalConfig.primaryColor}20` }}
      >
        <div className="flex items-center gap-4">
          {finalConfig.showLogo && data.companyLogo && (
            <img
              src={data.companyLogo}
              alt={data.companyName}
              className="h-12"
            />
          )}
          {data.companyName && (
            <h1
              className="text-2xl font-bold"
              style={{ color: finalConfig.primaryColor }}
            >
              {data.companyName}
            </h1>
          )}
        </div>

        <Button
          onClick={onCancel}
          variant="outline"
          className="text-lg px-6 py-2"
        >
          ← Volver
        </Button>
      </div>

      {/* Contenido principal */}
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        {/* Título y descripción */}
        <div className="text-center space-y-3">
          <h2
            className="font-bold"
            style={{ fontSize: `${finalConfig.headingSize}px` }}
          >
            {data.projectName}
          </h2>
          {data.projectDescription && (
            <p
              className="text-gray-600 max-w-2xl mx-auto"
              style={{ fontSize: `${finalConfig.bodySize + 2}px` }}
            >
              {data.projectDescription}
            </p>
          )}
        </div>

        {/* BEFORE/AFTER */}
        {state.showBeforeAfter && (
          <div className="rounded-lg overflow-hidden shadow-2xl">
            <div
              className="flex items-center justify-center text-gray-600"
              style={{ height: "500px", backgroundColor: "#f5f5f5" }}
            >
              <div className="text-center">
                <p className="text-xl font-semibold mb-2">Comparación BEFORE/AFTER</p>
                <p className="text-sm">Slider: {state.sliderPosition}%</p>
                <p className="text-xs mt-4 text-gray-500">
                  {state.autoPlayAnimation ? "Reproduciendo..." : "Pausado"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Precio grande y destacado */}
        {state.showPrice && (
          <div
            className="rounded-lg p-12 text-center shadow-lg"
            style={{ backgroundColor: `${finalConfig.primaryColor}10` }}
          >
            <p className="text-gray-600 mb-2" style={{ fontSize: `${finalConfig.bodySize}px` }}>
              Inversión Total
            </p>
            <h3
              className="font-bold"
              style={{
                fontSize: `${finalConfig.headingSize * 1.5}px`,
                color: finalConfig.primaryColor,
              }}
            >
              {formatPrice(data.totalPrice)}
            </h3>

            {/* Desglose opcional */}
            {state.priceDisplayMode === "breakdown" && (
              <div className="mt-6 grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div>
                  <p className="text-sm text-gray-600">Materiales</p>
                  <p
                    className="font-semibold"
                    style={{ color: finalConfig.primaryColor }}
                  >
                    {formatPrice(data.materialsCost)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Mano de Obra</p>
                  <p
                    className="font-semibold"
                    style={{ color: finalConfig.primaryColor }}
                  >
                    {formatPrice(data.laborCost)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Información adicional */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Duración estimada */}
          {finalConfig.showEstimatedDuration && data.estimatedDuration && (
            <Card className="p-6 text-center">
              <p className="text-gray-600 mb-2">Duración Estimada</p>
              <p
                className="text-2xl font-bold"
                style={{ color: finalConfig.primaryColor }}
              >
                {data.estimatedDuration}
              </p>
            </Card>
          )}

          {/* Nivel de mantenimiento */}
          {finalConfig.showMaintenance && data.maintenanceLevel && (
            <Card className="p-6 text-center">
              <p className="text-gray-600 mb-2">Mantenimiento</p>
              <p
                className="text-2xl font-bold capitalize"
                style={{ color: finalConfig.primaryColor }}
              >
                {data.maintenanceLevel === "bajo"
                  ? "Bajo"
                  : data.maintenanceLevel === "medio"
                    ? "Medio"
                    : "Alto"}
              </p>
            </Card>
          )}

          {/* Beneficios principales */}
          {finalConfig.showBenefits && data.benefits && data.benefits.length > 0 && (
            <Card className="p-6">
              <p className="text-gray-600 mb-3 font-semibold">Beneficios</p>
              <ul className="space-y-2">
                {data.benefits.slice(0, 3).map((benefit, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className="text-lg mt-0.5"
                      style={{ color: finalConfig.accentColor }}
                    >
                      ✓
                    </span>
                    <span className="text-sm">{benefit}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex gap-4 justify-center pt-8">
          {onDownloadPDF && finalConfig.allowDownloadPDF && (
            <Button
              onClick={onDownloadPDF}
              variant="outline"
              className="text-lg px-8 py-3"
            >
              📄 Descargar PDF
            </Button>
          )}

          {onConfirm && finalConfig.requireConfirmation && (
            <Button
              onClick={onConfirm}
              className="text-lg px-12 py-3 text-white"
              style={{ backgroundColor: finalConfig.primaryColor }}
            >
              ✓ Confirmar Proyecto
            </Button>
          )}
        </div>

        {/* Información de contacto */}
        {finalConfig.showContactInfo && data.contactInfo && (
          <div
            className="rounded-lg p-6 text-center mt-12"
            style={{ backgroundColor: `${finalConfig.primaryColor}05` }}
          >
            <p className="text-gray-600 mb-4">¿Preguntas? Contáctanos</p>
            <div className="flex justify-center gap-6 flex-wrap">
              {data.contactInfo.phone && (
                <a
                  href={`tel:${data.contactInfo.phone}`}
                  className="font-semibold hover:underline"
                  style={{ color: finalConfig.primaryColor }}
                >
                  📞 {data.contactInfo.phone}
                </a>
              )}
              {data.contactInfo.email && (
                <a
                  href={`mailto:${data.contactInfo.email}`}
                  className="font-semibold hover:underline"
                  style={{ color: finalConfig.primaryColor }}
                >
                  ✉️ {data.contactInfo.email}
                </a>
              )}
              {data.contactInfo.website && (
                <a
                  href={data.contactInfo.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold hover:underline"
                  style={{ color: finalConfig.primaryColor }}
                >
                  🌐 Visitar sitio
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="border-t py-4 text-center text-sm text-gray-600"
        style={{ borderColor: `${finalConfig.primaryColor}20` }}
      >
        <p>© {new Date().getFullYear()} {data.companyName}. Todos los derechos reservados.</p>
      </div>
    </div>
  );
};

export default ClientPresentationMode;
