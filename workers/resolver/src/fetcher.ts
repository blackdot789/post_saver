import { origins, site } from "@postsaver/config";

// Every request the Worker makes to another site goes through one of these: a time limit, an
// honest User-Agent, no automatic redirects, and a count, because the free plan allows 50
// outgoing requests per incoming one.

export const FETCH_TIMEOUT_MS = 5000;
/** Outgoing requests per incoming request, leaving room for the sign-in key lookup. */
export const SUBREQUEST_BUDGET = 45;

const USER_AGENT = `Mozilla/5.0 (compatible; ${site.brand.name.replace(/\s+/g, "")}Bot/1.0; +${origins.app})`;

export class BudgetError extends Error {
  constructor() {
    super("out of outgoing requests for this call");
  }
}

/** The platform answered, but not with what was asked for. */
export class UpstreamError extends Error {
  constructor(
    readonly status: number,
    message = `upstream answered ${status}`,
  ) {
    super(message);
  }
}

export type Fetcher = (url: URL | string, init?: { accept?: string }) => Promise<Response>;

/** A counting fetcher on top of `fetchImpl` (the Workers runtime's fetch, or a fake in tests). */
export function createFetcher(fetchImpl: typeof fetch, budget = SUBREQUEST_BUDGET): Fetcher {
  let left = budget;
  return async (url, init) => {
    if (left <= 0) throw new BudgetError();
    left--;
    return fetchImpl(String(url), {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: init?.accept ?? "*/*", "Accept-Language": "en" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  };
}
