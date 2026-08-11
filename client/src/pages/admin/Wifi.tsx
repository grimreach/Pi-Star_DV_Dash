import type { WifiNetwork } from "@pistar/shared";
import { useQuery } from "@tanstack/react-query";
import { SectionCard } from "../../components/admin/Field";
import { api } from "../../lib/api";

export function Wifi() {
  const query = useQuery({
    queryKey: ["wifi"],
    queryFn: () => api.get<WifiNetwork[]>("/wifi"),
    staleTime: 0, // scanning takes ~3s server-side; don't skip a real refetch on remount
  });

  return (
    <SectionCard title="WiFi Networks">
      <p className="mb-3 text-xs text-[color:var(--text-muted)]">
        Real scan via <code>wpa_cli</code> when available (takes a few seconds), falling back to a simulated list
        otherwise. Connecting/disconnecting isn't wired up yet — that changes what network this device is on, so
        it's deliberately left for a separate, more careful pass rather than built alongside a read-only scan.
      </p>
      {query.isFetching && <p className="mb-2 text-xs text-[color:var(--text-muted)]">Scanning…</p>}
      <ul className="divide-y divide-[color:var(--border-subtle)]">
        {query.data?.map((net) => (
          <li key={net.ssid} className="flex items-center justify-between py-2 text-sm">
            <div>
              <div className="font-medium">
                {net.ssid} {net.secured && <span title="Secured">🔒</span>}
              </div>
              <div className="text-xs text-[color:var(--text-muted)]">Signal {net.signalPercent}%</div>
            </div>
            {net.connected && (
              <span className="rounded bg-ok-500 px-2 py-0.5 text-xs font-semibold text-white">Connected</span>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
