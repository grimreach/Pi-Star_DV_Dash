import type { CalibrationMode, CalibrationState } from "@pistar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SectionCard } from "../../components/admin/Field";
import { api } from "../../lib/api";
import { useLiveStore } from "../../store/live";

const MODES: { key: CalibrationMode; label: string }[] = [
  { key: "dstar", label: "D-Star" },
  { key: "dmr", label: "DMR" },
  { key: "ysf", label: "YSF" },
  { key: "p25", label: "P25" },
  { key: "nxdn", label: "NXDN" },
];

const STEPS = [25, 50, 100] as const;

export function Calibration() {
  const queryClient = useQueryClient();
  const live = useLiveStore((s) => s.calibration);
  const [notice, setNotice] = useState<string | null>(null);
  const [berHistory, setBerHistory] = useState<number[]>([]);

  const query = useQuery({ queryKey: ["calibration"], queryFn: () => api.get<CalibrationState>("/calibration") });
  const state = live ?? query.data;

  useEffect(() => {
    if (state) setBerHistory((h) => [...h, state.current.berPercent].slice(-180));
  }, [state?.current.frames]); // eslint-disable-line react-hooks/exhaustive-deps

  const startMutation = useMutation({
    mutationFn: () => api.post<{ ok: boolean; message?: string }>("/calibration/start"),
    onSuccess: (result) => {
      if (!result.ok) setNotice(result.message ?? "Failed to start calibration.");
      else {
        setNotice(null);
        setBerHistory([]);
      }
      queryClient.invalidateQueries({ queryKey: ["calibration"] });
    },
  });
  const stopMutation = useMutation({ mutationFn: () => api.post("/calibration/stop") });
  const modeMutation = useMutation({ mutationFn: (mode: CalibrationMode) => api.post("/calibration/mode", { mode }) });
  const freqMutation = useMutation({ mutationFn: (direction: "up" | "down") => api.post("/calibration/frequency", { direction }) });
  const stepMutation = useMutation({ mutationFn: (step: number) => api.post("/calibration/step", { step }) });
  const saveOffsetMutation = useMutation({
    mutationFn: () => api.post<{ ok: boolean; message?: string }>("/calibration/saveoffset"),
    onSuccess: (result) => setNotice(result.ok ? "Offset saved to /etc/mmdvmhost." : (result.message ?? "Save failed.")),
  });

  return (
    <SectionCard title="Calibration">
      <p className="mb-4 text-xs text-[color:var(--text-muted)]">
        Equivalent to admin/calibration.php — starts MMDVMCal against the modem directly (takes MMDVMHost offline
        while running), controlled over a live UDP command socket, matching the original's protocol exactly.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending || state?.running}
          className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          Start
        </button>
        <button
          onClick={() => stopMutation.mutate()}
          disabled={!state?.running}
          className="rounded-md border border-[color:var(--border-subtle)] px-4 py-1.5 text-sm font-semibold disabled:opacity-60"
        >
          Stop
        </button>
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${state?.running ? "bg-ok-500" : "bg-off-500"}`}
          title={state?.running ? "Running" : "Idle"}
        />
        {notice && <span className="text-xs text-[color:var(--text-muted)]">{notice}</span>}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => modeMutation.mutate(m.key)}
            disabled={!state?.running}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
              state?.activeMode === m.key ? "bg-brand-500 text-white" : "bg-[color:var(--bg-app)] text-[color:var(--text-muted)]"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${state?.activeMode === m.key ? "bg-white" : "bg-off-500"}`} />
            {m.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="panel p-3">
          <div className="mb-2 text-xs font-semibold text-[color:var(--text-muted)]">Frequency</div>
          <div className="mono mb-1 text-sm">Base: {((state?.baseFrequencyHz ?? 0) / 1e6).toFixed(6)} MHz</div>
          <div className="mono mb-2 text-sm">
            Current: {(((state?.baseFrequencyHz ?? 0) + (state?.offsetHz ?? 0)) / 1e6).toFixed(6)} MHz
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => freqMutation.mutate("down")}
              disabled={!state?.running}
              className="rounded-md border border-[color:var(--border-subtle)] px-3 py-1 text-sm disabled:opacity-40"
            >
              −
            </button>
            <span className="mono w-16 text-center text-sm">{state?.offsetHz ?? 0} Hz</span>
            <button
              onClick={() => freqMutation.mutate("up")}
              disabled={!state?.running}
              className="rounded-md border border-[color:var(--border-subtle)] px-3 py-1 text-sm disabled:opacity-40"
            >
              +
            </button>
            <div className="ml-3 flex gap-1">
              {STEPS.map((step) => (
                <button
                  key={step}
                  onClick={() => stepMutation.mutate(step)}
                  disabled={!state?.running}
                  className={`rounded-md px-2 py-1 text-xs disabled:opacity-40 ${
                    state?.stepHz === step ? "bg-brand-500 text-white" : "bg-[color:var(--bg-app)] text-[color:var(--text-muted)]"
                  }`}
                >
                  {step}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => saveOffsetMutation.mutate()}
            disabled={!state || saveOffsetMutation.isPending}
            className="mt-3 rounded-md border border-brand-500 px-3 py-1.5 text-xs font-semibold text-brand-500 hover:bg-brand-50 disabled:opacity-40"
          >
            Save Offset to /etc/mmdvmhost
          </button>
        </div>

        <div className="panel p-3">
          <div className="mb-2 text-xs font-semibold text-[color:var(--text-muted)]">BER Stats</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[color:var(--text-muted)]">
                <th className="text-left font-medium"></th>
                <th className="text-right font-medium">Current</th>
                <th className="text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="mono">
              <tr>
                <td>Frames</td>
                <td className="text-right">{state?.current.frames ?? 0}</td>
                <td className="text-right">{state?.total.frames ?? 0}</td>
              </tr>
              <tr>
                <td>Bits</td>
                <td className="text-right">{state?.current.bits ?? 0}</td>
                <td className="text-right">{state?.total.bits ?? 0}</td>
              </tr>
              <tr>
                <td>Errors</td>
                <td className="text-right">{state?.current.errors ?? 0}</td>
                <td className="text-right">{state?.total.errors ?? 0}</td>
              </tr>
              <tr>
                <td>BER</td>
                <td className="text-right">{(state?.current.berPercent ?? 0).toFixed(2)}%</td>
                <td className="text-right">{(state?.total.berPercent ?? 0).toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <BerChart history={berHistory} />
    </SectionCard>
  );
}

function BerChart({ history }: { history: number[] }) {
  const width = 700;
  const height = 120;
  const maxBer = Math.max(5, ...history);
  const points = history
    .map((v, i) => {
      const x = history.length > 1 ? (i / (history.length - 1)) * width : 0;
      const y = height - (Math.min(v, maxBer) / maxBer) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="panel p-3">
      <div className="mb-2 text-xs font-semibold text-[color:var(--text-muted)]">Bit Error Rate (%)</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" preserveAspectRatio="none">
        {history.length > 1 && (
          <polyline points={points} fill="none" stroke="var(--color-brand-500)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    </div>
  );
}
