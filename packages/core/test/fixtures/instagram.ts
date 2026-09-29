import type { Fixture } from "./types.ts";

const CODE = "C8xYz12AbCd";
const post = `https://www.instagram.com/p/${CODE}/`;
const reel = `https://www.instagram.com/reel/${CODE}/`;

export const instagram: Fixture[] = [
  { from: "Android app share (reel)", input: `https://www.instagram.com/reel/${CODE}/?igsh=MWQ1ZGUxMzBkMA==`, platform: "instagram", kind: "reel", platformId: CODE, canonicalUrl: reel },
  { from: "iOS app share (post)", input: `https://www.instagram.com/p/${CODE}/?igsh=NTc4MTIwNjQ2YQ==`, platform: "instagram", kind: "post", platformId: CODE, canonicalUrl: post },
  { from: "Web copy link", input: `https://www.instagram.com/p/${CODE}/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==`, platform: "instagram", kind: "post", platformId: CODE, canonicalUrl: post },
  { from: "Web carousel slide", input: `https://www.instagram.com/p/${CODE}/?img_index=3`, platform: "instagram", kind: "post", platformId: CODE, canonicalUrl: post },
  { from: "Web reels tab", input: `https://www.instagram.com/reels/${CODE}/`, platform: "instagram", kind: "reel", platformId: CODE, canonicalUrl: reel },
  { from: "Old IGTV link", input: "https://www.instagram.com/tv/CAbCdEfGhIj/", platform: "instagram", kind: "video", platformId: "CAbCdEfGhIj", canonicalUrl: "https://www.instagram.com/tv/CAbCdEfGhIj/" },
  { from: "Web, username in path (post)", input: `https://www.instagram.com/natgeo/p/${CODE}/`, platform: "instagram", kind: "post", platformId: CODE, canonicalUrl: post, author: "natgeo" },
  { from: "Web, username in path (reel)", input: `https://www.instagram.com/NatGeo/reel/${CODE}/?hl=en`, platform: "instagram", kind: "reel", platformId: CODE, canonicalUrl: reel, author: "natgeo" },
  { from: "Typed without www", input: `https://instagram.com/p/${CODE}`, platform: "instagram", kind: "post", platformId: CODE, canonicalUrl: post },
  { from: "Mobile web", input: `https://m.instagram.com/p/${CODE}/`, platform: "instagram", kind: "post", platformId: CODE, canonicalUrl: post },
  { from: "Typed without scheme", input: `instagram.com/reel/${CODE}/`, platform: "instagram", kind: "reel", platformId: CODE, canonicalUrl: reel },
  { from: "Old instagr.am short domain", input: `http://instagr.am/p/${CODE}/`, platform: "instagram", kind: "post", platformId: CODE, canonicalUrl: post },
  { from: "Private-account post (long code)", input: "https://www.instagram.com/p/C8xYz12AbCdEfGhIjKlMnOpQrStUvWxYz0123/", platform: "instagram", kind: "post", platformId: "C8xYz12AbCdEfGhIjKlMnOpQrStUvWxYz0123", canonicalUrl: "https://www.instagram.com/p/C8xYz12AbCdEfGhIjKlMnOpQrStUvWxYz0123/" },
  { from: "Code with - and _", input: "https://www.instagram.com/reel/C-_xYz12AbC/", platform: "instagram", kind: "reel", platformId: "C-_xYz12AbC", canonicalUrl: "https://www.instagram.com/reel/C-_xYz12AbC/" },
  { from: "Embed URL", input: `https://www.instagram.com/p/${CODE}/embed/captioned/`, platform: "instagram", kind: "post", platformId: CODE, canonicalUrl: post },
  { from: "Chat-app fixer mirror", input: `https://www.ddinstagram.com/reel/${CODE}/`, platform: "instagram", kind: "reel", platformId: CODE, canonicalUrl: reel },
  { from: "Uppercase scheme and host", input: `HTTPS://WWW.INSTAGRAM.COM/p/${CODE}/`, platform: "instagram", kind: "post", platformId: CODE, canonicalUrl: post },
  { from: "Link with a fragment", input: `https://www.instagram.com/p/${CODE}/#comments`, platform: "instagram", kind: "post", platformId: CODE, canonicalUrl: post },
  { from: "Android intent link", input: `intent://www.instagram.com/p/${CODE}/#Intent;package=com.instagram.android;scheme=https;end`, platform: "instagram", kind: "post", platformId: CODE, canonicalUrl: post },
  { from: "App share link (reel)", input: "https://www.instagram.com/share/reel/BAabc123XYZ/", platform: "instagram", kind: "reel", platformId: null, canonicalUrl: "https://www.instagram.com/share/reel/BAabc123XYZ/", needsResolve: true },
  { from: "App share link (post, igsh)", input: "https://www.instagram.com/share/p/BAabc123XYZ/?igsh=YzljYTk1ODg3Zg==", platform: "instagram", kind: "post", platformId: null, canonicalUrl: "https://www.instagram.com/share/p/BAabc123XYZ/", needsResolve: true },
  { from: "App share link (no type)", input: "https://www.instagram.com/share/BAabc123XYZ", platform: "instagram", kind: "post", platformId: null, canonicalUrl: "https://www.instagram.com/share/BAabc123XYZ", needsResolve: true },
  { from: "Story share", input: "https://www.instagram.com/stories/natgeo/3412345678901234567/?utm_source=ig_story_item_share&igsh=MWJ0bWx2", platform: "instagram", kind: "story", platformId: null, canonicalUrl: "https://www.instagram.com/stories/natgeo/3412345678901234567/", author: "natgeo" },
  { from: "Highlight", input: "https://www.instagram.com/stories/highlights/17912345678901234/", platform: "instagram", kind: "story", platformId: null, canonicalUrl: "https://www.instagram.com/stories/highlights/17912345678901234/" },
  { from: "Highlight share link", input: "https://www.instagram.com/s/aGlnaGxpZ2h0OjE3OTEyMzQ1Njc4OTAxMjM0?story_media_id=3412345678901234567_123&igsh=MTc4", platform: "instagram", kind: "story", platformId: null, canonicalUrl: "https://www.instagram.com/s/aGlnaGxpZ2h0OjE3OTEyMzQ1Njc4OTAxMjM0?story_media_id=3412345678901234567_123" },
  { from: "Profile (web)", input: "https://www.instagram.com/natgeo/?hl=en", platform: "instagram", kind: "profile", platformId: null, canonicalUrl: "https://www.instagram.com/natgeo/", author: "natgeo" },
  { from: "Profile (app share)", input: "https://www.instagram.com/natgeo?igsh=MWx0dW9ubXZ3eDQ3Mw==", platform: "instagram", kind: "profile", platformId: null, canonicalUrl: "https://www.instagram.com/natgeo/", author: "natgeo" },
  { from: "Explore tag page", input: "https://www.instagram.com/explore/tags/travel/", platform: "instagram", kind: "link", platformId: null, canonicalUrl: "https://www.instagram.com/explore/tags/travel/" },
  { from: "Reel audio page (not a post)", input: "https://www.instagram.com/reels/audio/1234567890123456/", platform: "instagram", kind: "link", platformId: null, canonicalUrl: "https://www.instagram.com/reels/audio/1234567890123456/" },
  { from: "Outbound link wrapper", input: "https://l.instagram.com/?u=https%3A%2F%2Fexample.com%2Farticle%3Futm_source%3Dig&e=AT1abc", platform: "web", kind: "link", platformId: null, canonicalUrl: "https://example.com/article" },
];
