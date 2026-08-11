import { create } from "zustand";
import { WIDGET_REGISTRY, type WidgetLayout } from "../dashboard/registry";

export type GridLayout = Record<string, WidgetLayout>;

const STORAGE_KEY = "pistar-dashboard-layout";

function defaultLayout(): GridLayout {
  return Object.fromEntries(WIDGET_REGISTRY.map((w) => [w.id, w.defaultLayout]));
}

function loadLayout(): GridLayout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultLayout();
    const parsed = JSON.parse(stored) as GridLayout;
    // Merge with defaults so newly-added widgets (or ones removed from an
    // old save) still get a sane position instead of vanishing.
    const merged = defaultLayout();
    for (const id of Object.keys(merged)) {
      if (parsed[id]) merged[id] = parsed[id];
    }
    return merged;
  } catch {
    return defaultLayout();
  }
}

interface LayoutState {
  editing: boolean;
  layout: GridLayout;
  setEditing: (editing: boolean) => void;
  setLayout: (layout: GridLayout) => void;
  resetLayout: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  editing: false,
  layout: typeof window !== "undefined" ? loadLayout() : defaultLayout(),

  setEditing: (editing) => set({ editing }),

  setLayout: (layout) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    set({ layout });
  },

  resetLayout: () => {
    const layout = defaultLayout();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    set({ layout });
  },
}));
