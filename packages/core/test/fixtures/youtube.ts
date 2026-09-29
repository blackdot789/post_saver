import type { Fixture } from "./types.ts";

const ID = "dQw4w9WgXcQ";
const watch = `https://www.youtube.com/watch?v=${ID}`;
const SHORT = "Ks-_Mh1QhMc";
const LIST = "PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI";

export const youtube: Fixture[] = [
  { from: "Android app share", input: `https://youtu.be/${ID}?si=AbCdEfGhIjKlMnOp`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: watch },
  { from: "iOS app share (Short)", input: `https://youtube.com/shorts/${SHORT}?si=AbCdEfGhIjKlMnOp`, platform: "youtube", kind: "short", platformId: SHORT, canonicalUrl: `https://www.youtube.com/shorts/${SHORT}` },
  { from: "Web address bar (from search)", input: `https://www.youtube.com/watch?v=${ID}&pp=ygUJcmljayByb2xs`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: watch },
  { from: "Web with channel param", input: `https://www.youtube.com/watch?v=${ID}&ab_channel=RickAstley`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: watch },
  { from: "Web, v not first", input: `https://www.youtube.com/watch?app=desktop&v=${ID}`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: watch },
  { from: "Mobile web", input: `https://m.youtube.com/watch?v=${ID}&feature=share`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: watch },
  { from: "YouTube Music share", input: `https://music.youtube.com/watch?v=${ID}&si=AbCdEf`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: watch },
  { from: "Live stream share", input: "https://www.youtube.com/live/jfKfPfyJRdk?si=AbCdEf", platform: "youtube", kind: "live", platformId: "jfKfPfyJRdk", canonicalUrl: "https://www.youtube.com/live/jfKfPfyJRdk" },
  { from: "Short on the web", input: `https://www.youtube.com/shorts/${SHORT}`, platform: "youtube", kind: "short", platformId: SHORT, canonicalUrl: `https://www.youtube.com/shorts/${SHORT}` },
  { from: "Short on mobile web", input: `https://m.youtube.com/shorts/${SHORT}?feature=share`, platform: "youtube", kind: "short", platformId: SHORT, canonicalUrl: `https://www.youtube.com/shorts/${SHORT}` },
  { from: "Embed with start", input: `https://www.youtube.com/embed/${ID}?start=43`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: `${watch}&t=43` },
  { from: "Privacy-enhanced embed", input: `https://www.youtube-nocookie.com/embed/${ID}`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: watch },
  { from: "Old /v/ embed", input: `https://www.youtube.com/v/${ID}`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: watch },
  { from: "Share at current time", input: `https://youtu.be/${ID}?t=43`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: `${watch}&t=43` },
  { from: "Time as 1m30s", input: `https://www.youtube.com/watch?v=${ID}&t=1m30s`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: `${watch}&t=90` },
  { from: "Time in fragment", input: `https://www.youtube.com/watch?v=${ID}#t=90`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: `${watch}&t=90` },
  { from: "Inside a playlist", input: `https://www.youtube.com/watch?v=${ID}&list=${LIST}&index=3`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: `${watch}&list=${LIST}` },
  { from: "Playlist + time, v not first", input: `https://www.youtube.com/watch?list=${LIST}&v=${ID}&t=10s`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: `${watch}&t=10&list=${LIST}` },
  { from: "Typed without scheme", input: `youtube.com/watch?v=${ID}`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: watch },
  { from: "Old attribution link", input: `https://www.youtube.com/attribution_link?a=AbCd&u=%2Fwatch%3Fv%3D${ID}%26feature%3Dshare`, platform: "youtube", kind: "video", platformId: ID, canonicalUrl: watch },
  { from: "Description link redirect", input: `https://www.youtube.com/redirect?event=video_description&redir_token=QUFF&q=https%3A%2F%2Fexample.com%2Fshop&v=${ID}`, platform: "web", kind: "link", platformId: null, canonicalUrl: "https://example.com/shop" },
  { from: "Playlist", input: `https://www.youtube.com/playlist?list=${LIST}&si=AbCdEf`, platform: "youtube", kind: "playlist", platformId: null, canonicalUrl: `https://www.youtube.com/playlist?list=${LIST}` },
  { from: "Channel handle", input: "https://www.youtube.com/@mkbhd", platform: "youtube", kind: "profile", platformId: null, canonicalUrl: "https://www.youtube.com/@mkbhd", author: "mkbhd" },
  { from: "Channel handle (app share)", input: "https://youtube.com/@mkbhd?si=AbCdEf", platform: "youtube", kind: "profile", platformId: null, canonicalUrl: "https://www.youtube.com/@mkbhd", author: "mkbhd" },
  { from: "Channel id", input: "https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ", platform: "youtube", kind: "profile", platformId: null, canonicalUrl: "https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ" },
  { from: "Clip (link card)", input: "https://youtube.com/clip/UgkxAbCdEfGhIjKlMnOpQrStUvWxYz01234?si=AbCdEf", platform: "youtube", kind: "link", platformId: null, canonicalUrl: "https://youtube.com/clip/UgkxAbCdEfGhIjKlMnOpQrStUvWxYz01234" },
  { from: "Watch page without a video", input: "https://www.youtube.com/watch", platform: "youtube", kind: "link", platformId: null, canonicalUrl: "https://www.youtube.com/watch" },
  { from: "youtu.be with a bad id", input: "https://youtu.be/abc", platform: "youtube", kind: "link", platformId: null, canonicalUrl: "https://youtu.be/abc" },
];
