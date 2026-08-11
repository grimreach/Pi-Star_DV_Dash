import { InfoRow } from "../../components/dashboard/InfoPanel";
import { formatUptime } from "../../lib/format";
import { useLiveStore } from "../../store/live";

// system:update is WS-broadcast to every connected client regardless of
// login state (matches the rest of the dashboard's public read-only
// philosophy), and the server pushes it on an interval — so this widget
// relies purely on the live store rather than the auth-gated GET /system
// REST route, which would 401 for anonymous dashboard viewers.
export function SystemInfoWidget() {
  const data = useLiveStore((s) => s.system);

  if (!data) return <div className="p-3 text-xs text-[color:var(--text-muted)]">Loading…</div>;

  return (
    <div className="divide-y divide-[color:var(--border-subtle)] text-sm">
      <InfoRow label="Host" value={data.hostname} />
      <InfoRow label="Uptime" value={formatUptime(data.uptimeSeconds)} />
      <InfoRow label="CPU Temp" value={`${data.cpuTemperatureC.toFixed(1)}°C`} />
      <InfoRow label="Load" value={data.cpuLoad.map((n) => n.toFixed(2)).join(" / ")} />
      <InfoRow label="Memory" value={`${data.memoryUsedMb} / ${data.memoryTotalMb} MB`} />
      <InfoRow label="Disk" value={`${data.diskUsedMb} / ${data.diskTotalMb} MB`} />
      <InfoRow label="IP" value={data.ipAddress} />
    </div>
  );
}
