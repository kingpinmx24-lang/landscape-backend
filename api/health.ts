import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    env: {
      CF_API_TOKEN: process.env.CF_API_TOKEN ? `set(${process.env.CF_API_TOKEN.length}chars)` : "MISSING",
      CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID ? `set(${process.env.CF_ACCOUNT_ID.length}chars)` : "MISSING",
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? `set(${process.env.ANTHROPIC_API_KEY.length}chars)` : "MISSING",
      DATABASE_URL: process.env.DATABASE_URL ? `set(${process.env.DATABASE_URL.length}chars)` : "MISSING",
    }
  });
}
