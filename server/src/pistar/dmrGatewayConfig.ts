import { existsSync, readFileSync } from "node:fs";
import { iniBool, iniNumber, iniString, parseIni } from "./ini.js";

/**
 * Reader for /etc/dmrgateway's [DMR Network 1] — where Pi-Star/WPSD keep
 * the BrandMeister master, hotspot password and ESSID-suffixed ID when
 * MMDVMHost is routed through DMRGateway (mmdvmhost [DMR Network]
 * Address=127.0.0.1). Only Network 1 (BrandMeister in every stock
 * config) is modelled — DMR+ / XLX / custom networks 2-5 aren't exposed
 * in the dashboard yet.
 */
export interface DmrGatewayNetwork {
  enabled: boolean;
  name: string;
  address: string;
  port: number;
  password: string;
  /** Full login ID as written (base + optional ESSID); "" when the key is absent. */
  id: string;
}

export function parseDmrGatewayNetwork1(text: string): DmrGatewayNetwork {
  const ini = parseIni(text);
  const S = "DMR Network 1";
  return {
    enabled: iniBool(ini, S, "Enabled"),
    name: iniString(ini, S, "Name"),
    address: iniString(ini, S, "Address"),
    port: iniNumber(ini, S, "Port", 62031),
    password: iniString(ini, S, "Password"),
    id: iniString(ini, S, "Id"),
  };
}

export function readDmrGatewayNetwork1(path: string): DmrGatewayNetwork | null {
  if (!existsSync(path)) return null;
  try {
    return parseDmrGatewayNetwork1(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** Splits a login ID into the 7-digit base and the ESSID suffix, given the known base. */
export function splitEssid(fullId: string, baseId: string): string {
  if (!fullId || !baseId) return "";
  return fullId.length > baseId.length && fullId.startsWith(baseId) ? fullId.slice(baseId.length) : "";
}
