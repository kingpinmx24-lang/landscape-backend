import { useState, useCallback, useMemo } from "react";
import { useInventoryCanvas } from "./useInventoryCanvas";

interface QuotationConfig {
  laborCostPerHour: number;
  estimatedHours: number;
  marginPercentage: number;
  taxPercentage: number;
}

/**
 * Hook para calcular cotización basada en inventario
 * Integra costo de plantas + mano de obra + margen + impuestos
 */
export function useInventoryQuotation(config: QuotationConfig) {
  const { getPlantSummary, getTotalPlantsCost } = useInventoryCanvas();
  const [customNotes, setCustomNotes] = useState<string>("");

  /**
   * Calcular costos
   */
  const quotation = useMemo(() => {
    const plantsCost = getTotalPlantsCost();
    const laborCost = config.laborCostPerHour * config.estimatedHours;
    const subtotal = plantsCost + laborCost;
    const margin = subtotal * (config.marginPercentage / 100);
    const subtotalWithMargin = subtotal + margin;
    const tax = subtotalWithMargin * (config.taxPercentage / 100);
    const finalPrice = subtotalWithMargin + tax;

    return {
      plantsCost,
      laborCost,
      subtotal,
      margin,
      marginPercentage: config.marginPercentage,
      subtotalWithMargin,
      tax,
      taxPercentage: config.taxPercentage,
      finalPrice,
    };
  }, [getTotalPlantsCost, config]);

  /**
   * Obtener desglose detallado
   */
  const getDetailedBreakdown = useCallback(() => {
    const plantSummary = getPlantSummary();
    return {
      plants: plantSummary,
      labor: {
        hoursEstimated: config.estimatedHours,
        costPerHour: config.laborCostPerHour,
        totalCost: config.laborCostPerHour * config.estimatedHours,
      },
      quotation,
    };
  }, [getPlantSummary, config, quotation]);

  /**
   * Exportar cotización como CSV
   */
  const exportAsCSV = useCallback(() => {
    const breakdown = getDetailedBreakdown();
    const lines: string[] = [];

    lines.push("COTIZACIÓN DE PAISAJISMO");
    lines.push(`Fecha: ${new Date().toLocaleDateString()}`);
    lines.push("");

    lines.push("PLANTAS");
    lines.push("Nombre,Cantidad,Precio Unitario,Subtotal");
    breakdown.plants.forEach((plant) => {
      lines.push(
        `"${plant.item.name}",${plant.quantity},$${plant.item.price.toFixed(2)},$${plant.cost.toFixed(2)}`
      );
    });
    lines.push("");

    lines.push("RESUMEN");
    lines.push(`Costo de plantas,$${breakdown.quotation.plantsCost.toFixed(2)}`);
    lines.push(`Mano de obra (${breakdown.labor.hoursEstimated}h),$${breakdown.labor.totalCost.toFixed(2)}`);
    lines.push(`Subtotal,$${breakdown.quotation.subtotal.toFixed(2)}`);
    lines.push(`Margen (${breakdown.quotation.marginPercentage}%),$${breakdown.quotation.margin.toFixed(2)}`);
    lines.push(`Subtotal con margen,$${breakdown.quotation.subtotalWithMargin.toFixed(2)}`);
    lines.push(`Impuesto (${breakdown.quotation.taxPercentage}%),$${breakdown.quotation.tax.toFixed(2)}`);
    lines.push(`PRECIO FINAL,$${breakdown.quotation.finalPrice.toFixed(2)}`);

    if (customNotes) {
      lines.push("");
      lines.push("NOTAS");
      lines.push(customNotes);
    }

    return lines.join("\n");
  }, [getDetailedBreakdown, customNotes]);

  /**
   * Exportar cotización como JSON
   */
  const exportAsJSON = useCallback(() => {
    const breakdown = getDetailedBreakdown();
    return {
      generatedAt: new Date().toISOString(),
      plants: breakdown.plants.map((p) => ({
        name: p.item.name,
        quantity: p.quantity,
        unitPrice: p.item.price,
        subtotal: p.cost,
      })),
      labor: breakdown.labor,
      quotation: breakdown.quotation,
      notes: customNotes,
    };
  }, [getDetailedBreakdown, customNotes]);

  /**
   * Obtener cotización como HTML para impresión
   */
  const getHTMLQuotation = useCallback(() => {
    const breakdown = getDetailedBreakdown();
    const date = new Date().toLocaleDateString();

    return `
      <html>
        <head>
          <title>Cotización de Paisajismo</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .total { font-weight: bold; font-size: 18px; color: #2563eb; }
            .summary { margin-top: 30px; }
          </style>
        </head>
        <body>
          <h1>Cotización de Paisajismo</h1>
          <p><strong>Fecha:</strong> ${date}</p>
          
          <h2>Plantas</h2>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cantidad</th>
                <th>Precio Unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${breakdown.plants
                .map(
                  (p) => `
                <tr>
                  <td>${p.item.name}</td>
                  <td>${p.quantity}</td>
                  <td>$${p.item.price.toFixed(2)}</td>
                  <td>$${p.cost.toFixed(2)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <div class="summary">
            <p><strong>Costo de plantas:</strong> $${breakdown.quotation.plantsCost.toFixed(2)}</p>
            <p><strong>Mano de obra (${breakdown.labor.hoursEstimated}h):</strong> $${breakdown.labor.totalCost.toFixed(2)}</p>
            <p><strong>Subtotal:</strong> $${breakdown.quotation.subtotal.toFixed(2)}</p>
            <p><strong>Margen (${breakdown.quotation.marginPercentage}%):</strong> $${breakdown.quotation.margin.toFixed(2)}</p>
            <p><strong>Impuesto (${breakdown.quotation.taxPercentage}%):</strong> $${breakdown.quotation.tax.toFixed(2)}</p>
            <p class="total"><strong>PRECIO FINAL:</strong> $${breakdown.quotation.finalPrice.toFixed(2)}</p>
          </div>

          ${
            customNotes
              ? `
            <h2>Notas</h2>
            <p>${customNotes}</p>
          `
              : ""
          }
        </body>
      </html>
    `;
  }, [getDetailedBreakdown, customNotes]);

  return {
    quotation,
    customNotes,
    setCustomNotes,
    getDetailedBreakdown,
    exportAsCSV,
    exportAsJSON,
    getHTMLQuotation,
  };
}
