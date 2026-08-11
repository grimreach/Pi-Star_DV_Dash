import { useQuery } from "@tanstack/react-query";
import type { LinkState } from "@pistar/shared";
import { api } from "../../lib/api";
import { AuthGate } from "./AuthGate";

const PROTOCOL_LABELS: Record<string, string> = {
  dstar: "D-Star",
  dmr: "DMR",
  ysf: "YSF",
  p25: "P25",
  nxdn: "NXDN",
  m17: "M17",
};

function LinkStatusList() {
  const query = useQuery({
    queryKey: ["links"],
    queryFn: () => api.get<LinkState[]>("/links"),
    staleTime: 5000,
  });

  if (query.isLoading || !query.data) {
    return <div className="p-3 text-xs text-[color:var(--text-muted)]">Loading…</div>;
  }

  return (
    <div className="divide-y divide-[color:var(--border-subtle)] text-sm">
      {query.data.map((link) => (
        <div key={link.protocol} className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[color:var(--text-muted)]">{PROTOCOL_LABELS[link.protocol] ?? link.protocol}</span>
          <span className={`mono font-medium ${link.linked ? "text-ok-600" : "text-[color:var(--text-muted)]"}`}>
            {link.linked ? (link.current?.name ?? "Linked") : "Not linked"}
          </span>
        </div>
      ))}
    </div>
  );
}

// GET /links requires auth (routes/links.ts's requireAuth), unlike the
// WS-broadcast dashboard data — so anonymous viewers get the sign-in
// placeholder instead of a 401.
export function LinkStatusWidget() {
  return (
    <AuthGate>
      <LinkStatusList />
    </AuthGate>
  );
}
