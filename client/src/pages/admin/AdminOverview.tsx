import { Link } from "react-router";
import { useAuthStore } from "../../store/auth";
import { useDashboard } from "../../lib/useDashboard";

const CARDS = [
  { to: "/admin/configuration", title: "Configuration", desc: "Callsign, radio, and gateway settings" },
  { to: "/admin/links", title: "Link Manager", desc: "Connect/disconnect reflectors and talkgroups" },
  { to: "/admin/wifi", title: "WiFi", desc: "Manage wireless networks" },
  { to: "/admin/ssh", title: "SSH Access", desc: "Enable or disable remote shell access" },
  { to: "/admin/logs", title: "Live Logs", desc: "Tail the MMDVMHost log in real time" },
  { to: "/admin/system", title: "System Info", desc: "CPU, memory, disk, and uptime" },
  { to: "/admin/firmware", title: "Firmware Upgrade", desc: "Upgrade the modem firmware" },
  { to: "/admin/calibration", title: "Calibration", desc: "RX/TX/duplex calibration mode" },
  { to: "/admin/power", title: "Power", desc: "Reboot or shut down the device" },
];

export function AdminOverview() {
  const defaultPassword = useAuthStore((s) => s.defaultPassword);
  const { data } = useDashboard();

  return (
    <div>
      {defaultPassword && (
        <div className="mb-4 rounded-md border border-brand-500 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          You're using the default admin password. Change it before exposing this dashboard beyond your LAN.
        </div>
      )}
      <div className="panel mb-4 p-4 text-sm">
        <p>
          Signed in as <strong>{data?.callsign}</strong>. Running Pi-Star dashboard v{data?.dashboardVersion} on{" "}
          {data?.hostname}.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link key={card.to} to={card.to} className="panel p-4 transition hover:border-brand-500">
            <h3 className="mb-1 text-sm font-semibold">{card.title}</h3>
            <p className="text-xs text-[color:var(--text-muted)]">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
