import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { WifiNetwork } from "@pistar/shared";

const execFileAsync = promisify(execFile);

/**
 * Real WiFi network scanning via wpa_cli — deliberately read-only. Scoped
 * to `scan`/`scan_results`/`status` only; does NOT include `ifdown`/`ifup`
 * or `reconfigure`, which could actually disrupt the connection to this
 * device. Connecting to a network is a separate, riskier decision left
 * for later (routes/wifi.ts's connect/disconnect endpoints stay mock).
 *
 * Requires a scoped sudo grant for `/sbin/wpa_cli -i <iface> scan` /
 * `scan_results` / `status` — paths verified against the original Pi-Star
 * sudoers rules for www-data (deploy/sudoers.d/040-pistar-dashboard-node).
 */

const IFACE = process.env.WIFI_IFACE ?? "wlan0";

/** Exported for wifiConnect.ts to reuse the same sudo-wrapped invocation. */
export async function runWpaCli(args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("sudo", ["/sbin/wpa_cli", "-i", IFACE, ...args], { timeout: 5000 });
    return stdout;
  } catch {
    return null;
  }
}

function signalToPercent(dbm: number): number {
  return Math.max(0, Math.min(100, Math.round(2 * (dbm + 100))));
}

function isSecured(flags: string): boolean {
  return /WPA|WEP|PSK/i.test(flags);
}

function extractSsid(statusOutput: string): string | null {
  const match = statusOutput.match(/^ssid=(.*)$/m);
  return match ? match[1]! : null;
}

/** Fast — just `wpa_cli status`, no scan. For places (like a dashboard widget) that only need "connected to X or not". */
export async function getWifiConnectionStatus(): Promise<{ connected: boolean; ssid: string | null } | null> {
  const statusOutput = await runWpaCli(["status"]);
  if (statusOutput === null) return null;
  return { connected: /^wpa_state=COMPLETED$/m.test(statusOutput), ssid: extractSsid(statusOutput) };
}

/** Pure — parses wpa_cli's tab-separated scan_results output. Easy to test without touching sudo/child_process. */
export function parseScanResults(raw: string, connectedSsid: string | null): WifiNetwork[] {
  const seen = new Map<string, WifiNetwork>();

  const lines = raw.trim().split("\n").slice(1); // drop the header row
  for (const line of lines) {
    const [, , signalLevel, flags, ssid] = line.split("\t");
    if (!ssid) continue;
    const dbm = Number.parseInt(signalLevel ?? "-100", 10);
    const network: WifiNetwork = {
      ssid,
      signalPercent: signalToPercent(dbm),
      secured: isSecured(flags ?? ""),
      connected: ssid === connectedSsid,
    };
    // The same SSID can show up once per visible AP — keep the strongest.
    const existing = seen.get(ssid);
    if (!existing || network.signalPercent > existing.signalPercent) {
      seen.set(ssid, network);
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.signalPercent - a.signalPercent);
}

export async function scanWifiNetworks(): Promise<WifiNetwork[] | null> {
  const scanTriggered = await runWpaCli(["scan"]);
  if (scanTriggered === null) return null; // sudoers not set up yet, or no wlan0

  // wpa_cli's scan is asynchronous — give the driver a moment to populate
  // results before reading them back (standard wpa_cli usage pattern).
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const raw = await runWpaCli(["scan_results"]);
  if (!raw) return null;

  const statusOutput = await runWpaCli(["status"]);
  const connectedSsid = statusOutput ? extractSsid(statusOutput) : null;

  return parseScanResults(raw, connectedSsid);
}
