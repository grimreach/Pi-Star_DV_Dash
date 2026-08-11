import type { CalibrationState } from "@pistar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionCard } from "../../components/admin/Field";
import { api } from "../../lib/api";

const MODES: { key: CalibrationState["mode"]; label: string }[] = [
  { key: "off", label: "Off" },
  { key: "rx", label: "RX Only" },
  { key: "tx", label: "TX Only" },
  { key: "duplex", label: "Duplex" },
];

export function Calibration() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["calibration"], queryFn: () => api.get<CalibrationState>("/calibration") });

  const mutation = useMutation({
    mutationFn: (mode: CalibrationState["mode"]) => api.put<CalibrationState>("/calibration", { mode }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calibration"] }),
  });

  return (
    <SectionCard title="Calibration">
      <p className="mb-3 text-xs text-[color:var(--text-muted)]">
        Equivalent to admin/calibration.php's RSSI/level tuning mode. Simulated RSSI shown when active.
      </p>
      <div className="mb-4 flex gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => mutation.mutate(m.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              query.data?.mode === m.key ? "bg-brand-500 text-white" : "bg-[color:var(--bg-app)] text-[color:var(--text-muted)]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {query.data?.mode !== "off" && (
        <div className="panel p-4 text-center">
          <div className="text-xs text-[color:var(--text-muted)]">RSSI</div>
          <div className="mono text-2xl font-bold">{query.data?.rssiDbm} dBm</div>
        </div>
      )}
    </SectionCard>
  );
}
