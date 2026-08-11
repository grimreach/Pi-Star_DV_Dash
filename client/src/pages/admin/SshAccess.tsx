import type { SshAccessState } from "@pistar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionCard, Toggle } from "../../components/admin/Field";
import { api } from "../../lib/api";

export function SshAccess() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["ssh"], queryFn: () => api.get<SshAccessState>("/ssh") });

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => api.put<SshAccessState>("/ssh", { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ssh"] }),
  });

  return (
    <SectionCard title="SSH Access">
      <p className="mb-3 text-xs text-[color:var(--text-muted)]">
        Mirrors admin/expert/ssh_access.php — toggles the dropbear/sshd service. Simulated here.
      </p>
      <div className="flex items-center gap-3">
        <Toggle checked={Boolean(query.data?.enabled)} onChange={(v) => mutation.mutate(v)} />
        <span className="text-sm">{query.data?.enabled ? "SSH access is enabled" : "SSH access is disabled"}</span>
      </div>
    </SectionCard>
  );
}
