import { DashboardGrid } from "../dashboard/DashboardGrid";
import { MobileWidgetStack } from "../dashboard/MobileWidgetStack";
import { useLayoutStore } from "../store/layout";

export function Dashboard() {
  const editing = useLayoutStore((s) => s.editing);
  const setEditing = useLayoutStore((s) => s.setEditing);
  const resetLayout = useLayoutStore((s) => s.resetLayout);

  return (
    <div>
      {/* Drag/resize editing only applies to the desktop grid below —
          not worth the touch-target trouble on the single-column mobile stack. */}
      <div className="mb-4 hidden items-center justify-end gap-2 lg:flex">
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
      <div className="hidden lg:block">
        <DashboardGrid />
      </div>
      <div className="lg:hidden">
        <MobileWidgetStack />
      </div>
    </div>
  );
}
