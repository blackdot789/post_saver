import type { Fixture } from "./types.ts";

const POST = "10115123456789012";
const PFBID = "pfbid02AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfGhIjKl";
const VIDEO = "1234567890123456";

export const facebook: Fixture[] = [
  { from: "Android app share (post)", input: "https://www.facebook.com/share/p/1AbCdEfGhI/", platform: "facebook", kind: "post", platformId: null, canonicalUrl: "https://www.facebook.com/share/p/1AbCdEfGhI/", needsResolve: true },
  { from: "Android app share (reel)", input: "https://www.facebook.com/share/r/1AbCdEfGhI/", platform: "facebook", kind: "reel", platformId: null, canonicalUrl: "https://www.facebook.com/share/r/1AbCdEfGhI/", needsResolve: true },
  { from: "Android app share (video)", input: "https://www.facebook.com/share/v/1AbCdEfGhI/", platform: "facebook", kind: "video", platformId: null, canonicalUrl: "https://www.facebook.com/share/v/1AbCdEfGhI/", needsResolve: true },
  { from: "iOS app share (mibextid)", input: "https://www.facebook.com/share/1AbCdEfGhI/?mibextid=wwXIfr", platform: "facebook", kind: "post", platformId: null, canonicalUrl: "https://www.facebook.com/share/1AbCdEfGhI/", needsResolve: true },
  { from: "fb.watch video link", input: "https://fb.watch/abC1dEfGhI/", platform: "facebook", kind: "video", platformId: null, canonicalUrl: "https://fb.watch/abC1dEfGhI/", needsResolve: true },
  { from: "Web post (numeric id)", input: `https://www.facebook.com/zuck/posts/${POST}`, platform: "facebook", kind: "post", platformId: POST, canonicalUrl: `https://www.facebook.com/zuck/posts/${POST}`, author: "zuck" },
  { from: "Web post (pfbid, tracking)", input: `https://www.facebook.com/zuck/posts/${PFBID}?__cft__[0]=AZabc&__tn__=%2CO%2CP-R`, platform: "facebook", kind: "post", platformId: PFBID, canonicalUrl: `https://www.facebook.com/zuck/posts/${PFBID}`, author: "zuck" },
  { from: "Post by numeric profile", input: `https://www.facebook.com/100044123456789/posts/${POST}/`, platform: "facebook", kind: "post", platformId: POST, canonicalUrl: `https://www.facebook.com/100044123456789/posts/${POST}` },
  { from: "web.facebook", input: `https://web.facebook.com/zuck/posts/${POST}`, platform: "facebook", kind: "post", platformId: POST, canonicalUrl: `https://www.facebook.com/zuck/posts/${POST}`, author: "zuck" },
  { from: "fb.com domain", input: `https://fb.com/zuck/posts/${POST}`, platform: "facebook", kind: "post", platformId: POST, canonicalUrl: `https://www.facebook.com/zuck/posts/${POST}`, author: "zuck" },
  { from: "Mobile story.php", input: `https://m.facebook.com/story.php?story_fbid=${PFBID}&id=100044123456789&mibextid=Nif5oz`, platform: "facebook", kind: "post", platformId: PFBID, canonicalUrl: `https://www.facebook.com/permalink.php?story_fbid=${PFBID}&id=100044123456789` },
  { from: "permalink.php (owner id 4)", input: `https://www.facebook.com/permalink.php?story_fbid=${POST}&id=4`, platform: "facebook", kind: "post", platformId: POST, canonicalUrl: `https://www.facebook.com/permalink.php?story_fbid=${POST}&id=4` },
  { from: "mbasic story.php", input: `https://mbasic.facebook.com/story.php?story_fbid=${POST}&id=4`, platform: "facebook", kind: "post", platformId: POST, canonicalUrl: `https://www.facebook.com/permalink.php?story_fbid=${POST}&id=4` },
  { from: "Embed plugin URL", input: `https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fzuck%2Fposts%2F${POST}&width=500`, platform: "facebook", kind: "post", platformId: POST, canonicalUrl: `https://www.facebook.com/zuck/posts/${POST}`, author: "zuck" },
  { from: "Reel", input: `https://www.facebook.com/reel/${VIDEO}?mibextid=rS40aB7S9Ucbxw6v`, platform: "facebook", kind: "reel", platformId: VIDEO, canonicalUrl: `https://www.facebook.com/reel/${VIDEO}` },
  { from: "Watch", input: `https://www.facebook.com/watch/?v=${VIDEO}`, platform: "facebook", kind: "video", platformId: VIDEO, canonicalUrl: `https://www.facebook.com/watch/?v=${VIDEO}` },
  { from: "Watch (no slash)", input: `https://www.facebook.com/watch?v=${VIDEO}`, platform: "facebook", kind: "video", platformId: VIDEO, canonicalUrl: `https://www.facebook.com/watch/?v=${VIDEO}` },
  { from: "Watch live", input: `https://www.facebook.com/watch/live/?v=${VIDEO}`, platform: "facebook", kind: "video", platformId: VIDEO, canonicalUrl: `https://www.facebook.com/watch/?v=${VIDEO}` },
  { from: "Old video.php", input: `https://www.facebook.com/video.php?v=${VIDEO}`, platform: "facebook", kind: "video", platformId: VIDEO, canonicalUrl: `https://www.facebook.com/watch/?v=${VIDEO}` },
  { from: "Page video", input: `https://www.facebook.com/NASA/videos/${VIDEO}/`, platform: "facebook", kind: "video", platformId: VIDEO, canonicalUrl: `https://www.facebook.com/NASA/videos/${VIDEO}/`, author: "NASA" },
  { from: "Page video with title slug", input: `https://www.facebook.com/NASA/videos/artemis-launch/${VIDEO}/`, platform: "facebook", kind: "video", platformId: VIDEO, canonicalUrl: `https://www.facebook.com/NASA/videos/${VIDEO}/`, author: "NASA" },
  { from: "Photo", input: `https://www.facebook.com/photo/?fbid=${VIDEO}&set=a.987654321098765`, platform: "facebook", kind: "photo", platformId: VIDEO, canonicalUrl: `https://www.facebook.com/photo/?fbid=${VIDEO}` },
  { from: "Old photo.php", input: `https://www.facebook.com/photo.php?fbid=${VIDEO}&set=a.98765&type=3`, platform: "facebook", kind: "photo", platformId: VIDEO, canonicalUrl: `https://www.facebook.com/photo/?fbid=${VIDEO}` },
  { from: "Page photo in an album", input: `https://www.facebook.com/NASA/photos/a.123456789/${VIDEO}/`, platform: "facebook", kind: "photo", platformId: VIDEO, canonicalUrl: `https://www.facebook.com/photo/?fbid=${VIDEO}`, author: "NASA" },
  { from: "Group post", input: `https://www.facebook.com/groups/123456789012345/posts/${VIDEO}/`, platform: "facebook", kind: "post", platformId: VIDEO, canonicalUrl: `https://www.facebook.com/groups/123456789012345/posts/${VIDEO}/` },
  { from: "Group permalink (vanity name)", input: `https://www.facebook.com/groups/reactjs.devs/permalink/${VIDEO}/`, platform: "facebook", kind: "post", platformId: VIDEO, canonicalUrl: `https://www.facebook.com/groups/reactjs.devs/posts/${VIDEO}/` },
  { from: "Group", input: "https://www.facebook.com/groups/reactjs.devs/", platform: "facebook", kind: "community", platformId: null, canonicalUrl: "https://www.facebook.com/groups/reactjs.devs/" },
  { from: "Page", input: "https://www.facebook.com/NASA", platform: "facebook", kind: "profile", platformId: null, canonicalUrl: "https://www.facebook.com/NASA", author: "NASA" },
  { from: "profile.php", input: "https://www.facebook.com/profile.php?id=100012345678901", platform: "facebook", kind: "profile", platformId: null, canonicalUrl: "https://www.facebook.com/profile.php?id=100012345678901" },
  { from: "Event", input: "https://www.facebook.com/events/1234567890123456/", platform: "facebook", kind: "link", platformId: null, canonicalUrl: "https://www.facebook.com/events/1234567890123456/" },
  { from: "Marketplace item", input: "https://www.facebook.com/marketplace/item/1234567890123456/", platform: "facebook", kind: "link", platformId: null, canonicalUrl: "https://www.facebook.com/marketplace/item/1234567890123456/" },
  { from: "Outbound link wrapper", input: "https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com%2Fblog%3Ffbclid%3DIwAR1abc&h=AT0abc", platform: "web", kind: "link", platformId: null, canonicalUrl: "https://example.com/blog" },
];
