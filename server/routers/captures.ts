import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

/**
 * Router para manejo de capturas de terreno
 */
export const capturesRouter = router({
  /**
   * Guardar una captura de terreno
   */
  save: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        deviceModel: z.string(),
        hasLiDAR: z.boolean(),
        cameraType: z.enum(["webxr", "fallback"]),
        measurements: z.array(
          z.object({
            id: z.string(),
            pointA: z.object({ x: z.number(), y: z.number(), z: z.number() }),
            pointB: z.object({ x: z.number(), y: z.number(), z: z.number() }),
            distanceMeters: z.number(),
            timestamp: z.number(),
            confidence: z.number().min(0).max(1),
          })
        ),
        zones: z.array(
          z.object({
            id: z.string(),
            points: z.array(z.object({ x: z.number(), y: z.number(), z: z.number() })),
            terrainType: z.enum(["earth", "grass", "concrete", "unknown"]),
            areaSquareMeters: z.number().optional(),
            perimeter: z.number().optional(),
          })
        ),
        imageUrl: z.string().url(),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Validar que el proyecto pertenece al usuario
        // (En una implementación real, verificarías en la BD)

        // Guardar captura en base de datos
        const captureData = {
          projectId: input.projectId,
          userId: ctx.user.id,
          deviceModel: input.deviceModel,
          hasLiDAR: input.hasLiDAR,
          cameraType: input.cameraType,
          measurements: input.measurements,
          zones: input.zones,
          imageUrl: input.imageUrl,
          metadata: input.metadata || {},
          timestamp: Date.now(),
        };

        // TODO: Guardar en base de datos
        // await db.insert(captures).values(captureData);

        return {
          success: true,
          captureId: `capture-${Date.now()}`,
          data: captureData,
        };
      } catch (error) {
        console.error("[captures.save] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save capture",
        });
      }
    }),

  /**
   * Obtener capturas de un proyecto
   */
  list: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      try {
        // TODO: Obtener capturas de la base de datos
        // const captures = await db.select().from(captures)
        //   .where(and(eq(captures.projectId, input.projectId), eq(captures.userId, ctx.user.id)));

        return [];
      } catch (error) {
        console.error("[captures.list] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list captures",
        });
      }
    }),

  /**
   * Obtener una captura específica
   */
  get: protectedProcedure
    .input(
      z.object({
        captureId: z.string(),
        projectId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // TODO: Obtener captura de la base de datos
        // const capture = await db.select().from(captures)
        //   .where(and(
        //     eq(captures.id, input.captureId),
        //     eq(captures.projectId, input.projectId),
        //     eq(captures.userId, ctx.user.id)
        //   ));

        return null;
      } catch (error) {
        console.error("[captures.get] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get capture",
        });
      }
    }),

  /**
   * Exportar captura como GeoJSON
   */
  exportGeoJSON: protectedProcedure
    .input(
      z.object({
        captureId: z.string(),
        projectId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // TODO: Obtener captura y convertir a GeoJSON
        const geoJSON = {
          type: "FeatureCollection",
          features: [],
        };

        return {
          data: JSON.stringify(geoJSON),
          filename: `capture-${input.captureId}.geojson`,
          mimeType: "application/geo+json",
        };
      } catch (error) {
        console.error("[captures.exportGeoJSON] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export capture",
        });
      }
    }),

  /**
   * Exportar captura como JSON
   */
  exportJSON: protectedProcedure
    .input(
      z.object({
        captureId: z.string(),
        projectId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // TODO: Obtener captura y exportar como JSON
        const data = {
          captureId: input.captureId,
          projectId: input.projectId,
          timestamp: Date.now(),
          measurements: [],
          zones: [],
        };

        return {
          data: JSON.stringify(data, null, 2),
          filename: `capture-${input.captureId}.json`,
          mimeType: "application/json",
        };
      } catch (error) {
        console.error("[captures.exportJSON] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export capture",
        });
      }
    }),
});
