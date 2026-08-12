import type { ActivityEntry, ActivityStats, Mode } from "@pistar/shared";

/**
 * Pure — buckets activity entries into hourly counts and per-mode totals
 * over the trailing `hours` window ending at `now`. Easy to unit-test
 * without real time or real activity data.
 */
export function computeActivityStats(entries: ActivityEntry[], now: number, hours = 24): ActivityStats {
  const hourMs = 60 * 60 * 1000;
  const windowStart = now - hours * hourMs;
  const currentHourStart = Math.floor(now / hourMs) * hourMs;

  const hourly = [];
  for (let i = hours - 1; i >= 0; i--) {
    hourly.push({ hourStart: currentHourStart - i * hourMs, count: 0 });
  }

  const modeCounts = new Map<Mode, number>();
  let totalContacts = 0;

  for (const entry of entries) {
    if (entry.timestamp < windowStart || entry.timestamp > now) continue;
    totalContacts++;
    modeCounts.set(entry.mode, (modeCounts.get(entry.mode) ?? 0) + 1);

    const entryHourStart = Math.floor(entry.timestamp / hourMs) * hourMs;
    const hourOffset = (currentHourStart - entryHourStart) / hourMs;
    const idx = hours - 1 - hourOffset;
    if (idx >= 0 && idx < hourly.length) hourly[idx]!.count++;
  }

  const byMode = [...modeCounts.entries()]
    .map(([mode, count]) => ({ mode, count }))
    .sort((a, b) => b.count - a.count);

  return { hourly, byMode, totalContacts };
}
