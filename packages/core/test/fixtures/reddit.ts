import type { Fixture } from "./types.ts";

const ID = "1abcd2e";
const CID = "kxyz123";
const post = `https://www.reddit.com/r/AskReddit/comments/${ID}/`;
const comment = `${post}comment/${CID}/`;

export const reddit: Fixture[] = [
  { from: "Android app share (current)", input: "https://www.reddit.com/r/AskReddit/s/AbCdEf1234", platform: "reddit", kind: "post", platformId: null, canonicalUrl: "https://www.reddit.com/r/AskReddit/s/AbCdEf1234", needsResolve: true },
  { from: "Android app share (older)", input: `https://www.reddit.com/r/AskReddit/comments/${ID}/whats_a_skill_everyone_should_learn/?utm_source=share&utm_medium=android_app&utm_name=androidcss&utm_term=1&utm_content=share_button`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: post },
  { from: "iOS app share (older)", input: `https://www.reddit.com/r/AskReddit/comments/${ID}/whats_a_skill/?utm_source=share&utm_medium=ios_app&utm_name=iossmf`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: post },
  { from: "Web address bar", input: `https://www.reddit.com/r/AskReddit/comments/${ID}/whats_a_skill_everyone_should_learn/`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: post },
  { from: "old.reddit", input: `https://old.reddit.com/r/AskReddit/comments/${ID}/whats_a_skill/`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: post },
  { from: "new.reddit", input: `https://new.reddit.com/r/AskReddit/comments/${ID}/`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: post },
  { from: "np.reddit", input: `https://np.reddit.com/r/AskReddit/comments/${ID}/whats_a_skill/`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: post },
  { from: "sh.reddit", input: `https://sh.reddit.com/r/AskReddit/comments/${ID}/`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: post },
  { from: "Mobile web", input: `https://m.reddit.com/r/AskReddit/comments/${ID}/`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: post },
  { from: "Compact i.reddit", input: `https://i.reddit.com/r/AskReddit/comments/${ID}/`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: post },
  { from: "rxddit mirror", input: `https://rxddit.com/r/AskReddit/comments/${ID}/`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: post },
  { from: "No www, no slug", input: `https://reddit.com/r/AskReddit/comments/${ID}`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: post },
  { from: "Uppercase post id", input: "https://www.reddit.com/r/AskReddit/comments/1ABCD2E/", platform: "reddit", kind: "post", platformId: ID, canonicalUrl: post },
  { from: "share_id param", input: `https://www.reddit.com/r/AskReddit/comments/${ID}/?share_id=AbCdEf123`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: post },
  { from: "Real older post (6-char id)", input: "https://www.reddit.com/r/funny/comments/3g1jfi/buttons/", platform: "reddit", kind: "post", platformId: "3g1jfi", canonicalUrl: "https://www.reddit.com/r/funny/comments/3g1jfi/" },
  { from: "redd.it short link (offline)", input: `https://redd.it/${ID}`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: `https://www.reddit.com/comments/${ID}/` },
  { from: "Post without subreddit", input: `https://www.reddit.com/comments/${ID}/`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: `https://www.reddit.com/comments/${ID}/` },
  { from: "Gallery", input: `https://www.reddit.com/gallery/${ID}`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: `https://www.reddit.com/comments/${ID}/` },
  { from: "Post on a user profile", input: `https://www.reddit.com/user/spez/comments/${ID}/hello/`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: `https://www.reddit.com/user/spez/comments/${ID}/`, author: "spez" },
  { from: "Post on a user profile (/u/)", input: `https://www.reddit.com/u/spez/comments/${ID}/`, platform: "reddit", kind: "post", platformId: ID, canonicalUrl: `https://www.reddit.com/user/spez/comments/${ID}/`, author: "spez" },
  { from: "Comment share (web)", input: `https://www.reddit.com/r/AskReddit/comments/${ID}/comment/${CID}/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button`, platform: "reddit", kind: "comment", platformId: `${ID}_${CID}`, canonicalUrl: comment },
  { from: "Comment permalink (classic)", input: `https://www.reddit.com/r/AskReddit/comments/${ID}/whats_a_skill/${CID}/?context=3`, platform: "reddit", kind: "comment", platformId: `${ID}_${CID}`, canonicalUrl: comment },
  { from: "v.redd.it video link", input: "https://v.redd.it/abc123xyz789", platform: "reddit", kind: "post", platformId: null, canonicalUrl: "https://v.redd.it/abc123xyz789", needsResolve: true },
  { from: "App deep link", input: "https://reddit.app.link/AbCdEf123", platform: "reddit", kind: "post", platformId: null, canonicalUrl: "https://reddit.app.link/AbCdEf123", needsResolve: true },
  { from: "Subreddit", input: "https://www.reddit.com/r/AskReddit/", platform: "reddit", kind: "community", platformId: null, canonicalUrl: "https://www.reddit.com/r/AskReddit/" },
  { from: "User profile", input: "https://www.reddit.com/user/spez/", platform: "reddit", kind: "profile", platformId: null, canonicalUrl: "https://www.reddit.com/user/spez/", author: "spez" },
  { from: "Wiki page", input: "https://www.reddit.com/r/AskReddit/wiki/index", platform: "reddit", kind: "link", platformId: null, canonicalUrl: "https://www.reddit.com/r/AskReddit/wiki/index" },
  { from: "Outbound link wrapper", input: `https://out.reddit.com/t3_${ID}?url=https%3A%2F%2Fexample.com%2Fnews&token=AQAA&app_name=web`, platform: "web", kind: "link", platformId: null, canonicalUrl: "https://example.com/news" },
];
