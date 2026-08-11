import { runWpaCli } from "./wifiScan.js";

/**
 * Real WiFi connect/disconnect via wpa_cli. Deliberately more careful than
 * a typical "join network" flow:
 *
 *   - Uses add_network + enable_network, NOT select_network — select_network
 *     disables every other configured network profile, which could kill a
 *     previously-working connection if the new one fails. enable_network
 *     just adds this as another candidate and lets wpa_supplicant's normal
 *     selection logic take it if better/available.
 *   - Polls status for actual success (wpa_state=COMPLETED on the target
 *     SSID) rather than assuming enable_network succeeding means connected.
 *   - Automatically removes the network profile it just added if
 *     connection fails, rather than leaving a broken/orphaned entry.
 *
 * Requires the wpa_cli add_network/set_network/enable_network/
 * disable_network/remove_network/save_config sudo grants in
 * deploy/sudoers.d/040-pistar-dashboard-node.
 */

export interface WifiActionResult {
  success: boolean;
  message: string;
  // "no-capability" means wpa_cli itself couldn't be reached at all (no
  // sudo grant, no wlan0, not on the real device) — the route falls back
  // to mock behavior for this case specifically. Any other failure is a
  // real attempt that genuinely failed and should be shown as-is, not
  // silently swapped for a fake mock "success".
  reason?: "no-capability" | "invalid-input" | "config-failed" | "connect-failed" | "no-active-connection";
}

function isSafeWpaValue(value: string): boolean {
  // wpa_cli's simple CLI has no escaping for embedded quotes in a
  // string value — reject rather than send a malformed command.
  return !value.includes('"') && !/[\x00\r\n]/.test(value);
}

async function setNetworkParam(id: number, param: string, value: string): Promise<boolean> {
  const out = await runWpaCli(["set_network", String(id), param, value]);
  return out !== null && out.trim() === "OK";
}

async function waitForConnection(ssid: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await runWpaCli(["status"]);
    if (status) {
      const state = status.match(/^wpa_state=(.*)$/m)?.[1];
      const connectedSsid = status.match(/^ssid=(.*)$/m)?.[1];
      if (state === "COMPLETED" && connectedSsid === ssid) return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

export async function connectToWifi(ssid: string, password?: string): Promise<WifiActionResult> {
  if (!isSafeWpaValue(ssid) || (password !== undefined && !isSafeWpaValue(password))) {
    return { success: false, reason: "invalid-input", message: "SSID/password can't contain a double-quote character." };
  }

  const addOut = await runWpaCli(["add_network"]);
  if (addOut === null) {
    return {
      success: false,
      reason: "no-capability",
      message: "Couldn't reach wpa_cli — is the sudo grant installed and wlan0 present?",
    };
  }
  const id = Number.parseInt(addOut.trim(), 10);
  if (!Number.isFinite(id)) {
    return { success: false, reason: "config-failed", message: `Unexpected add_network response: ${addOut.trim()}` };
  }

  const ssidOk = await setNetworkParam(id, "ssid", `"${ssid}"`);
  const credOk = password ? await setNetworkParam(id, "psk", `"${password}"`) : await setNetworkParam(id, "key_mgmt", "NONE");

  if (!ssidOk || !credOk) {
    await runWpaCli(["remove_network", String(id)]);
    return { success: false, reason: "config-failed", message: "Failed to configure the network profile." };
  }

  await runWpaCli(["enable_network", String(id)]);

  const connected = await waitForConnection(ssid, 15000);
  if (!connected) {
    await runWpaCli(["disable_network", String(id)]);
    await runWpaCli(["remove_network", String(id)]);
    return {
      success: false,
      reason: "connect-failed",
      message: `Couldn't connect to "${ssid}" — check the password and try again.`,
    };
  }

  await runWpaCli(["save_config"]);
  return { success: true, message: `Connected to "${ssid}".` };
}

export async function disconnectWifi(): Promise<WifiActionResult> {
  const status = await runWpaCli(["status"]);
  if (status === null) {
    return { success: false, reason: "no-capability", message: "Couldn't reach wpa_cli — is the sudo grant installed?" };
  }
  const id = status.match(/^id=(\d+)$/m)?.[1];
  if (!id) {
    return { success: false, reason: "no-active-connection", message: "No active WiFi connection found." };
  }
  await runWpaCli(["disable_network", id]);
  return { success: true, message: "Disconnected." };
}
