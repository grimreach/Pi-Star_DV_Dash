import { readFileSync } from "node:fs";
import type {
  DStarRepeaterConfig,
  DmrGatewayConfig,
  FullConfig,
  GeneralConfig,
  M17GatewayConfig,
  Mode,
  MmdvmHostConfig,
  NetworkLink,
  NxdnGatewayConfig,
  P25GatewayConfig,
  YsfGatewayConfig,
} from "@pistar/shared";
import { iniBool, iniNumber, iniString, parseIni } from "./ini.js";

/**
 * Reads Pi-Star's real /etc/mmdvmhost (MMDVMHost.ini) and maps it onto our
 * config/dashboard shapes. This is the single source of truth for
 * general/mmdvmHost/dmrGateway/dstarRepeater/ysf/p25/nxdn/m17 config —
 * DAPNET, the time server, and per-slot DMR talkgroup routing live in
 * separate Pi-Star config files (DMRGateway.ini, dapnetgateway, etc.) not
 * read here yet, so those sections stay on the mock seed in store.ts.
 *
 * ts1Enabled/ts2Enabled below reflect the [DMR Network] Slot1/Slot2 routing
 * flags in this file (which slot that network entry carries), used as a
 * stand-in for "enabled" on the dashboard's TS1/TS2 panel — a true
 * per-slot/per-talkgroup breakdown needs DMRGateway.ini.
 *
 * Also note: enabled/connected here reflect *configured* state (Enable=1),
 * not *live* connection state — a network can be Enable=1 in this file and
 * still be failing to log in (see MMDVM-*.log). Live connection status will
 * come from the log tailer once that's wired up.
 */

export interface DerivedDashboardFields {
  callsign: string;
  enabledModes: Mode[];
  connectedNetworks: NetworkLink[];
  radio: { txFrequencyHz: number; rxFrequencyHz: number };
  dstar: { rpt1: string; rpt2: string };
  dmr: { dmrId: string; colorCode: number; ts1Enabled: boolean; ts2Enabled: boolean; master: string };
}

export interface ParsedMmdvmHost {
  config: Pick<
    FullConfig,
    "general" | "mmdvmHost" | "dmrGateway" | "dstarRepeater" | "ysfGateway" | "p25Gateway" | "nxdnGateway" | "m17Gateway"
  >;
  derived: DerivedDashboardFields;
}

export function readMmdvmHostConfig(path: string): ParsedMmdvmHost | null {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  return parseMmdvmHostConfig(text);
}

export function parseMmdvmHostConfig(text: string): ParsedMmdvmHost {
  const ini = parseIni(text);

  const callsign = iniString(ini, "General", "Callsign").toUpperCase();
  const dmrId = iniString(ini, "DMR", "Id", iniString(ini, "General", "Id"));

  const general: GeneralConfig = {
    callsign,
    dmrId,
    latitude: iniNumber(ini, "Info", "Latitude"),
    longitude: iniNumber(ini, "Info", "Longitude"),
    location: iniString(ini, "Info", "Location"),
    description: iniString(ini, "Info", "Description"),
    url: iniString(ini, "Info", "URL"),
    // MMDVMHost's config doesn't name the radio model directly (only a
    // serial port + the modem firmware's own Hardware= string) — not
    // worth guessing a mapping from that, so this stays generic.
    radio: "Other",
    timezone: "UTC",
  };

  const mmdvmHost: MmdvmHostConfig = {
    duplex: iniBool(ini, "General", "Duplex"),
    rxFrequencyHz: iniNumber(ini, "Info", "RXFrequency"),
    txFrequencyHz: iniNumber(ini, "Info", "TXFrequency"),
    rxOffsetHz: iniNumber(ini, "Modem", "RXOffset"),
    txOffsetHz: iniNumber(ini, "Modem", "TXOffset"),
    rfLevelPercent: iniNumber(ini, "Modem", "RFLevel", 100),
    displayLevel: iniBool(ini, "Log", "DisplayLevel"),
  };

  const dmrEnabled = iniBool(ini, "DMR", "Enable");
  const dmrNetEnabled = iniBool(ini, "DMR Network", "Enable");
  const dmrMasterAddress = iniString(ini, "DMR Network", "Address");
  const slot1Routed = iniBool(ini, "DMR Network", "Slot1");
  const slot2Routed = iniBool(ini, "DMR Network", "Slot2");

  const dmrGateway: DmrGatewayConfig = {
    enabled: dmrEnabled,
    id: dmrId,
    colorCode: iniNumber(ini, "DMR", "ColorCode", 1),
    ts1Enabled: slot1Routed,
    ts2Enabled: slot2Routed,
    master: dmrMasterAddress,
    networkPassword: iniString(ini, "DMR Network", "Password"),
    bmApiKey: "",
  };

  const dstarModule = iniString(ini, "D-Star", "Module", "B");
  const dstarRepeater: DStarRepeaterConfig = {
    enabled: iniBool(ini, "D-Star", "Enable"),
    rpt1: `${callsign} ${dstarModule}`,
    rpt2: `${callsign} G`,
    // ircDDBGateway's own config (not read here) owns the real ircDDB/APRS
    // hosts — [D-Star Network] GatewayAddress in this file is just the
    // loopback MMDVMHost uses to reach the locally-running gateway daemon.
    ircddbHost: "",
    aprsHost: "",
  };

  const ysfGateway: YsfGatewayConfig = {
    enabled: iniBool(ini, "System Fusion", "Enable"),
    wiresXMakeUpper: true,
    defaultRoom: "",
  };

  const p25Gateway: P25GatewayConfig = {
    enabled: iniBool(ini, "P25", "Enable"),
    nac: iniString(ini, "P25", "NAC", "293"),
    defaultReflector: "",
  };

  const nxdnGateway: NxdnGatewayConfig = {
    enabled: iniBool(ini, "NXDN", "Enable"),
    ran: iniNumber(ini, "NXDN", "RAN", 1),
    defaultReflector: "",
  };

  const m17Gateway: M17GatewayConfig = {
    enabled: iniBool(ini, "M17", "Enable"),
    module: "A",
    defaultReflector: "",
  };

  const enabledModes: Mode[] = [];
  if (dstarRepeater.enabled) enabledModes.push("dstar");
  if (dmrEnabled) enabledModes.push("dmr");
  if (ysfGateway.enabled) enabledModes.push("ysf");
  if (p25Gateway.enabled) enabledModes.push("p25");
  if (nxdnGateway.enabled) enabledModes.push("nxdn");
  if (m17Gateway.enabled) enabledModes.push("m17");
  if (iniBool(ini, "FM", "Enable")) enabledModes.push("fm");
  if (iniBool(ini, "POCSAG", "Enable")) enabledModes.push("pocsag");

  const connectedNetworks: NetworkLink[] = [];
  if (iniBool(ini, "D-Star Network", "Enable")) connectedNetworks.push("dstarNet");
  if (dmrNetEnabled) connectedNetworks.push("dmrNet");
  if (iniBool(ini, "System Fusion Network", "Enable")) connectedNetworks.push("ysfNet");
  if (iniBool(ini, "P25 Network", "Enable")) connectedNetworks.push("p25Net");
  if (iniBool(ini, "NXDN Network", "Enable")) connectedNetworks.push("nxdnNet");
  if (iniBool(ini, "M17 Network", "Enable")) connectedNetworks.push("m17Net");
  if (iniBool(ini, "POCSAG Network", "Enable")) connectedNetworks.push("pocsagNet");

  return {
    config: { general, mmdvmHost, dmrGateway, dstarRepeater, ysfGateway, p25Gateway, nxdnGateway, m17Gateway },
    derived: {
      callsign,
      enabledModes,
      connectedNetworks,
      radio: { txFrequencyHz: mmdvmHost.txFrequencyHz, rxFrequencyHz: mmdvmHost.rxFrequencyHz },
      dstar: { rpt1: dstarRepeater.rpt1, rpt2: dstarRepeater.rpt2 },
      dmr: {
        dmrId,
        colorCode: dmrGateway.colorCode,
        ts1Enabled: dmrGateway.ts1Enabled,
        ts2Enabled: dmrGateway.ts2Enabled,
        master: dmrMasterAddress,
      },
    },
  };
}
