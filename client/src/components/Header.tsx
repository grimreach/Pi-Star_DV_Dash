import { NavLink } from "react-router";
import { useLiveStore } from "../store/live";
import { useAuthStore } from "../store/auth";
import { useThemeStore } from "../store/theme";

export function Header() {
  const dashboard = useLiveStore((s) => s.dashboard);
  const connected = useLiveStore((s) => s.connected);
  const status = useAuthStore((s) => s.status);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);

  const callsign = dashboard?.callsign ?? "…";

  return (
    <header className="panel mb-4">
      <div
        className="flex items-center justify-between px-3 py-1 text-[11px]"
        style={{ background: "var(--bg-panel-header)", color: "white" }}
      >
        <span>Hostname: {dashboard?.hostname ?? "pi-star"}</span>
        <span className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-ok-500" : "bg-off-500"}`} title={connected ? "Live" : "Reconnecting…"} />
          Pi-Star:{dashboard?.pistarVersion ?? "–"} / Dashboard: {dashboard?.dashboardVersion ?? "–"}
        </span>
      </div>
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold">Pi-Star Digital Voice Dashboard for {callsign}</h1>
          <nav className="flex items-center gap-3 text-sm">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "font-semibold text-brand-500" : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]")}>
              Dashboard
            </NavLink>
            <NavLink to="/admin" className={({ isActive }) => (isActive ? "font-semibold text-brand-500" : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]")}>
              Admin
            </NavLink>
            <button
              onClick={toggleTheme}
              className="rounded-md border border-[color:var(--border-subtle)] px-2 py-1 text-xs"
              aria-label="Toggle color theme"
            >
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>
            {status === "authenticated" ? (
              <button onClick={() => logout()} className="rounded-md bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-600">
                Log out
              </button>
            ) : (
              <NavLink to="/login" className="rounded-md bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-600">
                Admin login
              </NavLink>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
