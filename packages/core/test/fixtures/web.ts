import type { Fixture } from "./types.ts";

const link = (from: string, input: string, canonicalUrl: string): Fixture => ({
  from,
  input,
  platform: "web",
  kind: "link",
  platformId: null,
  canonicalUrl,
});
const short = (from: string, input: string): Fixture => ({ ...link(from, input, input), needsResolve: true });

export const web: Fixture[] = [
  link("Newsletter link", "https://example.com/article?utm_source=newsletter&utm_medium=email&id=42", "https://example.com/article?id=42"),
  link("Plain http kept", "http://example.com/page", "http://example.com/page"),
  link("Typed without scheme", "example.com/page", "https://example.com/page"),
  link("www with fbclid", "www.example.com/page?fbclid=IwAR0abc", "https://www.example.com/page"),
  link("Protocol-relative", "//example.com/page", "https://example.com/page"),
  link("Section fragment dropped", "https://example.com/docs#section-2", "https://example.com/docs"),
  link("App route fragment kept", "https://example.com/#/post/123", "https://example.com/#/post/123"),
  link("Hashbang route kept", "https://example.com/#!/post/123", "https://example.com/#!/post/123"),
  link("Uppercase host", "https://EXAMPLE.com/Path", "https://example.com/Path"),
  link("Default port dropped", "https://example.com:443/page", "https://example.com/page"),
  link("Custom port kept", "https://example.com:8443/page", "https://example.com:8443/page"),
  link("Host with port, no scheme", "example.com:8080/x", "https://example.com:8080/x"),
  link("Credentials dropped", "https://user:pass@example.com/page", "https://example.com/page"),
  link("Trailing-dot host", "https://example.com./page", "https://example.com/page"),
  link("Non-ASCII domain and path", "https://müller.de/über", "https://xn--mller-kva.de/%C3%BCber"),
  link("Encoding of other params kept", "https://example.com/search?q=hello%20world&utm_campaign=x", "https://example.com/search?q=hello%20world"),
  link("Mailchimp params", "https://example.com/?mc_cid=abc&mc_eid=def", "https://example.com/"),
  link("ref param", "https://example.com/tool?ref=producthunt", "https://example.com/tool"),
  link("si kept on other sites", "https://example.com/page?si=5", "https://example.com/page?si=5"),
  link("Spotify share", "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123", "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"),
  link("Vimeo (link card in v1)", "https://vimeo.com/76979871", "https://vimeo.com/76979871"),
  link("Angle brackets (email)", "<https://example.com/page>", "https://example.com/page"),
  link("Zero-width spaces", "  ​https://example.com/page​  ", "https://example.com/page"),
  link("Whole URL percent-encoded", "https%3A%2F%2Fexample.com%2Fpage", "https://example.com/page"),
  link("Android intent without scheme hint", "intent://example.com/page#Intent;end", "https://example.com/page"),
  link("Google result redirect", "https://www.google.com/url?sa=t&url=https%3A%2F%2Fexample.com%2Fguide&ved=2ahUKE&usg=AOvVaw", "https://example.com/guide"),
  link("Google AMP", "https://www.google.com/amp/s/example.com/news/story.amp", "https://example.com/news/story.amp"),
  short("bit.ly", "https://bit.ly/3AbCdEf"),
  short("amzn.to", "https://amzn.to/3XyZabc"),
  short("tinyurl", "https://tinyurl.com/2p8abcd"),
];

/** Inputs that must be refused (parse returns null). */
export const invalid: string[] = [
  "",
  "   ",
  "hello world",
  "javascript:alert(1)",
  "mailto:hi@example.com",
  "tel:+15551234567",
  "data:text/html,hi",
  "file:///etc/passwd",
  "ftp://example.com/file",
  "https://",
  "https://localhost/page",
  "https://./page",
  "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.graph.follow/3l6oveex3ii2l",
  `https://example.com/${"a".repeat(2100)}`,
];
