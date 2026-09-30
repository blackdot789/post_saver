import { describe, expect, it } from "vitest";
import { embedToParams, hintsFromParams, linkForEmbed, paramsToEmbed, parse, themeFromParams, type Embed } from "../src/index.ts";
import { facebook } from "./fixtures/facebook.ts";
import { instagram } from "./fixtures/instagram.ts";
import { linkedin } from "./fixtures/linkedin.ts";
import { reddit } from "./fixtures/reddit.ts";
import { bluesky, pinterest, threads } from "./fixtures/threads-pinterest-bluesky.ts";
import { tiktok } from "./fixtures/tiktok.ts";
import { x } from "./fixtures/x.ts";
import { youtube } from "./fixtures/youtube.ts";

const embeds = [instagram, x, tiktok, youtube, reddit, facebook, linkedin, threads, pinterest, bluesky]
  .flat()
  .map((f) => parse(f.input)?.embed)
  .filter((e): e is Embed => e !== null && e !== undefined);

describe("embed fragment", () => {
  it("has an embed to test for every platform", () => {
    expect(new Set(embeds.map((e) => e.platform)).size).toBe(10);
  });

  it.each(embeds.map((e) => [e.platform, e] as const))("%s: survives the round trip through the fragment", (_p, embed) => {
    const params = embedToParams(embed, "dark");
    expect(paramsToEmbed(params)).toEqual(embed);
    expect(themeFromParams(params)).toBe("dark");
  });

  it.each(embeds.map((e) => [e.platform, e] as const))("%s: the link built for it parses to the same embed", (_p, embed) => {
    expect(parse(linkForEmbed(embed))?.embed).toEqual(embed);
  });

  it.each([
    ["no platform", "theme=dark"],
    ["an unknown platform", "p=myspace&id=1"],
    ["an instagram code with a slash", "p=instagram&code=abc/../x"],
    ["a non-numeric tweet id", "p=x&id=abc"],
    ["a YouTube id of the wrong length", "p=youtube&id=abc"],
    ["a facebook link on another site", "p=facebook&type=post&href=https://evil.example/posts/1"],
    ["a facebook link that isn't a post", "p=facebook&type=post&href=https://www.facebook.com/groups/123"],
    ["a linkedin urn of the wrong shape", "p=linkedin&urn=urn:li:evil:1"],
    ["a bluesky handle instead of a DID", "p=bluesky&did=someone.bsky.social&rkey=3kabcdefghi2x"],
    ["script in a reddit subreddit", "p=reddit&id=abc123&sub=<script>"],
  ])("refuses %s", (_label, fragment) => {
    expect(paramsToEmbed(new URLSearchParams(fragment))).toBeNull();
  });

  it("keeps a YouTube start time and drops a bad one", () => {
    expect(paramsToEmbed(new URLSearchParams("p=youtube&id=dQw4w9WgXcQ&start=90"))).toEqual({ platform: "youtube", id: "dQw4w9WgXcQ", start: 90 });
    expect(paramsToEmbed(new URLSearchParams("p=youtube&id=dQw4w9WgXcQ&start=-5"))).toEqual({ platform: "youtube", id: "dQw4w9WgXcQ" });
  });

  it("the theme defaults to light", () => {
    expect(themeFromParams(new URLSearchParams("p=x&id=1"))).toBe("light");
  });

  it("carries the size hints, and they never change what is rendered", () => {
    const embed: Embed = { platform: "youtube", id: "dQw4w9WgXcQ" };
    const params = embedToParams(embed, { theme: "dark", maxHeight: 451.6, tall: true });
    expect(paramsToEmbed(params)).toEqual(embed);
    expect(hintsFromParams(params)).toEqual({ theme: "dark", maxHeight: 452, tall: true });
  });

  it.each(["max=12", "max=99999", "max=abc", "max=300.5", "tall=yes"])("drops the odd hint %s", (fragment) => {
    expect(hintsFromParams(new URLSearchParams(`p=x&id=1&${fragment}`))).toEqual({ theme: "light" });
  });
});
