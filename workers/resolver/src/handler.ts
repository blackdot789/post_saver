/**
 * The resolver Worker's request handling (CLAUDE.md §6.3): opens short links and fetches titles
 * for saved posts. Kept apart from index.ts, because a Worker's entry file may export nothing
 * but its handlers.
 *
 *   GET  /health          → { ok, service, phase }                      (no sign-in)
 *   GET  /resolve?url=    → { finalUrl }
 *   GET  /meta?url=       → { title?, author?, thumb? }
 *   POST /batch           → { results: [...] }   body: { items: [{ url, do: "resolve" | "meta" }] }, at most 40
 *
 * Everything but /health needs `Authorization: Bearer <Firebase ID token>` of a user with a
 * verified email. Errors are `{ error, reason? }`; a failure a later try might fix is 502
 * ("upstream", "unresolved") or 503 ("busy"), so the app keeps the link and tries again.
 */
import { origins } from "@postsaver/config";
import { MAX_BATCH, type BatchItem, type BatchResult } from "@postsaver/core";
import { bearer, type Caller } from "./auth.ts";
import { BudgetError, createFetcher, type Fetcher } from "./fetcher.ts";
import { meta } from "./meta.ts";
import { resolve } from "./resolve.ts";

const ALLOWED_ORIGINS = new Set<string>([origins.app, origins.www, "http://localhost:5173"]);

/** How long the browser may reuse an answer: where a short link leads doesn't change, titles rarely do. */
const RESOLVE_MAX_AGE = 7 * 24 * 3600;
const META_MAX_AGE = 24 * 3600;
const MAX_BODY_BYTES = 128 * 1024;

export interface Deps {
  fetch: typeof fetch;
  verify: (token: string) => Promise<Caller | null>;
}

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

function json(body: unknown, status: number, origin: string | null, maxAge = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Answers depend on the caller's sign-in, so only the caller's own browser may keep them.
      "Cache-Control": maxAge > 0 ? `private, max-age=${maxAge}` : "no-store",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(origin),
    },
  });
}

async function runItem(item: BatchItem, fetcher: Fetcher): Promise<BatchResult> {
  try {
    if (item.do === "resolve") {
      const r = await resolve(item.url, fetcher);
      return r.ok ? { url: item.url, do: "resolve", ok: true, finalUrl: r.finalUrl } : { url: item.url, do: "resolve", ok: false, error: r.error, retry: r.error !== "bad_url" };
    }
    const r = await meta(item.url, fetcher);
    return r.ok ? { url: item.url, do: "meta", ok: true, meta: r.meta } : { url: item.url, do: "meta", ok: false, error: r.error, retry: r.error !== "bad_url" };
  } catch (error) {
    if (error instanceof BudgetError) return { url: item.url, do: item.do, ok: false, error: "busy", retry: true };
    return { url: item.url, do: item.do, ok: false, error: "failed", retry: true };
  }
}

function readItems(body: unknown): BatchItem[] | null {
  const items = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_BATCH) return null;
  const out: BatchItem[] = [];
  for (const item of items as Array<{ url?: unknown; do?: unknown }>) {
    if (!item || typeof item.url !== "string" || (item.do !== "resolve" && item.do !== "meta")) return null;
    out.push({ url: item.url, do: item.do });
  }
  return out;
}

export function createHandler(deps: Deps): (request: Request) => Promise<Response> {
  return async (request) => {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });

    const { pathname, searchParams } = new URL(request.url);
    if (pathname === "/health") return json({ ok: true, service: "resolver", phase: 1 }, 200, origin);

    const route = `${request.method} ${pathname}`;
    if (route !== "GET /resolve" && route !== "GET /meta" && route !== "POST /batch") return json({ error: "not_found" }, 404, origin);

    const token = bearer(request);
    const caller = token ? await deps.verify(token) : null;
    if (!caller) return json({ error: "unauthorized" }, 401, origin);
    if (!caller.emailVerified) return json({ error: "email_not_verified" }, 403, origin);

    const fetcher = createFetcher(deps.fetch);

    if (route === "POST /batch") {
      const length = Number(request.headers.get("Content-Length") ?? 0);
      if (length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413, origin);
      const items = readItems(await request.json().catch(() => null));
      if (!items) return json({ error: "bad_request", reason: `items: 1 to ${MAX_BATCH} of { url, do: "resolve" | "meta" }` }, 400, origin);
      // One at a time: the outgoing-request budget is shared, and the first items matter most.
      const results: BatchResult[] = [];
      for (const item of items) results.push(await runItem(item, fetcher));
      return json({ results }, 200, origin);
    }

    const url = searchParams.get("url");
    if (!url) return json({ error: "bad_url", reason: "url is missing" }, 400, origin);
    const result = await runItem({ url, do: route === "GET /resolve" ? "resolve" : "meta" }, fetcher);
    if (!result.ok) return json({ error: result.error }, result.error === "bad_url" ? 400 : result.error === "busy" ? 503 : 502, origin);
    return result.do === "resolve" ? json({ finalUrl: result.finalUrl }, 200, origin, RESOLVE_MAX_AGE) : json(result.meta, 200, origin, META_MAX_AGE);
  };
}
