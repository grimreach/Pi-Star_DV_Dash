import type { LinkProtocol, LinkState } from "@pistar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionCard } from "../../components/admin/Field";
import { api } from "../../lib/api";

const LABELS: Record<LinkProtocol, string> = {
  dstar: "D-Star Reflector",
  dmr: "DMR Talkgroup",
  ysf: "YSF Room",
  p25: "P25 Reflector",
  nxdn: "NXDN Reflector",
  m17: "M17 Reflector",
};

export function LinkManager() {
  const query = useQuery({ queryKey: ["links"], queryFn: () => api.get<LinkState[]>("/links") });

  return (
    <div>
      {query.data?.map((link) => <ProtocolCard key={link.protocol} link={link} />)}
    </div>
  );
}

function ProtocolCard({ link }: { link: LinkState }) {
  const queryClient = useQueryClient();

  const linkMutation = useMutation({
    mutationFn: (targetId: string) => api.post<LinkState>(`/links/${link.protocol}/link`, { targetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const unlinkMutation = useMutation({
    mutationFn: () => api.post<LinkState>(`/links/${link.protocol}/unlink`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <SectionCard title={LABELS[link.protocol]}>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span>
          Status:{" "}
          {link.linked ? (
            <span className="font-semibold text-ok-600">Linked to {link.current?.name}</span>
          ) : (
            <span className="text-[color:var(--text-muted)]">Not linked</span>
          )}
        </span>
        {link.linked && (
          <button
            onClick={() => unlinkMutation.mutate()}
            disabled={unlinkMutation.isPending}
            className="rounded-md border border-brand-500 px-3 py-1 text-xs font-semibold text-brand-500 hover:bg-brand-50"
          >
            Unlink
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {link.available.map((target) => (
          <button
            key={target.id}
            onClick={() => linkMutation.mutate(target.id)}
            disabled={linkMutation.isPending || (link.linked && link.current?.id === target.id)}
            className={`rounded-md border px-3 py-2 text-left text-xs ${
              link.current?.id === target.id
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-[color:var(--border-subtle)] hover:border-brand-500"
            }`}
          >
            <div className="font-semibold">{target.name}</div>
            <div className="text-[color:var(--text-muted)]">{target.description}</div>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
