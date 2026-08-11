import { create } from "zustand";

export type Theme = "classic" | "slate" | "neon";
export const THEMES: { key: Theme; label: string }[] = [
  { key: "classic", label: "Classic" },
  { key: "slate", label: "Slate" },
  { key: "neon", label: "Neon" },
];

function initialTheme(): Theme {
  const stored = localStorage.getItem("pistar-theme");
  if (stored === "classic" || stored === "slate" || stored === "neon") return stored;
  return "classic";
}

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("pistar-theme", theme);
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const initial = typeof window !== "undefined" ? initialTheme() : "classic";
if (typeof window !== "undefined") apply(initial);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,
  setTheme: (theme) => {
    apply(theme);
    set({ theme });
  },
}));
