import { ActivityTable } from "../components/dashboard/ActivityTable";
import { InfoPanel, InfoRow, StatusGrid } from "../components/dashboard/InfoPanel";
import { formatFrequencyMHz } from "../lib/format";
import { useDashboard } from "../lib/useDashboard";

export function Dashboard() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-[color:var(--text-muted)]">Loading dashboard…</div>;
  }

  const trxLabel = data.radio.trx === "transmitting" ? "Transmitting" : data.radio.trx === "listening" ? "Listening" : "Disconnected";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      <aside>
        <InfoPanel title="Modes Enabled">
          <StatusGrid items={data.modes.map((m) => ({ label: m.label, active: m.enabled }))} />
        </InfoPanel>

        <InfoPanel title="Network Status">
          <StatusGrid items={data.networks.map((n) => ({ label: n.label, active: n.connected }))} />
        </InfoPanel>

        <InfoPanel title="Radio Info">
          <InfoRow
            label="Trx"
            value={
              <span className={data.radio.trx === "transmitting" ? "text-brand-500" : "text-ok-600"}>{trxLabel}</span>
            }
          />
          <InfoRow label="Tx" value={formatFrequencyMHz(data.radio.txFrequencyHz)} />
          <InfoRow label="Rx" value={formatFrequencyMHz(data.radio.rxFrequencyHz)} />
          <InfoRow label="FW" value={data.radio.firmware} />
        </InfoPanel>

        <InfoPanel title="D-Star Repeater">
          <InfoRow label="RPT1" value={data.dstar.rpt1} />
          <InfoRow label="RPT2" value={data.dstar.rpt2} />
        </InfoPanel>
        <InfoPanel title="D-Star Network">
          <InfoRow label="APRS" value={data.dstar.aprsServer} />
          <div className="px-3 py-1.5 text-[color:var(--text-muted)]">{data.dstar.currentLink}</div>
        </InfoPanel>

        <InfoPanel title="DMR Repeater">
          <InfoRow label="DMR ID" value={data.dmr.dmrId} />
          <InfoRow label="DMR CC" value={data.dmr.colorCode} />
          <InfoRow label="TS1" value={<StatePill active={data.dmr.ts1.enabled} />} />
          <InfoRow label="TS2" value={<StatePill active={data.dmr.ts2.enabled} label={data.dmr.ts2.talkgroup} />} />
        </InfoPanel>
        <InfoPanel title="DMR Master">
          <div className="px-3 py-1.5 text-[color:var(--text-muted)]">{data.dmr.master}</div>
        </InfoPanel>
      </aside>

      <div>
        <ActivityTable title="Gateway Activity" entries={data.gatewayActivity} />
        <ActivityTable title="Local RF Activity" entries={data.localRfActivity} showRssi />
      </div>
    </div>
  );
}

function StatePill({ active, label }: { active: boolean; label?: string }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
        active ? "bg-ok-500 text-white" : "bg-[color:var(--border-subtle)] text-[color:var(--text-muted)]"
      }`}
    >
      {active ? label ?? "enabled" : "disabled"}
    </span>
  );
}
