/**
 * ============================================================================
 * PROJECTS ROUTER - REFACTORED WITH STANDARDIZED RESPONSES
 * ============================================================================
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createProjectRefactored,
  getProjectByIdRefactored,
  listProjectsByUserRefactored,
  updateProjectRefactored,
  deleteProjectRefactored,
  addPlantRefactored,
  getMeasurementsRefactored,
  addMeasurementRefactored,
  getQuotationsRefactored,
  addQuotationRefactored,
  updateProjectStatusRefactored,
} from "../queries-refactored";

export const projectsRouter = router({
  /**
   * LIST PROJECTS
   * GET /api/trpc/projects.list
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const result = await listProjectsByUserRefactored(ctx.user.id);

    if (!result.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: result.error,
      });
    }

    return result.data;
  }),

  /**
   * GET PROJECT
   * GET /api/trpc/projects.get?id=123
   */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const result = await getProjectByIdRefactored(input.id, ctx.user.id);

      if (!result.success) {
        throw new TRPCError({
          code: result.error === "Unauthorized access to this project" ? "FORBIDDEN" : "NOT_FOUND",
          message: result.error,
        });
      }

      return result.data;
    }),

  /**
   * CREATE PROJECT
   * POST /api/trpc/projects.create
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Project name is required"),
        description: z.string().optional(),
        terrain: z.object({
          width: z.number().positive(),
          height: z.number().positive(),
          unit: z.enum(["m", "ft", "cm", "mm"]).default("m"),
        }),
        status: z.enum(["draft", "active", "completed", "archived"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await createProjectRefactored(ctx.user.id, input);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }

      return result.data;
    }),

  /**
   * UPDATE PROJECT
   * PATCH /api/trpc/projects.update
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().optional(),
        description: z.string().optional(),
        terrain: z.object({
          width: z.number().positive().optional(),
          height: z.number().positive().optional(),
          unit: z.enum(["m", "ft", "cm", "mm"]).optional(),
        }).optional(),
        status: z.enum(["draft", "active", "completed", "archived"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const result = await updateProjectRefactored(id, ctx.user.id, data);

      if (!result.success) {
        throw new TRPCError({
          code: result.error === "Unauthorized access to this project" ? "FORBIDDEN" : "NOT_FOUND",
          message: result.error,
        });
      }

      return result.data;
    }),

  /**
   * DELETE PROJECT
   * DELETE /api/trpc/projects.delete?id=123
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const result = await deleteProjectRefactored(input.id, ctx.user.id);

      if (!result.success) {
        throw new TRPCError({
          code: result.error === "Unauthorized access to this project" ? "FORBIDDEN" : "NOT_FOUND",
          message: result.error,
        });
      }

      return result.data;
    }),

  /**
   * ADD PLANT
   * POST /api/trpc/projects.addPlant
   */
  addPlant: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        name: z.string().min(1),
        quantity: z.number().int().positive().default(1),
        position: z.object({
          x: z.number(),
          y: z.number(),
          z: z.number().optional(),
          rotation: z.number().optional(),
          scale: z.number().optional(),
        }),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, ...data } = input;
      const result = await addPlantRefactored(projectId, ctx.user.id, data);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }

      return result.data;
    }),

  /**
   * GET MEASUREMENTS
   * GET /api/trpc/projects.getMeasurements?projectId=123
   */
  getMeasurements: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const result = await getMeasurementsRefactored(input.projectId, ctx.user.id);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }

      return result.data;
    }),

  /**
   * ADD MEASUREMENT
   * POST /api/trpc/projects.addMeasurement
   */
  addMeasurement: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        data: z.object({
          type: z.enum(["distance", "area", "angle", "height", "custom"]),
          value: z.number(),
          unit: z.string(),
          description: z.string().optional(),
          timestamp: z.number().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, data } = input;
      const result = await addMeasurementRefactored(projectId, ctx.user.id, data);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }

      return result.data;
    }),

  /**
   * GET QUOTATIONS
   * GET /api/trpc/projects.getQuotations?projectId=123
   */
  getQuotations: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const result = await getQuotationsRefactored(input.projectId, ctx.user.id);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }

      return result.data;
    }),

  /**
   * ADD QUOTATION
   * POST /api/trpc/projects.addQuotation
   */
  addQuotation: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        items: z.array(
          z.object({
            description: z.string().min(1),
            quantity: z.number().positive(),
            unitPrice: z.number().nonnegative(),
            subtotal: z.number().nonnegative(),
          })
        ).min(1, "At least one item is required"),
        totalCost: z.number().nonnegative(),
        status: z.enum(["draft", "sent", "accepted", "rejected", "completed"]).default("draft"),
        metadata: z.object({
          notes: z.string().optional(),
          discount: z.number().nonnegative().optional(),
          tax: z.number().nonnegative().optional(),
          currency: z.string().optional(),
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, ...data } = input;
      const result = await addQuotationRefactored(projectId, ctx.user.id, data);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }

      return result.data;
    }),

  /**
   * UPDATE PROJECT STATUS
   * PATCH /api/trpc/projects.updateStatus
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        status: z.enum(["draft", "active", "completed", "archived"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await updateProjectStatusRefactored(input.projectId, ctx.user.id, input.status);

      if (!result.success) {
        throw new TRPCError({
          code: result.error === "Unauthorized access to this project" ? "FORBIDDEN" : "NOT_FOUND",
          message: result.error,
        });
      }

      return result.data;
    }),
});
