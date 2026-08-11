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

function quote(value: string): string {
  return value.includes(" ") || value.includes(",") ? `"${value}"` : value;
}

function bool01(value: boolean): string {
  return value ? "1" : "0";
}

export function buildMmdvmHostEdits(section: ConfigSection, config: FullConfig): SectionEdit[] {
  switch (section) {
    case "general":
      return [
        { section: "General", key: "Callsign", value: config.general.callsign.toUpperCase() },
        { section: "General", key: "Id", value: config.general.dmrId },
        { section: "DMR", key: "Id", value: config.general.dmrId },
        { section: "Info", key: "Latitude", value: String(config.general.latitude) },
        { section: "Info", key: "Longitude", value: String(config.general.longitude) },
        { section: "Info", key: "Location", value: quote(config.general.location) },
        { section: "Info", key: "Description", value: quote(config.general.description) },
        { section: "Info", key: "URL", value: config.general.url },
      ];

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

    case "dmrGateway":
      return [
        { section: "DMR", key: "Enable", value: bool01(config.dmrGateway.enabled) },
        { section: "DMR", key: "ColorCode", value: String(config.dmrGateway.colorCode) },
        { section: "DMR", key: "Id", value: config.dmrGateway.id },
        { section: "General", key: "Id", value: config.dmrGateway.id },
        { section: "DMR Network", key: "Slot1", value: bool01(config.dmrGateway.ts1Enabled) },
        { section: "DMR Network", key: "Slot2", value: bool01(config.dmrGateway.ts2Enabled) },
        { section: "DMR Network", key: "Address", value: config.dmrGateway.master },
      ];

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
