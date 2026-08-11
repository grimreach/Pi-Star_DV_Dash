import type { NetworkLink } from "@pistar/shared";
import { store } from "../store.js";
import { wsHub } from "../ws.js";
import { isProcessRunning } from "./processCheck.js";

/**
 * Mirrors the original PHP dashboard's showMode()/checkDMRLogin(): most
 * networks are "connected" based on whether their gateway daemon process
 * is actually running (ps -eo comm), not just the config's Enable flag —
 * D-Star Network → ircddbgatewayd, YSF → YSFGateway, P25 → P25Gateway,
 * NXDN → NXDNGateway, M17 → M17Gateway, POCSAG → DAPNETGateway.
 *
 * DMR additionally checks the log for the most recent line containing
 * "master" alongside either "successfully" or "failed" (same awk logic
 * as checkDMRLogin) — this is exactly the check that would have caught
 * the stale-DMR-ID login failure that config Enable=1 alone hid earlier.
 *
 * Only meaningful on a real Pi-Star device — index.ts only starts this
 * alongside the real activity feed, since on a dev machine none of these
 * processes exist and everything would show disconnected.
 */

type DmrLoginState = "ok" | "failed" | "unknown";
let dmrLoginState: DmrLoginState = "unknown";

/** Feed every raw MMDVM log line here (activityFeed.ts does this) to track DMR login state. */
export function recordLogLineForDmrLogin(line: string) {
  if (!line.includes("master")) return;
  if (line.includes("successfully")) dmrLoginState = "ok";
  else if (line.includes("failed")) dmrLoginState = "failed";
}

const PROCESS_BY_NETWORK: Partial<Record<NetworkLink, string>> = {
  dstarNet: "ircddbgatewayd",
  ysfNet: "YSFGateway",
  p25Net: "P25Gateway",
  nxdnNet: "NXDNGateway",
  m17Net: "M17Gateway",
  pocsagNet: "DAPNETGateway",
};

function isLiveConnected(link: NetworkLink): boolean {
  if (link === "dmrNet") {
    return isProcessRunning("MMDVMHost") && dmrLoginState !== "failed";
  }
  const processName = PROCESS_BY_NETWORK[link];
  if (!processName) return true; // no known process check (e.g. bridge modes) — trust config
  return isProcessRunning(processName);
}

export function startNetworkHealthMonitor() {
  const interval = setInterval(() => {
    const live = store.configuredNetworks.filter(isLiveConnected);
    const changed =
      live.length !== store.connectedNetworks.length || live.some((link) => !store.connectedNetworks.includes(link));
    if (changed) {
      store.connectedNetworks = live;
      wsHub.broadcast({ type: "dashboard:update", payload: store.dashboardState() });
    }
  }, 7000);

  return () => clearInterval(interval);
}
