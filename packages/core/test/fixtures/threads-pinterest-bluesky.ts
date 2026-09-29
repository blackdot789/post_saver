import type { Fixture } from "./types.ts";

const CODE = "C8AbCdEfGhI";
const thread = `https://www.threads.com/@zuck/post/${CODE}`;

export const threads: Fixture[] = [
  { from: "Android app share", input: `${thread}?xmt=AQGzAbCdEfGh`, platform: "threads", kind: "post", platformId: CODE, canonicalUrl: thread, author: "zuck" },
  { from: "Old threads.net link", input: `https://www.threads.net/@zuck/post/${CODE}?slof=1`, platform: "threads", kind: "post", platformId: CODE, canonicalUrl: thread, author: "zuck" },
  { from: "Typed without scheme", input: `threads.com/@zuck/post/${CODE}`, platform: "threads", kind: "post", platformId: CODE, canonicalUrl: thread, author: "zuck" },
  { from: "No www", input: `https://threads.net/@zuck/post/${CODE}`, platform: "threads", kind: "post", platformId: CODE, canonicalUrl: thread, author: "zuck" },
  { from: "Media viewer", input: `${thread}/media`, platform: "threads", kind: "post", platformId: CODE, canonicalUrl: thread, author: "zuck" },
  { from: "Uppercase username", input: `https://www.threads.com/@Zuck/post/${CODE}`, platform: "threads", kind: "post", platformId: CODE, canonicalUrl: thread, author: "zuck" },
  { from: "Code with - and _", input: "https://www.threads.com/@mosseri/post/DA-b_CdEfGh", platform: "threads", kind: "post", platformId: "DA-b_CdEfGh", canonicalUrl: "https://www.threads.com/@mosseri/post/DA-b_CdEfGh", author: "mosseri" },
  { from: "Early /t/ link", input: "https://www.threads.net/t/CuXFPIeLLod/", platform: "threads", kind: "post", platformId: "CuXFPIeLLod", canonicalUrl: "https://www.threads.com/t/CuXFPIeLLod" },
  { from: "Profile", input: "https://www.threads.com/@zuck", platform: "threads", kind: "profile", platformId: null, canonicalUrl: "https://www.threads.com/@zuck", author: "zuck" },
  { from: "Search", input: "https://www.threads.com/search?q=ai", platform: "threads", kind: "link", platformId: null, canonicalUrl: "https://www.threads.com/search?q=ai" },
  { from: "Outbound link wrapper", input: "https://l.threads.com/?u=https%3A%2F%2Fexample.com%2Fpost&e=AT0abc", platform: "web", kind: "link", platformId: null, canonicalUrl: "https://example.com/post" },
];

const PIN = "123456789012345678";
const pin = `https://www.pinterest.com/pin/${PIN}/`;

export const pinterest: Fixture[] = [
  { from: "Android/iOS app share", input: "https://pin.it/4AbCdEfGh", platform: "pinterest", kind: "pin", platformId: null, canonicalUrl: "https://pin.it/4AbCdEfGh", needsResolve: true },
  { from: "Web", input: pin, platform: "pinterest", kind: "pin", platformId: PIN, canonicalUrl: pin },
  { from: "India subdomain", input: `https://in.pinterest.com/pin/${PIN}/`, platform: "pinterest", kind: "pin", platformId: PIN, canonicalUrl: pin },
  { from: "Brazil subdomain", input: `https://br.pinterest.com/pin/${PIN}/`, platform: "pinterest", kind: "pin", platformId: PIN, canonicalUrl: pin },
  { from: "UK domain", input: `https://www.pinterest.co.uk/pin/${PIN}/`, platform: "pinterest", kind: "pin", platformId: PIN, canonicalUrl: pin },
  { from: "Australia domain", input: `https://www.pinterest.com.au/pin/${PIN}/`, platform: "pinterest", kind: "pin", platformId: PIN, canonicalUrl: pin },
  { from: "Germany domain", input: `https://www.pinterest.de/pin/${PIN}/`, platform: "pinterest", kind: "pin", platformId: PIN, canonicalUrl: pin },
  { from: "Japan domain", input: `https://www.pinterest.jp/pin/${PIN}/`, platform: "pinterest", kind: "pin", platformId: PIN, canonicalUrl: pin },
  { from: "Title slug before the id", input: `https://www.pinterest.com/pin/cozy-living-room-ideas--${PIN}/`, platform: "pinterest", kind: "pin", platformId: PIN, canonicalUrl: pin },
  { from: "Sent to a friend", input: `https://www.pinterest.com/pin/${PIN}/sent/?invite_code=AbCd&sender=123&sfo=1`, platform: "pinterest", kind: "pin", platformId: PIN, canonicalUrl: pin },
  { from: "Login redirect param", input: `https://www.pinterest.com/pin/${PIN}/?mt=login`, platform: "pinterest", kind: "pin", platformId: PIN, canonicalUrl: pin },
  { from: "Typed without scheme", input: `pinterest.com/pin/${PIN}`, platform: "pinterest", kind: "pin", platformId: PIN, canonicalUrl: pin },
  { from: "Profile", input: "https://www.pinterest.com/nasa/", platform: "pinterest", kind: "profile", platformId: null, canonicalUrl: "https://www.pinterest.com/nasa/", author: "nasa" },
  { from: "Board", input: "https://www.pinterest.com/nasa/space-photos/", platform: "pinterest", kind: "link", platformId: null, canonicalUrl: "https://www.pinterest.com/nasa/space-photos/" },
  { from: "Ideas page", input: "https://www.pinterest.com/ideas/home-decor/935249274030/", platform: "pinterest", kind: "link", platformId: null, canonicalUrl: "https://www.pinterest.com/ideas/home-decor/935249274030/" },
];

// did:plc:z72i7hdynmk6r22z27h6tvur is the real DID of the bsky.app account.
const DID = "did:plc:z72i7hdynmk6r22z27h6tvur";
const RKEY = "3l6oveex3ii2l";
const didPost = `https://bsky.app/profile/${DID}/post/${RKEY}`;

export const bluesky: Fixture[] = [
  { from: "App share (handle)", input: `https://bsky.app/profile/bsky.app/post/${RKEY}`, platform: "bluesky", kind: "post", platformId: null, canonicalUrl: `https://bsky.app/profile/bsky.app/post/${RKEY}`, author: "bsky.app", needsResolve: true },
  { from: "Custom-domain handle", input: `https://bsky.app/profile/nytimes.com/post/${RKEY}`, platform: "bluesky", kind: "post", platformId: null, canonicalUrl: `https://bsky.app/profile/nytimes.com/post/${RKEY}`, author: "nytimes.com", needsResolve: true },
  { from: "Uppercase handle", input: `https://bsky.app/profile/Jay.BSKY.team/post/${RKEY}`, platform: "bluesky", kind: "post", platformId: null, canonicalUrl: `https://bsky.app/profile/jay.bsky.team/post/${RKEY}`, author: "jay.bsky.team", needsResolve: true },
  { from: "fxbsky mirror", input: `https://fxbsky.app/profile/bsky.app/post/${RKEY}`, platform: "bluesky", kind: "post", platformId: null, canonicalUrl: `https://bsky.app/profile/bsky.app/post/${RKEY}`, author: "bsky.app", needsResolve: true },
  { from: "Web (DID)", input: didPost, platform: "bluesky", kind: "post", platformId: `${DID}_${RKEY}`, canonicalUrl: didPost },
  { from: "Web (encoded DID)", input: `https://bsky.app/profile/did%3Aplc%3Az72i7hdynmk6r22z27h6tvur/post/${RKEY}`, platform: "bluesky", kind: "post", platformId: `${DID}_${RKEY}`, canonicalUrl: didPost },
  { from: "AT Protocol URI", input: `at://${DID}/app.bsky.feed.post/${RKEY}`, platform: "bluesky", kind: "post", platformId: `${DID}_${RKEY}`, canonicalUrl: didPost },
  { from: "did:web account", input: `https://bsky.app/profile/did:web:example.com/post/${RKEY}`, platform: "bluesky", kind: "post", platformId: `did:web:example.com_${RKEY}`, canonicalUrl: `https://bsky.app/profile/did:web:example.com/post/${RKEY}` },
  { from: "Profile (handle)", input: "https://bsky.app/profile/bsky.app", platform: "bluesky", kind: "profile", platformId: null, canonicalUrl: "https://bsky.app/profile/bsky.app", author: "bsky.app" },
  { from: "Profile (DID)", input: `https://bsky.app/profile/${DID}`, platform: "bluesky", kind: "profile", platformId: null, canonicalUrl: `https://bsky.app/profile/${DID}` },
  { from: "Custom feed", input: `https://bsky.app/profile/${DID}/feed/whats-hot`, platform: "bluesky", kind: "link", platformId: null, canonicalUrl: `https://bsky.app/profile/${DID}/feed/whats-hot` },
  { from: "Search", input: "https://bsky.app/search?q=cats", platform: "bluesky", kind: "link", platformId: null, canonicalUrl: "https://bsky.app/search?q=cats" },
];
