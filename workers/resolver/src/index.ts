/**
 * Resolver Worker entry (CLAUDE.md §6.3). The routes are in handler.ts. This file may export
 * only the Worker's handlers: the runtime refuses any other export.
 */
import { verifyIdToken } from "./auth.ts";
import { createHandler } from "./handler.ts";

const handler = createHandler({ fetch: (input, init) => fetch(input, init), verify: (token) => verifyIdToken(token) });

export default {
  fetch: (request: Request) => handler(request),
} satisfies ExportedHandler;
