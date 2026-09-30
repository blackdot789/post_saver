import { describe, expect, it } from "vitest";
import {
  FULL_RESYNC_AFTER_MS,
  WATERMARK_SLACK_MS,
  advanceWatermark,
  planSync,
  purgePlan,
  retryDelayMs,
  syncStatus,
  untilPacificMidnightMs,
} from "./state.ts";

const DAY = 24 * 3600 * 1000;
const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);
const record = { watermarkMs: NOW - 3 * DAY, lastSyncMs: NOW - DAY, epoch: 1 };

describe("planSync", () => {
  it("first visit: everything", () => {
    expect(planSync(null, false, 1, NOW)).toEqual({ mode: "full", sinceMs: 0 });
  });
  it("a recent device with its cache: only what changed, from a little before the watermark", () => {
    expect(planSync(record, true, 1, NOW)).toEqual({ mode: "delta", sinceMs: record.watermarkMs - WATERMARK_SLACK_MS });
  });
  it("a wiped cache, a new epoch, or too long away: everything again", () => {
    expect(planSync(record, false, 1, NOW).mode).toBe("full");
    expect(planSync(record, true, 2, NOW).mode).toBe("full");
    expect(planSync({ ...record, lastSyncMs: NOW - FULL_RESYNC_AFTER_MS - 1 }, true, 1, NOW).mode).toBe("full");
    expect(planSync({ ...record, lastSyncMs: NOW - FULL_RESYNC_AFTER_MS + 1000 }, true, 1, NOW).mode).toBe("delta");
  });
  it("never starts before zero", () => {
    expect(planSync({ ...record, watermarkMs: 1000 }, true, 1, NOW).sinceMs).toBe(0);
  });
});

describe("advanceWatermark", () => {
  it("takes the highest server time seen and never goes backwards", () => {
    const next = advanceWatermark(record, [record.watermarkMs - 1000, record.watermarkMs + 5000], 1, NOW);
    expect(next).toEqual({ watermarkMs: record.watermarkMs + 5000, lastSyncMs: NOW, epoch: 1 });
    expect(advanceWatermark(next, [1], 1, NOW + 1).watermarkMs).toBe(next.watermarkMs);
  });
  it("an empty snapshot still counts as a sync", () => {
    expect(advanceWatermark(record, [], 1, NOW)).toEqual({ ...record, lastSyncMs: NOW });
    expect(advanceWatermark(null, [], 1, NOW)).toEqual({ watermarkMs: 0, lastSyncMs: NOW, epoch: 1 });
  });
  it("a new epoch starts the watermark over", () => {
    expect(advanceWatermark(record, [500], 2, NOW)).toEqual({ watermarkMs: 500, lastSyncMs: NOW, epoch: 2 });
  });
});

describe("syncStatus", () => {
  const base = { online: true, quotaExceeded: false, caughtUp: true, unreachable: false, pendingCount: 0 };
  it.each([
    ["synced", base],
    ["syncing", { ...base, caughtUp: false }],
    ["syncing", { ...base, pendingCount: 2 }],
    ["offline", { ...base, online: false }],
    ["offline", { ...base, online: false, pendingCount: 3 }],
    ["offline", { ...base, caughtUp: false, unreachable: true }],
    ["paused", { ...base, quotaExceeded: true, online: false }],
  ] as const)("%s", (expected, input) => {
    expect(syncStatus(input)).toBe(expected);
  });
});

describe("retry timing", () => {
  it("backs off from 30 s to 15 min", () => {
    expect(retryDelayMs("unavailable", 0, NOW)).toBe(30_000);
    expect(retryDelayMs("unavailable", 1, NOW)).toBe(60_000);
    expect(retryDelayMs("unavailable", 10, NOW)).toBe(15 * 60_000);
  });
  it("waits for the quota reset at Pacific midnight", () => {
    // 2026-09-30 12:00 UTC is 05:00 in Los Angeles (PDT): 19 h to midnight.
    expect(untilPacificMidnightMs(NOW)).toBe(19 * 3600 * 1000);
    expect(retryDelayMs("resource-exhausted", 0, NOW)).toBe(19 * 3600 * 1000 + 2 * 60_000);
  });
});

describe("purgePlan", () => {
  it("tombstones old trash and removes old tombstones, leaving the rest alone", () => {
    const rows = [
      { id: "live", deleted: false, status: "active" },
      { id: "fresh-trash", deleted: false, status: "trashed", trashedAtMs: NOW - 29 * DAY },
      { id: "old-trash", deleted: false, status: "trashed", trashedAtMs: NOW - 31 * DAY },
      { id: "fresh-tomb", deleted: true, updatedAtMs: NOW - 60 * DAY },
      { id: "old-tomb", deleted: true, updatedAtMs: NOW - 62 * DAY },
      { id: "no-dates", deleted: true },
    ];
    expect(purgePlan(rows, NOW)).toEqual([
      { id: "old-trash", action: "tombstone" },
      { id: "old-tomb", action: "delete" },
    ]);
  });
});
