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
  /** The tallest the host shows a preview. Renderers that pick their own height stay within it. */
  maxHeight?: number;
  /** An upright video (a Short): drawn 9:16. */
  tall: boolean;
  /** Tells the host where the post ends and the platform's own footer begins. */
  fold(px: number | null): void;
}

// The host gives up after 25 s without a status, so everything here answers sooner: a script
// gets 10 s to load and 12 s to turn its placeholder into the post; an iframe gets 12 s to load.
// Generous on purpose: X's widget was measured taking 9 s on a cold start (2026-09-30).
const SCRIPT_TIMEOUT_MS = 10_000;
const WIDGET_MS = 12_000;
/** A platform iframe that hasn't loaded by now counts as blocked. */
const FRAME_LOAD_MS = 12_000;

// Instagram's embed page, measured on 2026-09-30 at 300–424 px wide: a 54 px header, the media
// (square to 4:5), then 154 px of "View more on Instagram", the like row, likes and "Add a
// comment…". The host folds the preview at the end of the media.
const IG_HEADER = 54;
const IG_BELOW_MEDIA = 154;
/** Facebook's post plugin can't be narrower than this, Pinterest's medium Pin is this wide. */
const FB_MIN_WIDTH = 350;
const PIN_WIDTH = 345;
const BSKY_MIN_WIDTH = 300;
/** The side padding of `#frame.pad` (embed.css), for embeds that draw their own card. */
const PAD = 12;

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

interface FrameOptions {
  height: number;
  title: string;
  allow?: string;
  /** For platform pages that don't report their height: the reader scrolls inside them. */
  scroll?: boolean;
}

function frame(src: string, { height, title, allow, scroll }: FrameOptions): HTMLIFrameElement {
  const el = document.createElement("iframe");
  el.src = src;
  el.title = title;
  el.width = "100%";
  el.height = String(Math.round(height));
  el.style.border = "0";
  el.style.display = "block";
  el.setAttribute("allowfullscreen", "");
  if (!scroll) el.setAttribute("scrolling", "no");
  el.referrerPolicy = "strict-origin-when-cross-origin";
  if (allow) el.allow = allow;
  return el;
}

/**
 * Puts a platform iframe on the page and waits for it to load. A frame that hasn't loaded in
 * time is most likely blocked (a network filter, an ad-blocker): the host shows a link card
 * with "Try again" instead of an empty box.
 */
function mount(root: HTMLElement, el: HTMLIFrameElement): Promise<Status> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      el.remove();
      resolve("blocked");
    }, FRAME_LOAD_MS);
    el.addEventListener(
      "load",
      () => {
        clearTimeout(timer);
        resolve("ok");
      },
      { once: true },
    );
    root.append(el);
  });
}

/** Scales a widget that can't be narrower than `natural` down to the width there is. */
function fit(el: HTMLElement, natural: number, width: number): void {
  if (width >= natural) return;
  el.style.width = `${natural}px`;
  el.style.setProperty("zoom", String(width / natural));
}

/** Follows height messages a platform's iframe posts to its parent (us). */
function followHeight(el: HTMLIFrameElement, origin: string, pick: (data: unknown) => number | undefined, onHeight?: (height: number) => void): void {
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
    if (height && height > 50 && height < 10_000) {
      el.height = String(Math.round(height));
      onHeight?.(height);
    }
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
  async instagram(embed, { root, width, fold }) {
    // Without the caption: the card shows the post, and the rest is one tap away on Instagram.
    const el = frame(`https://www.instagram.com/p/${embed.code}/embed/`, { height: IG_HEADER + width * 1.25 + IG_BELOW_MEDIA, title: "Instagram post" });
    followHeight(
      el,
      "https://www.instagram.com",
      (d) => (get(d, "type") === "MEASURE" ? num(get(d, "details", "height")) : undefined),
      (height) => fold(height - IG_BELOW_MEDIA > IG_HEADER + 100 ? height - IG_BELOW_MEDIA : null),
    );
    return mount(root, el);
  },

  async x(embed, { root, theme }) {
    root.classList.add("pad");
    await loadScript("https://platform.twitter.com/widgets.js");
    const tweet = window.twttr?.widgets.createTweet(embed.id, root, { theme, dnt: true, align: "center", conversation: "none" });
    if (!tweet) return "blocked";
    // Resolves with the tweet's element, or with nothing when X no longer has the post.
    const el = await Promise.race([tweet, new Promise<"slow">((resolve) => setTimeout(() => resolve("slow"), WIDGET_MS))]);
    if (el === "slow") return "blocked";
    return el ? "ok" : "unavailable";
  },

  async tiktok(embed, { root, width, maxHeight }) {
    const height = Math.min(Math.round((width * 16) / 9), maxHeight ?? Infinity);
    return mount(
      root,
      frame(`https://www.tiktok.com/player/v1/${embed.id}?autoplay=0&rel=0&description=1&music_info=1`, {
        height,
        title: "TikTok video",
        allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
      }),
    );
  },

  async youtube(embed, { root, width, maxHeight, tall }) {
    // A facade: the thumbnail first, the player only on a click (YouTube's rules: ≥ 200×200).
    const height = tall ? Math.max(200, Math.min(Math.round((width * 16) / 9), maxHeight ?? Infinity)) : Math.max(200, Math.round((width * 9) / 16));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "yt-facade";
    button.style.height = `${height}px`;
    button.setAttribute("aria-label", "Play video");
    const img = document.createElement("img");
    img.alt = "";
    // hqdefault.jpg exists for every video. It is 4:3 with black bars above and below the
    // picture, which the "bars" style crops away.
    const landscape = () => {
      img.className = "bars";
      img.src = `https://i.ytimg.com/vi/${embed.id}/hqdefault.jpg`;
    };
    if (tall) {
      // Shorts have an upright thumbnail; a video without one answers with a tiny placeholder.
      img.addEventListener("load", () => {
        if (img.naturalWidth <= 120 && !img.className) landscape();
      });
      img.addEventListener("error", () => {
        if (!img.className) landscape();
      });
      img.src = `https://i.ytimg.com/vi/${embed.id}/oar2.jpg`;
    } else {
      landscape();
    }
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
    root.classList.add("pad");
    const path = embed.subreddit ? `/r/${embed.subreddit}/comments/${embed.postId}/` : `/comments/${embed.postId}/`;
    const comment = embed.commentId ? `comment/${embed.commentId}/` : "";
    const el = frame(`https://embed.reddit.com${path}${comment}?embed=true&ref_source=embed&ref=share&showmedia=true&theme=${theme}`, {
      height: 320,
      title: "Reddit post",
    });
    followHeight(el, "https://embed.reddit.com", (d) => (get(d, "type") === "resize.embed" ? num(get(d, "data")) : undefined));
    return mount(root, el);
  },

  async facebook(embed, { root, width, theme }) {
    // The SDK renders the plugin and keeps its iframe's height right.
    const fbRoot = document.createElement("div");
    fbRoot.id = "fb-root";
    const holder = document.createElement("div");
    const pluginWidth = Math.min(750, Math.max(FB_MIN_WIDTH, Math.round(width)));
    fit(holder, pluginWidth, width);
    const plugin = document.createElement("div");
    plugin.className = embed.type === "video" ? "fb-video" : "fb-post";
    plugin.dataset.href = embed.href;
    plugin.dataset.width = String(pluginWidth);
    plugin.dataset.showText = "true";
    plugin.dataset.colorscheme = theme;
    holder.append(plugin);
    root.append(fbRoot, holder);
    const rendered = new Promise<void>((resolve) => {
      window.addEventListener("fb-rendered", () => resolve(), { once: true });
    });
    await loadScript("https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v21.0");
    window.FB?.Event.subscribe("xfbml.render", () => window.dispatchEvent(new Event("fb-rendered")));
    window.FB?.XFBML.parse(root);
    await Promise.race([rendered, new Promise((r) => setTimeout(r, WIDGET_MS))]);
    return "ok";
  },

  async linkedin(embed, { root, maxHeight }) {
    // LinkedIn's page doesn't say how tall it is: it gets the tallest preview, and scrolls inside.
    return mount(root, frame(`https://www.linkedin.com/embed/feed/update/${embed.urn}`, { height: maxHeight ?? 570, title: "LinkedIn post", scroll: true }));
  },

  async threads(embed, { root }) {
    root.classList.add("pad");
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
    // embed.js puts the post's iframe in; our plain link was only there for it to find.
    if (!(await until(() => !!root.querySelector("iframe"), WIDGET_MS))) return "blocked";
    link.remove();
    return "ok";
  },

  async pinterest(embed, { root, width }) {
    root.classList.add("center");
    const holder = document.createElement("div");
    holder.style.width = `${PIN_WIDTH}px`;
    fit(holder, PIN_WIDTH, width);
    const link = document.createElement("a");
    link.dataset.pinDo = "embedPin";
    link.dataset.pinWidth = "medium";
    link.href = `https://www.pinterest.com/pin/${embed.id}/`;
    holder.append(link);
    root.append(holder);
    await loadScript("https://assets.pinterest.com/js/pinit.js");
    // pinit.js replaces the link with the Pin; a Pin that doesn't exist leaves it in place.
    return (await until(() => !holder.contains(link), WIDGET_MS)) ? "ok" : "unavailable";
  },

  async bluesky(embed, { root, theme, width }) {
    root.classList.add("pad");
    // The page answers with { id, height } messages, as it does to Bluesky's own embed.js.
    const el = frame(`https://embed.bsky.app/embed/${embed.did}/app.bsky.feed.post/${embed.rkey}?id=1&colorMode=${theme}`, { height: 320, title: "Bluesky post" });
    followHeight(el, "https://embed.bsky.app", (d) => (get(d, "id") !== undefined ? num(get(d, "height")) : undefined));
    // Bluesky's card has a minimum width (min-w-[300px], seen 2026-09-30).
    fit(el, BSKY_MIN_WIDTH, width - 2 * PAD);
    return mount(root, el);
  },
};

export function render(embed: Embed, ctx: Context): Promise<Status> {
  const renderer = renderers[embed.platform] as (e: Embed, c: Context) => Promise<Status>;
  return renderer(embed, ctx);
}
