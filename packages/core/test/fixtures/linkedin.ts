import type { Fixture } from "./types.ts";

const ID = "7212345678901234567";
const activity = `https://www.linkedin.com/feed/update/urn:li:activity:${ID}/`;

export const linkedin: Fixture[] = [
  { from: "Android app share", input: `https://www.linkedin.com/posts/satyanadella_ai-copilot-activity-${ID}-AbCd?utm_source=share&utm_medium=member_android`, platform: "linkedin", kind: "post", platformId: `activity_${ID}`, canonicalUrl: activity, author: "satyanadella" },
  { from: "iOS app share", input: `https://www.linkedin.com/posts/satyanadella_ai-copilot-activity-${ID}-AbCd?utm_source=share&utm_medium=member_ios`, platform: "linkedin", kind: "post", platformId: `activity_${ID}`, canonicalUrl: activity, author: "satyanadella" },
  { from: "Desktop copy link", input: `https://www.linkedin.com/posts/satyanadella_ai-copilot-activity-${ID}-AbCd?utm_source=share&utm_medium=member_desktop&rcm=ACoAAA`, platform: "linkedin", kind: "post", platformId: `activity_${ID}`, canonicalUrl: activity, author: "satyanadella" },
  { from: "Slug ending at the id", input: `https://www.linkedin.com/posts/satyanadella_ai-activity-${ID}`, platform: "linkedin", kind: "post", platformId: `activity_${ID}`, canonicalUrl: activity, author: "satyanadella" },
  { from: "Share slug (ugcPost)", input: `https://www.linkedin.com/posts/bill-gates_climate-ugcPost-${ID}-XyZw`, platform: "linkedin", kind: "post", platformId: `ugcPost_${ID}`, canonicalUrl: `https://www.linkedin.com/feed/update/urn:li:ugcPost:${ID}/`, author: "bill-gates" },
  { from: "Share slug (share)", input: `https://www.linkedin.com/posts/jane-doe-123_hiring-share-${ID}-QrSt`, platform: "linkedin", kind: "post", platformId: `share_${ID}`, canonicalUrl: `https://www.linkedin.com/feed/update/urn:li:share:${ID}/`, author: "jane-doe-123" },
  { from: "Slug without a username", input: `https://www.linkedin.com/posts/activity-${ID}-AbCd`, platform: "linkedin", kind: "post", platformId: `activity_${ID}`, canonicalUrl: activity },
  { from: "Mobile web", input: `https://m.linkedin.com/posts/satyanadella_ai-activity-${ID}-AbCd`, platform: "linkedin", kind: "post", platformId: `activity_${ID}`, canonicalUrl: activity, author: "satyanadella" },
  { from: "Feed update (web)", input: activity, platform: "linkedin", kind: "post", platformId: `activity_${ID}`, canonicalUrl: activity },
  { from: "Feed update (encoded urn)", input: `https://www.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A${ID}/`, platform: "linkedin", kind: "post", platformId: `activity_${ID}`, canonicalUrl: activity },
  { from: "Feed update (share urn)", input: `https://www.linkedin.com/feed/update/urn:li:share:${ID}`, platform: "linkedin", kind: "post", platformId: `share_${ID}`, canonicalUrl: `https://www.linkedin.com/feed/update/urn:li:share:${ID}/` },
  { from: "Link to a comment", input: `https://www.linkedin.com/feed/update/urn:li:ugcPost:${ID}?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A${ID}%2C7212345678901234999%29`, platform: "linkedin", kind: "post", platformId: `ugcPost_${ID}`, canonicalUrl: `https://www.linkedin.com/feed/update/urn:li:ugcPost:${ID}/` },
  { from: "Embed URL", input: `https://www.linkedin.com/embed/feed/update/urn:li:share:${ID}`, platform: "linkedin", kind: "post", platformId: `share_${ID}`, canonicalUrl: `https://www.linkedin.com/feed/update/urn:li:share:${ID}/` },
  { from: "lnkd.in wrapper (any site)", input: "https://lnkd.in/gAbC-dEf", platform: "web", kind: "link", platformId: null, canonicalUrl: "https://lnkd.in/gAbC-dEf", needsResolve: true },
  { from: "Article", input: "https://www.linkedin.com/pulse/future-work-satya-nadella/?trackingId=AbCd%3D%3D", platform: "linkedin", kind: "article", platformId: null, canonicalUrl: "https://www.linkedin.com/pulse/future-work-satya-nadella/" },
  { from: "Profile", input: "https://www.linkedin.com/in/satyanadella/", platform: "linkedin", kind: "profile", platformId: null, canonicalUrl: "https://www.linkedin.com/in/satyanadella/", author: "satyanadella" },
  { from: "Profile (country subdomain)", input: "https://in.linkedin.com/in/satyanadella", platform: "linkedin", kind: "profile", platformId: null, canonicalUrl: "https://www.linkedin.com/in/satyanadella/", author: "satyanadella" },
  { from: "Company page", input: "https://www.linkedin.com/company/microsoft/", platform: "linkedin", kind: "profile", platformId: null, canonicalUrl: "https://www.linkedin.com/company/microsoft/" },
  { from: "Job", input: "https://www.linkedin.com/jobs/view/3912345678/", platform: "linkedin", kind: "link", platformId: null, canonicalUrl: "https://www.linkedin.com/jobs/view/3912345678/" },
  { from: "Outbound link wrapper", input: "https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fexample%2Ecom%2Freport&urlhash=AbCd&trk=public_post-text", platform: "web", kind: "link", platformId: null, canonicalUrl: "https://example.com/report" },
];
