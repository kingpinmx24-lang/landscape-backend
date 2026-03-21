import {
  integer,
  varchar,
  text,
  timestamp,
  jsonb,
  pgEnum,
  pgTable,
  decimal,
  index,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enum definitions
const userRoleEnum = pgEnum("role", ["user", "admin"]);
const projectStatusEnum = pgEnum("project_status", ["draft", "active", "completed", "archived"]);
const quotationStatusEnum = pgEnum("quotation_status", [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "completed",
]);
const plantTypeEnum = pgEnum("plant_type", ["tree", "shrub", "flower", "grass", "groundcover"]);
const lightRequirementEnum = pgEnum("light_requirement", ["full", "partial", "shade"]);
const waterRequirementEnum = pgEnum("water_requirement", ["low", "medium", "high"]);

export { userRoleEnum, projectStatusEnum, quotationStatusEnum, plantTypeEnum, lightRequirementEnum, waterRequirementEnum };

/**
 * ============================================================================
 * CORE TABLES
 * ============================================================================
 */

/**
 * Users table - Core authentication and user management
 * Backed by Manus OAuth
 */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(), // PostgreSQL auto-increment is handled differently, often with serial types or sequences
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: userRoleEnum("role").default("user").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => ({
    openIdIdx: index("users_openId_idx").on(table.openId),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Projects table - Main project entity containing terrain and project metadata
 * Each project belongs to a user and contains terrain data, objects, measurements, and quotations
 */
export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    // Terrain data stored as JSON: { width, height, unit, type, etc. }
    terrain: jsonb("terrain").notNull(),
    // Project status: draft, active, completed, archived
    status: projectStatusEnum("project_status").default("draft").notNull(),
    // Metadata: tags, notes, custom fields
    metadata: jsonb("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("projects_userId_idx").on(table.userId),
    userStatusIdx: index("projects_userId_status_idx").on(table.userId, table.status),
  })
);

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Plants table - Individual plant objects within a project
 * Each plant has position, quantity, and metadata
 */
export const plants = pgTable(
  "plants",
  {
    id: serial("id").primaryKey(),
    projectId: integer("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    // Position in terrain: { x, y, z, rotation, scale }
    position: jsonb("position").notNull(),
    // Plant metadata: species, height, width, color, cost, etc.
    metadata: jsonb("metadata").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("plants_projectId_idx").on(table.projectId),
  })
);

export type Plant = typeof plants.$inferSelect;
export type InsertPlant = typeof plants.$inferInsert;

/**
 * Measurements table - Terrain measurements and calculations
 * Stores measurement data as JSON for flexibility
 */
export const measurements = pgTable(
  "measurements",
  {
    id: serial("id").primaryKey(),
    projectId: integer("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Measurement data: { type, value, unit, description, etc. }
    data: jsonb("data").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("measurements_projectId_idx").on(table.projectId),
  })
);

export type Measurement = typeof measurements.$inferSelect;
export type InsertMeasurement = typeof measurements.$inferInsert;

/**
 * Quotations table - Project quotations and pricing
 * Stores quotation items and totals as JSON
 */
export const quotations = pgTable(
  "quotations",
  {
    id: serial("id").primaryKey(),
    projectId: integer("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Total cost in decimal format (2 decimal places)
    totalCost: decimal("totalCost", { precision: 12, scale: 2 }).notNull(),
    // Quotation items: array of { description, quantity, unitPrice, subtotal }
    items: jsonb("items").notNull(),
    status: quotationStatusEnum("quotation_status").default("draft").notNull(),
    // Metadata: notes, discount, tax, etc.
    metadata: jsonb("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("quotations_projectId_idx").on(table.projectId),
  })
);

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

/**
 * Inventory Items table - Master list of plants available in the inventory
 */
export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    scientificName: varchar("scientificName", { length: 255 }),
    type: plantTypeEnum("plant_type").notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    stock: integer("stock").notNull().default(0),
    minStock: integer("minStock").notNull().default(0),
    imageUrl: text("imageUrl"),
    description: text("description"),
    lightRequirement: lightRequirementEnum("light_requirement"),
    waterRequirement: waterRequirementEnum("water_requirement"),
    matureHeight: decimal("matureHeight", { precision: 5, scale: 2 }),
    matureWidth: decimal("matureWidth", { precision: 5, scale: 2 }),
    minSpacing: decimal("minSpacing", { precision: 5, scale: 2 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index("inventory_items_name_idx").on(table.name),
  })
);

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = typeof inventoryItems.$inferInsert;

/**
 * ============================================================================
 * RELATIONS (for Drizzle ORM)
 * ============================================================================
 */

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  plants: many(plants),
  measurements: many(measurements),
  quotations: many(quotations),
}));

export const plantsRelations = relations(plants, ({ one }) => ({
  project: one(projects, {
    fields: [plants.projectId],
    references: [projects.id],
  }),
}));

export const measurementsRelations = relations(measurements, ({ one }) => ({
  project: one(projects, {
    fields: [measurements.projectId],
    references: [projects.id],
  }),
}));

export const quotationsRelations = relations(quotations, ({ one }) => ({
  project: one(projects, {
    fields: [quotations.projectId],
    references: [projects.id],
  }),
}));
