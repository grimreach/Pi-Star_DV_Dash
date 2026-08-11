import { DashboardGrid } from "../dashboard/DashboardGrid";
import { useLayoutStore } from "../store/layout";

export function Dashboard() {
  const editing = useLayoutStore((s) => s.editing);
  const setEditing = useLayoutStore((s) => s.setEditing);
  const resetLayout = useLayoutStore((s) => s.resetLayout);

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2">
        {editing && (
          <button
            type="button"
            onClick={resetLayout}
            className="rounded-md border border-[color:var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] hover:bg-[color:var(--bg-panel-header)]/10"
          >
            Reset layout
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
        >
          {editing ? "Done" : "Edit layout"}
        </button>
      </div>
      <DashboardGrid />
    </div>
  );
}
