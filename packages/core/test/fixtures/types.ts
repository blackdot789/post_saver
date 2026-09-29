import type { Kind, Platform } from "../../src/types.ts";

/**
 * One link as a platform's app or website produces it, and what the parser must return.
 *
 * The formats follow what each Android app, iOS app and website emits when you tap Share or
 * copy a link. Ids and share codes are placeholders unless a comment says otherwise. When a
 * real link breaks the parser, add it here exactly as it was shared, then fix the parser.
 */
export interface Fixture {
  /** Where this form of link comes from, e.g. "Android app share". */
  from: string;
  input: string;
  platform: Platform;
  kind: Kind;
  platformId: string | null;
  canonicalUrl: string;
  author?: string;
  needsResolve?: true;
}
