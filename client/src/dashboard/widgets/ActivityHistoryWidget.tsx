import { useQuery } from "@tanstack/react-query";
import type { ActivityStats } from "@pistar/shared";
import { MODE_LABELS } from "../../components/dashboard/ActivityTable";
import { api } from "../../lib/api";

function formatHourLabel(hourStart: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(hourStart);
}

// Public endpoint (GET /api/dashboard/activity-stats), same as the rest of
// the dashboard's read-only activity data — no auth needed. Polled rather
// than WS-pushed since it's a 24h aggregate, not something that needs
// per-contact freshness.
export function ActivityHistoryWidget() {
  const query = useQuery({
    queryKey: ["activity-stats"],
    queryFn: () => api.get<ActivityStats>("/dashboard/activity-stats"),
    refetchInterval: 60_000,
  });

  if (query.isLoading || !query.data) {
    return <div className="p-3 text-xs text-[color:var(--text-muted)]">Loading…</div>;
  }

  const { hourly, byMode, totalContacts } = query.data;

  if (totalContacts === 0) {
    return (
      <div className="p-3 text-xs text-[color:var(--text-muted)]">
        No activity in the last 24h yet.
      </div>
    );
  }

  const maxCount = Math.max(1, ...hourly.map((b) => b.count));
  const width = 480;
  const height = 80;
  const barGap = 2;
  const barWidth = width / hourly.length - barGap;

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 text-xs">
      <div className="text-[color:var(--text-muted)]">
        <span className="text-lg font-semibold text-[color:var(--text-primary)]">{totalContacts}</span> contacts in the last 24h
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full shrink-0" preserveAspectRatio="none">
        {hourly.map((bucket, i) => {
          const barHeight = (bucket.count / maxCount) * height;
          return (
            <rect
              key={bucket.hourStart}
              x={i * (barWidth + barGap)}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              fill="var(--color-brand-500)"
              rx={1}
            >
              <title>
                {formatHourLabel(bucket.hourStart)}: {bucket.count} contact{bucket.count === 1 ? "" : "s"}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="flex flex-col gap-1.5">
        {byMode.map(({ mode, count }) => (
          <div key={mode} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-[color:var(--text-muted)]">{MODE_LABELS[mode] ?? mode}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--border-subtle)]">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${(count / totalContacts) * 100}%` }} />
            </div>
            <span className="mono w-6 shrink-0 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
