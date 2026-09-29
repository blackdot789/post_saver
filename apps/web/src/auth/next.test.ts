import { describe, expect, it } from "vitest";
import { loginUrl, safeNext } from "./next.ts";

describe("safeNext", () => {
  it.each([
    [null, "/app/"],
    ["", "/app/"],
    ["/app/", "/app/"],
    ["/app/?view=list#top", "/app/?view=list#top"],
    ["/save/?url=https%3A%2F%2Fx.com%2Fa", "/save/?url=https%3A%2F%2Fx.com%2Fa"],
  ])("%j → %j", (raw, expected) => {
    expect(safeNext(raw)).toBe(expected);
  });

  it.each([
    "//evil.example/",
    "https://evil.example/",
    "/\\evil.example",
    "/\t/evil.example",
    "javascript:alert(1)",
    "app/",
    "/login/?next=/app/",
  ])("never leaves the site or loops back to sign-in: %j", (raw) => {
    expect(safeNext(raw)).toBe("/app/");
  });

  it("keeps encoded slashes as a harmless path on this site", () => {
    expect(safeNext("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });
});

describe("loginUrl", () => {
  it("returns to the page after sign-in", () => {
    expect(loginUrl("/app/?view=list")).toBe("/login/?next=%2Fapp%2F%3Fview%3Dlist");
  });
});
