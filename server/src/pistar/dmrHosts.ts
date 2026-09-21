import { readFileSync } from "node:fs";
import type { DmrMasterHost } from "@pistar/shared";

/**
 * Parser for Pi-Star's/WPSD's /usr/local/etc/DMR_Hosts.txt — the master
 * list both dashboards build their "DMR Master" dropdown from. Format
 * (whitespace-separated, '#' comments):
 *
 *   # Name            DMR-ID  IP/Hostname                      Password  Port
 *   DMRGateway        0000    127.0.0.1                        none      62031
 *   BM_3102_United_States 3102 3102.master.brandmeister.network passw0rd 62031
 */
export function parseDmrHosts(text: string): DmrMasterHost[] {
  const hosts: DmrMasterHost[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const cols = line.split(/\s+/);
    if (cols.length < 5) continue;
    const [name, id, address, password, portText] = cols as [string, string, string, string, string];
    const port = Number(portText);
    if (!Number.isInteger(port) || port <= 0) continue;
    hosts.push({ name, id, address, password, port });
  }
  return hosts;
}

/** Offline fallback so the dropdown isn't empty on a dev machine or before the hosts file has ever been downloaded. */
export const FALLBACK_DMR_HOSTS: DmrMasterHost[] = [
  { name: "DMRGateway", id: "0000", address: "127.0.0.1", password: "none", port: 62031 },
  ...["3101", "3102", "3103", "3104"].map((id) => ({
    name: `BM_${id}_United_States`,
    id,
    address: `${id}.master.brandmeister.network`,
    password: "passw0rd",
    port: 62031,
  })),
  { name: "BM_3021_Canada", id: "3021", address: "3021.master.brandmeister.network", password: "passw0rd", port: 62031 },
  { name: "BM_2341_United_Kingdom", id: "2341", address: "2341.master.brandmeister.network", password: "passw0rd", port: 62031 },
  { name: "BM_2041_Netherlands", id: "2041", address: "2041.master.brandmeister.network", password: "passw0rd", port: 62031 },
  { name: "BM_2621_Germany", id: "2621", address: "2621.master.brandmeister.network", password: "passw0rd", port: 62031 },
  { name: "BM_5051_Australia", id: "5051", address: "5051.master.brandmeister.network", password: "passw0rd", port: 62031 },
];

export function readDmrHosts(path: string): { hosts: DmrMasterHost[]; source: "file" | "fallback" } {
  try {
    const hosts = parseDmrHosts(readFileSync(path, "utf8"));
    if (hosts.length > 0) return { hosts, source: "file" };
  } catch {
    // missing/unreadable — fall through
  }
  return { hosts: FALLBACK_DMR_HOSTS, source: "fallback" };
}

/** BrandMeister hosts first (the common case), then everything else, both alphabetical. */
export function sortDmrHosts(hosts: DmrMasterHost[]): DmrMasterHost[] {
  const rank = (h: DmrMasterHost) => (h.name === "DMRGateway" ? 0 : h.name.startsWith("BM_") ? 1 : 2);
  return [...hosts].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
