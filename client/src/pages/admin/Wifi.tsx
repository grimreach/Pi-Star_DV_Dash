import type { WifiNetwork } from "@pistar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SectionCard } from "../../components/admin/Field";
import { api } from "../../lib/api";

interface WifiActionResponse {
  real: boolean;
  success: boolean;
  message: string;
}

export function Wifi() {
  const queryClient = useQueryClient();
  const [openPasswordFor, setOpenPasswordFor] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["wifi"],
    queryFn: () => api.get<WifiNetwork[]>("/wifi"),
    staleTime: 0, // scanning takes ~3s server-side; don't skip a real refetch on remount
  });

  const connect = useMutation({
    mutationFn: (vars: { ssid: string; password?: string }) => api.post<WifiActionResponse>("/wifi/connect", vars),
    onSuccess: (result) => {
      setLastMessage(result.message);
      setOpenPasswordFor(null);
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["wifi"] });
    },
  });

  const disconnect = useMutation({
    mutationFn: () => api.post<WifiActionResponse>("/wifi/disconnect"),
    onSuccess: (result) => {
      setLastMessage(result.message);
      queryClient.invalidateQueries({ queryKey: ["wifi"] });
    },
  });

  const busy = connect.isPending || disconnect.isPending;

  return (
    <SectionCard title="WiFi Networks">
      <p className="mb-3 text-xs text-[color:var(--text-muted)]">
        Real scan + connect via <code>wpa_cli</code> when available, falling back to a simulated list otherwise.
        Connecting can take up to ~15 seconds — it waits for an actual association before reporting success, and
        automatically cleans up if it fails rather than leaving a broken network profile behind.
      </p>
      {query.isFetching && <p className="mb-2 text-xs text-[color:var(--text-muted)]">Scanning…</p>}
      {connect.isPending && <p className="mb-2 text-xs text-[color:var(--text-muted)]">Connecting…</p>}
      {lastMessage && !busy && <p className="mb-2 text-xs text-[color:var(--text-muted)]">{lastMessage}</p>}
      <ul className="divide-y divide-[color:var(--border-subtle)]">
        {query.data?.map((net) => (
          <li key={net.ssid} className="py-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">
                  {net.ssid} {net.secured && <span title="Secured">🔒</span>}
                </div>
                <div className="text-xs text-[color:var(--text-muted)]">Signal {net.signalPercent}%</div>
              </div>
              {net.connected ? (
                <div className="flex items-center gap-2">
                  <span className="rounded bg-ok-500 px-2 py-0.5 text-xs font-semibold text-white">Connected</span>
                  <button
                    onClick={() => disconnect.mutate()}
                    disabled={busy}
                    className="rounded-md border border-[color:var(--border-subtle)] px-3 py-1 text-xs disabled:opacity-60"
                  >
                    Disconnect
                  </button>
                </div>
              ) : net.secured ? (
                <button
                  onClick={() => setOpenPasswordFor(openPasswordFor === net.ssid ? null : net.ssid)}
                  disabled={busy}
                  className="rounded-md bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                >
                  Connect
                </button>
              ) : (
                <button
                  onClick={() => connect.mutate({ ssid: net.ssid })}
                  disabled={busy}
                  className="rounded-md bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                >
                  Connect
                </button>
              )}
            </div>
            {openPasswordFor === net.ssid && (
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  connect.mutate({ ssid: net.ssid, password });
                }}
              >
                <input
                  type="password"
                  autoFocus
                  placeholder="Network password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-[color:var(--border-subtle)] bg-transparent px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy || password.length === 0}
                  className="shrink-0 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                >
                  Join
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
