import { describe, expect, it } from "vitest";
import { firstLine, splitLinks } from "./links.ts";

describe("splitLinks", () => {
  it("leaves plain text as one part", () => {
    expect(splitLinks("Gate code 4821#")).toEqual([{ text: "Gate code 4821#" }]);
    expect(splitLinks("")).toEqual([]);
  });

  it("finds links and keeps the text around them", () => {
    expect(splitLinks("Map: https://example.com/a?b=1, then call.\nhttp://example.org")).toEqual([
      { text: "Map: " },
      { text: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { text: ", then call.\n" },
      { text: "http://example.org", href: "http://example.org/" },
    ]);
  });

  it("drops sentence punctuation and an unpaired bracket from the end of a link", () => {
    expect(splitLinks("(see https://example.com/page).")[1]).toEqual({ text: "https://example.com/page", href: "https://example.com/page" });
    expect(splitLinks("https://en.wikipedia.org/wiki/Rust_(programming_language)")[0]?.text).toBe("https://en.wikipedia.org/wiki/Rust_(programming_language)");
  });

  it("never links anything but http(s)", () => {
    expect(splitLinks("javascript:alert(1) and ftp://example.com and data:text/html,x")).toEqual([
      { text: "javascript:alert(1) and ftp://example.com and data:text/html,x" },
    ]);
    expect(splitLinks("https://")).toEqual([{ text: "https://" }]);
  });

  it("puts every character back in order", () => {
    const text = "a https://x.example/1. b (https://y.example/2) c";
    expect(splitLinks(text).map((p) => p.text).join("")).toBe(text);
  });
});

describe("firstLine", () => {
  it("skips blank lines", () => {
    expect(firstLine("  \n  Shopping list \n- milk")).toBe("Shopping list");
    expect(firstLine("")).toBe("");
  });
});
