import type { WifiNetwork } from "@pistar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionCard } from "../../components/admin/Field";
import { api } from "../../lib/api";

export function Wifi() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["wifi"], queryFn: () => api.get<WifiNetwork[]>("/wifi") });

  const connect = useMutation({
    mutationFn: (ssid: string) => api.post<WifiNetwork[]>("/wifi/connect", { ssid }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wifi"] }),
  });
  const disconnect = useMutation({
    mutationFn: () => api.post<WifiNetwork[]>("/wifi/disconnect"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wifi"] }),
  });

  return (
    <SectionCard title="WiFi Networks">
      <p className="mb-3 text-xs text-[color:var(--text-muted)]">
        Simulated network scan. On a real device this drives <code>wpa_cli</code> as the admin/wifi.php page does.
      </p>
      <ul className="divide-y divide-[color:var(--border-subtle)]">
        {query.data?.map((net) => (
          <li key={net.ssid} className="flex items-center justify-between py-2 text-sm">
            <div>
              <div className="font-medium">
                {net.ssid} {net.secured && <span title="Secured">🔒</span>}
              </div>
              <div className="text-xs text-[color:var(--text-muted)]">Signal {net.signalPercent}%</div>
            </div>
            {net.connected ? (
              <div className="flex items-center gap-2">
                <span className="rounded bg-ok-500 px-2 py-0.5 text-xs font-semibold text-white">Connected</span>
                <button
                  onClick={() => disconnect.mutate()}
                  className="rounded-md border border-[color:var(--border-subtle)] px-3 py-1 text-xs"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => connect.mutate(net.ssid)}
                disabled={connect.isPending}
                className="rounded-md bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Connect
              </button>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
