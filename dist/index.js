// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import cors from "cors";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// drizzle/schema.ts
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
  serial
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
var userRoleEnum = pgEnum("role", ["user", "admin"]);
var projectStatusEnum = pgEnum("project_status", ["draft", "active", "completed", "archived"]);
var quotationStatusEnum = pgEnum("quotation_status", [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "completed"
]);
var plantTypeEnum = pgEnum("plant_type", ["tree", "shrub", "flower", "grass", "groundcover", "palm", "succulent", "vine"]);
var lightRequirementEnum = pgEnum("light_requirement", ["full", "partial", "shade"]);
var waterRequirementEnum = pgEnum("water_requirement", ["low", "medium", "high"]);
var users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    // PostgreSQL auto-increment is handled differently, often with serial types or sequences
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: userRoleEnum("role").default("user").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
  },
  (table) => ({
    openIdIdx: index("users_openId_idx").on(table.openId)
  })
);
var projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    // Terrain data stored as JSON: { width, height, unit, type, etc. }
    terrain: jsonb("terrain").notNull(),
    // Project status: draft, active, completed, archived
    status: projectStatusEnum("project_status").default("draft").notNull(),
    // Metadata: tags, notes, custom fields
    metadata: jsonb("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull()
  },
  (table) => ({
    userIdIdx: index("projects_userId_idx").on(table.userId),
    userStatusIdx: index("projects_userId_status_idx").on(table.userId, table.status)
  })
);
var plants = pgTable(
  "plants",
  {
    id: serial("id").primaryKey(),
    projectId: integer("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    // Position in terrain: { x, y, z, rotation, scale }
    position: jsonb("position").notNull(),
    // Plant metadata: species, height, width, color, cost, etc.
    metadata: jsonb("metadata").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull()
  },
  (table) => ({
    projectIdIdx: index("plants_projectId_idx").on(table.projectId)
  })
);
var measurements = pgTable(
  "measurements",
  {
    id: serial("id").primaryKey(),
    projectId: integer("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    // Measurement data: { type, value, unit, description, etc. }
    data: jsonb("data").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull()
  },
  (table) => ({
    projectIdIdx: index("measurements_projectId_idx").on(table.projectId)
  })
);
var quotations = pgTable(
  "quotations",
  {
    id: serial("id").primaryKey(),
    projectId: integer("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    // Total cost in decimal format (2 decimal places)
    totalCost: decimal("totalCost", { precision: 12, scale: 2 }).notNull(),
    // Quotation items: array of { description, quantity, unitPrice, subtotal }
    items: jsonb("items").notNull(),
    status: quotationStatusEnum("quotation_status").default("draft").notNull(),
    // Metadata: notes, discount, tax, etc.
    metadata: jsonb("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull()
  },
  (table) => ({
    projectIdIdx: index("quotations_projectId_idx").on(table.projectId)
  })
);
var inventoryItems = pgTable(
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
    updatedAt: timestamp("updatedAt").defaultNow().notNull()
  },
  (table) => ({
    nameIdx: index("inventory_items_name_idx").on(table.name)
  })
);
var usersRelations = relations(users, ({ many }) => ({
  projects: many(projects)
}));
var projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id]
  }),
  plants: many(plants),
  measurements: many(measurements),
  quotations: many(quotations)
}));
var plantsRelations = relations(plants, ({ one }) => ({
  project: one(projects, {
    fields: [plants.projectId],
    references: [projects.id]
  })
}));
var measurementsRelations = relations(measurements, ({ one }) => ({
  project: one(projects, {
    fields: [measurements.projectId],
    references: [projects.id]
  })
}));
var quotationsRelations = relations(quotations, ({ one }) => ({
  project: one(projects, {
    fields: [quotations.projectId],
    references: [projects.id]
  })
}));

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
var _sql = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _sql = postgres(process.env.DATABASE_URL, {
        ssl: { rejectUnauthorized: false },
        connect_timeout: 15,
        idle_timeout: 20,
        max_lifetime: 60 * 30,
        max: 3
      });
      _db = drizzle(_sql);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _sql = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers/projects.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z3 } from "zod";

// server/queries.ts
import { eq as eq2, and, desc } from "drizzle-orm";

// shared/schemas.ts
import { z as z2 } from "zod";
var TerrainSchema = z2.object({
  width: z2.number().positive("Width must be positive"),
  height: z2.number().positive("Height must be positive"),
  unit: z2.enum(["m", "ft", "cm", "mm"]).default("m"),
  type: z2.enum(["rectangular", "polygonal", "freeform"]).default("rectangular"),
  description: z2.string().optional()
});
var PlantPositionSchema = z2.object({
  x: z2.number(),
  y: z2.number(),
  z: z2.number().optional().default(0),
  rotation: z2.number().optional().default(0),
  scale: z2.number().positive().optional().default(1)
});
var PlantMetadataSchema = z2.object({
  species: z2.string().optional(),
  commonName: z2.string().optional(),
  height: z2.number().positive().optional(),
  width: z2.number().positive().optional(),
  color: z2.string().optional(),
  unitCost: z2.number().nonnegative().optional(),
  notes: z2.string().optional()
});
var CreatePlantSchema = z2.object({
  projectId: z2.number().int().positive(),
  name: z2.string().min(1, "Plant name is required").max(255),
  quantity: z2.number().int().positive().default(1),
  position: PlantPositionSchema,
  metadata: PlantMetadataSchema
});
var UpdatePlantSchema = CreatePlantSchema.partial().extend({
  id: z2.number().int().positive()
});
var MeasurementDataSchema = z2.object({
  type: z2.enum(["distance", "area", "angle", "height", "custom"]),
  value: z2.number(),
  unit: z2.string(),
  description: z2.string().optional(),
  timestamp: z2.number().optional()
});
var CreateMeasurementSchema = z2.object({
  projectId: z2.number().int().positive(),
  data: MeasurementDataSchema
});
var QuotationItemSchema = z2.object({
  description: z2.string().min(1),
  quantity: z2.number().positive(),
  unitPrice: z2.number().nonnegative(),
  subtotal: z2.number().nonnegative()
});
var QuotationMetadataSchema = z2.object({
  notes: z2.string().optional(),
  discount: z2.number().nonnegative().optional(),
  tax: z2.number().nonnegative().optional(),
  currency: z2.string().default("USD")
});
var CreateQuotationSchema = z2.object({
  projectId: z2.number().int().positive(),
  items: z2.array(QuotationItemSchema).min(1, "At least one item is required"),
  totalCost: z2.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid total cost format"),
  status: z2.enum(["draft", "sent", "accepted", "rejected", "completed"]).default("draft"),
  metadata: QuotationMetadataSchema.optional()
});
var UpdateQuotationSchema = CreateQuotationSchema.partial().extend({
  id: z2.number().int().positive()
});
var CreateProjectSchema = z2.object({
  name: z2.string().min(1, "Project name is required").max(255),
  description: z2.string().optional(),
  terrain: TerrainSchema,
  status: z2.enum(["draft", "active", "completed", "archived"]).default("draft"),
  metadata: z2.record(z2.string(), z2.any()).optional()
});
var UpdateProjectSchema = CreateProjectSchema.partial().extend({
  id: z2.number().int().positive()
});
var CompleteProjectSchema = z2.object({
  id: z2.number().int().positive(),
  userId: z2.number().int().positive(),
  name: z2.string(),
  description: z2.string().nullable(),
  terrain: z2.record(z2.string(), z2.any()),
  status: z2.enum(["draft", "active", "completed", "archived"]),
  metadata: z2.record(z2.string(), z2.any()).nullable(),
  plants: z2.array(
    z2.object({
      id: z2.number(),
      projectId: z2.number(),
      name: z2.string(),
      quantity: z2.number(),
      position: z2.record(z2.string(), z2.any()),
      metadata: z2.record(z2.string(), z2.any()),
      createdAt: z2.date(),
      updatedAt: z2.date()
    })
  ),
  measurements: z2.array(
    z2.object({
      id: z2.number(),
      projectId: z2.number(),
      data: z2.record(z2.string(), z2.any()),
      createdAt: z2.date(),
      updatedAt: z2.date()
    })
  ),
  quotations: z2.array(
    z2.object({
      id: z2.number(),
      projectId: z2.number(),
      totalCost: z2.string(),
      items: z2.array(z2.record(z2.string(), z2.any())),
      status: z2.enum(["draft", "sent", "accepted", "rejected", "completed"]),
      metadata: z2.record(z2.string(), z2.any()).nullable(),
      createdAt: z2.date(),
      updatedAt: z2.date()
    })
  ),
  createdAt: z2.date(),
  updatedAt: z2.date()
});

// server/queries.ts
async function getProjectById(projectId, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(projects).where(and(eq2(projects.id, projectId), eq2(projects.userId, userId))).limit(1);
  if (result.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }
  const project = result[0];
  const projectPlants = await db.select().from(plants).where(eq2(plants.projectId, projectId));
  const projectMeasurements = await db.select().from(measurements).where(eq2(measurements.projectId, projectId));
  const projectQuotations = await db.select().from(quotations).where(eq2(quotations.projectId, projectId));
  return {
    ...project,
    plants: projectPlants,
    measurements: projectMeasurements,
    quotations: projectQuotations
  };
}
async function listProjectsByUser(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(projects).where(eq2(projects.userId, userId));
}
async function createProject(userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const validated = CreateProjectSchema.parse(data);
  const insertData = {
    userId,
    name: validated.name,
    description: validated.description || null,
    terrain: validated.terrain,
    status: validated.status || "draft",
    metadata: validated.metadata || null
  };
  const result = await db.insert(projects).values(insertData);
  let projectId;
  if (result.insertId) {
    projectId = result.insertId;
  } else if (result[0]?.insertId) {
    projectId = result[0].insertId;
  } else {
    const recent = await db.select().from(projects).where(eq2(projects.userId, userId)).orderBy(desc(projects.createdAt)).limit(1);
    if (recent.length === 0) throw new Error("Failed to create project");
    return recent[0];
  }
  return await getProjectById(projectId, userId);
}
async function updateProject(projectId, userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(projects).where(and(eq2(projects.id, projectId), eq2(projects.userId, userId))).limit(1);
  if (existing.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }
  const updateData = {};
  if (data.name !== void 0) updateData.name = data.name;
  if (data.description !== void 0) updateData.description = data.description;
  if (data.terrain !== void 0) updateData.terrain = data.terrain;
  if (data.status !== void 0) updateData.status = data.status;
  if (data.metadata !== void 0) updateData.metadata = data.metadata;
  await db.update(projects).set(updateData).where(eq2(projects.id, projectId));
  return await getProjectById(projectId, userId);
}
async function deleteProject(projectId, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(projects).where(and(eq2(projects.id, projectId), eq2(projects.userId, userId))).limit(1);
  if (existing.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }
  await db.delete(projects).where(eq2(projects.id, projectId));
  return { success: true, projectId };
}
async function addPlant(projectId, userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const project = await db.select().from(projects).where(and(eq2(projects.id, projectId), eq2(projects.userId, userId))).limit(1);
  if (project.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }
  const validated = CreatePlantSchema.parse({
    projectId,
    ...data
  });
  const insertData = {
    projectId,
    name: validated.name,
    quantity: validated.quantity || 1,
    position: validated.position,
    metadata: validated.metadata
  };
  const result = await db.insert(plants).values(insertData);
  let plantId;
  if (result.insertId) {
    plantId = result.insertId;
  } else if (result[0]?.insertId) {
    plantId = result[0].insertId;
  } else {
    const recent = await db.select().from(plants).where(eq2(plants.projectId, projectId)).orderBy(desc(plants.createdAt)).limit(1);
    if (recent.length === 0) throw new Error("Failed to add plant");
    return recent[0];
  }
  const createdPlant = await db.select().from(plants).where(eq2(plants.id, plantId)).limit(1);
  return createdPlant[0];
}
async function updatePlant(plantId, projectId, userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const project = await db.select().from(projects).where(and(eq2(projects.id, projectId), eq2(projects.userId, userId))).limit(1);
  if (project.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }
  const updateData = {};
  if (data.name !== void 0) updateData.name = data.name;
  if (data.quantity !== void 0) updateData.quantity = data.quantity;
  if (data.position !== void 0) updateData.position = data.position;
  if (data.metadata !== void 0) updateData.metadata = data.metadata;
  await db.update(plants).set(updateData).where(and(eq2(plants.id, plantId), eq2(plants.projectId, projectId)));
  const updated = await db.select().from(plants).where(eq2(plants.id, plantId)).limit(1);
  return updated[0];
}
async function addMeasurement(projectId, userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const project = await db.select().from(projects).where(and(eq2(projects.id, projectId), eq2(projects.userId, userId))).limit(1);
  if (project.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }
  const validated = CreateMeasurementSchema.parse({
    projectId,
    data
  });
  const insertData = {
    projectId,
    data: validated.data
  };
  const result = await db.insert(measurements).values(insertData);
  let measurementId;
  if (result.insertId) {
    measurementId = result.insertId;
  } else if (result[0]?.insertId) {
    measurementId = result[0].insertId;
  } else {
    const recent = await db.select().from(measurements).where(eq2(measurements.projectId, projectId)).orderBy(desc(measurements.createdAt)).limit(1);
    if (recent.length === 0) throw new Error("Failed to add measurement");
    return recent[0];
  }
  const created = await db.select().from(measurements).where(eq2(measurements.id, measurementId)).limit(1);
  return created[0];
}
async function getMeasurements(projectId, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const project = await db.select().from(projects).where(and(eq2(projects.id, projectId), eq2(projects.userId, userId))).limit(1);
  if (project.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }
  return await db.select().from(measurements).where(eq2(measurements.projectId, projectId));
}
async function addQuotation(projectId, userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const project = await db.select().from(projects).where(and(eq2(projects.id, projectId), eq2(projects.userId, userId))).limit(1);
  if (project.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }
  const validated = CreateQuotationSchema.parse({
    projectId,
    ...data
  });
  const insertData = {
    projectId,
    items: validated.items,
    totalCost: validated.totalCost,
    status: validated.status || "draft",
    metadata: validated.metadata || null
  };
  const result = await db.insert(quotations).values(insertData);
  let quotationId;
  if (result.insertId) {
    quotationId = result.insertId;
  } else if (result[0]?.insertId) {
    quotationId = result[0].insertId;
  } else {
    const recent = await db.select().from(quotations).where(eq2(quotations.projectId, projectId)).orderBy(desc(quotations.createdAt)).limit(1);
    if (recent.length === 0) throw new Error("Failed to add quotation");
    return recent[0];
  }
  const created = await db.select().from(quotations).where(eq2(quotations.id, quotationId)).limit(1);
  return created[0];
}
async function getQuotations(projectId, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const project = await db.select().from(projects).where(and(eq2(projects.id, projectId), eq2(projects.userId, userId))).limit(1);
  if (project.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }
  return await db.select().from(quotations).where(eq2(quotations.projectId, projectId));
}
async function updateQuotationStatus(quotationId, projectId, userId, status) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const project = await db.select().from(projects).where(and(eq2(projects.id, projectId), eq2(projects.userId, userId))).limit(1);
  if (project.length === 0) {
    throw new Error(`Project ${projectId} not found or unauthorized`);
  }
  await db.update(quotations).set({ status }).where(
    and(eq2(quotations.id, quotationId), eq2(quotations.projectId, projectId))
  );
  const updated = await db.select().from(quotations).where(eq2(quotations.id, quotationId)).limit(1);
  return updated[0];
}

// server/routers/projects.ts
var projectsRouter = router({
  /**
   * List all projects for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listProjectsByUser(ctx.user.id);
    } catch (error) {
      console.error("[projects.list] Error:", error);
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list projects"
      });
    }
  }),
  /**
   * Get a specific project with all relations
   */
  get: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).query(async ({ ctx, input }) => {
    try {
      return await getProjectById(input.id, ctx.user.id);
    } catch (error) {
      console.error("[projects.get] Error:", error);
      if (error.message.includes("not found")) {
        throw new TRPCError3({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get project"
      });
    }
  }),
  /**
   * Create a new project
   */
  create: protectedProcedure.input(CreateProjectSchema).mutation(async ({ ctx, input }) => {
    try {
      return await createProject(ctx.user.id, input);
    } catch (error) {
      console.error("[projects.create] Error:", error);
      if (error instanceof z3.ZodError) {
        throw new TRPCError3({
          code: "BAD_REQUEST",
          message: "Invalid project data"
        });
      }
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create project"
      });
    }
  }),
  /**
   * Update a project
   */
  update: protectedProcedure.input(
    z3.object({
      id: z3.number().int().positive(),
      data: UpdateProjectSchema.partial()
    })
  ).mutation(async ({ ctx, input }) => {
    try {
      return await updateProject(input.id, ctx.user.id, input.data);
    } catch (error) {
      console.error("[projects.update] Error:", error);
      if (error.message.includes("not found")) {
        throw new TRPCError3({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update project"
      });
    }
  }),
  /**
   * Delete a project
   */
  delete: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      return await deleteProject(input.id, ctx.user.id);
    } catch (error) {
      console.error("[projects.delete] Error:", error);
      if (error.message.includes("not found")) {
        throw new TRPCError3({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete project"
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
  addPlant: protectedProcedure.input(
    z3.object({
      projectId: z3.number().int().positive(),
      name: z3.string().min(1).max(255),
      quantity: z3.number().int().positive().optional(),
      position: z3.record(z3.string(), z3.any()),
      metadata: z3.record(z3.string(), z3.any())
    })
  ).mutation(async ({ ctx, input }) => {
    try {
      return await addPlant(input.projectId, ctx.user.id, {
        name: input.name,
        quantity: input.quantity,
        position: input.position,
        metadata: input.metadata
      });
    } catch (error) {
      console.error("[projects.addPlant] Error:", error);
      if (error.message.includes("not found")) {
        throw new TRPCError3({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to add plant"
      });
    }
  }),
  /**
   * Update a plant
   */
  updatePlant: protectedProcedure.input(
    z3.object({
      plantId: z3.number().int().positive(),
      projectId: z3.number().int().positive(),
      data: z3.object({
        name: z3.string().optional(),
        quantity: z3.number().int().positive().optional(),
        position: z3.record(z3.string(), z3.any()).optional(),
        metadata: z3.record(z3.string(), z3.any()).optional()
      })
    })
  ).mutation(async ({ ctx, input }) => {
    try {
      return await updatePlant(
        input.plantId,
        input.projectId,
        ctx.user.id,
        input.data
      );
    } catch (error) {
      console.error("[projects.updatePlant] Error:", error);
      if (error.message.includes("not found")) {
        throw new TRPCError3({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update plant"
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
  addMeasurement: protectedProcedure.input(
    z3.object({
      projectId: z3.number().int().positive(),
      type: z3.enum(["distance", "area", "angle", "height", "custom"]),
      value: z3.number(),
      unit: z3.string(),
      description: z3.string().optional(),
      timestamp: z3.number().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    try {
      return await addMeasurement(input.projectId, ctx.user.id, {
        type: input.type,
        value: input.value,
        unit: input.unit,
        description: input.description,
        timestamp: input.timestamp
      });
    } catch (error) {
      console.error("[projects.addMeasurement] Error:", error);
      if (error.message.includes("not found")) {
        throw new TRPCError3({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to add measurement"
      });
    }
  }),
  /**
   * Get measurements for a project
   */
  getMeasurements: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive() })).query(async ({ ctx, input }) => {
    try {
      return await getMeasurements(input.projectId, ctx.user.id);
    } catch (error) {
      console.error("[projects.getMeasurements] Error:", error);
      if (error.message.includes("not found")) {
        throw new TRPCError3({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get measurements"
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
  addQuotation: protectedProcedure.input(
    z3.object({
      projectId: z3.number().int().positive(),
      items: z3.array(
        z3.object({
          description: z3.string(),
          quantity: z3.number().positive(),
          unitPrice: z3.number().nonnegative(),
          subtotal: z3.number().nonnegative()
        })
      ),
      totalCost: z3.string(),
      status: z3.enum(["draft", "sent", "accepted", "rejected", "completed"]).optional(),
      metadata: z3.record(z3.string(), z3.any()).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    try {
      return await addQuotation(input.projectId, ctx.user.id, {
        items: input.items,
        totalCost: input.totalCost,
        status: input.status,
        metadata: input.metadata
      });
    } catch (error) {
      console.error("[projects.addQuotation] Error:", error);
      if (error.message.includes("not found")) {
        throw new TRPCError3({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to add quotation"
      });
    }
  }),
  /**
   * Get quotations for a project
   */
  getQuotations: protectedProcedure.input(z3.object({ projectId: z3.number().int().positive() })).query(async ({ ctx, input }) => {
    try {
      return await getQuotations(input.projectId, ctx.user.id);
    } catch (error) {
      console.error("[projects.getQuotations] Error:", error);
      if (error.message.includes("not found")) {
        throw new TRPCError3({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get quotations"
      });
    }
  }),
  /**
   * Update quotation status
   */
  updateQuotationStatus: protectedProcedure.input(
    z3.object({
      quotationId: z3.number().int().positive(),
      projectId: z3.number().int().positive(),
      status: z3.enum(["draft", "sent", "accepted", "rejected", "completed"])
    })
  ).mutation(async ({ ctx, input }) => {
    try {
      return await updateQuotationStatus(
        input.quotationId,
        input.projectId,
        ctx.user.id,
        input.status
      );
    } catch (error) {
      console.error("[projects.updateQuotationStatus] Error:", error);
      if (error.message.includes("not found")) {
        throw new TRPCError3({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update quotation status"
      });
    }
  })
});

// server/routers/captures.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z4 } from "zod";
var capturesRouter = router({
  /**
   * Guardar una captura de terreno
   */
  save: protectedProcedure.input(
    z4.object({
      projectId: z4.number().int().positive(),
      deviceModel: z4.string(),
      hasLiDAR: z4.boolean(),
      cameraType: z4.enum(["webxr", "fallback"]),
      measurements: z4.array(
        z4.object({
          id: z4.string(),
          pointA: z4.object({ x: z4.number(), y: z4.number(), z: z4.number() }),
          pointB: z4.object({ x: z4.number(), y: z4.number(), z: z4.number() }),
          distanceMeters: z4.number(),
          timestamp: z4.number(),
          confidence: z4.number().min(0).max(1)
        })
      ),
      zones: z4.array(
        z4.object({
          id: z4.string(),
          points: z4.array(z4.object({ x: z4.number(), y: z4.number(), z: z4.number() })),
          terrainType: z4.enum(["earth", "grass", "concrete", "unknown"]),
          areaSquareMeters: z4.number().optional(),
          perimeter: z4.number().optional()
        })
      ),
      imageUrl: z4.string().url(),
      metadata: z4.record(z4.string(), z4.any()).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    try {
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
        timestamp: Date.now()
      };
      return {
        success: true,
        captureId: `capture-${Date.now()}`,
        data: captureData
      };
    } catch (error) {
      console.error("[captures.save] Error:", error);
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to save capture"
      });
    }
  }),
  /**
   * Obtener capturas de un proyecto
   */
  list: protectedProcedure.input(z4.object({ projectId: z4.number().int().positive() })).query(async ({ ctx, input }) => {
    try {
      return [];
    } catch (error) {
      console.error("[captures.list] Error:", error);
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list captures"
      });
    }
  }),
  /**
   * Obtener una captura específica
   */
  get: protectedProcedure.input(
    z4.object({
      captureId: z4.string(),
      projectId: z4.number().int().positive()
    })
  ).query(async ({ ctx, input }) => {
    try {
      return null;
    } catch (error) {
      console.error("[captures.get] Error:", error);
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get capture"
      });
    }
  }),
  /**
   * Exportar captura como GeoJSON
   */
  exportGeoJSON: protectedProcedure.input(
    z4.object({
      captureId: z4.string(),
      projectId: z4.number().int().positive()
    })
  ).query(async ({ ctx, input }) => {
    try {
      const geoJSON = {
        type: "FeatureCollection",
        features: []
      };
      return {
        data: JSON.stringify(geoJSON),
        filename: `capture-${input.captureId}.geojson`,
        mimeType: "application/geo+json"
      };
    } catch (error) {
      console.error("[captures.exportGeoJSON] Error:", error);
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to export capture"
      });
    }
  }),
  /**
   * Exportar captura como JSON
   */
  exportJSON: protectedProcedure.input(
    z4.object({
      captureId: z4.string(),
      projectId: z4.number().int().positive()
    })
  ).query(async ({ ctx, input }) => {
    try {
      const data = {
        captureId: input.captureId,
        projectId: input.projectId,
        timestamp: Date.now(),
        measurements: [],
        zones: []
      };
      return {
        data: JSON.stringify(data, null, 2),
        filename: `capture-${input.captureId}.json`,
        mimeType: "application/json"
      };
    } catch (error) {
      console.error("[captures.exportJSON] Error:", error);
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to export capture"
      });
    }
  })
});

// server/routers/inventory.ts
import { TRPCError as TRPCError5 } from "@trpc/server";
import { z as z5 } from "zod";
import { eq as eq3 } from "drizzle-orm";
var PlantSchema = z5.object({
  name: z5.string().min(1, "Name is required"),
  scientificName: z5.string().optional().nullable(),
  type: z5.enum(["tree", "shrub", "flower", "grass", "groundcover", "palm", "succulent", "vine"]),
  price: z5.number().positive("Price must be positive"),
  stock: z5.number().int().min(0).default(0),
  minStock: z5.number().int().min(0).default(0),
  imageUrl: z5.string().optional().nullable(),
  description: z5.string().optional().nullable(),
  lightRequirement: z5.enum(["full", "partial", "shade"]).optional().nullable(),
  waterRequirement: z5.enum(["low", "medium", "high"]).optional().nullable(),
  matureHeight: z5.number().positive().optional().nullable(),
  matureWidth: z5.number().positive().optional().nullable(),
  minSpacing: z5.number().positive().optional().nullable()
});
function toDbValues(input) {
  return {
    name: input.name,
    scientificName: input.scientificName ?? null,
    type: input.type,
    price: String(input.price),
    // decimal stored as string in drizzle
    stock: input.stock ?? 0,
    minStock: input.minStock ?? 0,
    imageUrl: input.imageUrl ?? null,
    description: input.description ?? null,
    lightRequirement: input.lightRequirement ?? null,
    waterRequirement: input.waterRequirement ?? null,
    matureHeight: input.matureHeight ? String(input.matureHeight) : null,
    matureWidth: input.matureWidth ? String(input.matureWidth) : null,
    minSpacing: input.minSpacing ? String(input.minSpacing) : null
  };
}
var inventoryRouter = router({
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }
    return db.select().from(inventoryItems);
  }),
  add: publicProcedure.input(PlantSchema).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }
    const [newPlant] = await db.insert(inventoryItems).values(toDbValues(input)).returning();
    return newPlant;
  }),
  update: publicProcedure.input(PlantSchema.extend({ id: z5.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }
    const { id, ...data } = input;
    const [updatedPlant] = await db.update(inventoryItems).set(toDbValues(data)).where(eq3(inventoryItems.id, id)).returning();
    return updatedPlant;
  }),
  delete: publicProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }
    await db.delete(inventoryItems).where(eq3(inventoryItems.id, input.id));
    return { success: true };
  }),
  // Upload image: receives base64, returns data URL
  uploadImage: publicProcedure.input(z5.object({
    fileData: z5.string(),
    // Base64 encoded
    mimeType: z5.string()
  })).mutation(async ({ input }) => {
    const imageUrl = `data:${input.mimeType};base64,${input.fileData}`;
    return { imageUrl };
  }),
  updateStock: publicProcedure.input(z5.object({
    id: z5.number(),
    quantity: z5.number()
    // positive = add, negative = subtract
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }
    const [item] = await db.select().from(inventoryItems).where(eq3(inventoryItems.id, input.id));
    if (!item) {
      throw new TRPCError5({ code: "NOT_FOUND", message: "Item not found" });
    }
    const newStock = Math.max(0, item.stock + input.quantity);
    const [updated] = await db.update(inventoryItems).set({ stock: newStock }).where(eq3(inventoryItems.id, input.id)).returning();
    return updated;
  })
});

// server/routers/inpaint.ts
import { z as z6 } from "zod";
import sharp from "sharp";
function getCFToken() {
  return process.env.CF_API_TOKEN || "";
}
function getCFAccountId() {
  return process.env.CF_ACCOUNT_ID || "a5a228d8474a0f927acb0356a946d4fe";
}
function getCFUrl() {
  return `https://api.cloudflare.com/client/v4/accounts/${getCFAccountId()}/ai/run/@cf/runwayml/stable-diffusion-v1-5-inpainting`;
}
function getCFTxt2ImgUrl() {
  return `https://api.cloudflare.com/client/v4/accounts/${getCFAccountId()}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`;
}
var PLANT_FALLBACK_IMAGES = {
  palm: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&q=85",
  tree: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400&q=85",
  shrub: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=85",
  flower: "https://images.unsplash.com/photo-1490750967868-88df5691cc0c?w=400&q=85",
  grass: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=85",
  succulent: "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400&q=85",
  groundcover: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=85",
  vine: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=85",
  cactus: "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400&q=85",
  fern: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=85",
  bamboo: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400&q=85",
  rose: "https://images.unsplash.com/photo-1490750967868-88df5691cc0c?w=400&q=85",
  bougainvillea: "https://images.unsplash.com/photo-1490750967868-88df5691cc0c?w=400&q=85"
};
async function cfGeneratePlantImage(plantName, plantType) {
  const token = getCFToken();
  if (!token) return null;
  const prompt = `professional landscape photography, isolated ${plantName} ${plantType} plant on transparent background, photorealistic, high quality, nursery catalog photo, white background, detailed leaves`;
  try {
    const response = await fetch(getCFTxt2ImgUrl(), {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, num_steps: 20, width: 512, height: 512 })
    });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return "data:image/png;base64," + buffer.toString("base64");
  } catch {
    return null;
  }
}
function getClaudeKey() {
  return process.env.ANTHROPIC_API_KEY || "";
}
var CLAUDE_MODEL = "claude-opus-4-6";
var ObstacleSchema = z6.object({
  x: z6.number(),
  y: z6.number(),
  width: z6.number(),
  height: z6.number(),
  label: z6.string(),
  confidence: z6.number().optional()
});
function base64ToBuffer(base64) {
  const data = base64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(data, "base64");
}
function buildInpaintPrompt(label) {
  const l = label.toLowerCase();
  const STRICT_NEGATIVE = "plants, trees, bushes, shrubs, flowers, vegetation, grass blades, leaves, branches, rocks, boulders, stones, gravel, sand, water, puddles, shadows, people, animals, furniture, pots, tools, construction materials, debris, pipes, fences, posts, structures, buildings, objects, artifacts, blurry, distorted, overexposed, watermark, text, logo, painting, illustration, cartoon, CGI, generated content";
  const BASE_PROMPT = "bare flat empty soil ground, seamless texture perfectly matching surrounding area, photorealistic, neutral bare earth, empty terrain ready for landscaping, no objects, no plants, no vegetation, inpaint only the masked area";
  if (l.includes("tree") || l.includes("stump") || l.includes("root") || l.includes("arbol") || l.includes("\xE1rbol") || l.includes("tronco"))
    return {
      prompt: BASE_PROMPT + ", remove tree completely, fill with bare dirt ground",
      negative: STRICT_NEGATIVE + ", tree, stump, root, wood, trunk"
    };
  if (l.includes("fence") || l.includes("post") || l.includes("pipe") || l.includes("barda") || l.includes("reja") || l.includes("malla"))
    return {
      prompt: BASE_PROMPT + ", remove fence completely, fill with bare open ground",
      negative: STRICT_NEGATIVE + ", fence, post, pipe, wire, metal, structure"
    };
  if (l.includes("concrete") || l.includes("pavement") || l.includes("asphalt") || l.includes("concreto") || l.includes("cemento"))
    return {
      prompt: BASE_PROMPT + ", remove concrete completely, fill with bare dirt ground",
      negative: STRICT_NEGATIVE + ", concrete, pavement, asphalt, cement, slab"
    };
  if (l.includes("rock") || l.includes("boulder") || l.includes("piedra") || l.includes("stone"))
    return {
      prompt: BASE_PROMPT + ", remove rocks completely, fill with bare flat dirt",
      negative: STRICT_NEGATIVE + ", rock, boulder, stone, pebble"
    };
  return {
    prompt: BASE_PROMPT + ", erase obstacle completely, fill with bare empty ground",
    negative: STRICT_NEGATIVE
  };
}
async function dilateMask(maskBuffer, pixels, w, h) {
  if (pixels <= 0) return maskBuffer;
  const { data } = await sharp(maskBuffer).resize(w, h, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const src = new Uint8Array(data);
  const dst = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let maxVal = 0;
      for (let dy = -pixels; dy <= pixels; dy++) {
        for (let dx = -pixels; dx <= pixels; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const v = src[ny * w + nx];
            if (v > maxVal) maxVal = v;
          }
        }
      }
      dst[y * w + x] = maxVal;
    }
  }
  return sharp(Buffer.from(dst), { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}
async function cfInpaintCall(image512, mask512, prompt, negative, steps = 25, strength = 0.55, guidance = 4) {
  const token = getCFToken();
  if (!token) throw new Error("CF_API_TOKEN not configured \u2014 contact admin");
  const imageArray = Array.from(image512);
  const maskArray = Array.from(mask512);
  const MAX_RETRIES = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[CF Inpaint] Attempt ${attempt}/${MAX_RETRIES}...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5e4);
      let resp;
      try {
        resp = await fetch(getCFUrl(), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt,
            negative_prompt: negative,
            image: imageArray,
            mask: maskArray,
            num_steps: steps,
            strength,
            guidance
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!resp.ok) {
        const errText = await resp.text();
        if ((resp.status === 429 || resp.status === 503 || resp.status >= 500) && attempt < MAX_RETRIES) {
          lastError = new Error(`CF ${resp.status}: ${errText.slice(0, 200)}`);
          console.warn(`[CF Inpaint] Attempt ${attempt} failed (${resp.status}), retrying in ${attempt * 2}s...`);
          await new Promise((r) => setTimeout(r, attempt * 2e3));
          continue;
        }
        throw new Error(`Cloudflare AI error ${resp.status}: ${errText.slice(0, 300)}`);
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length < 1e3) {
        if (attempt < MAX_RETRIES) {
          lastError = new Error(`CF returned too-small response: ${buf.length} bytes`);
          console.warn(`[CF Inpaint] Attempt ${attempt} returned tiny response, retrying...`);
          await new Promise((r) => setTimeout(r, attempt * 1500));
          continue;
        }
        throw new Error(`Cloudflare AI returned invalid response after ${MAX_RETRIES} attempts`);
      }
      console.log(`[CF Inpaint] \u2713 Attempt ${attempt} succeeded (${buf.length} bytes)`);
      return buf;
    } catch (err) {
      if (err.name === "AbortError") {
        lastError = new Error(`Cloudflare AI timeout (attempt ${attempt})`);
        console.warn(`[CF Inpaint] Attempt ${attempt} timed out`);
      } else {
        lastError = err;
      }
      if (attempt < MAX_RETRIES) {
        console.warn(`[CF Inpaint] Attempt ${attempt} error: ${lastError?.message}, retrying in ${attempt * 2}s...`);
        await new Promise((r) => setTimeout(r, attempt * 2e3));
      }
    }
  }
  throw lastError || new Error("Cloudflare AI failed after 3 attempts");
}
async function processObstacle(workingBuffer, obs, origW, origH, scaleX, scaleY, promptOverride) {
  const cx = obs.x * scaleX;
  const cy = obs.y * scaleY;
  const hw = obs.width * scaleX / 2;
  const hh = obs.height * scaleY / 2;
  const padX = Math.max(hw * 0.6, 30);
  const padY = Math.max(hh * 0.6, 30);
  const cropX = Math.max(0, Math.floor(cx - hw - padX));
  const cropY = Math.max(0, Math.floor(cy - hh - padY));
  const cropW = Math.min(origW - cropX, Math.ceil((hw + padX) * 2));
  const cropH = Math.min(origH - cropY, Math.ceil((hh + padY) * 2));
  if (cropW < 16 || cropH < 16) return workingBuffer;
  const cropBuf = await sharp(workingBuffer).extract({ left: cropX, top: cropY, width: cropW, height: cropH }).png().toBuffer();
  const maskObsX = Math.max(0, Math.floor(cx - hw - cropX));
  const maskObsY = Math.max(0, Math.floor(cy - hh - cropY));
  const maskObsW = Math.max(1, Math.min(cropW - maskObsX, Math.ceil(hw * 2)));
  const maskObsH = Math.max(1, Math.min(cropH - maskObsY, Math.ceil(hh * 2)));
  const whitePatch = await sharp({
    create: { width: maskObsW, height: maskObsH, channels: 3, background: { r: 255, g: 255, b: 255 } }
  }).png().toBuffer();
  const rawMask = await sharp({
    create: { width: cropW, height: cropH, channels: 3, background: { r: 0, g: 0, b: 0 } }
  }).composite([{ input: whitePatch, left: maskObsX, top: maskObsY }]).png().toBuffer();
  const dilatedMask = await dilateMask(rawMask, 15, cropW, cropH);
  const crop512 = await sharp(cropBuf).resize(512, 512, { fit: "fill" }).png().toBuffer();
  const mask512 = await sharp(dilatedMask).resize(512, 512, { fit: "fill" }).png().toBuffer();
  const { prompt, negative } = buildInpaintPrompt(obs.label);
  const finalPrompt = promptOverride || prompt;
  const result512 = await cfInpaintCall(crop512, mask512, finalPrompt, negative, 25, 0.55, 4);
  const resultCrop = await sharp(result512).resize(cropW, cropH, { fit: "fill" }).png().toBuffer();
  return sharp(workingBuffer).composite([{ input: resultCrop, left: cropX, top: cropY }]).png().toBuffer();
}
async function processFreehandMask(origBuffer, maskBuf, origW, origH, prompt) {
  const maskResized = await sharp(maskBuf).resize(origW, origH, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const maskData = new Uint8Array(maskResized.data);
  let minX = origW, minY = origH, maxX = 0, maxY = 0;
  let hasMask = false;
  for (let y = 0; y < origH; y++) {
    for (let x = 0; x < origW; x++) {
      if (maskData[y * origW + x] > 30) {
        hasMask = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!hasMask) return origBuffer;
  const padX = Math.max((maxX - minX) * 0.3, 30);
  const padY = Math.max((maxY - minY) * 0.3, 30);
  const cropX = Math.max(0, Math.floor(minX - padX));
  const cropY = Math.max(0, Math.floor(minY - padY));
  const cropW = Math.min(origW - cropX, Math.ceil(maxX - minX + padX * 2));
  const cropH = Math.min(origH - cropY, Math.ceil(maxY - minY + padY * 2));
  if (cropW < 16 || cropH < 16) return origBuffer;
  const cropBuf = await sharp(origBuffer).extract({ left: cropX, top: cropY, width: cropW, height: cropH }).png().toBuffer();
  const cropMaskData = new Uint8Array(cropW * cropH);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const srcX = x + cropX;
      const srcY = y + cropY;
      if (srcX < origW && srcY < origH) {
        cropMaskData[y * cropW + x] = maskData[srcY * origW + srcX];
      }
    }
  }
  const cropMaskBuf = await sharp(Buffer.from(cropMaskData), {
    raw: { width: cropW, height: cropH, channels: 1 }
  }).png().toBuffer();
  const dilatedMask = await dilateMask(cropMaskBuf, 12, cropW, cropH);
  const crop512 = await sharp(cropBuf).resize(512, 512, { fit: "fill" }).png().toBuffer();
  const mask512 = await sharp(dilatedMask).resize(512, 512, { fit: "fill" }).png().toBuffer();
  const p = prompt || "bare empty ground, seamless terrain texture perfectly matching surrounding pixels, photorealistic soil or grass fill, no objects, no plants, no trees, no people, no structures, clean empty land, inpaint only the masked area";
  const n = "trees, plants, bushes, shrubs, flowers, vegetation, grass blades, leaves, branches, rocks, boulders, stones, people, animals, furniture, buildings, structures, objects, debris, pipes, fences, posts, shadows, water, puddles, blurry, distorted, overexposed, watermark, text, logo, painting, illustration, cartoon, CGI";
  const result512 = await cfInpaintCall(crop512, mask512, p, n, 25, 0.55, 4);
  const resultCrop = await sharp(result512).resize(cropW, cropH, { fit: "fill" }).png().toBuffer();
  return sharp(origBuffer).composite([{ input: resultCrop, left: cropX, top: cropY }]).png().toBuffer();
}
var inpaintRouter = router({
  /**
   * detectObstacles — Claude Vision analyzes terrain and returns ALL obstacles
   * with precise bounding boxes in image pixel coordinates.
   */
  detectObstacles: publicProcedure.input(
    z6.object({
      imageBase64: z6.string(),
      imageWidth: z6.number().optional(),
      imageHeight: z6.number().optional()
    })
  ).mutation(async ({ input }) => {
    const { imageBase64 } = input;
    const claudeKey = getClaudeKey();
    if (!claudeKey) throw new Error("ANTHROPIC_API_KEY not configured");
    const imgBuf = base64ToBuffer(imageBase64);
    const meta = await sharp(imgBuf).metadata();
    const imgW = meta.width || 800;
    const imgH = meta.height || 600;
    const imgRawB64 = imgBuf.toString("base64");
    const isPng = imgBuf[0] === 137 && imgBuf[1] === 80;
    const mimeType = isPng ? "image/png" : "image/jpeg";
    console.log(`[DetectObstacles] ${imgW}x${imgH} \u2014 calling Claude Vision...`);
    const prompt = `You are analyzing a terrain/landscape photo (${imgW}x${imgH} pixels) to detect ALL obstacles that must be removed for landscaping.

Detect EVERY obstacle: rocks, stones, concrete blocks, debris, stumps, pipes, fences, posts, construction materials, tools, pots, plants, or any object that does not belong to clean terrain.

Return ONLY a valid JSON array. No markdown, no explanation, no code blocks. Each item:
{"label":"rock","x":85,"y":70,"width":70,"height":60,"confidence":0.95}

x,y = CENTER of obstacle in pixels. width,height = bounding box in pixels.
If no obstacles found, return: []`;
    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: imgRawB64 } },
            { type: "text", text: prompt }
          ]
        }]
      })
    });
    if (!claudeResp.ok) {
      const err = await claudeResp.text();
      throw new Error(`Claude Vision ${claudeResp.status}: ${err.slice(0, 200)}`);
    }
    const claudeData = await claudeResp.json();
    const responseText = claudeData?.content?.[0]?.text || "[]";
    console.log(`[DetectObstacles] Claude: ${responseText.slice(0, 150)}`);
    let obstacles = [];
    try {
      const match = responseText.match(/\[[\s\S]*\]/);
      if (match) {
        obstacles = JSON.parse(match[0]).map((o) => ({
          label: String(o.label || "obstacle"),
          x: Number(o.x),
          y: Number(o.y),
          width: Number(o.width),
          height: Number(o.height),
          confidence: Number(o.confidence || 0.9)
        })).filter(
          (o) => !isNaN(o.x) && !isNaN(o.y) && o.width > 0 && o.height > 0
        );
      }
    } catch (e) {
      console.error("[DetectObstacles] parse error:", e);
    }
    console.log(`[DetectObstacles] Found ${obstacles.length} obstacles`);
    return { obstacles, imageWidth: imgW, imageHeight: imgH };
  }),
  /**
   * cleanTerrain — Erase obstacles from terrain photo using Cloudflare AI.
   *
   * Modes:
   *  - maskBase64 only: freehand brush mask → crop bounding box → inpaint
   *  - obstacles[] only: process each bounding box individually
   *  - both: process obstacles first, then apply freehand mask
   */
  cleanTerrain: publicProcedure.input(
    z6.object({
      imageBase64: z6.string(),
      maskBase64: z6.string().optional(),
      obstacles: z6.array(ObstacleSchema).optional().default([]),
      coordSpace: z6.enum(["image", "canvas800x600"]).optional().default("image"),
      prompt: z6.string().optional()
    })
  ).mutation(async ({ input }) => {
    const { imageBase64, maskBase64, obstacles, coordSpace, prompt } = input;
    if (!maskBase64 && (!obstacles || obstacles.length === 0)) {
      return { imageBase64, success: true, processed: 0, failed: 0, errors: [] };
    }
    const token = getCFToken();
    if (!token) {
      return {
        imageBase64,
        success: false,
        processed: 0,
        failed: 1,
        errors: ["CF_API_TOKEN no configurado \u2014 contacta al administrador"]
      };
    }
    let origBuffer;
    try {
      origBuffer = base64ToBuffer(imageBase64);
    } catch (e) {
      return { imageBase64, success: false, processed: 0, failed: 1, errors: ["Imagen inv\xE1lida"] };
    }
    const meta = await sharp(origBuffer).metadata();
    const origW = meta.width || 800;
    const origH = meta.height || 600;
    console.log(`[Inpaint] ${origW}x${origH} \u2014 obstacles:${obstacles?.length || 0} mask:${maskBase64 ? "yes" : "no"}`);
    let workingBuffer = origBuffer;
    let processed = 0;
    let failed = 0;
    const errors = [];
    if (obstacles && obstacles.length > 0) {
      const scaleX = coordSpace === "canvas800x600" ? origW / 800 : 1;
      const scaleY = coordSpace === "canvas800x600" ? origH / 600 : 1;
      const sorted = [...obstacles].sort((a, b) => b.width * b.height - a.width * a.height);
      for (let i = 0; i < sorted.length; i++) {
        const obs = sorted[i];
        console.log(`[Inpaint] Obstacle ${i + 1}/${sorted.length}: ${obs.label}`);
        try {
          workingBuffer = await processObstacle(workingBuffer, obs, origW, origH, scaleX, scaleY, prompt);
          console.log(`[Inpaint] \u2713 ${obs.label} erased`);
          processed++;
        } catch (err) {
          const msg = err.message;
          console.error(`[Inpaint] \u2717 ${obs.label} failed:`, msg);
          errors.push(`${obs.label}: ${msg}`);
          failed++;
        }
      }
    }
    if (maskBase64) {
      console.log(`[Inpaint] Processing freehand mask...`);
      try {
        const maskBuf = base64ToBuffer(maskBase64);
        workingBuffer = await processFreehandMask(workingBuffer, maskBuf, origW, origH, prompt);
        console.log(`[Inpaint] \u2713 Freehand mask applied`);
        processed++;
      } catch (err) {
        const msg = err.message;
        console.error(`[Inpaint] \u2717 Freehand mask failed:`, msg);
        errors.push(`Pincel: ${msg}`);
        failed++;
      }
    }
    const finalBuf = await sharp(workingBuffer).jpeg({ quality: 92 }).toBuffer();
    console.log(`[Inpaint] Done: processed=${processed} failed=${failed} size=${finalBuf.length}b`);
    return {
      imageBase64: "data:image/jpeg;base64," + finalBuf.toString("base64"),
      success: failed === 0,
      processed,
      failed,
      errors
    };
  }),
  /**
   * aiDesignChat — AI landscape design assistant
   * Receives user message + terrain image + inventory, returns reply + design actions
   */
  aiDesignChat: publicProcedure.input(z6.object({
    message: z6.string(),
    captureImage: z6.string().nullable().optional(),
    canvasObjects: z6.array(z6.object({
      id: z6.string(),
      type: z6.string(),
      x: z6.number(),
      y: z6.number(),
      name: z6.string().optional(),
      cost: z6.number().optional()
    })).optional(),
    inventory: z6.array(z6.object({
      id: z6.union([z6.string(), z6.number()]),
      name: z6.string(),
      type: z6.string(),
      price: z6.number(),
      imageUrl: z6.string().optional(),
      stock: z6.number().optional()
    })).optional(),
    appliedMaterials: z6.record(z6.string()).optional()
  })).mutation(async ({ input }) => {
    const claudeKey = getClaudeKey();
    if (!claudeKey) {
      return {
        reply: "El asistente de IA no est\xE1 configurado. Contacta al administrador.",
        actions: []
      };
    }
    const { message, captureImage, canvasObjects = [], inventory = [], appliedMaterials = {} } = input;
    const inventoryList = inventory.slice(0, 40).map(
      (i) => `- ID:${i.id} | ${i.name} (tipo: ${i.type}, precio: $${i.price}, stock: ${i.stock ?? "?"})`
    ).join("\n");
    const currentObjects = canvasObjects.map(
      (o) => `- ${o.name || o.type} en posici\xF3n (${Math.round(o.x)}, ${Math.round(o.y)})`
    ).join("\n");
    const materialsApplied = Object.values(appliedMaterials).join(", ") || "ninguno";
    const systemPrompt = `Eres un asistente experto en dise\xF1o de paisajismo profesional. Ayudas al usuario a dise\xF1ar el terreno de su cliente usando su inventario de plantas y materiales.

El canvas es de 800x600 p\xEDxeles. La imagen de fondo es la foto real del terreno. Cuando el usuario te env\xEDe una imagen del terreno, AN\xC1LIZA visualmente d\xF3nde est\xE1 la tierra/c\xE9sped/\xE1rea disponible y coloca los elementos en esas zonas.

Inventario disponible (usa EXACTAMENTE estos IDs):
${inventoryList || "Sin inventario cargado a\xFAn"}

Elementos actuales en el canvas:
${currentObjects || "Canvas vac\xEDo"}

Materiales aplicados actualmente: ${materialsApplied}

== INSTRUCCIONES DE RESPUESTA ==
Cuando el usuario pida colocar plantas, materiales, dise\xF1ar el terreno O ELIMINAR elementos:
1. Responde con un mensaje amigable y profesional explicando lo que har\xE1s
2. Si ves la foto del terreno, menciona brevemente lo que observas (tierra disponible, \xE1rea aproximada)
3. Al FINAL de tu respuesta, incluye el bloque de acciones en este formato EXACTO:

<actions>
[
  {"type": "add_plant", "inventoryId": "ID_EXACTO", "x": 400, "y": 300, "name": "Nombre", "plantType": "palm"},
  {"type": "apply_material", "material": "grass", "zone": "full"},
  {"type": "remove_objects", "filter": "all"},
  {"type": "generate_terrain", "description": "lush green zoysia grass lawn covering the entire terrain, photorealistic", "style": "photorealistic", "materialName": "Pasto Zoysia"}
]
</actions>

TIPOS DE ACCIONES DISPONIBLES:
1. add_plant: Coloca planta. Campos: inventoryId (ID exacto o "GENERATE"), x, y, name, plantType (palm/tree/shrub/flower/grass/succulent)
2. apply_material: Aplica material visual. Campos: material, zone
3. remove_objects: Elimina elementos del canvas. Campos: filter ("all"=todos, "border"=borde, "left"/"right"/"center"/"top"/"bottom"=zona, "type:palm"=por tipo, "name:Palmera"=por nombre)
4. generate_terrain: Genera imagen fotorrealista del terreno con IA. Campos:
   - description: descripci\xF3n detallada en INGL\xC9S del dise\xF1o (ej: "lush green zoysia grass lawn with river stone border path")
   - style: "photorealistic"
   - materialName: nombre EXACTO del material del inventario en espa\xF1ol (ej: "Pasto Zoysia", "Piedras de R\xEDo") \u2014 OBLIGATORIO cuando el usuario mencione un material espec\xEDfico

Materiales v\xE1lidos: grass (pasto), river_stones (piedras de r\xEDo), gravel (grava), soil (tierra), mulch, concrete (concreto).
Zonas v\xE1lidas: left, right, center, top, bottom, border, full.

Posiciones en el canvas (800x600):
- Izquierda: x entre 80-280, y entre 100-500
- Centro: x entre 320-480, y entre 150-450
- Derecha: x entre 520-720, y entre 100-500
- Arriba: y entre 50-200
- Abajo: y entre 400-550
- Distribuye m\xFAltiples plantas uniformemente, nunca las pongas en la misma posici\xF3n exacta

REGLAS IMPORTANTES:
- Usa SOLO plantas del inventario disponible con sus IDs exactos
- Si piden "3 palmeras" y hay palmeras en inventario, genera 3 acciones add_plant con posiciones distintas
- Si piden "elimina el borde", "borra las palmeras", "quita todo": genera acci\xF3n remove_objects con el filter correcto
- Si piden "pon pasto", "pasto zoysia", "dise\xF1a con piedras de r\xEDo" o cualquier material: genera SIEMPRE acci\xF3n generate_terrain con description en ingl\xE9s Y materialName en espa\xF1ol
- La description del generate_terrain debe ser muy espec\xEDfica: incluye el tipo de pasto/material, cobertura, estilo, iluminaci\xF3n
- Si no hay el tipo de planta pedido en inventario, usa add_plant con inventoryId="GENERATE" y el plantType correcto
- Si el usuario hace preguntas generales de paisajismo, responde profesionalmente SIN generar acciones
- Siempre responde en espa\xF1ol`;
    const userContent = [{ type: "text", text: message }];
    if (captureImage && captureImage.startsWith("data:image/")) {
      const base64Data = captureImage.replace(/^data:image\/\w+;base64,/, "");
      const mediaType = captureImage.includes("data:image/png") ? "image/png" : "image/jpeg";
      userContent.unshift({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64Data }
      });
    }
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }]
      })
    });
    if (!response.ok) {
      const err = await response.text();
      console.error("[aiDesignChat] Claude error:", err);
      return { reply: "Error al conectar con el asistente de IA. Intenta de nuevo.", actions: [] };
    }
    const data = await response.json();
    const fullText = data.content?.[0]?.text || "";
    const actionsMatch = fullText.match(/<actions>([\s\S]*?)<\/actions>/);
    let actions = [];
    let reply = fullText.replace(/<actions>[\s\S]*?<\/actions>/g, "").trim();
    if (actionsMatch) {
      try {
        actions = JSON.parse(actionsMatch[1].trim());
      } catch (e) {
        console.error("[aiDesignChat] Failed to parse actions:", e);
      }
    }
    console.log(`[aiDesignChat] reply=${reply.length}chars actions=${actions.length}`);
    return { reply, actions };
  }),
  /**
   * generatePlantImage — Generates a photorealistic plant image via CF AI.
   * Used when the plant is not found in the user's inventory.
   * Returns a base64 image or a high-quality Unsplash fallback URL.
   */
  generatePlantImage: publicProcedure.input(z6.object({
    plantName: z6.string(),
    plantType: z6.string().default("tree")
  })).mutation(async ({ input }) => {
    const { plantName, plantType } = input;
    const aiImage = await cfGeneratePlantImage(plantName, plantType);
    if (aiImage) {
      console.log(`[generatePlantImage] CF AI generated image for: ${plantName}`);
      return { imageUrl: aiImage, source: "ai" };
    }
    const typeKey = plantType.toLowerCase();
    const fallbackUrl = PLANT_FALLBACK_IMAGES[typeKey] || PLANT_FALLBACK_IMAGES[plantName.toLowerCase()] || PLANT_FALLBACK_IMAGES["tree"];
    console.log(`[generatePlantImage] Using fallback for: ${plantName} (${plantType})`);
    return { imageUrl: fallbackUrl, source: "fallback" };
  }),
  /**
   * generateDesign — Production-grade AI landscape design image generator.
   *
   * 3-Strategy fallback system (NEVER returns empty):
   *   1. img2img with CF SD v1.5 inpainting (uses terrain photo as base — best result)
   *   2. txt2img with CF SDXL-base-1.0 (high quality, no photo needed)
   *   3. txt2img with CF SD v1.5 via cfGeneratePlantImage (most reliable)
   *
   * BUG FIXES applied:
   *   - mask channels: 4 (RGBA) instead of 1 (grayscale) — was crashing Sharp
   *   - image resized to PNG (not JPEG) for inpainting compatibility
   *   - enriched prompt with material name and landscape context
   *   - full try/catch per strategy with automatic fallthrough
   */
  generateDesign: publicProcedure.input(z6.object({
    captureImage: z6.string().optional(),
    description: z6.string(),
    materialName: z6.string().optional()
  })).mutation(async ({ input }) => {
    const cfToken = getCFToken();
    if (!cfToken) {
      return { success: false, imageBase64: null, error: "CF_API_TOKEN no configurado \u2014 contacta al administrador" };
    }
    const { captureImage, description, materialName } = input;
    const materialHint = materialName ? `${materialName}, ` : "";
    const prompt = `Professional residential landscape design, ${materialHint}${description}. Photorealistic garden photography, high quality DSLR photo, natural sunlight, lush and well-maintained, professional landscaping, beautiful outdoor space, aerial perspective`;
    const negativePrompt = "ugly, blurry, low quality, cartoon, anime, drawing, sketch, painting, people, cars, text, watermark, logo, border, frame, distorted, deformed, bad anatomy, indoors";
    console.log(`[generateDesign] START hasPhoto=${!!captureImage} material="${materialName || ""}" desc="${description.slice(0, 60)}"`);
    if (captureImage) {
      try {
        const imageBuffer = base64ToBuffer(captureImage);
        const resized = await sharp(imageBuffer).resize(512, 512, { fit: "cover" }).png().toBuffer();
        const maskBuffer = await sharp({
          create: { width: 512, height: 512, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
        }).png().toBuffer();
        const resultBuf = await cfInpaintCall(
          resized,
          maskBuffer,
          prompt,
          negativePrompt,
          25,
          // steps — more steps = better quality
          0.85,
          // strength — high = redesign the terrain completely
          8
          // guidance — higher = follows prompt more strictly
        );
        const resultBase64 = "data:image/png;base64," + resultBuf.toString("base64");
        console.log(`[generateDesign] \u2713 Strategy 1 (img2img inpainting) success, size=${resultBuf.length}b`);
        return { success: true, imageBase64: resultBase64, error: null };
      } catch (err) {
        console.warn(`[generateDesign] Strategy 1 (img2img) failed: ${err.message} \u2014 falling back to txt2img`);
      }
    }
    try {
      const sdxlUrl = `https://api.cloudflare.com/client/v4/accounts/${getCFAccountId()}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`;
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 5e4);
      let resp2;
      try {
        resp2 = await fetch(sdxlUrl, {
          method: "POST",
          headers: { "Authorization": `Bearer ${cfToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, negative_prompt: negativePrompt, num_steps: 25, width: 768, height: 512 }),
          signal: controller2.signal
        });
      } finally {
        clearTimeout(timeout2);
      }
      if (resp2.ok) {
        const buf2 = Buffer.from(await resp2.arrayBuffer());
        if (buf2.length > 1e3) {
          const resultBase64 = "data:image/png;base64," + buf2.toString("base64");
          console.log(`[generateDesign] \u2713 Strategy 2 (SDXL txt2img) success, size=${buf2.length}b`);
          return { success: true, imageBase64: resultBase64, error: null };
        }
      } else {
        const errText2 = await resp2.text();
        console.warn(`[generateDesign] Strategy 2 SDXL failed: ${resp2.status} ${errText2.slice(0, 100)}`);
      }
    } catch (err) {
      console.warn(`[generateDesign] Strategy 2 (SDXL) failed: ${err.message} \u2014 falling back to SD v1.5`);
    }
    try {
      const generatedBase64 = await cfGeneratePlantImage(
        `${materialHint}${description}`,
        "landscape"
      );
      if (generatedBase64) {
        console.log(`[generateDesign] \u2713 Strategy 3 (SD v1.5 txt2img) success`);
        return { success: true, imageBase64: generatedBase64, error: null };
      }
    } catch (err) {
      console.warn(`[generateDesign] Strategy 3 (SD v1.5) failed: ${err.message}`);
    }
    console.error("[generateDesign] \u2717 All 3 strategies failed");
    return { success: false, imageBase64: null, error: "No se pudo generar el dise\xF1o. Verifica la configuraci\xF3n de Cloudflare AI." };
  })
});

// server/routers.ts
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  projects: projectsRouter,
  captures: capturesRouter,
  inventory: inventoryRouter,
  inpaint: inpaintRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import path from "path";
async function setupVite(app, server) {
  const { createServer: createViteServer } = await import("vite");
  const { nanoid } = await import("nanoid");
  const { jsxLocPlugin } = await import("@builder.io/vite-plugin-jsx-loc");
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    plugins: [jsxLocPlugin()],
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    app.get("/", (_req, res) => res.status(200).json({ status: "ok", mode: "api-only" }));
    console.log("[Static] No client build found. Running in API-only mode.");
    return;
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "3000");
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}
startServer().catch(console.error);
