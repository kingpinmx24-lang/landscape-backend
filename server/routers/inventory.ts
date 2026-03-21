/**
 * Router: Inventory
 * ============================================================================
 * Procedimientos tRPC para gestión de inventario y plantas
 */

import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { inventoryItems } from "../../drizzle/schema";
import { getDb } from "../db";
import { eq } from "drizzle-orm";

/**
 * Validación de planta
 */
const PlantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  scientificName: z.string().optional(),
  type: z.enum(["tree", "shrub", "flower", "grass", "groundcover"]),
  price: z.number().positive("Price must be positive"),
  stock: z.number().int().min(0, "Stock cannot be negative"),
  minStock: z.number().int().min(0, "Min stock cannot be negative"),
  imageUrl: z.string().url("Invalid image URL").optional(),
  description: z.string().optional(),
  climate: z.string().optional(),
  lightRequirement: z.enum(["full", "partial", "shade"]).optional(),
  waterRequirement: z.enum(["low", "medium", "high"]).optional(),
  matureHeight: z.number().positive("Mature height must be positive").optional(),
  matureWidth: z.number().positive("Mature width must be positive").optional(),
  minSpacing: z.number().positive("Min spacing must be positive").optional(),
});

/**
 * Router de inventario
 */
export const inventoryRouter = router({
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }
    return db.select().from(inventoryItems);
  }),

  add: protectedProcedure.input(PlantSchema).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }
    const [newPlant] = await db.insert(inventoryItems).values(input).returning();
    return newPlant;
  }),

  update: protectedProcedure.input(PlantSchema.extend({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }
    const { id, ...data } = input;
    const [updatedPlant] = await db.update(inventoryItems).set(data).where(eq(inventoryItems.id, id)).returning();
    return updatedPlant;
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }
    await db.delete(inventoryItems).where(eq(inventoryItems.id, input.id));
    return { success: true };
  }),

  uploadImage: protectedProcedure.input(z.object({
    fileData: z.string(), // Base64 encoded
    mimeType: z.string(),
  })).mutation(async ({ input }) => {
    const imageUrl = `data:${input.mimeType};base64,${input.fileData}`;
    return { imageUrl };
  }),

  updateStock: protectedProcedure.input(z.object({
    id: z.number(),
    quantity: z.number(), // positive = add, negative = subtract
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, input.id));
    if (!item) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
    }
    const newStock = Math.max(0, item.stock + input.quantity);
    const [updated] = await db.update(inventoryItems)
      .set({ stock: newStock })
      .where(eq(inventoryItems.id, input.id))
      .returning();
    return updated;
  }),
});
