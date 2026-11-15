import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { transform } from "esbuild";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Serve api/import.ts at /api/import in `vite dev` and `vite preview`, the way Vercel does in
 * production: compiled as one plain ES module, with keys from .env.local.
 */
function importApi(): Plugin {
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const source = await readFile(new URL("./api/import.ts", import.meta.url), "utf8");
      const { code } = await transform(source, { loader: "ts", format: "esm" });
      const mod = (await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`)) as {
        GET: (r: Request) => Promise<Response>;
      };
      const response = await mod.GET(new Request(new URL(req.originalUrl ?? req.url ?? "/", "http://localhost")));
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(await response.text());
    } catch (e) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: `Local import server failed: ${e instanceof Error ? e.message : e}` }));
    }
  };
  return {
    name: "api-import",
    configureServer: (server) => void server.middlewares.use("/api/import", handle),
    configurePreviewServer: (server) => void server.middlewares.use("/api/import", handle),
  };
}

export default defineConfig(({ mode }) => {
  // Bracket-site keys for the import endpoint (never sent to the browser). Not in tests:
  // they stub their own, and real keys would change what the tests exercise.
  if (mode !== "test")
    for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ""))) process.env[k] ??= v;
  return { plugins: [react(), importApi()] };
});
