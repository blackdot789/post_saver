import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  KINDS,
  LIMITS,
  PLATFORMS,
  newSave,
  parse,
  saveId,
  tombstone,
  type NewSaveOptions,
} from "@postsaver/core";
import {
  Timestamp,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type FieldValue,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const RULES = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const DAY = 24 * 3600 * 1000;

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-post-saver", firestore: { rules: RULES } });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

// ---------- people ----------

const PEOPLE = {
  alice: { uid: "alice", email: "alice@example.com", email_verified: true },
  unverified: { uid: "alice", email: "alice@example.com", email_verified: false },
  mallory: { uid: "mallory", email: "mallory@example.com", email_verified: true },
};
type Who = keyof typeof PEOPLE | "anon";

function db(who: Who): Firestore {
  if (who === "anon") return env.unauthenticatedContext().firestore() as unknown as Firestore;
  const { uid, ...token } = PEOPLE[who];
  return env.authenticatedContext(uid, token).firestore() as unknown as Firestore;
}

/** Writes test data without rules (like an admin would). */
async function seed(path: string, data: DocumentData): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, path), data);
  });
}

// ---------- documents, built the way the app builds them ----------

type Stamp = FieldValue | Timestamp;

async function saveFor(url: string, opts: Partial<NewSaveOptions<Stamp>> = {}) {
  const link = parse(url);
  if (!link) throw new Error(`parse returned null for ${url}`);
  const data: DocumentData = newSave<Stamp>(link, { source: "web", now: serverTimestamp(), ...opts });
  const id = await saveId(link);
  return { id, path: `users/alice/saves/${id}`, data };
}

const IG = "https://www.instagram.com/reel/C8xYz12AbCd/?igsh=MWQ1ZGUxMzBkMA==";
const past = (days: number) => Timestamp.fromMillis(Date.now() - days * DAY);

/** A save already on the server (as if written earlier). */
async function existingSave(url = IG) {
  const s = await saveFor(url, { now: past(3) });
  await seed(s.path, s.data);
  return s;
}

function userDoc(extra: DocumentData = {}): DocumentData {
  return {
    email: "alice@example.com",
    displayName: "Alice",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    settings: { view: "grid", theme: "system", previews: "ask", onUnsave: "keep" },
    schemaVersion: 1,
    ...extra,
  };
}

// ---------- tests ----------

describe("rules stay in step with packages/core", () => {
  const list = (fn: string) => {
    const m = new RegExp(`function ${fn}\\(\\) \\{\\s*return \\[([^\\]]*)\\];`).exec(RULES);
    if (!m?.[1]) throw new Error(`${fn}() not found in firestore.rules`);
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  };
  it("platforms() matches PLATFORMS", () => expect(list("platforms")).toEqual([...PLATFORMS]));
  it("kinds() matches KINDS", () => expect(list("kinds")).toEqual([...KINDS]));
});

describe("config", () => {
  it("anyone can read the app config, even signed out", async () => {
    await seed("config/app", { maintenance: false });
    await assertSucceeds(getDoc(doc(db("anon"), "config/app")));
  });
  it("nobody can write it from the app", async () => {
    await assertFails(setDoc(doc(db("alice"), "config/app"), { maintenance: true }));
  });
});

describe("unknown and future paths are closed", () => {
  it.each(["something/else", "inboxTokens/abc", "inbox/abc/items/def"])("%s", async (path) => {
    await assertFails(setDoc(doc(db("alice"), path), { uid: "alice" }));
    await assertFails(getDoc(doc(db("alice"), path)));
  });
});

describe("user profile", () => {
  const path = "users/alice";
  it("the verified owner can create, read and update it", async () => {
    await assertSucceeds(setDoc(doc(db("alice"), path), userDoc()));
    await assertSucceeds(getDoc(doc(db("alice"), path)));
    await assertSucceeds(updateDoc(doc(db("alice"), path), { "settings.theme": "dark", updatedAt: serverTimestamp() }));
  });
  it("an unverified email can't write", async () => {
    await assertFails(setDoc(doc(db("unverified"), path), userDoc()));
  });
  it("others can't read or write it", async () => {
    await seed(path, { ...userDoc(), createdAt: past(1), updatedAt: past(1) });
    await assertFails(getDoc(doc(db("mallory"), path)));
    await assertFails(getDoc(doc(db("anon"), path)));
    await assertFails(setDoc(doc(db("mallory"), path), userDoc({ email: "mallory@example.com" })));
  });
  it("the email must be the signed-in account's", async () => {
    await assertFails(setDoc(doc(db("alice"), path), userDoc({ email: "someone@example.com" })));
  });
  it.each([
    ["an unknown field", { isAdmin: true }],
    ["an unknown setting", { settings: { view: "grid", admin: true } }],
    ["a bad setting value", { settings: { theme: "neon" } }],
    ["a long display name", { displayName: "x".repeat(LIMITS.displayName + 1) }],
    ["a client clock for updatedAt", { updatedAt: Timestamp.now() }],
  ])("rejects %s", async (_label, extra) => {
    await assertFails(setDoc(doc(db("alice"), path), userDoc(extra)));
  });
  it("createdAt can't be changed later", async () => {
    await seed(path, { ...userDoc(), createdAt: past(10), updatedAt: past(10) });
    await assertFails(updateDoc(doc(db("alice"), path), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });
});

describe("saves: create", () => {
  it.each([
    ["an Instagram reel", IG],
    ["an X post", "https://x.com/NASA/status/1812345678901234567?s=46"],
    ["a Reddit comment", "https://www.reddit.com/r/AskReddit/comments/1abcd2e/comment/kxyz123/"],
    ["a Bluesky post (DID)", "https://bsky.app/profile/did:plc:z72i7hdynmk6r22z27h6tvur/post/3l6oveex3ii2l"],
    ["a Bluesky post (handle, unresolved)", "https://bsky.app/profile/bsky.app/post/3l6oveex3ii2l"],
    ["a TikTok short link", "https://vm.tiktok.com/ZMhvqjXXX/"],
    ["a website", "https://example.com/article?utm_source=x&id=42"],
    ["a non-ASCII website", "https://müller.de/über"],
    ["a profile", "https://www.instagram.com/natgeo/"],
  ])("the verified owner can save %s", async (_label, url) => {
    const s = await saveFor(url);
    await assertSucceeds(setDoc(doc(db("alice"), s.path), s.data));
  });

  it("with tags, a note and an import date", async () => {
    const s = await saveFor(IG, { source: "import-dewey", savedAt: past(400), tags: ["Travel", "#food"], note: "Try this" });
    expect(s.data.tags).toEqual(["travel", "food"]);
    await assertSucceeds(setDoc(doc(db("alice"), s.path), s.data));
  });

  it("an unverified email can't save", async () => {
    const s = await saveFor(IG);
    await assertFails(setDoc(doc(db("unverified"), s.path), s.data));
  });

  it("nobody can save into someone else's library", async () => {
    const s = await saveFor(IG);
    await assertFails(setDoc(doc(db("mallory"), s.path), s.data));
    await assertFails(setDoc(doc(db("anon"), s.path), s.data));
  });

  describe("the id must come from the link", () => {
    it("rejects another post's id", async () => {
      const s = await saveFor(IG);
      await assertFails(setDoc(doc(db("alice"), "users/alice/saves/instagram_DIFFERENT123"), s.data));
    });
    it("rejects a hash id for a post that has a platform id", async () => {
      const s = await saveFor(IG);
      await assertFails(setDoc(doc(db("alice"), "users/alice/saves/url_0123456789abcdef01234567"), s.data));
    });
    it("rejects a hash id that isn't the link's hash", async () => {
      const s = await saveFor("https://example.com/a");
      await assertFails(setDoc(doc(db("alice"), "users/alice/saves/url_0123456789abcdef01234567"), s.data));
    });
    it("rejects a changed link under the original id", async () => {
      const s = await saveFor("https://example.com/a");
      await assertFails(setDoc(doc(db("alice"), s.path), { ...s.data, url: "https://example.com/b" }));
    });
  });

  describe("field checks", () => {
    const long = (n: number) => "x".repeat(n);
    const tags = (n: number) => Array.from({ length: n }, (_, i) => `tag${i}`);
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);

    it.each([
      ["a title at the limit", { title: long(LIMITS.title) }],
      ["an author at the limit", { author: long(LIMITS.author) }],
      ["a note at the limit", { note: long(LIMITS.note) }],
      ["a note in Hindi at the limit", { note: "न".repeat(LIMITS.note) }],
      ["30 tags", { tags: tags(LIMITS.tags) }],
      ["a 40-character tag", { tags: [long(LIMITS.tagLength)] }],
      ["a 40-character tag in Hindi", { tags: ["न".repeat(LIMITS.tagLength)] }],
      ["tags with spaces and emoji", { tags: ["road trip", "🍕 pizza"] }],
      ["50 collections", { collectionIds: ids(LIMITS.collectionIds) }],
      ["a YouTube thumbnail", { thumb: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" }],
      ["a trashed save with its trash time", { status: "trashed", trashedAt: serverTimestamp() }],
      ["an embed check time", { embedStatus: "unavailable", embedCheckedAt: serverTimestamp() }],
      ["a device clock a little ahead", { savedAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000) }],
    ])("accepts %s", async (_label, extra) => {
      const s = await saveFor(IG);
      await assertSucceeds(setDoc(doc(db("alice"), s.path), { ...s.data, ...extra }));
    });

    it.each([
      ["an unknown field", { isPublic: true }],
      ["a title over the limit", { title: long(LIMITS.title + 1) }],
      ["an author over the limit", { author: long(LIMITS.author + 1) }],
      ["a note over the limit", { note: long(LIMITS.note + 1) }],
      ["31 tags", { tags: tags(LIMITS.tags + 1) }],
      ["a 41-character tag", { tags: [long(LIMITS.tagLength + 1)] }],
      ["a capitalised tag", { tags: ["Travel"] }],
      ["a tag with a comma", { tags: ["a,b"] }],
      ["an empty tag", { tags: ["ok", ""] }],
      ["a tag that isn't text", { tags: [42] }],
      ["a tag that's a map", { tags: [{ a: "b" }] }],
      ["one huge tag hidden behind commas", { tags: [Array.from({ length: 200 }, () => "x".repeat(40)).join(",")] }],
      ["a collection id that isn't text", { collectionIds: [7] }],
      ["51 collections", { collectionIds: ids(LIMITS.collectionIds + 1) }],
      ["a bad collection id", { collectionIds: ["../x"] }],
      ["a thumbnail from an expiring host", { thumb: "https://scontent.cdninstagram.com/v/t51.jpg" }],
      ["an unknown platform", { platform: "myspace" }],
      ["an unknown kind", { kind: "tweet" }],
      ["an unknown source", { source: "robot" }],
      ["a trashed save without a trash time", { status: "trashed" }],
      ["deleted: true on a live save", { deleted: true }],
      ["a javascript: link", { url: "javascript:alert(1)" }],
      ["a link over 2048 characters", { originalUrl: `https://example.com/${long(2040)}` }],
      ["a client clock for updatedAt", { updatedAt: Timestamp.now() }],
      ["a client clock for createdAt", { createdAt: Timestamp.now() }],
      ["a save date two hours ahead", { savedAt: Timestamp.fromMillis(Date.now() + 2 * 3600 * 1000) }],
    ])("rejects %s", async (_label, extra) => {
      const s = await saveFor(IG);
      await assertFails(setDoc(doc(db("alice"), s.path), { ...s.data, ...extra }));
    });

    it("rejects a missing required field", async () => {
      const { needsMeta: _dropped, ...data } = (await saveFor(IG)).data;
      await assertFails(setDoc(doc(db("alice"), (await saveFor(IG)).path), data));
    });
  });
});

describe("saves: read and query", () => {
  it("the owner can read one and run the delta query", async () => {
    const s = await existingSave();
    await assertSucceeds(getDoc(doc(db("alice"), s.path)));
    await assertSucceeds(getDocs(query(collection(db("alice"), "users/alice/saves"), where("updatedAt", ">", past(30)))));
  });
  it("an unverified owner can still read (they just can't write)", async () => {
    const s = await existingSave();
    await assertSucceeds(getDoc(doc(db("unverified"), s.path)));
  });
  it("others can't read or list them", async () => {
    const s = await existingSave();
    await assertFails(getDoc(doc(db("mallory"), s.path)));
    await assertFails(getDocs(collection(db("mallory"), "users/alice/saves")));
    await assertFails(getDocs(collection(db("anon"), "users/alice/saves")));
  });
  it("nobody can query saves across users", async () => {
    await existingSave();
    await assertFails(getDocs(collectionGroup(db("alice"), "saves")));
  });
});

describe("saves: edit", () => {
  const now = () => ({ updatedAt: serverTimestamp() });

  it.each([
    ["tags", { tags: ["travel", "food"] }],
    ["a note", { note: "Remember this" }],
    ["favorite", { favorite: true }],
    ["trash", { status: "trashed", trashedAt: serverTimestamp() }],
    ["title and author from enrichment", { title: "A reel", author: "natgeo", needsMeta: false }],
    ["move to top", { savedAt: serverTimestamp() }],
    ["removing the note", { note: deleteField() }],
  ])("the owner can change %s", async (_label, change) => {
    const s = await existingSave();
    await assertSucceeds(updateDoc(doc(db("alice"), s.path), { ...change, ...now() }));
  });

  it("restoring from trash", async () => {
    const s = await existingSave();
    await seed(s.path, { ...s.data, createdAt: past(3), updatedAt: past(1), savedAt: past(3), status: "trashed", trashedAt: past(1) });
    await assertSucceeds(updateDoc(doc(db("alice"), s.path), { status: "active", trashedAt: deleteField(), ...now() }));
  });

  it.each([
    ["without bumping updatedAt", { favorite: true }],
    ["the link", { url: "https://example.com/other", updatedAt: serverTimestamp() }],
    ["the platform", { platform: "x", updatedAt: serverTimestamp() }],
    ["the source", { source: "paste", updatedAt: serverTimestamp() }],
    ["createdAt", { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }],
    ["to deleted: true without stripping it", { deleted: true, updatedAt: serverTimestamp() }],
  ])("rejects changing %s", async (_label, change) => {
    const s = await existingSave();
    await assertFails(updateDoc(doc(db("alice"), s.path), change));
  });

  it("others can't edit", async () => {
    const s = await existingSave();
    await assertFails(updateDoc(doc(db("mallory"), s.path), { favorite: true, ...now() }));
  });

  it("an unverified owner can't edit", async () => {
    const s = await existingSave();
    await assertFails(updateDoc(doc(db("unverified"), s.path), { favorite: true, ...now() }));
  });

  it("saving the same post again from another device is refused, not duplicated", async () => {
    const s = await existingSave();
    const again = await saveFor(IG);
    expect(again.path).toBe(s.path);
    await assertFails(setDoc(doc(db("alice"), again.path), again.data));
  });
});

describe("saves: delete", () => {
  it("the owner turns a save into a tombstone", async () => {
    const s = await existingSave();
    await assertSucceeds(setDoc(doc(db("alice"), s.path), tombstone(serverTimestamp())));
  });
  it("a tombstone can't keep other fields", async () => {
    const s = await existingSave();
    await assertFails(setDoc(doc(db("alice"), s.path), { ...tombstone(serverTimestamp()), url: s.data.url }));
  });
  it("a tombstone needs the server time", async () => {
    const s = await existingSave();
    await assertFails(setDoc(doc(db("alice"), s.path), tombstone(Timestamp.now())));
  });
  it("saving a deleted post again starts it fresh", async () => {
    const s = await existingSave();
    await seed(s.path, tombstone(past(2)));
    await assertSucceeds(setDoc(doc(db("alice"), s.path), (await saveFor(IG)).data));
  });
  it("a live save can't be hard-deleted", async () => {
    const s = await existingSave();
    await assertFails(deleteDoc(doc(db("alice"), s.path)));
  });
  it("a recent tombstone can't be hard-deleted yet", async () => {
    const s = await existingSave();
    await seed(s.path, tombstone(past(59)));
    await assertFails(deleteDoc(doc(db("alice"), s.path)));
  });
  it("a tombstone older than 60 days can be hard-deleted", async () => {
    const s = await existingSave();
    await seed(s.path, tombstone(past(61)));
    await assertSucceeds(deleteDoc(doc(db("alice"), s.path)));
  });
  it("during account deletion anything can be deleted", async () => {
    const s = await existingSave();
    await seed("users/alice", { ...userDoc(), createdAt: past(9), updatedAt: past(1), deleting: true });
    await assertSucceeds(deleteDoc(doc(db("alice"), s.path)));
  });
  it("others can't delete", async () => {
    const s = await existingSave();
    await seed(s.path, tombstone(past(61)));
    await assertFails(deleteDoc(doc(db("mallory"), s.path)));
  });
});

describe("collections", () => {
  const path = "users/alice/collections/c1";
  const col = (extra: DocumentData = {}) => ({
    name: "Recipes",
    emoji: "🍝",
    color: "#6636F2",
    order: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deleted: false,
    ...extra,
  });

  it("the owner can create, rename and delete (tombstone) one", async () => {
    await assertSucceeds(setDoc(doc(db("alice"), path), col()));
    await assertSucceeds(updateDoc(doc(db("alice"), path), { name: "Food", updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db("alice"), path), tombstone(serverTimestamp())));
  });
  it.each([
    ["an empty name", { name: "" }],
    ["a name over 60 characters", { name: "x".repeat(LIMITS.collectionName + 1) }],
    ["a bad color", { color: "red" }],
    ["an unknown field", { shared: true }],
  ])("rejects %s", async (_label, extra) => {
    await assertFails(setDoc(doc(db("alice"), path), col(extra)));
  });
  it("rejects a bad id", async () => {
    await assertFails(setDoc(doc(db("alice"), "users/alice/collections/bad-id!"), col()));
  });
  it("others can't create or read", async () => {
    await assertFails(setDoc(doc(db("mallory"), path), col()));
    await seed(path, { ...col(), createdAt: past(1), updatedAt: past(1) });
    await assertFails(getDoc(doc(db("mallory"), path)));
  });
});

describe("imports", () => {
  const path = "users/alice/imports/job1";
  const job = (extra: DocumentData = {}) => ({
    type: "instagram",
    total: 1200,
    done: 0,
    cursor: 0,
    status: "running",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  });

  it("the owner can start one and record progress", async () => {
    await assertSucceeds(setDoc(doc(db("alice"), path), job()));
    await assertSucceeds(updateDoc(doc(db("alice"), path), { done: 500, cursor: 500, status: "paused", updatedAt: serverTimestamp() }));
  });
  it.each([
    ["more done than total", { done: 1201 }],
    ["an unknown status", { status: "hacked" }],
    ["a huge total", { total: LIMITS.importTotal + 1 }],
    ["a bad type", { type: "Instagram!" }],
  ])("rejects %s", async (_label, extra) => {
    await assertFails(setDoc(doc(db("alice"), path), job(extra)));
  });
  it("the type can't change after the start", async () => {
    await seed(path, { ...job(), createdAt: past(1), updatedAt: past(1) });
    await assertFails(updateDoc(doc(db("alice"), path), { type: "csv", updatedAt: serverTimestamp() }));
  });
  it("others can't read it", async () => {
    await seed(path, { ...job(), createdAt: past(1), updatedAt: past(1) });
    await assertFails(getDoc(doc(db("mallory"), path)));
  });
});
