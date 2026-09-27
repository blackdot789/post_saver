/**
 * The ONLY place where the domain, brand, contacts and service URLs are written.
 *
 * To change the domain or brand: edit this file, then follow docs/DOMAIN_CHANGE.md.
 * `pnpm check:domains` (run in CI) fails if any of these values appear anywhere else.
 */
export const site = {
  brand: {
    name: "Post Saver",
    shortName: "Post Saver",
    tagline: "Save Posts Across All Platforms",
    description:
      "Save posts from Instagram, TikTok, YouTube, X, Reddit, LinkedIn and more — and find them all in one place.",
    colors: { from: "#099AFE", to: "#6636F2", ink: "#03112C" },
  },

  /** Main domain. Subdomains below are derived from it. */
  domain: "kerdostack.com",
  subdomains: { www: "www", embed: "embed", auth: "auth" },

  /** Resolver Worker base URL (no trailing slash). Filled in after the first Worker deploy. */
  apiBaseUrl: "",

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

export interface FirebaseWebConfig {
  apiKey: string;
  projectId: string;
  appId: string;
  messagingSenderId: string;
  storageBucket?: string;
}
