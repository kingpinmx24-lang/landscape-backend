import type { VercelRequest, VercelResponse } from "@vercel/node";
import postgres from "postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const result = await sql`SELECT version()`;
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' ORDER BY table_name
    `;
    await sql.end();
    return res.status(200).json({ 
      ok: true,
      version: result[0].version.substring(0, 50),
      tables: tables.map((r: any) => r.table_name),
    });
  } catch (error: any) {
    await sql.end().catch(() => {});
    return res.status(500).json({ 
      error: error.message,
      code: error.code,
    });
  }
}
