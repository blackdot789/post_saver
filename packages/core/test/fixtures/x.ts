import type { Fixture } from "./types.ts";

const ID = "1812345678901234567";
const canonical = `https://x.com/NASA/status/${ID}`;
const noUser = `https://x.com/i/status/${ID}`;

export const x: Fixture[] = [
  { from: "Android app share", input: `https://x.com/NASA/status/${ID}?t=Ab12Cd34Ef56Gh78&s=19`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "iOS app share", input: `https://x.com/NASA/status/${ID}?s=46&t=Ab12Cd34Ef56Gh78`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "Web address bar", input: `https://x.com/NASA/status/${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "Old twitter.com link", input: `https://twitter.com/NASA/status/${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "Old mobile.twitter.com link", input: `https://mobile.twitter.com/NASA/status/${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "Mobile web", input: `https://mobile.x.com/NASA/status/${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "www prefix", input: `https://www.x.com/NASA/status/${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "Typed without scheme", input: `x.com/NASA/status/${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "i/web/status (no username)", input: `https://x.com/i/web/status/${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: noUser },
  { from: "i/status (no username)", input: `https://twitter.com/i/status/${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: noUser },
  { from: "Photo viewer", input: `https://x.com/NASA/status/${ID}/photo/1`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "Video viewer", input: `https://x.com/NASA/status/${ID}/video/1`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "Analytics page", input: `https://x.com/NASA/status/${ID}/analytics`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "Very old statuses path", input: `https://twitter.com/NASA/statuses/${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "Embed code link", input: `https://twitter.com/NASA/status/${ID}?ref_src=twsrc%5Etfw`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "fxtwitter mirror", input: `https://fxtwitter.com/NASA/status/${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "vxtwitter mirror", input: `https://vxtwitter.com/NASA/status/${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "fixupx mirror", input: `https://fixupx.com/NASA/status/${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "fxtwitter direct-media mirror", input: `https://d.fxtwitter.com/NASA/status/${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "xcancel mirror", input: `https://xcancel.com/NASA/status/${ID}#m`, platform: "x", kind: "post", platformId: ID, canonicalUrl: canonical, author: "NASA" },
  { from: "First-ever tweet (real, short id)", input: "https://twitter.com/jack/status/20", platform: "x", kind: "post", platformId: "20", canonicalUrl: "https://x.com/jack/status/20", author: "jack" },
  { from: "Username with underscores", input: `https://x.com/space_fan_123/status/${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: `https://x.com/space_fan_123/status/${ID}`, author: "space_fan_123" },
  { from: "Like intent", input: `https://x.com/intent/like?tweet_id=${ID}`, platform: "x", kind: "post", platformId: ID, canonicalUrl: noUser },
  { from: "Profile", input: "https://x.com/NASA", platform: "x", kind: "profile", platformId: null, canonicalUrl: "https://x.com/NASA", author: "NASA" },
  { from: "Profile (old domain, lang)", input: "https://twitter.com/NASA?lang=en", platform: "x", kind: "profile", platformId: null, canonicalUrl: "https://x.com/NASA", author: "NASA" },
  { from: "Home timeline", input: "https://x.com/home", platform: "x", kind: "link", platformId: null, canonicalUrl: "https://x.com/home" },
  { from: "Search", input: "https://x.com/search?q=nasa&src=typed_query", platform: "x", kind: "link", platformId: null, canonicalUrl: "https://x.com/search?q=nasa&src=typed_query" },
  { from: "Hashtag page", input: "https://x.com/hashtag/space?s=21", platform: "x", kind: "link", platformId: null, canonicalUrl: "https://x.com/hashtag/space" },
  { from: "t.co wrapper (any site)", input: "https://t.co/AbCdEf1234", platform: "web", kind: "link", platformId: null, canonicalUrl: "https://t.co/AbCdEf1234", needsResolve: true },
];
