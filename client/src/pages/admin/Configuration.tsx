import type { ConfigSection, FullConfig } from "@pistar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FieldRow, NumberInput, SectionCard, SelectInput, TextInput, Toggle } from "../../components/admin/Field";
import { api } from "../../lib/api";

const TABS: { key: ConfigSection; label: string }[] = [
  { key: "general", label: "General" },
  { key: "mmdvmHost", label: "MMDVMHost" },
  { key: "dmrGateway", label: "DMR Gateway" },
  { key: "dstarRepeater", label: "D-Star Repeater" },
  { key: "ysfGateway", label: "YSF Gateway" },
  { key: "p25Gateway", label: "P25 Gateway" },
  { key: "nxdnGateway", label: "NXDN Gateway" },
  { key: "m17Gateway", label: "M17 Gateway" },
  { key: "dapnetGateway", label: "DAPNET Gateway" },
  { key: "timeServer", label: "Time Server" },
];

export function Configuration() {
  const [tab, setTab] = useState<ConfigSection>("general");
  const query = useQuery({ queryKey: ["config"], queryFn: () => api.get<FullConfig>("/config") });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === t.key ? "bg-brand-500 text-white" : "bg-[color:var(--bg-surface)] text-[color:var(--text-muted)] hover:bg-[color:var(--border-subtle)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {query.data && <SectionForm section={tab} config={query.data} />}
    </div>
  );
}

function SectionForm({ section, config }: { section: ConfigSection; config: FullConfig }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, unknown>>(config[section] as unknown as Record<string, unknown>);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setDraft(config[section] as unknown as Record<string, unknown>);
    setSavedAt(null);
  }, [section, config]);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/config/${section}`, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSavedAt(Date.now());
    },
  });

  function set(key: string, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <SectionCard
      title={TABS.find((t) => t.key === section)!.label}
      footer={
        <div className="flex items-center gap-3">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </button>
          {mutation.isError && <span className="text-sm text-brand-500">Save failed. Try again.</span>}
          {savedAt && !mutation.isPending && <span className="text-sm text-ok-600">Saved.</span>}
        </div>
      }
    >
      {section === "general" && <GeneralFields draft={draft} set={set} />}
      {section === "mmdvmHost" && <MmdvmFields draft={draft} set={set} />}
      {section === "dmrGateway" && <DmrFields draft={draft} set={set} />}
      {section === "dstarRepeater" && <DStarFields draft={draft} set={set} />}
      {section === "ysfGateway" && <SimpleGatewayFields draft={draft} set={set} extra="defaultRoom" extraLabel="Default Room" />}
      {section === "p25Gateway" && <SimpleGatewayFields draft={draft} set={set} extra="nac" extraLabel="NAC" />}
      {section === "nxdnGateway" && <SimpleGatewayFields draft={draft} set={set} extra="ran" extraLabel="RAN" isNumber />}
      {section === "m17Gateway" && <SimpleGatewayFields draft={draft} set={set} extra="module" extraLabel="Module" />}
      {section === "dapnetGateway" && <DapnetFields draft={draft} set={set} />}
      {section === "timeServer" && <TimeServerFields draft={draft} set={set} />}
    </SectionCard>
  );
}

type Setter = (key: string, value: unknown) => void;

function GeneralFields({ draft, set }: { draft: Record<string, unknown>; set: Setter }) {
  return (
    <>
      <FieldRow label="Callsign">
        <TextInput value={String(draft.callsign ?? "")} onChange={(e) => set("callsign", e.target.value.toUpperCase())} />
      </FieldRow>
      <FieldRow label="DMR ID">
        <TextInput value={String(draft.dmrId ?? "")} onChange={(e) => set("dmrId", e.target.value)} />
      </FieldRow>
      <FieldRow label="Location">
        <TextInput value={String(draft.location ?? "")} onChange={(e) => set("location", e.target.value)} />
      </FieldRow>
      <FieldRow label="Description">
        <TextInput value={String(draft.description ?? "")} onChange={(e) => set("description", e.target.value)} />
      </FieldRow>
      <FieldRow label="Latitude">
        <NumberInput step="0.0001" value={Number(draft.latitude ?? 0)} onChange={(e) => set("latitude", Number(e.target.value))} />
      </FieldRow>
      <FieldRow label="Longitude">
        <NumberInput step="0.0001" value={Number(draft.longitude ?? 0)} onChange={(e) => set("longitude", Number(e.target.value))} />
      </FieldRow>
      <FieldRow label="Radio">
        <SelectInput value={String(draft.radio ?? "")} onChange={(e) => set("radio", e.target.value)}>
          {["MMDVM_HS_Hat", "MMDVM_HS_Dual_Hat", "Nano_hotSPOT", "ZUMspot", "DVMEGA_HR3", "Other"].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </SelectInput>
      </FieldRow>
    </>
  );
}

function MmdvmFields({ draft, set }: { draft: Record<string, unknown>; set: Setter }) {
  return (
    <>
      <FieldRow label="Duplex">
        <Toggle checked={Boolean(draft.duplex)} onChange={(v) => set("duplex", v)} />
      </FieldRow>
      <FieldRow label="RX Frequency (Hz)">
        <NumberInput value={Number(draft.rxFrequencyHz ?? 0)} onChange={(e) => set("rxFrequencyHz", Number(e.target.value))} />
      </FieldRow>
      <FieldRow label="TX Frequency (Hz)">
        <NumberInput value={Number(draft.txFrequencyHz ?? 0)} onChange={(e) => set("txFrequencyHz", Number(e.target.value))} />
      </FieldRow>
      <FieldRow label="RF Level (%)">
        <NumberInput
          min={0}
          max={100}
          value={Number(draft.rfLevelPercent ?? 0)}
          onChange={(e) => set("rfLevelPercent", Number(e.target.value))}
        />
      </FieldRow>
    </>
  );
}

function DmrFields({ draft, set }: { draft: Record<string, unknown>; set: Setter }) {
  return (
    <>
      <FieldRow label="Enabled">
        <Toggle checked={Boolean(draft.enabled)} onChange={(v) => set("enabled", v)} />
      </FieldRow>
      <FieldRow label="DMR ID">
        <TextInput value={String(draft.id ?? "")} onChange={(e) => set("id", e.target.value)} />
      </FieldRow>
      <FieldRow label="Color Code">
        <NumberInput min={0} max={15} value={Number(draft.colorCode ?? 1)} onChange={(e) => set("colorCode", Number(e.target.value))} />
      </FieldRow>
      <FieldRow label="TS1 Enabled">
        <Toggle checked={Boolean(draft.ts1Enabled)} onChange={(v) => set("ts1Enabled", v)} />
      </FieldRow>
      <FieldRow label="TS2 Enabled">
        <Toggle checked={Boolean(draft.ts2Enabled)} onChange={(v) => set("ts2Enabled", v)} />
      </FieldRow>
      <FieldRow label="Master">
        <TextInput value={String(draft.master ?? "")} onChange={(e) => set("master", e.target.value)} />
      </FieldRow>
      <FieldRow label="BrandMeister API Key">
        <TextInput type="password" value={String(draft.bmApiKey ?? "")} onChange={(e) => set("bmApiKey", e.target.value)} />
      </FieldRow>
    </>
  );
}

function DStarFields({ draft, set }: { draft: Record<string, unknown>; set: Setter }) {
  return (
    <>
      <FieldRow label="Enabled">
        <Toggle checked={Boolean(draft.enabled)} onChange={(v) => set("enabled", v)} />
      </FieldRow>
      <FieldRow label="RPT1">
        <TextInput value={String(draft.rpt1 ?? "")} onChange={(e) => set("rpt1", e.target.value)} />
      </FieldRow>
      <FieldRow label="RPT2">
        <TextInput value={String(draft.rpt2 ?? "")} onChange={(e) => set("rpt2", e.target.value)} />
      </FieldRow>
      <FieldRow label="ircDDBGateway Host">
        <TextInput value={String(draft.ircddbHost ?? "")} onChange={(e) => set("ircddbHost", e.target.value)} />
      </FieldRow>
      <FieldRow label="APRS Host">
        <TextInput value={String(draft.aprsHost ?? "")} onChange={(e) => set("aprsHost", e.target.value)} />
      </FieldRow>
    </>
  );
}

function SimpleGatewayFields({
  draft,
  set,
  extra,
  extraLabel,
  isNumber,
}: {
  draft: Record<string, unknown>;
  set: Setter;
  extra: string;
  extraLabel: string;
  isNumber?: boolean;
}) {
  return (
    <>
      <FieldRow label="Enabled">
        <Toggle checked={Boolean(draft.enabled)} onChange={(v) => set("enabled", v)} />
      </FieldRow>
      <FieldRow label={extraLabel}>
        {isNumber ? (
          <NumberInput value={Number(draft[extra] ?? 0)} onChange={(e) => set(extra, Number(e.target.value))} />
        ) : (
          <TextInput value={String(draft[extra] ?? "")} onChange={(e) => set(extra, e.target.value)} />
        )}
      </FieldRow>
      <FieldRow label="Default Reflector">
        <TextInput value={String(draft.defaultReflector ?? "")} onChange={(e) => set("defaultReflector", e.target.value)} />
      </FieldRow>
    </>
  );
}

function DapnetFields({ draft, set }: { draft: Record<string, unknown>; set: Setter }) {
  return (
    <>
      <FieldRow label="Enabled">
        <Toggle checked={Boolean(draft.enabled)} onChange={(v) => set("enabled", v)} />
      </FieldRow>
      <FieldRow label="Callsign">
        <TextInput value={String(draft.callsign ?? "")} onChange={(e) => set("callsign", e.target.value)} />
      </FieldRow>
      <FieldRow label="Auth Key">
        <TextInput type="password" value={String(draft.authKey ?? "")} onChange={(e) => set("authKey", e.target.value)} />
      </FieldRow>
    </>
  );
}

function TimeServerFields({ draft, set }: { draft: Record<string, unknown>; set: Setter }) {
  return (
    <>
      <FieldRow label="Enabled">
        <Toggle checked={Boolean(draft.enabled)} onChange={(v) => set("enabled", v)} />
      </FieldRow>
      <FieldRow label="NTP Server">
        <TextInput value={String(draft.ntpServer ?? "")} onChange={(e) => set("ntpServer", e.target.value)} />
      </FieldRow>
    </>
  );
}
