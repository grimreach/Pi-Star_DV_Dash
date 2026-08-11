import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { SectionCard } from "../../components/admin/Field";
import { api } from "../../lib/api";

export function Power() {
  const [result, setResult] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (action: "reboot" | "shutdown") => api.post<{ message: string }>("/power", { action }),
    onSuccess: (data) => setResult(data.message),
  });

  return (
    <SectionCard title="Power">
      <p className="mb-4 text-xs text-[color:var(--text-muted)]">
        Equivalent to admin/power.php. This demo only simulates the request — it never issues a real{" "}
        <code>shutdown</code> command.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => mutation.mutate("reboot")}
          disabled={mutation.isPending}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          Reboot
        </button>
        <button
          onClick={() => mutation.mutate("shutdown")}
          disabled={mutation.isPending}
          className="rounded-md border border-brand-500 px-4 py-2 text-sm font-semibold text-brand-500 hover:bg-brand-50"
        >
          Shutdown
        </button>
      </div>
      {result && <p className="mt-3 text-sm text-ok-600">{result}</p>}
    </SectionCard>
  );
}
