import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
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

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In production (Render), the esbuild output is at dist/index.js
  // and the Vite client build is at dist/ (same folder)
  // We try multiple paths to find the built client assets
  const candidatePaths = [
    path.resolve(import.meta.dirname, "public"),           // dist/public (legacy)
    path.resolve(import.meta.dirname, ".."),               // dist/ (when server is dist/index.js)
    path.resolve(process.cwd(), "dist"),                   // cwd/dist
    path.resolve(process.cwd(), "public"),                 // cwd/public
  ];
  const distPath = candidatePaths.find(p => fs.existsSync(path.join(p, "index.html"))) ||
    candidatePaths[0];
  if (!fs.existsSync(path.join(distPath, "index.html"))) {
    console.warn(
      `[serveStatic] Could not find index.html in any candidate path. Tried: ${candidatePaths.join(', ')}`
    );
  } else {
    console.log(`[serveStatic] Serving static files from: ${distPath}`);
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
