import { WIDGET_REGISTRY } from "./registry";
import { useLayoutStore } from "../store/layout";

// Below the `lg` breakpoint, react-grid-layout's fixed 12-column grid
// squeezes every widget into an unreadably narrow strip — so instead of
// making the grid itself responsive, mobile gets a plain full-width stack
// in the same reading order as the user's desktop layout (sorted by y,
// then x), with no drag/resize (not worth the touch-target trouble at
// this width).
const ROW_HEIGHT = 32;
const ROW_MARGIN = 12;

function heightPx(rows: number): number {
  return rows * ROW_HEIGHT + (rows - 1) * ROW_MARGIN;
}

export function MobileWidgetStack() {
  const layout = useLayoutStore((s) => s.layout);

  const ordered = [...WIDGET_REGISTRY].sort((a, b) => {
    const posA = layout[a.id] ?? a.defaultLayout;
    const posB = layout[b.id] ?? b.defaultLayout;
    return posA.y - posB.y || posA.x - posB.x;
  });

  return (
    <div className="flex flex-col gap-4">
      {ordered.map((w) => {
        const pos = layout[w.id] ?? w.defaultLayout;
        const Widget = w.component;
        return (
          <div key={w.id} className="panel flex flex-col overflow-hidden" style={{ height: heightPx(pos.h) }}>
            <div className="panel-header">{w.title}</div>
            <div className="min-h-0 flex-1 overflow-auto">
              <Widget />
            </div>
          </div>
        );
      })}
    </div>
  );
}
