import React from "react";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StockIndicatorProps {
  stock: number;
  minStock: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Indicador de stock en tiempo real
 * Muestra estado visual del stock disponible
 */
export function StockIndicator({
  stock,
  minStock,
  showLabel = true,
  size = "md",
}: StockIndicatorProps) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let icon = null;
  let label = "";

  if (stock === 0) {
    variant = "destructive";
    icon = <AlertCircle className="w-4 h-4" />;
    label = "Agotado";
  } else if (stock < minStock) {
    variant = "destructive";
    icon = <AlertTriangle className="w-4 h-4" />;
    label = "Stock bajo";
  } else if (stock < minStock * 2) {
    variant = "secondary";
    label = "Stock limitado";
  } else {
    variant = "default";
    icon = <CheckCircle className="w-4 h-4" />;
    label = "En stock";
  }

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-2.5 py-1.5",
    lg: "text-base px-3 py-2",
  };

  return (
    <Badge variant={variant} className={sizeClasses[size]}>
      {icon && <span className="mr-1">{icon}</span>}
      {showLabel ? label : stock}
    </Badge>
  );
}
