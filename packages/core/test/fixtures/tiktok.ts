import type { Fixture } from "./types.ts";

// 6718335390845095173 by @scout2015 is the example in TikTok's own embed docs.
const ID = "6718335390845095173";
const canonical = `https://www.tiktok.com/@scout2015/video/${ID}`;
const noUser = `https://www.tiktok.com/@/video/${ID}`;

export const tiktok: Fixture[] = [
  { from: "Android app share", input: "https://vm.tiktok.com/ZMhvqjXXX/", platform: "tiktok", kind: "video", platformId: null, canonicalUrl: "https://vm.tiktok.com/ZMhvqjXXX/", needsResolve: true },
  { from: "Android app share (no slash)", input: "https://vm.tiktok.com/ZMhvqjXXX", platform: "tiktok", kind: "video", platformId: null, canonicalUrl: "https://vm.tiktok.com/ZMhvqjXXX", needsResolve: true },
  { from: "Android app share (vt)", input: "https://vt.tiktok.com/ZSabc123/", platform: "tiktok", kind: "video", platformId: null, canonicalUrl: "https://vt.tiktok.com/ZSabc123/", needsResolve: true },
  { from: "iOS app share", input: "https://www.tiktok.com/t/ZTRabc123/", platform: "tiktok", kind: "video", platformId: null, canonicalUrl: "https://www.tiktok.com/t/ZTRabc123/", needsResolve: true },
  { from: "Web address bar", input: canonical, platform: "tiktok", kind: "video", platformId: ID, canonicalUrl: canonical, author: "scout2015" },
  { from: "Web copy link", input: `${canonical}?is_from_webapp=1&sender_device=pc&web_id=7312345678901234567`, platform: "tiktok", kind: "video", platformId: ID, canonicalUrl: canonical, author: "scout2015" },
  { from: "App link opened in browser", input: `${canonical}?_r=1&_t=8oAbCdEfGhI`, platform: "tiktok", kind: "video", platformId: ID, canonicalUrl: canonical, author: "scout2015" },
  { from: "Uppercase username", input: `https://www.tiktok.com/@Scout2015/video/${ID}`, platform: "tiktok", kind: "video", platformId: ID, canonicalUrl: canonical, author: "scout2015" },
  { from: "Typed without scheme", input: `tiktok.com/@scout2015/video/${ID}`, platform: "tiktok", kind: "video", platformId: ID, canonicalUrl: canonical, author: "scout2015" },
  { from: "Username with . and _", input: "https://www.tiktok.com/@the_real.user/video/7106594312292453675", platform: "tiktok", kind: "video", platformId: "7106594312292453675", canonicalUrl: "https://www.tiktok.com/@the_real.user/video/7106594312292453675", author: "the_real.user" },
  { from: "Photo post", input: "https://www.tiktok.com/@khaby.lame/photo/7301234567890123456", platform: "tiktok", kind: "photo", platformId: "7301234567890123456", canonicalUrl: "https://www.tiktok.com/@khaby.lame/photo/7301234567890123456", author: "khaby.lame" },
  { from: "Old mobile link", input: `https://m.tiktok.com/v/${ID}.html`, platform: "tiktok", kind: "video", platformId: ID, canonicalUrl: noUser },
  { from: "Embed v2", input: `https://www.tiktok.com/embed/v2/${ID}`, platform: "tiktok", kind: "video", platformId: ID, canonicalUrl: noUser },
  { from: "Embed", input: `https://www.tiktok.com/embed/${ID}`, platform: "tiktok", kind: "video", platformId: ID, canonicalUrl: noUser },
  { from: "Player", input: `https://www.tiktok.com/player/v1/${ID}?autoplay=0`, platform: "tiktok", kind: "video", platformId: ID, canonicalUrl: noUser },
  { from: "tiktokv share page", input: `https://www.tiktokv.com/share/video/${ID}/`, platform: "tiktok", kind: "video", platformId: ID, canonicalUrl: noUser },
  { from: "Profile", input: "https://www.tiktok.com/@scout2015?lang=en", platform: "tiktok", kind: "profile", platformId: null, canonicalUrl: "https://www.tiktok.com/@scout2015", author: "scout2015" },
  { from: "Live", input: "https://www.tiktok.com/@scout2015/live", platform: "tiktok", kind: "live", platformId: null, canonicalUrl: "https://www.tiktok.com/@scout2015/live", author: "scout2015" },
  { from: "Sound page", input: "https://www.tiktok.com/music/original-sound-7012345678901234567", platform: "tiktok", kind: "link", platformId: null, canonicalUrl: "https://www.tiktok.com/music/original-sound-7012345678901234567" },
  { from: "Tag page", input: "https://www.tiktok.com/tag/cats", platform: "tiktok", kind: "link", platformId: null, canonicalUrl: "https://www.tiktok.com/tag/cats" },
];
