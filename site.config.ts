/**
 * The ONLY place where the domain, brand, contacts and service URLs are written.
 *
 * To change the name and logo: change `activeBrand` (one line) to another key of `brands`.
 * To change the domain: edit `domain`, then follow docs/DOMAIN_CHANGE.md.
 * `pnpm check:domains` (run in CI) fails if any of these values appear anywhere else.
 */

/** THE ONE LINE: the name, tagline, colours and logo the whole product wears. */
const activeBrand: keyof typeof brands = "claspkart";

/**
 * The brands to choose from. Each one's logo files are in brand/<key>/ (`pnpm brand` turns them
 * into the site's icons). To add one: a block here, its folder there, then `pnpm brand`.
 */
export const brands = {
  claspkart: {
    name: "ClaspKart",
    accent: "Kart",
    shortName: "ClaspKart",
    tagline: "Save Anything. Find It Anywhere.",
    description:
      "Save posts, links and text from Instagram, TikTok, YouTube, X, Reddit, LinkedIn and more, and find it all in one place on every device.",
    colors: { from: "#0088FD", to: "#6138F8", ink: "#192035" },
  },
  postsaver: {
    name: "Post Saver",
    accent: "Saver",
    shortName: "Post Saver",
    tagline: "Save Posts Across All Platforms",
    description:
      "Save posts from Instagram, TikTok, YouTube, X, Reddit, LinkedIn and more — and find them all in one place.",
    colors: { from: "#099AFE", to: "#6636F2", ink: "#03112C" },
  },
} satisfies Record<string, Brand>;

export const site = {
  /** The active brand; `key` is its folder in brand/. */
  brand: { key: activeBrand, ...brands[activeBrand] } as Brand & { key: string },

  /** Main domain. Subdomains below are derived from it. */
  domain: "kerdostack.com",
  subdomains: { www: "www", embed: "embed", auth: "auth" },

  /** Resolver Worker base URL (no trailing slash). Can move to https://api.<domain> later. */
  apiBaseUrl: "https://post-saver-resolver.postsaver-resolver.workers.dev",

  contact: {
    support: "kerdostack@gmail.com",
    privacy: "kerdostack@gmail.com",
  },

  github: {
    owner: "blackdot789",
    repos: { web: "post_saver", embed: "post_saver_embed", ops: "post_saver_ops" },
  },

  /** Firebase web configs are public by design (security comes from Firestore rules). */
  firebase: {
    dev: {
      apiKey: "AIzaSyCXexm2m1x5El_SL2aKM6D9JqwsynJ8a0o",
      projectId: "post-saver-dev",
      appId: "1:96165435237:web:6c02c349e9286d812cb38c",
      messagingSenderId: "96165435237",
    } as FirebaseWebConfig | null,
    prod: {
      apiKey: "AIzaSyB4QJWrbcoTDwgUN2q-9yYOKqvt-0tAFC8",
      projectId: "post-saver-prod",
      appId: "1:650431358172:web:8188bcd18fcfa9f3350019",
      messagingSenderId: "650431358172",
    } as FirebaseWebConfig | null,
  },
} as const;

export interface Brand {
  name: string;
  /** The end of the name that pages draw in the brand gradient, as the logo does ("" for none). */
  accent: string;
  /** Under the home-screen icon: 12 characters at most. */
  shortName: string;
  tagline: string;
  description: string;
  /** The gradient's two ends, and the text colour. */
  colors: { from: string; to: string; ink: string };
}

export interface FirebaseWebConfig {
  apiKey: string;
  projectId: string;
  appId: string;
  messagingSenderId: string;
  storageBucket?: string;
}
