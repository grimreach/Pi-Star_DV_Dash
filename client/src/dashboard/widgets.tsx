import { ActivityTable } from "../components/dashboard/ActivityTable";
import { InfoPanel, InfoRow, StatusGrid } from "../components/dashboard/InfoPanel";
import { formatFrequencyMHz } from "../lib/format";
import { useDashboard } from "../lib/useDashboard";

// Each widget owns its own data access (useDashboard() is a shared
// react-query cache, so multiple widgets calling it isn't a redundant
// fetch) so the grid can mount/unmount/reposition them independently.

function useDash() {
  const { data, isLoading } = useDashboard();
  return { data, isLoading };
}

function Loading() {
  return <div className="p-3 text-xs text-[color:var(--text-muted)]">Loading…</div>;
}

export function ModesEnabledWidget() {
  const { data, isLoading } = useDash();
  if (isLoading || !data) return <Loading />;
  return <StatusGrid items={data.modes.map((m) => ({ label: m.label, active: m.enabled }))} />;
}

export function NetworkStatusWidget() {
  const { data, isLoading } = useDash();
  if (isLoading || !data) return <Loading />;
  return <StatusGrid items={data.networks.map((n) => ({ label: n.label, active: n.connected }))} />;
}

export function RadioInfoWidget() {
  const { data, isLoading } = useDash();
  if (isLoading || !data) return <Loading />;
  const trxLabel = data.radio.trx === "transmitting" ? "Transmitting" : data.radio.trx === "listening" ? "Listening" : "Disconnected";
  return (
    <div className="divide-y divide-[color:var(--border-subtle)] text-sm">
      <InfoRow
        label="Trx"
        value={<span className={data.radio.trx === "transmitting" ? "text-brand-500" : "text-ok-600"}>{trxLabel}</span>}
      />
      <InfoRow label="Tx" value={formatFrequencyMHz(data.radio.txFrequencyHz)} />
      <InfoRow label="Rx" value={formatFrequencyMHz(data.radio.rxFrequencyHz)} />
      <InfoRow label="FW" value={data.radio.firmware} />
    </div>
  );
}

export function DStarRepeaterWidget() {
  const { data, isLoading } = useDash();
  if (isLoading || !data) return <Loading />;
  return (
    <div className="divide-y divide-[color:var(--border-subtle)] text-sm">
      <InfoRow label="RPT1" value={data.dstar.rpt1} />
      <InfoRow label="RPT2" value={data.dstar.rpt2} />
    </div>
  );
}

export function DStarNetworkWidget() {
  const { data, isLoading } = useDash();
  if (isLoading || !data) return <Loading />;
  return (
    <div className="divide-y divide-[color:var(--border-subtle)] text-sm">
      <InfoRow label="APRS" value={data.dstar.aprsServer} />
      <div className="px-3 py-1.5 text-[color:var(--text-muted)]">{data.dstar.currentLink}</div>
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
      {active ? (label ?? "enabled") : "disabled"}
    </span>
  );
}

export function DmrRepeaterWidget() {
  const { data, isLoading } = useDash();
  if (isLoading || !data) return <Loading />;
  return (
    <div className="divide-y divide-[color:var(--border-subtle)] text-sm">
      <InfoRow label="DMR ID" value={data.dmr.dmrId} />
      <InfoRow label="DMR CC" value={data.dmr.colorCode} />
      <InfoRow label="TS1" value={<StatePill active={data.dmr.ts1.enabled} />} />
      <InfoRow label="TS2" value={<StatePill active={data.dmr.ts2.enabled} label={data.dmr.ts2.talkgroup} />} />
    </div>
  );
}

export function DmrMasterWidget() {
  const { data, isLoading } = useDash();
  if (isLoading || !data) return <Loading />;
  return <div className="px-3 py-1.5 text-sm text-[color:var(--text-muted)]">{data.dmr.master}</div>;
}

export function GatewayActivityWidget() {
  const { data, isLoading } = useDash();
  if (isLoading || !data) return <Loading />;
  return <ActivityTable title="" entries={data.gatewayActivity} bare />;
}

export function LocalRfActivityWidget() {
  const { data, isLoading } = useDash();
  if (isLoading || !data) return <Loading />;
  return <ActivityTable title="" entries={data.localRfActivity} showRssi bare />;
}

export { InfoPanel };
