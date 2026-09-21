import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { FieldRow, SectionCard, TextInput } from "../../components/admin/Field";
import { useAuthStore } from "../../store/auth";
import { useDashboard } from "../../lib/useDashboard";

const CARDS = [
  { to: "/admin/configuration", title: "Configuration", desc: "Callsign, radio, and gateway settings" },
  { to: "/admin/links", title: "Link Manager", desc: "Connect/disconnect reflectors and talkgroups" },
  { to: "/admin/brandmeister", title: "BrandMeister", desc: "Static and dynamic talkgroups via the BM API" },
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
      <div className="mt-4">
        <ChangePasswordForm />
      </div>
    </div>
  );
}

function ChangePasswordForm() {
  const changePassword = useAuthStore((s) => s.changePassword);
  const username = useAuthStore((s) => s.username);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (next.length < 8) {
      setNotice({ ok: false, text: "New password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setNotice({ ok: false, text: "New passwords don't match." });
      return;
    }
    setBusy(true);
    const error = await changePassword(current, next);
    setBusy(false);
    if (error) {
      setNotice({ ok: false, text: error });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setNotice({ ok: true, text: "Password changed. It's saved on the device and will survive restarts." });
  }

  return (
    <form onSubmit={onSubmit}>
      <SectionCard
        title="Admin password"
        footer={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy || !current || !next || !confirm}
              className="rounded-md border border-transparent bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {busy ? "Changing…" : "Change password"}
            </button>
            {notice && (
              <span className={`text-sm ${notice.ok ? "text-ok-600" : "text-brand-500"}`}>{notice.text}</span>
            )}
          </div>
        }
      >
        <p className="mb-3 text-xs text-[color:var(--text-muted)]">
          Login for <strong>{username ?? "admin"}</strong> on this dashboard. This is separate from the Pi's SSH
          password and from any DMR network password.
        </p>
        <FieldRow label="Current password">
          <TextInput type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </FieldRow>
        <FieldRow label="New password">
          <TextInput type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </FieldRow>
        <FieldRow label="Confirm new password">
          <TextInput type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </FieldRow>
      </SectionCard>
    </form>
  );
}
