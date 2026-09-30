// The service worker (CLAUDE.md §6.1, §6.10): lets the app's pages open without a connection,
// so a post can be shared to the app on a train or in a lift. `pnpm build` turns this template
// into /sw.js, filling in the three placeholders below from the files it built.
//
// - Pages (/app/, /save/, /share/, …) come from the network when it answers within 3 seconds,
//   so a new version shows up at once; otherwise from the copy kept here.
// - Scripts, styles, fonts and icons come from the copy kept here (their names change whenever
//   their content does), otherwise from the network.
// - Everything else (the landing page, other sites, Firebase, the embed sandbox) is left alone.
//
// A new version installs next to the old one and takes over when every tab of the old one is
// closed, so a page never gets files from two versions.

const VERSION = "__VERSION__";
const CACHE = `ps-shell-${VERSION}`;
/** @type {string[]} Every file kept for offline use. */
const FILES = __FILES__;
/** @type {Set<string>} The pages among them, as paths ending in "/". */
const PAGES = new Set(__PAGES__);
const KEPT = new Set(FILES);
const PAGE_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) => {
  // cache: "reload" skips the browser's HTTP cache, so the copy matches this version exactly.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((url) => new Request(url, { cache: "reload" })))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("ps-shell-") && name !== CACHE).map((name) => caches.delete(name)))),
  );
});

const kept = (path) => caches.open(CACHE).then((cache) => cache.match(path));

async function page(request, path) {
  const copy = await kept(path);
  // The request is passed on untouched: a navigation can't be re-made with other options.
  const fresh = fetch(request);
  // Without a copy to fall back on, the network gets all the time it needs.
  if (!copy) return fresh;
  const answer = await Promise.race([fresh.catch(() => null), new Promise((resolve) => setTimeout(resolve, PAGE_TIMEOUT_MS, null))]);
  return answer && answer.ok ? answer : copy;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
    if (PAGES.has(path)) event.respondWith(page(request, path));
    return;
  }
  if (KEPT.has(url.pathname)) event.respondWith(kept(url.pathname).then((copy) => copy || fetch(request)));
});
