import type { ConfigSection, DmrMasterHost, DmrNetworkMode, FullConfig } from "@pistar/shared";
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

interface ConfigPatchResponse {
  config: unknown;
  real: { written: boolean; skipped?: string[]; error?: string; files?: string[] };
}

function SectionForm({ section, config }: { section: ConfigSection; config: FullConfig }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, unknown>>(config[section] as unknown as Record<string, unknown>);
  const [lastResult, setLastResult] = useState<ConfigPatchResponse["real"] | null>(null);

  useEffect(() => {
    setDraft(config[section] as unknown as Record<string, unknown>);
  }, [section, config]);

  // Deliberately NOT depending on `config` here — a successful save
  // invalidates the config query, which refetches and gives a new
  // `config` object reference. If this effect also reset on `config`
  // changes, it would immediately wipe out the "Restart to apply" button
  // that the save's onSuccess just set, before the user could click it.
  useEffect(() => {
    setLastResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const mutation = useMutation({
    // POST, not PATCH — Pi-Star's stock nginx security include drops any
    // method other than GET/HEAD/POST before it reaches the Node app.
    mutationFn: () => api.post<ConfigPatchResponse>(`/config/${section}`, draft),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setLastResult(data.real);
    },
  });

  const restartMutation = useMutation({
    mutationFn: () =>
      api.post<{ restarted: boolean; message?: string; error?: string; services?: string[] }>("/system/mmdvmhost/restart", {
        // DMRGateway reads its own file, so a gateway-mode DMR save needs it bounced too.
        dmrGateway: section === "dmrGateway" && draft.mode === "gateway",
      }),
  });

  function set(key: string, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <SectionCard
      title={TABS.find((t) => t.key === section)!.label}
      footer={
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-md border border-transparent bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </button>
          {mutation.isError && <span className="text-sm text-brand-500">Save failed. Try again.</span>}
          {lastResult && !mutation.isPending && (
            <SaveStatus result={lastResult} />
          )}
          {lastResult?.written && (
            <button
              onClick={() => restartMutation.mutate()}
              disabled={restartMutation.isPending}
              className="rounded-md border border-[color:var(--border-subtle)] px-4 py-1.5 text-sm font-semibold hover:border-brand-500 disabled:opacity-60"
              title="Restart MMDVMHost to apply this change — interrupts any in-progress transmission"
            >
              {restartMutation.isPending
                ? "Restarting…"
                : section === "dmrGateway" && draft.mode === "gateway"
                  ? "Restart DMRGateway + MMDVMHost to apply"
                  : "Restart MMDVMHost to apply"}
            </button>
          )}
          {restartMutation.isSuccess && restartMutation.data.restarted && (
            <span className="text-sm text-ok-600">Restarted.</span>
          )}
          {restartMutation.isSuccess && !restartMutation.data.restarted && (
            <span className="text-sm text-[color:var(--text-muted)]">{restartMutation.data.message}</span>
          )}
          {restartMutation.isError && <span className="text-sm text-brand-500">Restart failed.</span>}
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

function SecretInput({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <TextInput
        type={shown ? "text" : "password"}
        autoComplete={autoComplete ?? "off"}
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        className="shrink-0 rounded-md border border-[color:var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] hover:border-brand-500"
        aria-pressed={shown}
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}

const ESSID_OPTIONS = ["", ...Array.from({ length: 99 }, (_, i) => String(i + 1).padStart(2, "0"))];
const CUSTOM_MASTER = "__custom__";

function DmrFields({ draft, set }: { draft: Record<string, unknown>; set: Setter }) {
  const masters = useQuery({
    queryKey: ["dmr-masters"],
    queryFn: () => api.get<{ hosts: DmrMasterHost[]; source: "file" | "fallback" }>("/config/dmr-masters"),
    staleTime: 5 * 60_000,
  });
  const hosts = (masters.data?.hosts ?? []).filter((h) => h.name !== "DMRGateway");
  const mode = (draft.mode as DmrNetworkMode) ?? "direct";
  const master = String(draft.master ?? "");
  const masterPort = Number(draft.masterPort ?? 62031);
  const matched = hosts.find((h) => h.address === master && h.port === masterPort);
  const [customMaster, setCustomMaster] = useState(false);
  const selectValue = customMaster || (!matched && master !== "") ? CUSTOM_MASTER : (matched?.name ?? "");
  const isBrandMeister = (matched?.name ?? "").startsWith("BM_") || /brandmeister/i.test(master);
  const loginId = `${String(draft.id ?? "")}${String(draft.essid ?? "")}`;

  function chooseMaster(name: string) {
    if (name === CUSTOM_MASTER) {
      setCustomMaster(true);
      return;
    }
    setCustomMaster(false);
    const host = hosts.find((h) => h.name === name);
    if (!host) return;
    set("master", host.address);
    set("masterPort", host.port);
    // Non-BrandMeister networks use the hosts-file default password; BM
    // uses the per-user Hotspot Security password, so leave that alone.
    if (!host.name.startsWith("BM_") && host.password !== "none" && String(draft.networkPassword ?? "") === "") {
      set("networkPassword", host.password);
    }
  }

  return (
    <>
      <FieldRow label="Enabled">
        <Toggle checked={Boolean(draft.enabled)} onChange={(v) => set("enabled", v)} />
      </FieldRow>
      <FieldRow label="DMR ID">
        <TextInput
          inputMode="numeric"
          maxLength={7}
          value={String(draft.id ?? "")}
          onChange={(e) => set("id", e.target.value.replace(/[^0-9]/g, "").slice(0, 7))}
        />
      </FieldRow>
      <FieldRow label="ESSID">
        <SelectInput value={String(draft.essid ?? "")} onChange={(e) => set("essid", e.target.value)}>
          {ESSID_OPTIONS.map((v) => (
            <option key={v || "none"} value={v}>
              {v === "" ? "None" : v}
            </option>
          ))}
        </SelectInput>
      </FieldRow>
      <p className="mb-2 -mt-1 text-xs text-[color:var(--text-muted)]">
        Optional 2-digit extended ID appended for the network login (needed when more than one hotspot or radio shares
        your DMR ID). Logs in as <strong>{loginId || "—"}</strong>.
      </p>
      <FieldRow label="Color Code">
        <NumberInput min={0} max={15} value={Number(draft.colorCode ?? 1)} onChange={(e) => set("colorCode", Number(e.target.value))} />
      </FieldRow>
      <FieldRow label="TS1 Enabled">
        <Toggle checked={Boolean(draft.ts1Enabled)} onChange={(v) => set("ts1Enabled", v)} />
      </FieldRow>
      <FieldRow label="TS2 Enabled">
        <Toggle checked={Boolean(draft.ts2Enabled)} onChange={(v) => set("ts2Enabled", v)} />
      </FieldRow>
      <FieldRow label="Connection">
        <SelectInput value={mode} onChange={(e) => set("mode", e.target.value as DmrNetworkMode)}>
          <option value="direct">Direct — MMDVMHost logs into the master itself</option>
          <option value="gateway">Via DMRGateway — multi-network, BrandMeister Manager support</option>
        </SelectInput>
      </FieldRow>
      <p className="mb-2 -mt-1 text-xs text-[color:var(--text-muted)]">
        {mode === "gateway"
          ? "Master, password and ESSID are written to /etc/dmrgateway [DMR Network 1]; /etc/mmdvmhost is pointed at 127.0.0.1:62031. Requires the dmrgateway service."
          : "Master, password and ESSID are written straight into /etc/mmdvmhost [DMR Network]."}
      </p>
      <FieldRow label="Master">
        <div className="flex flex-col gap-2">
          <SelectInput value={selectValue} onChange={(e) => chooseMaster(e.target.value)}>
            <option value="" disabled>
              {masters.isLoading ? "Loading master list…" : "Choose a master…"}
            </option>
            {hosts.map((h) => (
              <option key={h.name} value={h.name}>
                {h.name.replace(/_/g, " ")}
              </option>
            ))}
            <option value={CUSTOM_MASTER}>Custom address…</option>
          </SelectInput>
          {selectValue === CUSTOM_MASTER && (
            <div className="flex flex-wrap items-center gap-2">
              <TextInput
                className="min-w-0 flex-1"
                placeholder="hostname or IP"
                value={master}
                onChange={(e) => set("master", e.target.value)}
              />
              <span className="text-xs text-[color:var(--text-muted)]">port</span>
              <NumberInput min={1} max={65535} value={masterPort} onChange={(e) => set("masterPort", Number(e.target.value))} />
            </div>
          )}
          {selectValue !== CUSTOM_MASTER && master && (
            <span className="text-xs text-[color:var(--text-muted)]">
              {master}:{masterPort}
              {masters.data?.source === "fallback" && " · built-in list (DMR_Hosts.txt not found on this device)"}
            </span>
          )}
        </div>
      </FieldRow>
      <FieldRow label={isBrandMeister ? "BM Hotspot Security" : "Network Password"}>
        <SecretInput value={String(draft.networkPassword ?? "")} onChange={(v) => set("networkPassword", v)} />
      </FieldRow>
      <p className="mb-2 -mt-1 text-xs text-[color:var(--text-muted)]">
        {isBrandMeister ? (
          <>
            The <em>Hotspot Security</em> password from{" "}
            <a className="underline" href="https://brandmeister.network/?page=selfcare" target="_blank" rel="noreferrer">
              BrandMeister SelfCare
            </a>{" "}
            (not your SelfCare login, and not the API key below). Leading/trailing spaces are removed on save; use Show to
            compare it with SelfCare character-by-character if the master rejects the login.
          </>
        ) : (
          <>The network login password — most non-BrandMeister networks use the DMR_Hosts.txt default (usually “passw0rd”).</>
        )}
      </p>
      <FieldRow label="BrandMeister API Key">
        <SecretInput value={String(draft.bmApiKey ?? "")} onChange={(v) => set("bmApiKey", v)} />
      </FieldRow>
      <p className="mb-2 -mt-1 text-xs text-[color:var(--text-muted)]">
        Saved to /etc/bmapi.key. Used by the BrandMeister Manager to add/drop static talkgroups. Create one under{" "}
        <em>Profile settings → API keys</em> on brandmeister.network.
      </p>
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

const DSTAR_MODULES = ["A", "B", "C", "D", "E"];

function TimeServerFields({ draft, set }: { draft: Record<string, unknown>; set: Setter }) {
  const modules = Array.isArray(draft.modules) ? (draft.modules as string[]) : [];

  function toggleModule(letter: string, on: boolean) {
    set("modules", on ? [...modules, letter] : modules.filter((m) => m !== letter));
  }

  return (
    <>
      <p className="mb-2 text-xs text-[color:var(--text-muted)]">
        D-Star's periodic time-beacon feature (not NTP) — broadcasts the current time as a "CALLSIGN/TIME"
        transmission on the selected module(s), same as the TIME entries in the activity feed.
      </p>
      <FieldRow label="Enabled">
        <Toggle checked={Boolean(draft.enabled)} onChange={() => {}} />
      </FieldRow>
      <FieldRow label="Callsign">
        <TextInput value={String(draft.callsign ?? "")} onChange={(e) => set("callsign", e.target.value.toUpperCase())} />
      </FieldRow>
      <FieldRow label="Modules">
        <div className="flex gap-3">
          {DSTAR_MODULES.map((letter) => (
            <label key={letter} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={modules.includes(letter)}
                onChange={(e) => toggleModule(letter, e.target.checked)}
              />
              {letter}
            </label>
          ))}
        </div>
      </FieldRow>
      <FieldRow label="Interval (hours)">
        <NumberInput
          min={0}
          value={Number(draft.intervalHours ?? 0)}
          onChange={(e) => set("intervalHours", Number(e.target.value))}
        />
      </FieldRow>
    </>
  );
}

function SaveStatus({ result }: { result: ConfigPatchResponse["real"] }) {
  if (result.error) {
    return (
      <span className="text-sm text-brand-500" title={result.error}>
        Saved in-app, but writing to the device failed — see console/logs.
      </span>
    );
  }
  if (result.written) {
    return (
      <span className="text-sm text-ok-600">
        Saved to {result.files && result.files.length > 0 ? result.files.join(", ") : "/etc/mmdvmhost"}.
        {result.skipped && result.skipped.length > 0 && (
          <span className="text-[color:var(--text-muted)]"> ({result.skipped.length} field(s) not found in file)</span>
        )}
      </span>
    );
  }
  return (
    <span className="text-sm text-ok-600">
      Saved (in-memory only — this section isn't wired to write a real config file yet, or no real device was
      detected).
    </span>
  );
}
