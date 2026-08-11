import { randomUUID } from "node:crypto";
import type { ActivityEntry, Mode } from "@pistar/shared";
import { store } from "./store.js";
import { wsHub } from "./ws.js";

/**
 * Simulates live radio traffic and log output so the UI has something to
 * react to without a real modem. `startSystemInfoBroadcast` always runs
 * (system stats aren't wired to real data yet — see README). The
 * activity/log simulation in `startActivitySimulator` is only started
 * when `activityFeed.ts`'s real MMDVM log tailer isn't available (e.g.
 * local dev off-device) — see index.ts.
 */

const CALLSIGNS = [
  "W3EZE",
  "KX0UWU",
  "N4ABC",
  "VE3XYZ",
  "G0ABC",
  "DL1XYZ",
  "JA1ABC",
  "M0XYZ",
  "K2ABC/M",
];

const TARGETS = ["CQCQCQ", "TG 3102", "TG 91", "REF001 C", "DCS672 E"];

function randomOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomEntry(mode: Mode, scope: "gateway" | "localRf"): ActivityEntry {
  const entry: ActivityEntry = {
    id: randomUUID(),
    timestamp: Date.now(),
    mode,
    callsign: randomOf(CALLSIGNS),
    target: randomOf(TARGETS),
    src: scope === "gateway" ? "Net" : "RF",
    durationSeconds: Math.round((1.5 + Math.random() * 8) * 10) / 10,
    lossPercent: Math.random() < 0.85 ? 0 : Math.round(Math.random() * 5),
    berPercent: Math.round(Math.random() * 20) / 10,
  };
  if (scope === "localRf") entry.rssiDbm = -60 - Math.round(Math.random() * 40);
  if (Math.random() < 0.3) entry.gps = true;
  return entry;
}

export function startSystemInfoBroadcast() {
  const systemInterval = setInterval(() => {
    wsHub.broadcast({ type: "system:update", payload: store.systemInfo() });
  }, 5000);

  return () => clearInterval(systemInterval);
}

export function startActivitySimulator() {
  const interval = setInterval(() => {
    const enabled = store.enabledModes;
    if (enabled.length === 0) return;
    const mode = randomOf(enabled);
    const scope: "gateway" | "localRf" = Math.random() < 0.7 ? "gateway" : "localRf";

    store.radio = { ...store.radio, trx: "transmitting" };
    wsHub.broadcast({ type: "dashboard:update", payload: store.dashboardState() });

    const holdMs = 1500 + Math.random() * 4000;
    setTimeout(() => {
      const entry = randomEntry(mode, scope);
      store.pushActivity(scope, entry);
      store.radio = { ...store.radio, trx: "listening" };
      wsHub.broadcast({ type: "activity:new", payload: { scope, entry } });
      wsHub.broadcast({ type: "dashboard:update", payload: store.dashboardState() });
    }, holdMs);
  }, 9000 + Math.random() * 6000);

  const logInterval = setInterval(() => {
    const line = randomLogLine();
    store.pushLog(line);
    wsHub.broadcast({ type: "log:line", payload: { timestamp: Date.now(), text: line } });
  }, 4000 + Math.random() * 4000);

  return () => {
    clearInterval(interval);
    clearInterval(logInterval);
  };
}

const LOG_TEMPLATES = [
  "M: MMDVMHost: RSSI: -${rssi}dBm",
  "M: DMR Slot 2, received network voice header from ${call} to TG ${tg}",
  "M: D-Star, received RF header from ${call} to CQCQCQ",
  "M: DMR Slot 2, ended network voice transmission from ${call} to TG ${tg}, 4.2 seconds",
  "M: MMDVMHost: CPU temp: ${temp}C",
];

function randomLogLine(): string {
  const template = randomOf(LOG_TEMPLATES);
  return template
    .replace("${rssi}", String(60 + Math.round(Math.random() * 40)))
    .replace("${call}", randomOf(CALLSIGNS))
    .replace("${tg}", randomOf(["3102", "91", "3100"]))
    .replace("${temp}", (46 + Math.random() * 4).toFixed(1));
}
