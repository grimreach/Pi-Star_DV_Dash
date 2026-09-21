import type { ConfigSection, FullConfig } from "@pistar/shared";
import type { SectionEdit } from "./configWriter.js";

/**
 * Reverse of mmdvmConfig.ts's read-side mapping — turns a FullConfig
 * section update into the specific /etc/mmdvmhost [Section] key=value
 * edits needed. Deliberately symmetric with the read side: only fields
 * that mmdvmConfig.ts actually reads back out of this file are written
 * here. Fields that live in other Pi-Star config files (BrandMeister API
 * key, ircDDB/APRS hosts, per-protocol default rooms/reflectors, DAPNET,
 * time server) aren't covered — writing those needs those other files
 * added to the allow-list first.
 */

// Pi-Star always quotes Location/Description regardless of content (see
// the real device's config: `Description="Country"` even though "Country"
// has no space/comma) — quoting conditionally on content, as an earlier
// version of this did, silently dropped quotes on unquoted-looking values
// and produced an unnecessary diff on every save. Always quote instead.
function quote(value: string): string {
  return `"${value}"`;
}

function bool01(value: boolean): string {
  return value ? "1" : "0";
}

export function buildMmdvmHostEdits(section: ConfigSection, config: FullConfig): SectionEdit[] {
  switch (section) {
    case "general": {
      const baseId = config.general.dmrId.trim().slice(0, 7);
      return [
        { section: "General", key: "Callsign", value: config.general.callsign.toUpperCase() },
        { section: "General", key: "Id", value: baseId },
        // Keep a configured direct-mode ESSID attached to the RF/login ID
        // rather than clobbering it from the General tab.
        { section: "DMR", key: "Id", value: baseId + (config.dmrGateway.mode === "direct" ? config.dmrGateway.essid : "") },
        { section: "Info", key: "Latitude", value: String(config.general.latitude) },
        { section: "Info", key: "Longitude", value: String(config.general.longitude) },
        { section: "Info", key: "Location", value: quote(config.general.location) },
        { section: "Info", key: "Description", value: quote(config.general.description) },
        { section: "Info", key: "URL", value: config.general.url },
      ];
    }

    case "mmdvmHost":
      return [
        { section: "General", key: "Duplex", value: bool01(config.mmdvmHost.duplex) },
        { section: "Info", key: "RXFrequency", value: String(config.mmdvmHost.rxFrequencyHz) },
        { section: "Info", key: "TXFrequency", value: String(config.mmdvmHost.txFrequencyHz) },
        { section: "Modem", key: "RXOffset", value: String(config.mmdvmHost.rxOffsetHz) },
        { section: "Modem", key: "TXOffset", value: String(config.mmdvmHost.txOffsetHz) },
        { section: "Modem", key: "RFLevel", value: String(config.mmdvmHost.rfLevelPercent) },
        { section: "Log", key: "DisplayLevel", value: bool01(config.mmdvmHost.displayLevel) },
      ];

    case "dmrGateway": {
      // Trim the fields the master actually checks at login (a trailing
      // space pasted from SelfCare fails with a bare "Login to the master
      // has failed" while the read side, which trims, shows it as fine).
      const d = config.dmrGateway;
      const baseId = d.id.trim().slice(0, 7);
      const essid = d.essid.trim();
      const common: SectionEdit[] = [
        { section: "DMR", key: "Enable", value: bool01(d.enabled) },
        { section: "DMR", key: "ColorCode", value: String(d.colorCode) },
        { section: "General", key: "Id", value: baseId },
        { section: "DMR Network", key: "Slot1", value: bool01(d.ts1Enabled) },
        { section: "DMR Network", key: "Slot2", value: bool01(d.ts2Enabled) },
      ];
      if (d.mode === "gateway") {
        // Same shape Pi-Star/WPSD write when the master is "DMRGateway":
        // MMDVMHost talks to the local daemon; the real master lives in
        // /etc/dmrgateway (see buildDmrGatewayFileEdits). Both the older
        // Address/Port/Local keys and the newer Remote*/Local* ones are
        // written — whichever the installed MMDVMHost build reads; the
        // writer skips keys the file doesn't have.
        return [
          ...common,
          { section: "DMR", key: "Id", value: baseId },
          { section: "DMR Network", key: "Address", value: "127.0.0.1" },
          { section: "DMR Network", key: "RemoteAddress", value: "127.0.0.1" },
          { section: "DMR Network", key: "Port", value: "62031" },
          { section: "DMR Network", key: "RemotePort", value: "62031" },
          { section: "DMR Network", key: "Local", value: "62032" },
          { section: "DMR Network", key: "LocalPort", value: "62032" },
          { section: "DMR Network", key: "LocalAddress", value: "127.0.0.1" },
          { section: "DMR Network", key: "Password", value: quote("none") },
        ];
      }
      return [
        ...common,
        // Direct mode: the ESSID rides on the [DMR] Id MMDVMHost logs in with.
        { section: "DMR", key: "Id", value: baseId + essid },
        { section: "DMR Network", key: "Address", value: d.master.trim() },
        { section: "DMR Network", key: "RemoteAddress", value: d.master.trim() },
        { section: "DMR Network", key: "Port", value: String(d.masterPort) },
        { section: "DMR Network", key: "RemotePort", value: String(d.masterPort) },
        // Quoted, like Pi-Star/WPSD: MMDVMHost treats '#' in an UNQUOTED
        // value as the start of a comment and truncates the password there.
        { section: "DMR Network", key: "Password", value: quote(d.networkPassword.trim()) },
      ];
    }

    case "dstarRepeater": {
      // The ini only stores a single Module letter — RPT1/RPT2 are
      // display-derived (CALLSIGN + " " + Module, CALLSIGN + " G").
      // Take the module as the last non-space character of rpt1.
      const trimmed = config.dstarRepeater.rpt1.trim();
      const module = trimmed.slice(-1) || "B";
      return [
        { section: "D-Star", key: "Enable", value: bool01(config.dstarRepeater.enabled) },
        { section: "D-Star", key: "Module", value: module },
      ];
    }

    case "ysfGateway":
      return [{ section: "System Fusion", key: "Enable", value: bool01(config.ysfGateway.enabled) }];

    case "p25Gateway":
      return [
        { section: "P25", key: "Enable", value: bool01(config.p25Gateway.enabled) },
        { section: "P25", key: "NAC", value: config.p25Gateway.nac },
      ];

    case "nxdnGateway":
      return [
        { section: "NXDN", key: "Enable", value: bool01(config.nxdnGateway.enabled) },
        { section: "NXDN", key: "RAN", value: String(config.nxdnGateway.ran) },
      ];

    case "m17Gateway":
      return [{ section: "M17", key: "Enable", value: bool01(config.m17Gateway.enabled) }];

    // Not in /etc/mmdvmhost — live in separate Pi-Star config files not
    // yet added to the writer's allow-list.
    case "dapnetGateway":
    case "timeServer":
      return [];
  }
}

/**
 * Companion edits for /etc/dmrgateway [DMR Network 1] (BrandMeister) —
 * only meaningful in gateway mode, where this is the block that carries
 * the real master, hotspot password and ESSID-suffixed login ID.
 */
export function buildDmrGatewayFileEdits(config: FullConfig): SectionEdit[] {
  const d = config.dmrGateway;
  if (d.mode !== "gateway") return [];
  const baseId = d.id.trim().slice(0, 7);
  const S = "DMR Network 1";
  return [
    { section: S, key: "Enabled", value: bool01(d.enabled) },
    { section: S, key: "Address", value: d.master.trim() },
    { section: S, key: "Port", value: String(d.masterPort) },
    { section: S, key: "Password", value: quote(d.networkPassword.trim()) },
    { section: S, key: "Id", value: baseId + d.essid.trim(), insertIfMissing: true },
  ];
}
