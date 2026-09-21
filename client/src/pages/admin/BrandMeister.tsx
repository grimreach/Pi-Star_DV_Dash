import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { NumberInput, SectionCard, SelectInput } from "../../components/admin/Field";
import { api, ApiError } from "../../lib/api";

interface Subscription {
  talkgroup: number;
  slot: number;
  timeout?: number;
}

interface BmStatus {
  deviceId: string;
  hasKey: boolean;
  isBrandMeister: boolean;
  master: string;
  slots: { ts1: boolean; ts2: boolean };
  profile: { staticSubscriptions: Subscription[]; dynamicSubscriptions: Subscription[] } | null;
  error?: string;
}

const btn = "rounded-md border border-[color:var(--border-subtle)] px-3 py-1 text-xs font-semibold hover:border-brand-500 disabled:opacity-60";
const btnDanger = "rounded-md border border-brand-500 px-3 py-1 text-xs font-semibold text-brand-500 hover:bg-brand-50 disabled:opacity-60";

function errorText(err: unknown) {
  return err instanceof ApiError ? err.message : "Request failed";
}

export function BrandMeister() {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["bm-status"],
    queryFn: () => api.get<BmStatus>("/bm/status"),
    refetchInterval: 15_000,
  });
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  function act<T>(path: string, body: T, okText: string) {
    return api
      .post(path, body)
      .then(() => {
        setNotice({ ok: true, text: okText });
        queryClient.invalidateQueries({ queryKey: ["bm-status"] });
      })
      .catch((err) => setNotice({ ok: false, text: errorText(err) }));
  }

  const addStatic = useMutation({ mutationFn: (v: { talkgroup: number; slot: number }) => act("/bm/static/add", v, `TG ${v.talkgroup} added as static on TS${v.slot}.`) });
  const dropStatic = useMutation({ mutationFn: (v: { talkgroup: number; slot: number }) => act("/bm/static/drop", v, `TG ${v.talkgroup} dropped from TS${v.slot}.`) });
  const dropDynamic = useMutation({ mutationFn: (slot: number) => act("/bm/dynamic/drop", { slot }, `Dynamic talkgroups dropped on TS${slot}.`) });
  const dropQso = useMutation({ mutationFn: (slot: number) => act("/bm/qso/drop", { slot }, `Current QSO dropped on TS${slot}.`) });
  const busy = addStatic.isPending || dropStatic.isPending || dropDynamic.isPending || dropQso.isPending;

  const s = status.data;
  const slotOptions = s ? [s.slots.ts1 ? 1 : null, s.slots.ts2 ? 2 : null].filter((v): v is number => v !== null) : [1, 2];
  const [tg, setTg] = useState("");
  const [slot, setSlot] = useState<number>(2);
  const effectiveSlot = slotOptions.includes(slot) ? slot : (slotOptions[0] ?? 2);

  return (
    <div>
      {s && !s.hasKey && (
        <div className="mb-4 rounded-md border border-brand-500 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          No BrandMeister API key is configured, so talkgroups can be viewed but not changed. Add one under{" "}
          <Link className="underline" to="/admin/configuration">
            Configuration → DMR Gateway
          </Link>
          .
        </div>
      )}
      {s && !s.isBrandMeister && (
        <div className="mb-4 rounded-md border border-[color:var(--border-subtle)] px-3 py-2 text-sm text-[color:var(--text-muted)]">
          The configured DMR master ({s.master || "none"}) doesn't look like a BrandMeister master — this page only applies to BrandMeister.
        </div>
      )}

      <SectionCard title="BrandMeister device">
        {status.isLoading && <p className="text-sm text-[color:var(--text-muted)]">Loading…</p>}
        {s && (
          <div className="text-sm">
            <p>
              Device ID <strong>{s.deviceId || "—"}</strong> on {s.master || "—"}.{" "}
              {s.deviceId && (
                <a className="underline" href={`https://brandmeister.network/?page=device&id=${s.deviceId}`} target="_blank" rel="noreferrer">
                  Open on brandmeister.network
                </a>
              )}
            </p>
            {s.error && <p className="mt-1 text-brand-500">{s.error}</p>}
          </div>
        )}
        {notice && <p className={`mt-2 text-sm ${notice.ok ? "text-ok-600" : "text-brand-500"}`}>{notice.text}</p>}
      </SectionCard>

      <SectionCard
        title="Static talkgroups"
        footer={
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(tg);
              if (!Number.isInteger(n) || n <= 0) {
                setNotice({ ok: false, text: "Enter a talkgroup number." });
                return;
              }
              addStatic.mutate({ talkgroup: n, slot: effectiveSlot });
              setTg("");
            }}
          >
            <NumberInput min={1} placeholder="Talkgroup" value={tg} onChange={(e) => setTg(e.target.value)} className="w-32" />
            <SelectInput value={effectiveSlot} onChange={(e) => setSlot(Number(e.target.value))}>
              {slotOptions.map((v) => (
                <option key={v} value={v}>
                  TS{v}
                </option>
              ))}
            </SelectInput>
            <button type="submit" disabled={busy || !s?.hasKey} className="rounded-md border border-transparent bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
              Add static
            </button>
          </form>
        }
      >
        <SubscriptionList
          items={s?.profile?.staticSubscriptions ?? []}
          empty="No static talkgroups."
          action={(sub) => (
            <button disabled={busy || !s?.hasKey} className={btnDanger} onClick={() => dropStatic.mutate({ talkgroup: sub.talkgroup, slot: sub.slot })}>
              Drop
            </button>
          )}
        />
      </SectionCard>

      <SectionCard title="Dynamic talkgroups">
        <SubscriptionList items={s?.profile?.dynamicSubscriptions ?? []} empty="No dynamic talkgroups active." showTimeout />
        <div className="mt-3 flex flex-wrap gap-2">
          {slotOptions.map((v) => (
            <span key={v} className="flex gap-2">
              <button disabled={busy || !s?.hasKey} className={btn} onClick={() => dropDynamic.mutate(v)}>
                Drop dynamic TS{v}
              </button>
              <button disabled={busy || !s?.hasKey} className={btn} onClick={() => dropQso.mutate(v)}>
                Drop QSO TS{v}
              </button>
            </span>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function SubscriptionList({
  items,
  empty,
  showTimeout,
  action,
}: {
  items: Subscription[];
  empty: string;
  showTimeout?: boolean;
  action?: (sub: Subscription) => React.ReactNode;
}) {
  if (items.length === 0) return <p className="text-sm text-[color:var(--text-muted)]">{empty}</p>;
  const sorted = [...items].sort((a, b) => a.slot - b.slot || a.talkgroup - b.talkgroup);
  return (
    <ul className="divide-y divide-[color:var(--border-subtle)] text-sm">
      {sorted.map((sub) => (
        <li key={`${sub.slot}-${sub.talkgroup}`} className="flex items-center justify-between gap-3 py-2">
          <span>
            <span className="font-semibold">TG {sub.talkgroup}</span>
            <span className="ml-2 text-xs text-[color:var(--text-muted)]">TS{sub.slot}</span>
            {showTimeout && sub.timeout !== undefined && (
              <span className="ml-2 text-xs text-[color:var(--text-muted)]">expires in {Math.max(0, Math.round(sub.timeout / 60))} min</span>
            )}
          </span>
          {action?.(sub)}
        </li>
      ))}
    </ul>
  );
}
