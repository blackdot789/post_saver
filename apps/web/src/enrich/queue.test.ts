import { describe, expect, it } from "vitest";
import { toLibrarySave, type LibrarySave, type LinkSave } from "../sync/library.ts";
import { afterFailure, bskyParts, bskyPostUrl, GIVEN_UP, MAX_TRIES, mergeExtras, metaChanges, pickWork, pruneAttempts } from "./queue.ts";

function save(over: Partial<LinkSave> & { id: string }): LinkSave {
  return {
    url: `https://example.com/${over.id}`,
    originalUrl: `https://example.com/${over.id}`,
    platform: "web",
    kind: "link",
    platformId: null,
    tags: [],
    collectionIds: [],
    favorite: false,
    status: "active",
    source: "web",
    embedStatus: "unknown",
    needsResolve: false,
    needsMeta: false,
    schemaVersion: 1,
    pending: false,
    ...over,
  };
}

const NOW = 1_800_000_000_000;

describe("pickWork", () => {
  const saves = [
    save({ id: "short", url: "https://vm.tiktok.com/ZMhvqjXXX/", platform: "tiktok", needsResolve: true, needsMeta: true }),
    save({ id: "handle", url: "https://bsky.app/profile/bsky.app/post/3mwolmfws5k2r", platform: "bluesky", needsResolve: true }),
    save({ id: "known", url: "https://www.instagram.com/reel/C8xYz12AbCd/", platform: "instagram", needsResolve: true }),
    save({ id: "video", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", platform: "youtube", needsMeta: true }),
    save({ id: "reel", url: "https://www.instagram.com/reel/C8xYz12AbCe/", platform: "instagram", needsMeta: true }),
    save({ id: "done", needsMeta: false }),
    save({ id: "trashed", needsMeta: true, status: "trashed" }),
    save({ id: "unsent", needsMeta: true, pending: true }),
  ];

  it("picks what waits, in library order, and says how each is settled", () => {
    expect(pickWork(saves, {}, NOW).map((w) => [w.save.id, w.do])).toEqual([
      // A short link is opened first; its title comes once it's the real post.
      ["short", "resolve"],
      ["handle", "bsky"],
      // Marked as a short link by an older app, but the link is understood now.
      ["known", "reparse"],
      ["video", "meta"],
      // Not: Instagram has no metadata, nothing waits, the Trash, a save not yet on the server.
    ]);
  });

  it("never picks a saved text, whatever its document says", () => {
    const text = toLibrarySave("text_0123456789abcdef01234567", { text: "see https://vm.tiktok.com/ZMhvqjXXX/", platform: "text", status: "active" }, false);
    const odd: LibrarySave[] = [text, { ...text, id: "odd", needsMeta: true, needsResolve: true }];
    expect(pickWork(odd, {}, NOW)).toEqual([]);
    expect(pruneAttempts({ odd: GIVEN_UP }, odd)).toEqual({});
  });

  it("skips saves that are backing off or given up on, and takes at most a batch", () => {
    const attempts = { short: { tries: 1, nextAt: NOW + 1000 }, handle: GIVEN_UP, video: { tries: 2, nextAt: NOW - 1 } };
    expect(pickWork(saves, attempts, NOW).map((w) => w.save.id)).toEqual(["known", "video"]);
    expect(pickWork(saves, {}, NOW, 2)).toHaveLength(2);
  });
});

describe("retrying", () => {
  it("waits longer after each failure and stops after five", () => {
    let attempt = afterFailure(undefined, NOW);
    expect(attempt).toEqual({ tries: 1, nextAt: NOW + 60_000 });
    const waits = [attempt.nextAt - NOW];
    for (let i = 0; i < 5; i++) {
      attempt = afterFailure(attempt, NOW);
      waits.push(attempt.nextAt - NOW);
    }
    expect(waits).toEqual([60_000, 600_000, 3_600_000, 21_600_000, 86_400_000, 86_400_000]);
    expect(attempt.tries).toBeGreaterThanOrEqual(MAX_TRIES);
    expect(pickWork([save({ id: "a", needsMeta: true })], { a: attempt }, NOW + 10 * 86_400_000)).toEqual([]);
  });

  it("forgets saves that are gone or need nothing any more", () => {
    const saves = [save({ id: "waiting", needsMeta: true }), save({ id: "settled" })];
    expect(pruneAttempts({ waiting: GIVEN_UP, settled: GIVEN_UP, deleted: GIVEN_UP }, saves)).toEqual({ waiting: GIVEN_UP });
  });
});

describe("what a lookup changes", () => {
  it("adds a title and thumbnail, and an author only when the link didn't name one", () => {
    expect(metaChanges({}, { title: "A title", author: "Rick Astley", thumb: "https://i.ytimg.com/vi/x/hqdefault.jpg" })).toEqual({
      title: "A title",
      author: "Rick Astley",
      thumb: "https://i.ytimg.com/vi/x/hqdefault.jpg",
    });
    // The handle from the link stays: the platform's answer may be a display name.
    expect(metaChanges({ author: "jack" }, { title: "just setting up my twttr", author: "Jack Dorsey" })).toEqual({ title: "just setting up my twttr" });
    expect(metaChanges({ title: "Kept" }, { title: "New" })).toEqual({});
    expect(metaChanges({}, {})).toEqual({});
    expect(metaChanges({}, { title: "x".repeat(900) }).title).toHaveLength(500);
  });

  it("folds a short link's tags, collections, favorite and note into the post's save", () => {
    const post = { tags: ["a"], collectionIds: ["c1"], favorite: false };
    expect(mergeExtras(post, { tags: ["b", "a"], collectionIds: ["c2"], favorite: true, note: "mine" })).toEqual({
      tags: ["a", "b"],
      collectionIds: ["c1", "c2"],
      favorite: true,
      note: "mine",
    });
    // The post's own note and favorite stay; nothing new means nothing to write.
    expect(mergeExtras({ ...post, favorite: true, note: "theirs" }, { tags: ["a"], collectionIds: [], favorite: false, note: "mine" })).toBeNull();
    // Never past the limits the rules enforce.
    const many = Array.from({ length: 40 }, (_, i) => `t${i}`);
    expect(mergeExtras(post, { tags: many, collectionIds: [], favorite: false })?.tags).toHaveLength(30);
  });
});

describe("Bluesky handles", () => {
  it("reads the handle and post key from a saved link", () => {
    expect(bskyParts("https://bsky.app/profile/bsky.app/post/3mwolmfws5k2r")).toEqual({ handle: "bsky.app", rkey: "3mwolmfws5k2r" });
    expect(bskyParts("https://bsky.app/profile/bsky.app")).toBeNull();
    expect(bskyParts("nonsense")).toBeNull();
  });

  it("builds the post's address only from a well-formed DID", () => {
    expect(bskyPostUrl("did:plc:z72i7hdynmk6r22z27h6tvur", "3mwolmfws5k2r")).toBe("https://bsky.app/profile/did:plc:z72i7hdynmk6r22z27h6tvur/post/3mwolmfws5k2r");
    expect(bskyPostUrl("did:web:example.com", "3k")).toBe("https://bsky.app/profile/did:web:example.com/post/3k");
    expect(bskyPostUrl("javascript:alert(1)", "3k")).toBeNull();
    expect(bskyPostUrl(undefined, "3k")).toBeNull();
    expect(bskyPostUrl("did:plc:abc/../../x", "3k")).toBeNull();
  });
});
