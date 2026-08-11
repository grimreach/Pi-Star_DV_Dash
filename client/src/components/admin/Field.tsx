import type { ReactNode } from "react";

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-3">
      <span className="text-sm font-medium text-[color:var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-[color:var(--border-subtle)] bg-transparent px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

export function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" {...props} className={inputClass} />;
}

export function SelectInput({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={inputClass}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-ok-500" : "bg-[color:var(--border-subtle)]"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      {label && <span className="sr-only">{label}</span>}
    </button>
  );
}

export function SectionCard({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="panel mb-4">
      <div className="panel-header">{title}</div>
      <div className="p-4">{children}</div>
      {footer && <div className="border-t border-[color:var(--border-subtle)] px-4 py-3">{footer}</div>}
    </div>
  );
}
