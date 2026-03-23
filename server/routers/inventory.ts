/**
 * Router: Inventory
 * ============================================================================
 * Procedimientos tRPC para gestión de inventario y plantas
 * NOTE: All procedures are PUBLIC — no auth required.
 * This is a field sales app; the vendor uses their own device.
 */

import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { inventoryItems } from "../../drizzle/schema";
import { getDb } from "../db";
import { eq } from "drizzle-orm";

/**
 * Validación de planta — matches exact DB schema columns
 */
const PlantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  scientificName: z.string().optional().nullable(),
  type: z.enum(["tree", "shrub", "flower", "grass", "groundcover", "palm", "succulent", "vine"]),
  price: z.number().positive("Price must be positive"),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  imageUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  lightRequirement: z.enum(["full", "partial", "shade"]).optional().nullable(),
  waterRequirement: z.enum(["low", "medium", "high"]).optional().nullable(),
  matureHeight: z.number().positive().optional().nullable(),
  matureWidth: z.number().positive().optional().nullable(),
  minSpacing: z.number().positive().optional().nullable(),
});

type PlantInput = z.infer<typeof PlantSchema>;

function toDbValues(input: PlantInput) {
  return {
    name: input.name,
    scientificName: input.scientificName ?? null,
    type: input.type,
    price: String(input.price), // decimal stored as string in drizzle
    stock: input.stock ?? 0,
    minStock: input.minStock ?? 0,
    imageUrl: input.imageUrl ?? null,
    description: input.description ?? null,
    lightRequirement: input.lightRequirement ?? null,
    waterRequirement: input.waterRequirement ?? null,
    matureHeight: input.matureHeight ? String(input.matureHeight) : null,
    matureWidth: input.matureWidth ? String(input.matureWidth) : null,
    minSpacing: input.minSpacing ? String(input.minSpacing) : null,
  };
}

/**
 * Router de inventario — todas las operaciones son públicas
 */
export const inventoryRouter = router({
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }
    return db.select().from(inventoryItems);
  }),

  add: publicProcedure.input(PlantSchema).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }
    const [newPlant] = await db.insert(inventoryItems).values(toDbValues(input)).returning();
    return newPlant;
  }),

  update: publicProcedure.input(PlantSchema.extend({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }
    const { id, ...data } = input;
    const [updatedPlant] = await db.update(inventoryItems)
      .set(toDbValues(data))
      .where(eq(inventoryItems.id, id))
      .returning();
    return updatedPlant;
  }),

  delete: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }
    await db.delete(inventoryItems).where(eq(inventoryItems.id, input.id));
    return { success: true };
  }),

  // Upload image: receives base64, returns data URL
  uploadImage: publicProcedure.input(z.object({
    fileData: z.string(), // Base64 encoded
    mimeType: z.string(),
  })).mutation(async ({ input }) => {
    const imageUrl = `data:${input.mimeType};base64,${input.fileData}`;
    return { imageUrl };
  }),

  updateStock: publicProcedure.input(z.object({
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
