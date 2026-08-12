import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { ReactGridLayout as GridLayout, WidthProvider } from "react-grid-layout/legacy";
import type { Layout, LayoutItem } from "react-grid-layout";
import { WIDGET_MAP, WIDGET_REGISTRY } from "./registry";
import { useLayoutStore } from "../store/layout";

const GridLayoutWithWidth = WidthProvider(GridLayout);

export function DashboardGrid() {
  const editing = useLayoutStore((s) => s.editing);
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);

  const items: Layout = WIDGET_REGISTRY.map((w) => {
    const pos = layout[w.id] ?? w.defaultLayout;
    return { i: w.id, x: pos.x, y: pos.y, w: pos.w, h: pos.h, minW: w.minW, minH: w.minH };
  });

  function handleLayoutChange(next: readonly LayoutItem[]) {
    const nextLayout = Object.fromEntries(next.map((item) => [item.i, { x: item.x, y: item.y, w: item.w, h: item.h }]));
    setLayout(nextLayout);
  }

  return (
    <GridLayoutWithWidth
      layout={items}
      cols={12}
      rowHeight={32}
      margin={[12, 12]}
      containerPadding={[0, 0]}
      isDraggable={editing}
      isResizable={editing}
      resizeHandles={["s", "e", "se"]}
      draggableHandle=".widget-drag-handle"
      onLayoutChange={handleLayoutChange}
    >
      {WIDGET_REGISTRY.map((w) => {
        const Widget = WIDGET_MAP.get(w.id)!.component;
        return (
          // Resize handles are appended as siblings of the panel div by
          // react-grid-layout — kept outside the panel's own overflow-hidden
          // and rounded corners so they render uncropped and stay clickable.
          <div key={w.id} className="h-full">
            <div className="panel flex h-full flex-col overflow-hidden">
              <div className={`panel-header flex items-center justify-between ${editing ? "widget-drag-handle cursor-move" : ""}`}>
                <span>{w.title}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <Widget />
              </div>
            </div>
          </div>
        );
      })}
    </GridLayoutWithWidth>
  );
}
