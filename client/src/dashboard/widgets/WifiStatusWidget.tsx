import { useQuery } from "@tanstack/react-query";
import { InfoRow } from "../../components/dashboard/InfoPanel";
import { api } from "../../lib/api";
import { AuthGate } from "./AuthGate";

interface WifiStatus {
  connected: boolean;
  ssid: string | null;
}

function WifiStatusInner() {
  const query = useQuery({
    queryKey: ["wifi-status"],
    queryFn: () => api.get<WifiStatus>("/wifi/status"),
    staleTime: 5000,
    refetchInterval: 15000,
  });

  if (query.isLoading || !query.data) {
    return <div className="p-3 text-xs text-[color:var(--text-muted)]">Loading…</div>;
  }

  return (
    <div className="divide-y divide-[color:var(--border-subtle)] text-sm">
      <InfoRow
        label="Status"
        value={<span className={query.data.connected ? "text-ok-600" : "text-[color:var(--text-muted)]"}>{query.data.connected ? "Connected" : "Disconnected"}</span>}
      />
      <InfoRow label="SSID" value={query.data.ssid ?? "–"} />
    </div>
  );
}

// GET /wifi/status requires auth (routes/wifi.ts's requireAuth) — sign-in
// placeholder for anonymous viewers, same as the other admin-data widgets.
export function WifiStatusWidget() {
  return (
    <AuthGate>
      <WifiStatusInner />
    </AuthGate>
  );
}
