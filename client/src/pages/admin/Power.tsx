import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { SectionCard } from "../../components/admin/Field";
import { api } from "../../lib/api";

export function Power() {
  const navigate = useNavigate();
  const [result, setResult] = useState<string | null>(null);
  const [rebootCountdown, setRebootCountdown] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: (action: "reboot" | "shutdown") => api.post<{ message: string; accepted: boolean }>("/power", { action }),
    onSuccess: (data, action) => {
      setResult(data.message);
      if (action === "reboot") setRebootCountdown(90);
    },
  });

  useEffect(() => {
    if (rebootCountdown === null) return;
    if (rebootCountdown <= 0) {
      navigate("/");
      return;
    }
    const timer = setTimeout(() => setRebootCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [rebootCountdown, navigate]);

  function confirmAndRun(action: "reboot" | "shutdown") {
    const message =
      action === "reboot"
        ? "Reboot this Pi-Star device now? It'll be back in about 90 seconds."
        : "Shut this Pi-Star device down now? It will NOT come back up remotely — you'll need to physically power-cycle it.";
    if (window.confirm(message)) {
      mutation.mutate(action);
    }
  }

  const busy = mutation.isPending || rebootCountdown !== null;

  return (
    <SectionCard title="Power">
      <p className="mb-4 text-xs text-[color:var(--text-muted)]">
        Equivalent to admin/power.php — syncs the disk and remounts read-only before the actual power command, same
        as the original.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => confirmAndRun("reboot")}
          disabled={busy}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          Reboot
        </button>
        <button
          onClick={() => confirmAndRun("shutdown")}
          disabled={busy}
          className="rounded-md border border-brand-500 px-4 py-2 text-sm font-semibold text-brand-500 hover:bg-brand-50"
        >
          Shutdown
        </button>
      </div>
      {result && <p className="mt-3 text-sm text-ok-600">{result}</p>}
      {rebootCountdown !== null && (
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
          Returning to the dashboard in {rebootCountdown}s…
        </p>
      )}
    </SectionCard>
  );
}
