/**
 * Hook: useQuotationSync
 * ============================================================================
 * Sincronización de cotización en tiempo real
 */

import { useCallback, useRef, useEffect, useState } from "react";
import { DesignData, PlantObject, MaterialArea } from "@shared/workflow-persistence-types";

interface QuotationItem {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  type: "plant" | "material";
}

interface Quotation {
  items: QuotationItem[];
  subtotal: number;
  laborCost: number;
  margin: number;
  tax: number;
  total: number;
  finalPrice: number;
  lastUpdated: number;
}

interface QuotationConfig {
  laborCostPerHour?: number;
  estimatedHours?: number;
  marginPercentage?: number;
  taxPercentage?: number;
  debounceDelay?: number;
}

/**
 * Mapeo de costos de plantas por tipo
 */
const PLANT_COSTS: Record<string, number> = {
  flowering: 15,
  shrub: 20,
  tree: 50,
  groundcover: 10,
  decorative: 25,
};

/**
 * Mapeo de costos de materiales por tipo
 */
const MATERIAL_COSTS: Record<string, number> = {
  grass: 5,
  soil: 3,
  concrete: 15,
  gravel: 8,
};

/**
 * Hook useQuotationSync
 */
export function useQuotationSync(config: QuotationConfig = {}) {
  const {
    laborCostPerHour = 50,
    estimatedHours = 4,
    marginPercentage = 30,
    taxPercentage = 10,
    debounceDelay = 500,
  } = config;

  const [quotation, setQuotation] = useState<Quotation>({
    items: [],
    subtotal: 0,
    laborCost: 0,
    margin: 0,
    tax: 0,
    total: 0,
    finalPrice: 0,
    lastUpdated: Date.now(),
  });

  const [isCalculating, setIsCalculating] = useState(false);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * Calcular costo de planta
   */
  const getPlantCost = useCallback((plantType: string): number => {
    return PLANT_COSTS[plantType] || 25;
  }, []);

  /**
   * Calcular costo de material
   */
  const getMaterialCost = useCallback((materialType: string): number => {
    return MATERIAL_COSTS[materialType] || 10;
  }, []);

  /**
   * Calcular cotización a partir del diseño
   */
  const calculateQuotation = useCallback(
    (design: DesignData): Quotation => {
      const items: QuotationItem[] = [];
      let subtotal = 0;

      // Agregar plantas
      design.plants.forEach((plant) => {
        const unitCost = getPlantCost(plant.type);
        const totalCost = unitCost;

        items.push({
          id: plant.id,
          name: plant.name || plant.type,
          quantity: 1,
          unitCost,
          totalCost,
          type: "plant",
        });

        subtotal += totalCost;
      });

      // Agregar materiales
      design.materials.forEach((material) => {
        const unitCost = getMaterialCost(material.type);
        const totalCost = unitCost * material.area;

        items.push({
          id: material.id,
          name: `${material.type} (${material.area.toFixed(2)} m²)`,
          quantity: material.area,
          unitCost,
          totalCost,
          type: "material",
        });

        subtotal += totalCost;
      });

      // Calcular costos adicionales
      const laborCost = laborCostPerHour * estimatedHours;
      const marginAmount = subtotal * (marginPercentage / 100);
      const subtotalWithMargin = subtotal + marginAmount;
      const tax = subtotalWithMargin * (taxPercentage / 100);
      const total = subtotalWithMargin + tax;
      const finalPrice = total + laborCost;

      return {
        items,
        subtotal,
        laborCost,
        margin: marginAmount,
        tax,
        total,
        finalPrice,
        lastUpdated: Date.now(),
      };
    },
    [getPlantCost, getMaterialCost, laborCostPerHour, estimatedHours, marginPercentage, taxPercentage]
  );

  /**
   * Actualizar cotización (debounced)
   */
  const updateQuotation = useCallback(
    (design: DesignData) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        setIsCalculating(true);
        try {
          const newQuotation = calculateQuotation(design);
          setQuotation(newQuotation);
        } finally {
          setIsCalculating(false);
        }
      }, debounceDelay);
    },
    [calculateQuotation, debounceDelay]
  );

  /**
   * Actualizar cotización inmediatamente
   */
  const updateQuotationImmediate = useCallback(
    (design: DesignData) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      setIsCalculating(true);
      try {
        const newQuotation = calculateQuotation(design);
        setQuotation(newQuotation);
      } finally {
        setIsCalculating(false);
      }
    },
    [calculateQuotation]
  );

  /**
   * Obtener desglose de cotización
   */
  const getQuotationBreakdown = useCallback(() => {
    const plants = quotation.items.filter((item) => item.type === "plant");
    const materials = quotation.items.filter((item) => item.type === "material");

    return {
      plants: {
        count: plants.length,
        cost: plants.reduce((sum, item) => sum + item.totalCost, 0),
        items: plants,
      },
      materials: {
        count: materials.length,
        cost: materials.reduce((sum, item) => sum + item.totalCost, 0),
        items: materials,
      },
      labor: {
        hours: estimatedHours,
        hourlyRate: laborCostPerHour,
        cost: quotation.laborCost,
      },
      summary: {
        subtotal: quotation.subtotal,
        margin: quotation.margin,
        tax: quotation.tax,
        total: quotation.total,
        finalPrice: quotation.finalPrice,
      },
    };
  }, [quotation, estimatedHours, laborCostPerHour]);

  /**
   * Exportar cotización como JSON
   */
  const exportQuotation = useCallback(() => {
    return {
      timestamp: new Date().toISOString(),
      quotation,
      breakdown: getQuotationBreakdown(),
    };
  }, [quotation, getQuotationBreakdown]);

  /**
   * Exportar cotización como CSV
   */
  const exportQuotationCSV = useCallback(() => {
    const breakdown = getQuotationBreakdown();
    const lines: string[] = [];

    lines.push("COTIZACIÓN DE PAISAJISMO");
    lines.push(`Fecha: ${new Date().toLocaleDateString()}`);
    lines.push("");

    lines.push("PLANTAS");
    lines.push("Nombre,Cantidad,Costo Unitario,Costo Total");
    breakdown.plants.items.forEach((item) => {
      lines.push(`${item.name},${item.quantity},${item.unitCost},${item.totalCost}`);
    });
    lines.push("");

    lines.push("MATERIALES");
    lines.push("Nombre,Cantidad,Costo Unitario,Costo Total");
    breakdown.materials.items.forEach((item) => {
      lines.push(`${item.name},${item.quantity},${item.unitCost},${item.totalCost}`);
    });
    lines.push("");

    lines.push("RESUMEN");
    lines.push(`Subtotal,${breakdown.summary.subtotal}`);
    lines.push(`Margen (${marginPercentage}%),${breakdown.summary.margin}`);
    lines.push(`Impuesto (${taxPercentage}%),${breakdown.summary.tax}`);
    lines.push(`Mano de Obra,${breakdown.labor.cost}`);
    lines.push(`TOTAL,${breakdown.summary.finalPrice}`);

    return lines.join("\n");
  }, [getQuotationBreakdown, marginPercentage, taxPercentage]);

  /**
   * Limpiar timeout
   */
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Estado
    quotation,
    isCalculating,

    // Métodos
    updateQuotation,
    updateQuotationImmediate,
    calculateQuotation,
    getQuotationBreakdown,
    exportQuotation,
    exportQuotationCSV,

    // Utilidades
    getPlantCost,
    getMaterialCost,
  };
}
