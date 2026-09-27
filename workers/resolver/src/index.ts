/**
 * Resolver Worker: expands short links and fetches post metadata (Phase 1).
 * Phase 0 skeleton: health endpoint + CORS allowlist derived from site.config.ts.
 */
import { origins } from "@postsaver/config";

const ALLOWED_ORIGINS = new Set<string>([origins.app, origins.www, "http://localhost:5173"]);

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    const { pathname } = new URL(request.url);
    if (pathname === "/health") return json({ ok: true, service: "resolver", phase: 0 }, 200, origin);
    return json({ error: "not_found" }, 404, origin);
  },
} satisfies ExportedHandler;
