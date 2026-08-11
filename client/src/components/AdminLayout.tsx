import { NavLink, Outlet } from "react-router";
import clsx from "clsx";

const NAV = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/configuration", label: "Configuration" },
  { to: "/admin/links", label: "Link Manager" },
  { to: "/admin/wifi", label: "WiFi" },
  { to: "/admin/ssh", label: "SSH Access" },
  { to: "/admin/logs", label: "Live Logs" },
  { to: "/admin/system", label: "System Info" },
  { to: "/admin/firmware", label: "Firmware Upgrade" },
  { to: "/admin/calibration", label: "Calibration" },
  { to: "/admin/power", label: "Power" },
];

export function AdminLayout() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
      <aside className="panel h-fit p-2">
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  "rounded-md px-3 py-2 text-sm",
                  isActive ? "bg-brand-500 font-semibold text-white" : "text-[color:var(--text-muted)] hover:bg-[color:var(--border-subtle)]",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  );
}
