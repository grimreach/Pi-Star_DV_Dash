import type { LogLine } from "@pistar/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { SectionCard } from "../../components/admin/Field";
import { api } from "../../lib/api";
import { useLiveStore } from "../../store/live";

export function LiveLogs() {
  const query = useQuery({ queryKey: ["logs"], queryFn: () => api.get<LogLine[]>("/logs") });
  const live = useLiveStore((s) => s.recentLogs);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lines = [...(query.data ?? []), ...live];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines.length]);

  return (
    <SectionCard title="Live Logs">
      <p className="mb-3 text-xs text-[color:var(--text-muted)]">
        Live tail equivalent to admin/live_modem_log.php, streamed over WebSocket.
      </p>
      <div ref={scrollRef} className="mono h-96 overflow-y-auto rounded-md bg-[color:var(--bg-app)] p-3 text-xs">
        {lines.length === 0 && <p className="text-[color:var(--text-muted)]">Waiting for log output…</p>}
        {lines.map((line, i) => (
          <div key={i}>
            <span className="text-[color:var(--text-muted)]">{new Date(line.timestamp).toLocaleTimeString()}</span>{" "}
            {line.text}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
