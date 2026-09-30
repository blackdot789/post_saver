// One renderer per platform (CLAUDE.md §6.6): the platform's direct iframe where one exists,
// otherwise its official script. Everything here runs on embed.<domain>, never on the main
// origin. Ids arrive validated (core's paramsToEmbed) and are only ever placed in URLs and
// data attributes, never in HTML.
import type { Embed, EmbedTheme } from "@postsaver/core";

export type Status = "ok" | "unavailable" | "blocked";

export interface Context {
  root: HTMLElement;
  theme: EmbedTheme;
  /** The frame's width in CSS pixels. */
  width: number;
}

const SCRIPT_TIMEOUT_MS = 12_000;

declare global {
  interface Window {
    twttr?: { widgets: { createTweet(id: string, el: HTMLElement, options?: Record<string, unknown>): Promise<HTMLElement | undefined> } };
    FB?: { XFBML: { parse(el?: HTMLElement): void }; Event: { subscribe(event: string, cb: () => void): void } };
  }
}

/** Loads a platform script once. Rejects when it fails to load (ad-blocker, network). */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.loaded) return resolve();
    const script = existing ?? document.createElement("script");
    const timer = setTimeout(() => reject(new Error("timeout")), SCRIPT_TIMEOUT_MS);
    script.addEventListener("load", () => {
      clearTimeout(timer);
      script.dataset.loaded = "1";
      resolve();
    });
    script.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("blocked"));
    });
    if (!existing) {
      script.async = true;
      script.src = src;
      document.head.append(script);
    }
  });
}

function frame(src: string, { height, title, allow }: { height: number; title: string; allow?: string }): HTMLIFrameElement {
  const el = document.createElement("iframe");
  el.src = src;
  el.title = title;
  el.width = "100%";
  el.height = String(Math.round(height));
  el.style.border = "0";
  el.style.display = "block";
  el.setAttribute("allowfullscreen", "");
  el.setAttribute("scrolling", "no");
  el.referrerPolicy = "strict-origin-when-cross-origin";
  if (allow) el.allow = allow;
  return el;
}

/** Follows height messages a platform's iframe posts to its parent (us). */
function followHeight(el: HTMLIFrameElement, origin: string, pick: (data: unknown) => number | undefined): void {
  window.addEventListener("message", (event) => {
    if (event.origin !== origin || event.source !== el.contentWindow) return;
    let data: unknown = event.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    const height = pick(data);
    if (height && height > 50 && height < 10_000) el.height = String(Math.round(height));
  });
}

const get = (data: unknown, ...path: string[]): unknown => path.reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), data);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined);

/** Waits until `test` holds, checking every 250 ms, for up to `ms`. */
function until(test: () => boolean, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (test()) resolve(true);
      else if (Date.now() - started > ms) resolve(false);
      else setTimeout(tick, 250);
    };
    tick();
  });
}

const renderers: { [P in Embed["platform"]]: (embed: Extract<Embed, { platform: P }>, ctx: Context) => Promise<Status> } = {
  async instagram(embed, { root }) {
    const el = frame(`https://www.instagram.com/p/${embed.code}/embed/captioned/`, { height: 620, title: "Instagram post" });
    followHeight(el, "https://www.instagram.com", (d) => (get(d, "type") === "MEASURE" ? num(get(d, "details", "height")) : undefined));
    root.append(el);
    return "ok";
  },

  async x(embed, { root, theme }) {
    await loadScript("https://platform.twitter.com/widgets.js");
    const el = await window.twttr?.widgets.createTweet(embed.id, root, { theme, dnt: true, align: "center", conversation: "none" });
    return el ? "ok" : "unavailable";
  },

  async tiktok(embed, { root, width }) {
    root.append(
      frame(`https://www.tiktok.com/player/v1/${embed.id}?autoplay=0&rel=0&description=1&music_info=1`, {
        height: Math.min(width, 420) * (16 / 9) + 40,
        title: "TikTok video",
        allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
      }),
    );
    return "ok";
  },

  async youtube(embed, { root, width }) {
    // A facade: the thumbnail first, the player only on a click (YouTube's rules: ≥ 200×200).
    const height = Math.max(200, Math.round((width * 9) / 16));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "yt-facade";
    button.style.height = `${height}px`;
    button.setAttribute("aria-label", "Play video");
    const img = document.createElement("img");
    img.src = `https://i.ytimg.com/vi/${embed.id}/hqdefault.jpg`;
    img.alt = "";
    img.loading = "lazy";
    const play = document.createElement("span");
    play.className = "yt-play";
    button.append(img, play);
    button.addEventListener("click", () => {
      const start = embed.start ? `&start=${embed.start}` : "";
      const player = frame(`https://www.youtube-nocookie.com/embed/${embed.id}?autoplay=1&rel=0${start}`, {
        height,
        title: "YouTube video",
        allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
      });
      button.replaceWith(player);
    });
    root.append(button);
    return "ok";
  },

  async reddit(embed, { root, theme }) {
    const path = embed.subreddit ? `/r/${embed.subreddit}/comments/${embed.postId}/` : `/comments/${embed.postId}/`;
    const comment = embed.commentId ? `comment/${embed.commentId}/` : "";
    const el = frame(`https://embed.reddit.com${path}${comment}?embed=true&ref_source=embed&ref=share&showmedia=true&theme=${theme}`, {
      height: 520,
      title: "Reddit post",
    });
    followHeight(el, "https://embed.reddit.com", (d) => (get(d, "type") === "resize.embed" ? num(get(d, "data")) : undefined));
    root.append(el);
    return "ok";
  },

  async facebook(embed, { root, width, theme }) {
    // The SDK renders the plugin and keeps its iframe's height right.
    const fbRoot = document.createElement("div");
    fbRoot.id = "fb-root";
    const plugin = document.createElement("div");
    plugin.className = embed.type === "video" ? "fb-video" : "fb-post";
    plugin.dataset.href = embed.href;
    plugin.dataset.width = String(Math.min(750, Math.max(350, Math.round(width))));
    plugin.dataset.showText = "true";
    plugin.dataset.colorscheme = theme;
    root.append(fbRoot, plugin);
    const rendered = new Promise<void>((resolve) => {
      window.addEventListener("fb-rendered", () => resolve(), { once: true });
    });
    await loadScript("https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v21.0");
    window.FB?.Event.subscribe("xfbml.render", () => window.dispatchEvent(new Event("fb-rendered")));
    window.FB?.XFBML.parse(root);
    await Promise.race([rendered, new Promise((r) => setTimeout(r, SCRIPT_TIMEOUT_MS))]);
    return "ok";
  },

  async linkedin(embed, { root }) {
    root.append(frame(`https://www.linkedin.com/embed/feed/update/${embed.urn}`, { height: 570, title: "LinkedIn post" }));
    return "ok";
  },

  async threads(embed, { root }) {
    const permalink = embed.user ? `https://www.threads.com/@${embed.user}/post/${embed.code}` : `https://www.threads.com/t/${embed.code}`;
    const quote = document.createElement("blockquote");
    quote.className = "text-post-media";
    quote.dataset.textPostPermalink = permalink;
    quote.dataset.textPostVersion = "0";
    const link = document.createElement("a");
    link.href = permalink;
    link.textContent = "View on Threads";
    link.rel = "noopener noreferrer";
    link.target = "_blank";
    quote.append(link);
    root.append(quote);
    await loadScript("https://www.threads.com/embed.js");
    return "ok";
  },

  async pinterest(embed, { root }) {
    const link = document.createElement("a");
    link.dataset.pinDo = "embedPin";
    link.dataset.pinWidth = "medium";
    link.href = `https://www.pinterest.com/pin/${embed.id}/`;
    root.append(link);
    await loadScript("https://assets.pinterest.com/js/pinit.js");
    // pinit.js replaces the link with the Pin; a Pin that doesn't exist leaves it in place.
    return (await until(() => !root.contains(link), 8000)) ? "ok" : "unavailable";
  },

  async bluesky(embed, { root }) {
    const el = frame(`https://embed.bsky.app/embed/${embed.did}/app.bsky.feed.post/${embed.rkey}?id=1`, { height: 320, title: "Bluesky post" });
    followHeight(el, "https://embed.bsky.app", (d) => (get(d, "type") === "height" ? num(get(d, "height")) : undefined));
    root.append(el);
    return "ok";
  },
};

export function render(embed: Embed, ctx: Context): Promise<Status> {
  const renderer = renderers[embed.platform] as (e: Embed, c: Context) => Promise<Status>;
  return renderer(embed, ctx);
}
