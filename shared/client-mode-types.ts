/**
 * Client Presentation Mode Types
 * ============================================================================
 * Tipos para modo presentación limpio y profesional para clientes
 */

import { z } from "zod";

/**
 * Estado del Modo Cliente
 */
export interface ClientModeState {
  isActive: boolean;
  showBeforeAfter: boolean;
  sliderPosition: number; // 0-100
  autoPlayAnimation: boolean;
  animationDuration: number; // ms
  showPrice: boolean;
  priceDisplayMode: "total" | "breakdown" | "monthly";
}

/**
 * Datos para presentación al cliente
 */
export interface ClientPresentationData {
  projectName: string;
  projectDescription?: string;
  
  // Imágenes
  beforeImage: string; // URL o base64
  afterImage: string; // URL o base64
  
  // Precios
  totalPrice: number;
  laborCost: number;
  materialsCost: number;
  currency: string; // "USD", "MXN", etc.
  
  // Opcionales
  estimatedDuration?: string; // "3-4 semanas"
  maintenanceLevel?: "bajo" | "medio" | "alto";
  benefits?: string[];
  
  // Configuración
  companyName?: string;
  companyLogo?: string;
  contactInfo?: {
    phone?: string;
    email?: string;
    website?: string;
  };
}

/**
 * Acciones disponibles en modo cliente
 */
export enum ClientModeAction {
  TOGGLE_MODE = "toggle_mode",
  TOGGLE_BEFORE_AFTER = "toggle_before_after",
  UPDATE_SLIDER = "update_slider",
  CONFIRM_PROJECT = "confirm_project",
  CANCEL = "cancel",
  DOWNLOAD_PDF = "download_pdf",
  SHARE = "share",
}

/**
 * Configuración de presentación
 */
export interface PresentationConfig {
  // Colores
  primaryColor: string; // hex
  accentColor: string; // hex
  backgroundColor: string; // hex
  textColor: string; // hex
  
  // Tipografía
  fontFamily: string;
  headingSize: number; // px
  bodySize: number; // px
  
  // Animaciones
  enableAnimations: boolean;
  animationSpeed: "slow" | "normal" | "fast";
  
  // Elementos
  showLogo: boolean;
  showContactInfo: boolean;
  showBenefits: boolean;
  showMaintenance: boolean;
  showEstimatedDuration: boolean;
  
  // Comportamiento
  autoPlayBeforeAfter: boolean;
  autoPlayDuration: number; // ms
  allowDownloadPDF: boolean;
  allowShare: boolean;
  requireConfirmation: boolean;
}

/**
 * Schemas de validación
 */
export const ClientModeStateSchema = z.object({
  isActive: z.boolean(),
  showBeforeAfter: z.boolean(),
  sliderPosition: z.number().min(0).max(100),
  autoPlayAnimation: z.boolean(),
  animationDuration: z.number().positive(),
  showPrice: z.boolean(),
  priceDisplayMode: z.enum(["total", "breakdown", "monthly"]),
});

export const ClientPresentationDataSchema = z.object({
  projectName: z.string().min(1),
  projectDescription: z.string().optional(),
  beforeImage: z.string().url().or(z.string().startsWith("data:")),
  afterImage: z.string().url().or(z.string().startsWith("data:")),
  totalPrice: z.number().nonnegative(),
  laborCost: z.number().nonnegative(),
  materialsCost: z.number().nonnegative(),
  currency: z.string(),
  estimatedDuration: z.string().optional(),
  maintenanceLevel: z.enum(["bajo", "medio", "alto"]).optional(),
  benefits: z.array(z.string()).optional(),
  companyName: z.string().optional(),
  companyLogo: z.string().url().optional(),
  contactInfo: z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
  }).optional(),
});

export const PresentationConfigSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  accentColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  backgroundColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  textColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  fontFamily: z.string(),
  headingSize: z.number().positive(),
  bodySize: z.number().positive(),
  enableAnimations: z.boolean(),
  animationSpeed: z.enum(["slow", "normal", "fast"]),
  showLogo: z.boolean(),
  showContactInfo: z.boolean(),
  showBenefits: z.boolean(),
  showMaintenance: z.boolean(),
  showEstimatedDuration: z.boolean(),
  autoPlayBeforeAfter: z.boolean(),
  autoPlayDuration: z.number().positive(),
  allowDownloadPDF: z.boolean(),
  allowShare: z.boolean(),
  requireConfirmation: z.boolean(),
});

export type ClientModeStateType = z.infer<typeof ClientModeStateSchema>;
export type ClientPresentationDataType = z.infer<typeof ClientPresentationDataSchema>;
export type PresentationConfigType = z.infer<typeof PresentationConfigSchema>;

/**
 * Configuración por defecto
 */
export const DEFAULT_PRESENTATION_CONFIG: PresentationConfigType = {
  primaryColor: "#2E7D32", // Verde profesional
  accentColor: "#FFC107", // Oro
  backgroundColor: "#FFFFFF",
  textColor: "#212121",
  fontFamily: "'Inter', 'Segoe UI', sans-serif",
  headingSize: 48,
  bodySize: 16,
  enableAnimations: true,
  animationSpeed: "normal",
  showLogo: true,
  showContactInfo: true,
  showBenefits: true,
  showMaintenance: true,
  showEstimatedDuration: true,
  autoPlayBeforeAfter: true,
  autoPlayDuration: 3000,
  allowDownloadPDF: true,
  allowShare: true,
  requireConfirmation: true,
};
