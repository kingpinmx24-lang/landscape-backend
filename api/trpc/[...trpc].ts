import "dotenv/config";
import express, { Express } from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import type { VercelRequest, VercelResponse } from "@vercel/node";

let app: Express | null = null;

async function getApp(): Promise<Express> {
  if (app) return app;
  
  try {
    // Import from pre-bundled file to avoid ES module path alias issues
    const { appRouter, createContext } = await import("../../dist/serverless.js");
    
    const instance = express();
    instance.use(cors({ origin: true, credentials: true }));
    instance.use(express.json({ limit: "50mb" }));
    instance.use(express.urlencoded({ limit: "50mb", extended: true }));
    
    instance.use(
      "/api/trpc",
      createExpressMiddleware({
        router: appRouter,
        createContext,
      })
    );
    
    app = instance;
    return instance;
  } catch (err) {
    console.error("[tRPC Handler] Failed to initialize:", err);
    throw err;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const expressApp = await getApp();
    // Rewrite the URL so Express can match /api/trpc/*
    req.url = "/api/trpc" + (req.url || "");
    // Express app is callable as a request handler
    return (expressApp as unknown as (req: any, res: any) => void)(req, res);
  } catch (err: any) {
    console.error("[tRPC Handler] Runtime error:", err?.message, err?.stack);
    res.status(500).json({ 
      error: "Internal server error", 
      message: err?.message || "Unknown error"
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
    responseLimit: "50mb",
  },
};
