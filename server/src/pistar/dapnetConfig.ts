import { readFileSync } from "node:fs";
import type { DapnetGatewayConfig } from "@pistar/shared";
import { parseIni, iniString } from "./ini.js";
import { isProcessRunning } from "./processCheck.js";

/**
 * Reads Pi-Star's /etc/dapnetgateway — same [Section] key=value shape as
 * /etc/mmdvmhost. Unlike mmdvmhost's per-protocol Enable=0/1 flags, this
 * file has no enable flag of its own — DAPNET is turned on/off as a
 * systemd service (dapnetgateway.service), same as the network-health
 * checks in networkHealth.ts. So `enabled` here is derived from whether
 * that process is actually running, not a config value.
 */
export function readDapnetConfig(path: string): DapnetGatewayConfig | null {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }

  const ini = parseIni(text);
  return {
    enabled: isProcessRunning("DAPNETGateway"),
    callsign: iniString(ini, "General", "Callsign").toUpperCase(),
    authKey: iniString(ini, "DAPNET", "AuthKey"),
  };
}
