import { describe, expect, it } from "vitest";
import type { ActivityEntry } from "@pistar/shared";
import { computeActivityStats } from "./activityStats.js";

const HOUR = 60 * 60 * 1000;

function entry(overrides: Partial<ActivityEntry> & { timestamp: number; mode: ActivityEntry["mode"] }): ActivityEntry {
  return {
    id: crypto.randomUUID(),
    callsign: "W3EZE",
    target: "CQCQCQ",
    src: "RF",
    durationSeconds: 1,
    lossPercent: 0,
    berPercent: 0,
    ...overrides,
  };
}

describe("computeActivityStats", () => {
  it("produces exactly `hours` buckets, oldest to newest, ending on the current hour", () => {
    const now = Date.UTC(2026, 0, 1, 12, 30, 0); // 2026-01-01 12:30 UTC
    const stats = computeActivityStats([], now, 24);

    expect(stats.hourly).toHaveLength(24);
    expect(stats.hourly[23]!.hourStart).toBe(Date.UTC(2026, 0, 1, 12, 0, 0)); // current hour, floored
    expect(stats.hourly[0]!.hourStart).toBe(Date.UTC(2026, 0, 1, 12, 0, 0) - 23 * HOUR); // 23 hours earlier
    expect(stats.hourly.every((b) => b.count === 0)).toBe(true);
    expect(stats.totalContacts).toBe(0);
    expect(stats.byMode).toEqual([]);
  });

  it("counts an entry into the bucket for its hour", () => {
    const now = Date.UTC(2026, 0, 1, 12, 30, 0);
    const twoHoursAgo = Date.UTC(2026, 0, 1, 10, 15, 0);
    const stats = computeActivityStats([entry({ timestamp: twoHoursAgo, mode: "dmr" })], now, 24);

    expect(stats.totalContacts).toBe(1);
    // 10:00 bucket is 2 hours before the 12:00 current-hour bucket -> index 23-2=21
    expect(stats.hourly[21]!.count).toBe(1);
    expect(stats.hourly.filter((b) => b.count > 0)).toHaveLength(1);
  });

  it("excludes entries older than the window", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const twoDaysAgo = now - 48 * HOUR;
    const stats = computeActivityStats([entry({ timestamp: twoDaysAgo, mode: "dstar" })], now, 24);

    expect(stats.totalContacts).toBe(0);
    expect(stats.hourly.every((b) => b.count === 0)).toBe(true);
  });

  it("excludes entries timestamped after `now`", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const stats = computeActivityStats([entry({ timestamp: now + HOUR, mode: "ysf" })], now, 24);
    expect(stats.totalContacts).toBe(0);
  });

  it("counts an entry exactly at the window boundary as included", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const stats = computeActivityStats([entry({ timestamp: now - 24 * HOUR, mode: "dmr" })], now, 24);
    expect(stats.totalContacts).toBe(1);
  });

  it("tallies byMode counts and sorts descending by count", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const entries = [
      entry({ timestamp: now - HOUR, mode: "dmr" }),
      entry({ timestamp: now - HOUR, mode: "dmr" }),
      entry({ timestamp: now - HOUR, mode: "dstar" }),
      entry({ timestamp: now - HOUR, mode: "ysf" }),
    ];
    const stats = computeActivityStats(entries, now, 24);

    expect(stats.totalContacts).toBe(4);
    expect(stats.byMode[0]).toEqual({ mode: "dmr", count: 2 });
    expect(stats.byMode).toContainEqual({ mode: "dstar", count: 1 });
    expect(stats.byMode).toContainEqual({ mode: "ysf", count: 1 });
  });

  it("supports a custom window size", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const stats = computeActivityStats([entry({ timestamp: now - HOUR, mode: "dmr" })], now, 6);
    expect(stats.hourly).toHaveLength(6);
    expect(stats.totalContacts).toBe(1);
  });
});
