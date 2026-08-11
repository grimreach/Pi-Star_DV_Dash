import type { SshAccessState } from "@pistar/shared";
import { useQuery } from "@tanstack/react-query";
import { SectionCard } from "../../components/admin/Field";
import { api } from "../../lib/api";

export function SshAccess() {
  const query = useQuery({ queryKey: ["ssh"], queryFn: () => api.get<SshAccessState>("/ssh"), refetchInterval: 10_000 });

  return (
    <SectionCard title="SSH Access">
      <p className="mb-3 text-xs text-[color:var(--text-muted)]">
        Mirrors admin/expert/ssh_access.php. Status below is read from the real device
        (<code>systemctl is-enabled ssh</code>, no elevated access needed) — toggling it isn't wired up yet, since
        that needs a new scoped sudo grant, same as the Configuration page's write support.
      </p>
      <div className="flex items-center gap-3">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${query.data?.enabled ? "bg-ok-500" : "bg-off-500"}`}
        />
        <span className="text-sm">
          {query.data === undefined
            ? "Checking…"
            : query.data.enabled
              ? "SSH access is enabled"
              : "SSH access is disabled"}
        </span>
      </div>
    </SectionCard>
  );
}
