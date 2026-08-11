import { create } from "zustand";

type Theme = "light" | "dark";

function initialTheme(): Theme {
  const stored = localStorage.getItem("pistar-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("pistar-theme", theme);
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

const initial = typeof window !== "undefined" ? initialTheme() : "light";
if (typeof window !== "undefined") apply(initial);

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initial,
  toggle: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    apply(next);
    set({ theme: next });
  },
}));
