/**
 * Tipos de Inventario y Tienda
 * ============================================================================
 * Define la estructura de datos para plantas, inventario y carrito de compras
 */

import { z } from "zod";

/**
 * Tipos de plantas
 */
export enum PlantType {
  TREE = "tree",
  SHRUB = "shrub",
  GROUNDCOVER = "groundcover",
  GRASS = "grass",
  FLOWER = "flower",
  VINE = "vine",
  SUCCULENT = "succulent",
}

/**
 * Regiones/Climas
 */
export enum ClimateZone {
  TROPICAL = "tropical",
  SUBTROPICAL = "subtropical",
  TEMPERATE = "temperate",
  ARID = "arid",
  COLD = "cold",
  MIXED = "mixed",
}

/**
 * Producto de inventario
 */
export interface InventoryItem {
  id: string;
  name: string;
  scientificName: string;
  type: PlantType;
  description: string;
  imageUrl: string;
  price: number; // Precio unitario en USD
  stock: number; // Cantidad disponible
  minStock: number; // Stock mínimo para alertas
  climateZones: ClimateZone[];
  matureHeight: number; // en metros
  matureWidth: number; // en metros
  minSpacing: number; // Espaciamiento mínimo en metros
  sunRequirement: "full" | "partial" | "shade";
  waterNeeds: "low" | "medium" | "high";
  maintenanceLevel: "low" | "medium" | "high";
  nativeRegion: string;
  bloomSeason?: string;
  bloomColor?: string;
  foliageColor?: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

/**
 * Planta usada en diseño
 */
export interface DesignPlant {
  id: string; // ID único de la instancia en el diseño
  inventoryItemId: string; // Referencia al item del inventario
  x: number;
  y: number;
  radius: number; // Radio de la planta
  quantity: number; // Cantidad de plantas en este punto
  addedAt: number;
  notes?: string;
}

/**
 * Carrito de compras (temporal durante diseño)
 */
export interface ShoppingCart {
  items: CartItem[];
  totalQuantity: number;
  totalCost: number;
  lastUpdated: number;
}

/**
 * Item en carrito
 */
export interface CartItem {
  inventoryItemId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/**
 * Historial de stock
 */
export interface StockHistory {
  id: string;
  inventoryItemId: string;
  previousStock: number;
  newStock: number;
  change: number;
  reason: "added" | "removed" | "design_used" | "design_removed" | "adjustment";
  projectId?: string;
  timestamp: number;
  notes?: string;
}

/**
 * Reporte de inventario
 */
export interface InventoryReport {
  totalItems: number;
  totalValue: number;
  lowStockItems: InventoryItem[];
  outOfStockItems: InventoryItem[];
  mostPopular: Array<{
    item: InventoryItem;
    timesUsed: number;
  }>;
  generatedAt: number;
}

/**
 * Filtros de búsqueda
 */
export interface InventoryFilters {
  searchTerm?: string;
  types?: PlantType[];
  climateZones?: ClimateZone[];
  priceRange?: {
    min: number;
    max: number;
  };
  sunRequirement?: "full" | "partial" | "shade";
  waterNeeds?: "low" | "medium" | "high";
  maintenanceLevel?: "low" | "medium" | "high";
  inStockOnly?: boolean;
}

/**
 * Modo rápido (venta rápida)
 */
export interface QuickSaleMode {
  enabled: boolean;
  selectedPlants: string[]; // IDs de inventario
  maxPlants: number; // Máximo de especies diferentes
  autoDesign: boolean; // Generar diseño automático
}

/**
 * Validaciones con Zod
 */
export const PlantTypeSchema = z.enum([
  PlantType.TREE,
  PlantType.SHRUB,
  PlantType.GROUNDCOVER,
  PlantType.GRASS,
  PlantType.FLOWER,
  PlantType.VINE,
  PlantType.SUCCULENT,
]);

export const ClimateZoneSchema = z.enum([
  ClimateZone.TROPICAL,
  ClimateZone.SUBTROPICAL,
  ClimateZone.TEMPERATE,
  ClimateZone.ARID,
  ClimateZone.COLD,
  ClimateZone.MIXED,
]);

export const InventoryItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  scientificName: z.string(),
  type: PlantTypeSchema,
  description: z.string(),
  imageUrl: z.string().url(),
  price: z.number().positive(),
  stock: z.number().nonnegative(),
  minStock: z.number().nonnegative(),
  climateZones: z.array(ClimateZoneSchema),
  matureHeight: z.number().positive(),
  matureWidth: z.number().positive(),
  minSpacing: z.number().positive(),
  sunRequirement: z.enum(["full", "partial", "shade"]),
  waterNeeds: z.enum(["low", "medium", "high"]),
  maintenanceLevel: z.enum(["low", "medium", "high"]),
  nativeRegion: z.string(),
  bloomSeason: z.string().optional(),
  bloomColor: z.string().optional(),
  foliageColor: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  isActive: z.boolean(),
});

export const DesignPlantSchema = z.object({
  id: z.string(),
  inventoryItemId: z.string(),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  quantity: z.number().positive().int(),
  addedAt: z.number(),
  notes: z.string().optional(),
});

export const CartItemSchema = z.object({
  inventoryItemId: z.string(),
  quantity: z.number().positive().int(),
  unitPrice: z.number().positive(),
  subtotal: z.number().positive(),
});

export const ShoppingCartSchema = z.object({
  items: z.array(CartItemSchema),
  totalQuantity: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
  lastUpdated: z.number(),
});

export const InventoryFiltersSchema = z.object({
  searchTerm: z.string().optional(),
  types: z.array(PlantTypeSchema).optional(),
  climateZones: z.array(ClimateZoneSchema).optional(),
  priceRange: z.object({
    min: z.number().nonnegative(),
    max: z.number().positive(),
  }).optional(),
  sunRequirement: z.enum(["full", "partial", "shade"]).optional(),
  waterNeeds: z.enum(["low", "medium", "high"]).optional(),
  maintenanceLevel: z.enum(["low", "medium", "high"]).optional(),
  inStockOnly: z.boolean().optional(),
});

export const QuickSaleModeSchema = z.object({
  enabled: z.boolean(),
  selectedPlants: z.array(z.string()),
  maxPlants: z.number().positive().int(),
  autoDesign: z.boolean(),
});
