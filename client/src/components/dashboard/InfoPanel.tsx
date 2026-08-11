import type { ReactNode } from "react";

export function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel mb-4">
      <div className="panel-header">{title}</div>
      <div className="divide-y divide-[color:var(--border-subtle)] text-sm">{children}</div>
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-[color:var(--text-muted)]">{label}</span>
      <span className="mono font-medium">{value}</span>
    </div>
  );
}

export function StatusGrid({
  items,
}: {
  items: { label: string; active: boolean }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-px bg-[color:var(--border-subtle)] p-px">
      {items.map((item) => (
        <div
          key={item.label}
          className={`px-2 py-2 text-center text-xs font-semibold ${
            item.active ? "bg-ok-500 text-white" : "bg-[color:var(--bg-surface)] text-[color:var(--text-muted)]"
          }`}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
