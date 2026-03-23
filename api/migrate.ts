import type { VercelRequest, VercelResponse } from "@vercel/node";
import postgres from "postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.query.secret;
  if (secret !== 'landscape-migrate-2024') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ error: 'DATABASE_URL not set' });
  }

  const sql = postgres(dbUrl, {
    ssl: { rejectUnauthorized: false },
    connect_timeout: 12,
    idle_timeout: 10,
    max: 1,
  });

  try {
    // Create ENUMs (idempotent)
    await sql.unsafe(`DO $$ BEGIN CREATE TYPE "public"."light_requirement" AS ENUM('full', 'partial', 'shade'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
    await sql.unsafe(`DO $$ BEGIN CREATE TYPE "public"."plant_type" AS ENUM('tree', 'shrub', 'flower', 'grass', 'groundcover'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
    await sql.unsafe(`DO $$ BEGIN CREATE TYPE "public"."project_status" AS ENUM('draft', 'active', 'completed', 'archived'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
    await sql.unsafe(`DO $$ BEGIN CREATE TYPE "public"."quotation_status" AS ENUM('draft', 'sent', 'accepted', 'rejected', 'completed'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
    await sql.unsafe(`DO $$ BEGIN CREATE TYPE "public"."role" AS ENUM('user', 'admin'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
    await sql.unsafe(`DO $$ BEGIN CREATE TYPE "public"."water_requirement" AS ENUM('low', 'medium', 'high'); EXCEPTION WHEN duplicate_object THEN null; END $$`);

    // Create tables (idempotent)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS "users" ("id" serial PRIMARY KEY NOT NULL, "openId" varchar(64) NOT NULL, "name" text, "email" varchar(320), "loginMethod" varchar(64), "role" "role" DEFAULT 'user' NOT NULL, "createdAt" timestamp DEFAULT now() NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL, "lastSignedIn" timestamp DEFAULT now() NOT NULL, CONSTRAINT "users_openId_unique" UNIQUE("openId"))`);

    await sql.unsafe(`CREATE TABLE IF NOT EXISTS "inventory_items" ("id" serial PRIMARY KEY NOT NULL, "name" varchar(255) NOT NULL, "scientificName" varchar(255), "plant_type" "plant_type" NOT NULL, "price" numeric(10, 2) NOT NULL, "stock" integer DEFAULT 0 NOT NULL, "minStock" integer DEFAULT 0 NOT NULL, "imageUrl" text, "description" text, "climate" varchar(255), "light_requirement" "light_requirement", "water_requirement" "water_requirement", "matureHeight" numeric(5, 2), "matureWidth" numeric(5, 2), "minSpacing" numeric(5, 2), "createdAt" timestamp DEFAULT now() NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL)`);

    await sql.unsafe(`CREATE TABLE IF NOT EXISTS "projects" ("id" serial PRIMARY KEY NOT NULL, "userId" integer NOT NULL, "name" varchar(255) NOT NULL, "description" text, "terrain" jsonb NOT NULL, "project_status" "project_status" DEFAULT 'draft' NOT NULL, "metadata" jsonb, "createdAt" timestamp DEFAULT now() NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL)`);

    await sql.unsafe(`CREATE TABLE IF NOT EXISTS "measurements" ("id" serial PRIMARY KEY NOT NULL, "projectId" integer NOT NULL, "data" jsonb NOT NULL, "createdAt" timestamp DEFAULT now() NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL)`);

    await sql.unsafe(`CREATE TABLE IF NOT EXISTS "plants" ("id" serial PRIMARY KEY NOT NULL, "projectId" integer NOT NULL, "name" varchar(255) NOT NULL, "quantity" integer DEFAULT 1 NOT NULL, "position" jsonb NOT NULL, "metadata" jsonb NOT NULL, "createdAt" timestamp DEFAULT now() NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL)`);

    await sql.unsafe(`CREATE TABLE IF NOT EXISTS "quotations" ("id" serial PRIMARY KEY NOT NULL, "projectId" integer NOT NULL, "totalCost" numeric(12, 2) NOT NULL, "items" jsonb NOT NULL, "quotation_status" "quotation_status" DEFAULT 'draft' NOT NULL, "metadata" jsonb, "createdAt" timestamp DEFAULT now() NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL)`);

    // Create indexes
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "inventory_items_name_idx" ON "inventory_items" USING btree ("name")`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "users_openId_idx" ON "users" USING btree ("openId")`);

    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`;
    
    await sql.end();
    return res.status(200).json({ 
      ok: true, 
      message: 'Migration completed successfully',
      tables: tables.map((r: any) => r.table_name)
    });
  } catch (error: any) {
    await sql.end().catch(() => {});
    return res.status(500).json({ 
      error: error.message,
      detail: error.detail || null
    });
  }
}
