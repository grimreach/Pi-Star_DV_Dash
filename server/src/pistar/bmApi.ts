/**
 * Thin client for BrandMeister's v2 REST API — the same five calls
 * WPSD's BM Manager (classes/class.BMApi.php) and Pi-Star's BM API
 * helper use:
 *
 *   GET    device/{id}/profile                      (no key needed)
 *   POST   device/{id}/talkgroup  {group, slot}     add static TG
 *   DELETE device/{id}/talkgroup/{slot}/{tg}        drop static TG
 *   GET    device/{id}/action/dropDynamicGroups/{slot}
 *   GET    device/{id}/action/dropCallRoute/{slot}  (drop current QSO)
 *
 * {id} is the device's login ID: the 7-digit DMR ID plus its ESSID
 * suffix if one is configured. Authenticated calls send the API key
 * from /etc/bmapi.key as a Bearer token.
 */

const BASE_URL = process.env.BMAPI_BASE_URL ?? "https://api.brandmeister.network/v2/";
const TIMEOUT_MS = 10_000;

export interface BmSubscription {
  talkgroup: number;
  slot: number;
  /** Seconds remaining (dynamic subscriptions only). */
  timeout?: number;
}

export interface BmProfile {
  staticSubscriptions: BmSubscription[];
  dynamicSubscriptions: BmSubscription[];
}

export class BmApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call(method: "GET" | "POST" | "DELETE", route: string, apiKey: string | null, body?: unknown, deviceId?: string) {
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": `Pi-Star Node dashboard for ${deviceId ?? "unknown"}`,
  };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(new URL(route, BASE_URL), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 200);
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      detail = parsed.message ?? parsed.error ?? detail;
    } catch {
      // not JSON
    }
    throw new BmApiError(res.status, `BrandMeister API ${method} ${route} → ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return text ? (JSON.parse(text) as unknown) : null;
}

function toSubscription(raw: unknown): BmSubscription | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as { talkgroup?: unknown; slot?: unknown; timeout?: unknown };
  const talkgroup = Number(r.talkgroup);
  const slot = Number(r.slot);
  if (!Number.isFinite(talkgroup) || !Number.isFinite(slot)) return null;
  const sub: BmSubscription = { talkgroup, slot };
  if (r.timeout !== undefined && Number.isFinite(Number(r.timeout))) sub.timeout = Number(r.timeout);
  return sub;
}

export async function getProfile(deviceId: string): Promise<BmProfile> {
  const raw = (await call("GET", `device/${deviceId}/profile`, null, undefined, deviceId)) as {
    staticSubscriptions?: unknown[];
    dynamicSubscriptions?: unknown[];
  } | null;
  const pick = (list: unknown[] | undefined) => (list ?? []).map(toSubscription).filter((s): s is BmSubscription => s !== null);
  return { staticSubscriptions: pick(raw?.staticSubscriptions), dynamicSubscriptions: pick(raw?.dynamicSubscriptions) };
}

export async function addStaticTalkgroup(deviceId: string, apiKey: string, talkgroup: number, slot: number) {
  await call("POST", `device/${deviceId}/talkgroup`, apiKey, { group: talkgroup, slot }, deviceId);
}

export async function dropStaticTalkgroup(deviceId: string, apiKey: string, talkgroup: number, slot: number) {
  await call("DELETE", `device/${deviceId}/talkgroup/${slot}/${talkgroup}`, apiKey, undefined, deviceId);
}

export async function dropDynamicTalkgroups(deviceId: string, apiKey: string, slot: number) {
  await call("GET", `device/${deviceId}/action/dropDynamicGroups/${slot}`, apiKey, undefined, deviceId);
}

export async function dropCurrentQso(deviceId: string, apiKey: string, slot: number) {
  await call("GET", `device/${deviceId}/action/dropCallRoute/${slot}`, apiKey, undefined, deviceId);
}
