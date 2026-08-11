import { randomUUID } from "node:crypto";
import type {
  ActivityEntry,
  DashboardState,
  FullConfig,
  LinkProtocol,
  LinkState,
  Mode,
  ModeStatus,
  NetworkLink,
  NetworkStatus,
  RadioInfo,
  SshAccessState,
  SystemInfo,
  WifiNetwork,
} from "@pistar/shared";
import { readMmdvmHostConfig } from "./pistar/mmdvmConfig.js";

/**
 * In-memory data layer standing in for Pi-Star's real system integration
 * (MMDVMHost.log tailing, /etc/mmdvmhost, ircDDBGateway state, etc).
 *
 * Every mutator here is the seam to replace with real system calls when
 * this runs on an actual Pi-Star device: read the config off disk, shell
 * out to `sudo systemctl restart mmdvmhost`, tail the real log, and so on.
 */

const MODE_LABELS: Record<Mode, string> = {
  dstar: "D-Star",
  dmr: "DMR",
  m17: "M17",
  nxdn: "NXDN",
  p25: "P25",
  ysf: "YSF",
  dmrXMode: "DMR XMode",
  ysfXMode: "YSF XMode",
  fm: "FM",
  pocsag: "POCSAG",
};

const NETWORK_LABELS: Record<NetworkLink, string> = {
  dstarNet: "D-Star Net",
  dmrNet: "DMR Net",
  m17Net: "M17 Net",
  nxdnNet: "NXDN Net",
  p25Net: "P25 Net",
  ysfNet: "YSF Net",
  dmr2nxdn: "DMR2NXDN",
  dmr2ysf: "DMR2YSF",
  ysf2dmr: "YSF2DMR",
  ysf2nxdn: "YSF2NXDN",
  ysf2p25: "YSF2P25",
  pocsagNet: "POCSAG Net",
};

function modeStatus(enabled: Mode[]): ModeStatus[] {
  return (Object.keys(MODE_LABELS) as Mode[]).map((mode) => ({
    mode,
    label: MODE_LABELS[mode],
    enabled: enabled.includes(mode),
  }));
}

function networkStatus(connected: NetworkLink[]): NetworkStatus[] {
  return (Object.keys(NETWORK_LABELS) as NetworkLink[]).map((link) => ({
    link,
    label: NETWORK_LABELS[link],
    connected: connected.includes(link),
  }));
}

function seedActivity(): { gateway: ActivityEntry[]; localRf: ActivityEntry[] } {
  const now = Date.now();
  return {
    gateway: [
      {
        id: randomUUID(),
        timestamp: now - 17 * 60 * 1000,
        mode: "dstar",
        callsign: "W3EZE/TIME",
        target: "CQCQCQ",
        src: "Net",
        durationSeconds: 3.9,
        lossPercent: 0,
        berPercent: 0,
        gps: true,
      },
      {
        id: randomUUID(),
        timestamp: now - 33 * 60 * 1000,
        mode: "dstar",
        callsign: "KX0UWU/P25",
        target: "CQCQCQ",
        src: "Net",
        durationSeconds: 6.0,
        lossPercent: 0,
        berPercent: 0,
        gps: true,
      },
    ],
    localRf: [],
  };
}

class DataStore {
  callsign = "W3EZE";
  hostname = "pi-star";
  dashboardVersion = "20260501";
  pistarVersion = "4.3.7";

  enabledModes: Mode[] = ["dstar", "dmr"];
  // configuredNetworks: what /etc/mmdvmhost says should be connected.
  // connectedNetworks: what's actually live right now (networkHealth.ts
  // narrows this down from configuredNetworks via process/login checks
  // when running on a real device) — starts equal to configuredNetworks.
  configuredNetworks: NetworkLink[] = ["dstarNet", "dmrNet"];
  connectedNetworks: NetworkLink[] = ["dstarNet", "dmrNet"];

  radio: RadioInfo = {
    trx: "listening",
    txFrequencyHz: 431_075_000,
    rxFrequencyHz: 431_075_000,
    firmware: "DVMEGA HR3.26",
  };

  dstar = {
    rpt1: "W3EZE B",
    rpt2: "W3EZE G",
    aprsServer: "noam.aprs2.net",
    currentLink: "DCS672 E DCS/Out",
  };

  dmr = {
    dmrId: "1107385",
    colorCode: 1,
    ts1: { enabled: false, talkgroup: undefined as string | undefined },
    ts2: { enabled: true, talkgroup: "TG 3102" },
    master: "BM 3102 United States",
  };

  activity = seedActivity();

  config: FullConfig = {
    general: {
      callsign: this.callsign,
      dmrId: "1107385",
      latitude: 39.29,
      longitude: -76.61,
      location: "Baltimore, MD",
      description: "Pi-Star Hotspot",
      url: "https://www.pistar.uk",
      radio: "DVMEGA_HR3",
      timezone: "America/New_York",
    },
    mmdvmHost: {
      duplex: false,
      rxFrequencyHz: 431_075_000,
      txFrequencyHz: 431_075_000,
      rxOffsetHz: 0,
      txOffsetHz: 0,
      rfLevelPercent: 100,
      displayLevel: false,
    },
    dmrGateway: {
      enabled: true,
      id: "1107385",
      colorCode: 1,
      ts1Enabled: false,
      ts2Enabled: true,
      master: "BM 3102 United States",
      bmApiKey: "",
    },
    dstarRepeater: {
      enabled: true,
      rpt1: "W3EZE B",
      rpt2: "W3EZE G",
      ircddbHost: "rr.openquad.net",
      aprsHost: "noam.aprs2.net",
    },
    ysfGateway: {
      enabled: false,
      wiresXMakeUpper: true,
      defaultRoom: "",
    },
    p25Gateway: {
      enabled: false,
      nac: "293",
      defaultReflector: "",
    },
    nxdnGateway: {
      enabled: false,
      ran: 1,
      defaultReflector: "",
    },
    m17Gateway: {
      enabled: false,
      module: "A",
      defaultReflector: "",
    },
    dapnetGateway: {
      enabled: false,
      callsign: this.callsign,
      authKey: "",
    },
    timeServer: {
      enabled: true,
      ntpServer: "pool.ntp.org",
    },
  };

  links: Record<LinkProtocol, LinkState> = {
    dstar: {
      protocol: "dstar",
      linked: true,
      current: { id: "DCS672E", name: "DCS672 E", description: "DCS/Out reflector" },
      available: [
        { id: "REF001C", name: "REF001 C", description: "Parrot / test reflector" },
        { id: "DCS672E", name: "DCS672 E", description: "DCS/Out reflector" },
        { id: "XRF757A", name: "XRF757 A", description: "General chat" },
      ],
    },
    dmr: {
      protocol: "dmr",
      linked: true,
      current: { id: "3102", name: "TG 3102", description: "US Nationwide" },
      available: [
        { id: "3100", name: "TG 3100", description: "Worldwide" },
        { id: "3102", name: "TG 3102", description: "US Nationwide" },
        { id: "3120", name: "TG 3120", description: "US TAC 1" },
      ],
    },
    ysf: {
      protocol: "ysf",
      linked: false,
      available: [
        { id: "21111", name: "America Link", description: "YSF America Link" },
        { id: "21582", name: "England Link", description: "YSF England Link" },
      ],
    },
    p25: {
      protocol: "p25",
      linked: false,
      available: [{ id: "10999", name: "P25 Parrot", description: "Test reflector" }],
    },
    nxdn: {
      protocol: "nxdn",
      linked: false,
      available: [{ id: "65000", name: "NXDN Reflector 01", description: "General" }],
    },
    m17: {
      protocol: "m17",
      linked: false,
      available: [{ id: "M17-M17", name: "M17-M17", description: "Reflector M17" }],
    },
  };

  wifiNetworks: WifiNetwork[] = [
    { ssid: "ShackNet", signalPercent: 88, secured: true, connected: true },
    { ssid: "ShackNet-Guest", signalPercent: 61, secured: true, connected: false },
    { ssid: "NeighborWifi", signalPercent: 34, secured: true, connected: false },
  ];

  sshAccess: SshAccessState = { enabled: false };

  firmware = {
    inProgress: false,
    progressPercent: 0,
    currentVersion: "HR3.26",
    latestVersion: "HR3.28",
    logLines: [] as string[],
  };

  calibration: { mode: "off" | "rx" | "tx" | "duplex"; rssiDbm?: number } = { mode: "off" };

  logBuffer: { timestamp: number; text: string }[] = [];

  pushLog(text: string) {
    this.logBuffer = [...this.logBuffer, { timestamp: Date.now(), text }].slice(-200);
  }

  bootTime = Date.now();

  systemInfo(): SystemInfo {
    return {
      hostname: this.hostname,
      pistarVersion: this.pistarVersion,
      dashboardVersion: this.dashboardVersion,
      uptimeSeconds: Math.floor((Date.now() - this.bootTime) / 1000),
      cpuTemperatureC: 46 + Math.random() * 4,
      cpuLoad: [0.12, 0.18, 0.21],
      memoryUsedMb: 210,
      memoryTotalMb: 512,
      diskUsedMb: 2100,
      diskTotalMb: 7400,
      ipAddress: "192.168.1.42",
    };
  }

  dashboardState(): DashboardState {
    return {
      callsign: this.callsign,
      hostname: this.hostname,
      dashboardVersion: this.dashboardVersion,
      pistarVersion: this.pistarVersion,
      modes: modeStatus(this.enabledModes),
      networks: networkStatus(this.connectedNetworks),
      radio: this.radio,
      dstar: this.dstar,
      dmr: this.dmr,
      gatewayActivity: this.activity.gateway.slice(0, 25),
      localRfActivity: this.activity.localRf.slice(0, 25),
    };
  }

  pushActivity(scope: "gateway" | "localRf", entry: ActivityEntry) {
    const key = scope === "gateway" ? "gateway" : "localRf";
    this.activity[key] = [entry, ...this.activity[key]].slice(0, 50);
  }

  constructor() {
    this.loadRealConfigIfAvailable();
  }

  private loadRealConfigIfAvailable() {
    const path = process.env.MMDVMHOST_CONFIG_PATH ?? "/etc/mmdvmhost";
    const parsed = readMmdvmHostConfig(path);
    if (!parsed) return;

    console.log(`Loaded real MMDVMHost config from ${path}`);
    const { config, derived } = parsed;

    this.callsign = derived.callsign;
    this.enabledModes = derived.enabledModes;
    this.configuredNetworks = derived.connectedNetworks;
    this.connectedNetworks = derived.connectedNetworks;
    this.radio = { ...this.radio, ...derived.radio };
    this.dstar = { ...this.dstar, ...derived.dstar };
    this.dmr = { ...this.dmr, ...derived.dmr };

    // dapnetGateway and timeServer aren't in this file (separate Pi-Star
    // config files, not read yet) — left on the mock seed intentionally.
    this.config = {
      ...this.config,
      general: config.general,
      mmdvmHost: config.mmdvmHost,
      dmrGateway: config.dmrGateway,
      dstarRepeater: config.dstarRepeater,
      ysfGateway: config.ysfGateway,
      p25Gateway: config.p25Gateway,
      nxdnGateway: config.nxdnGateway,
      m17Gateway: config.m17Gateway,
    };
  }
}

export const store = new DataStore();
