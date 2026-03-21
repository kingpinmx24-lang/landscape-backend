import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getProjectById,
  listProjectsByUser,
  createProject,
  updateProject,
  deleteProject,
  addPlant,
  updatePlant,
  addMeasurement,
  getMeasurements,
  addQuotation,
  getQuotations,
  updateQuotationStatus,
} from "../queries";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  CreatePlantSchema,
  CreateMeasurementSchema,
  CreateQuotationSchema,
} from "../../shared/schemas";

export const projectsRouter = router({
  /**
   * List all projects for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listProjectsByUser(ctx.user.id);
    } catch (error) {
      console.error("[projects.list] Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list projects",
      });
    }
  }),

  /**
   * Get a specific project with all relations
   */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getProjectById(input.id, ctx.user.id);
      } catch (error) {
        console.error("[projects.get] Error:", error);
        if ((error as Error).message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get project",
        });
      }
    }),

  /**
   * Create a new project
   */
  create: protectedProcedure
    .input(CreateProjectSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createProject(ctx.user.id, input);
      } catch (error) {
        console.error("[projects.create] Error:", error);
        if (error instanceof z.ZodError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid project data",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create project",
        });
      }
    }),

  /**
   * Update a project
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        data: UpdateProjectSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateProject(input.id, ctx.user.id, input.data);
      } catch (error) {
        console.error("[projects.update] Error:", error);
        if ((error as Error).message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update project",
        });
      }
    }),

  /**
   * Delete a project
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteProject(input.id, ctx.user.id);
      } catch (error) {
        console.error("[projects.delete] Error:", error);
        if ((error as Error).message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete project",
        });
      }
    }),

  /**
   * ============================================================================
   * PLANT OPERATIONS
   * ============================================================================
   */

  /**
   * Add a plant to a project
   */
  addPlant: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        quantity: z.number().int().positive().optional(),
        position: z.record(z.string(), z.any()),
        metadata: z.record(z.string(), z.any()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await addPlant(input.projectId, ctx.user.id, {
          name: input.name,
          quantity: input.quantity,
          position: input.position,
          metadata: input.metadata,
        });
      } catch (error) {
        console.error("[projects.addPlant] Error:", error);
        if ((error as Error).message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add plant",
        });
      }
    }),

  /**
   * Update a plant
   */
  updatePlant: protectedProcedure
    .input(
      z.object({
        plantId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        data: z.object({
          name: z.string().optional(),
          quantity: z.number().int().positive().optional(),
          position: z.record(z.string(), z.any()).optional(),
          metadata: z.record(z.string(), z.any()).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updatePlant(
          input.plantId,
          input.projectId,
          ctx.user.id,
          input.data
        );
      } catch (error) {
        console.error("[projects.updatePlant] Error:", error);
        if ((error as Error).message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update plant",
        });
      }
    }),

  /**
   * ============================================================================
   * MEASUREMENT OPERATIONS
   * ============================================================================
   */

  /**
   * Add a measurement to a project
   */
  addMeasurement: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        type: z.enum(["distance", "area", "angle", "height", "custom"]),
        value: z.number(),
        unit: z.string(),
        description: z.string().optional(),
        timestamp: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await addMeasurement(input.projectId, ctx.user.id, {
          type: input.type,
          value: input.value,
          unit: input.unit,
          description: input.description,
          timestamp: input.timestamp,
        });
      } catch (error) {
        console.error("[projects.addMeasurement] Error:", error);
        if ((error as Error).message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add measurement",
        });
      }
    }),

  /**
   * Get measurements for a project
   */
  getMeasurements: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getMeasurements(input.projectId, ctx.user.id);
      } catch (error) {
        console.error("[projects.getMeasurements] Error:", error);
        if ((error as Error).message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get measurements",
        });
      }
    }),

  /**
   * ============================================================================
   * QUOTATION OPERATIONS
   * ============================================================================
   */

  /**
   * Add a quotation to a project
   */
  addQuotation: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        items: z.array(
          z.object({
            description: z.string(),
            quantity: z.number().positive(),
            unitPrice: z.number().nonnegative(),
            subtotal: z.number().nonnegative(),
          })
        ),
        totalCost: z.string(),
        status: z
          .enum(["draft", "sent", "accepted", "rejected", "completed"])
          .optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await addQuotation(input.projectId, ctx.user.id, {
          items: input.items,
          totalCost: input.totalCost,
          status: input.status,
          metadata: input.metadata,
        });
      } catch (error) {
        console.error("[projects.addQuotation] Error:", error);
        if ((error as Error).message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add quotation",
        });
      }
    }),

  /**
   * Get quotations for a project
   */
  getQuotations: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getQuotations(input.projectId, ctx.user.id);
      } catch (error) {
        console.error("[projects.getQuotations] Error:", error);
        if ((error as Error).message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get quotations",
        });
      }
    }),

  /**
   * Update quotation status
   */
  updateQuotationStatus: protectedProcedure
    .input(
      z.object({
        quotationId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        status: z.enum(["draft", "sent", "accepted", "rejected", "completed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateQuotationStatus(
          input.quotationId,
          input.projectId,
          ctx.user.id,
          input.status
        );
      } catch (error) {
        console.error("[projects.updateQuotationStatus] Error:", error);
        if ((error as Error).message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update quotation status",
        });
      }
    }),
});
