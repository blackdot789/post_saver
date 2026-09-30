import { origins } from "@postsaver/config";

/** Where the embed sandbox lives: embed.<domain>, or a local preview server in test builds. */
export const embedOrigin: string = import.meta.env.VITE_EMBED_ORIGIN || origins.embed;
