import { formatTime } from "../../lib/format";
import { useLiveStore } from "../../store/live";

// log:line is WS-broadcast publicly (same as the rest of the dashboard),
// so this needs no auth gate — it's a read-only tail, same data anonymous
// viewers already see reflected in the activity feed.
export function LiveLogWidget() {
  const lines = useLiveStore((s) => s.recentLogs);

  if (lines.length === 0) {
    return <div className="p-3 text-xs text-[color:var(--text-muted)]">Waiting for log activity…</div>;
  }

  const tail = lines.slice(-40);

  return (
    <div className="mono h-full overflow-y-auto px-3 py-2 text-[11px] leading-relaxed">
      {tail.map((line, i) => (
        <div key={`${line.timestamp}-${i}`} className="whitespace-pre-wrap break-all text-[color:var(--text-primary)]">
          <span className="text-[color:var(--text-muted)]">{formatTime(line.timestamp)}</span> {line.text}
        </div>
      ))}
    </div>
  );
}
