import { createFetcher, type Fetcher } from "../src/fetcher.ts";

type Answer = Response | Error | (() => Response);

/** A stand-in for the network: answers by exact URL, 404 for anything else, and records the calls. */
export function fakeNet(routes: Record<string, Answer>, budget?: number): { fetcher: Fetcher; fetch: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const answer = routes[url];
    if (!answer) return new Response("not found", { status: 404 });
    if (answer instanceof Error) throw answer;
    return typeof answer === "function" ? answer() : answer.clone();
  }) as typeof fetch;
  return { fetcher: createFetcher(impl, budget), fetch: impl, calls };
}

export const redirect = (to: string, status = 301) => new Response(null, { status, headers: { location: to } });
export const html = (body: string, contentType = "text/html; charset=utf-8") => new Response(body, { status: 200, headers: { "content-type": contentType } });
export const jsonAnswer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
