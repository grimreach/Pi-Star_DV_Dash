import type { FirmwareUpgradeState } from "@pistar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionCard } from "../../components/admin/Field";
import { api } from "../../lib/api";
import { useLiveStore } from "../../store/live";

export function Firmware() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["firmware"], queryFn: () => api.get<FirmwareUpgradeState>("/firmware") });
  const live = useLiveStore((s) => s.firmware);
  const data = live ?? query.data;

  const upgrade = useMutation({
    mutationFn: () => api.post<FirmwareUpgradeState>("/firmware/upgrade"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firmware"] }),
  });

  if (!data) return null;

  return (
    <SectionCard title="Firmware Upgrade">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span>
          Current: <strong className="mono">{data.currentVersion}</strong> · Latest:{" "}
          <strong className="mono">{data.latestVersion}</strong>
        </span>
        <button
          onClick={() => upgrade.mutate()}
          disabled={data.inProgress || data.currentVersion === data.latestVersion}
          className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {data.currentVersion === data.latestVersion ? "Up to date" : "Upgrade firmware"}
        </button>
      </div>
      {(data.inProgress || data.logLines.length > 0) && (
        <div>
          <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-[color:var(--border-subtle)]">
            <div className="h-full bg-ok-500 transition-all" style={{ width: `${data.progressPercent}%` }} />
          </div>
          <div className="mono h-32 overflow-y-auto rounded-md bg-[color:var(--bg-app)] p-3 text-xs">
            {data.logLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
