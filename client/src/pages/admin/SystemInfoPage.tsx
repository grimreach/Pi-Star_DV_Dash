import type { SystemInfo } from "@pistar/shared";
import { useQuery } from "@tanstack/react-query";
import { InfoRow, InfoPanel } from "../../components/dashboard/InfoPanel";
import { formatUptime } from "../../lib/format";
import { api } from "../../lib/api";
import { useLiveStore } from "../../store/live";

export function SystemInfoPage() {
  const live = useLiveStore((s) => s.system);
  const query = useQuery({ queryKey: ["system"], queryFn: () => api.get<SystemInfo>("/system"), refetchInterval: 5000 });
  const data = live ?? query.data;

  if (!data) return <div className="p-4 text-sm text-[color:var(--text-muted)]">Loading…</div>;

  return (
    <InfoPanel title="System Info">
      <InfoRow label="Hostname" value={data.hostname} />
      <InfoRow label="Pi-Star Version" value={data.pistarVersion} />
      <InfoRow label="Dashboard Version" value={data.dashboardVersion} />
      <InfoRow label="Uptime" value={formatUptime(data.uptimeSeconds)} />
      <InfoRow label="IP Address" value={data.ipAddress} />
      <InfoRow label="CPU Temp" value={`${data.cpuTemperatureC.toFixed(1)} °C`} />
      <InfoRow label="Load Avg" value={data.cpuLoad.map((n) => n.toFixed(2)).join(" / ")} />
      <InfoRow label="Memory" value={`${data.memoryUsedMb} / ${data.memoryTotalMb} MB`} />
      <InfoRow label="Disk" value={`${(data.diskUsedMb / 1024).toFixed(1)} / ${(data.diskTotalMb / 1024).toFixed(1)} GB`} />
    </InfoPanel>
  );
}
