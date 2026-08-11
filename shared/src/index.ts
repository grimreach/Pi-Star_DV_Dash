// Shared contract between the Pi-Star dashboard server and client.
// Mirrors the domain concepts of the original PHP dashboard (modes,
// network status, repeater info, activity log) without any of the
// system-level implementation details.

export type Mode =
  | "dstar"
  | "dmr"
  | "m17"
  | "nxdn"
  | "p25"
  | "ysf"
  | "dmrXMode"
  | "ysfXMode"
  | "fm"
  | "pocsag";

export type NetworkLink =
  | "dstarNet"
  | "dmrNet"
  | "m17Net"
  | "nxdnNet"
  | "p25Net"
  | "ysfNet"
  | "dmr2nxdn"
  | "dmr2ysf"
  | "ysf2dmr"
  | "ysf2nxdn"
  | "ysf2p25"
  | "pocsagNet";

export interface ModeStatus {
  mode: Mode;
  label: string;
  enabled: boolean;
}

export interface NetworkStatus {
  link: NetworkLink;
  label: string;
  connected: boolean;
}

export type TrxState = "listening" | "transmitting" | "disconnected";

export interface RadioInfo {
  trx: TrxState;
  txFrequencyHz: number;
  rxFrequencyHz: number;
  firmware: string;
}

export interface DStarRepeaterInfo {
  rpt1: string;
  rpt2: string;
  aprsServer: string;
  currentLink: string;
}

export interface DmrRepeaterInfo {
  dmrId: string;
  colorCode: number;
  ts1: { enabled: boolean; talkgroup?: string };
  ts2: { enabled: boolean; talkgroup?: string };
  master: string;
}

export type ActivitySource = "Net" | "RF";

export interface ActivityEntry {
  id: string;
  /** epoch millis */
  timestamp: number;
  mode: Mode;
  callsign: string;
  target: string;
  src: ActivitySource;
  durationSeconds: number;
  lossPercent: number;
  berPercent: number;
  /** local RF only */
  rssiDbm?: number;
  gps?: boolean;
}

export interface DashboardState {
  callsign: string;
  hostname: string;
  dashboardVersion: string;
  pistarVersion: string;
  modes: ModeStatus[];
  networks: NetworkStatus[];
  radio: RadioInfo;
  dstar: DStarRepeaterInfo;
  dmr: DmrRepeaterInfo;
  gatewayActivity: ActivityEntry[];
  localRfActivity: ActivityEntry[];
}

// ---------------------------------------------------------------------------
// Configuration (admin > configure)
// ---------------------------------------------------------------------------

export interface GeneralConfig {
  callsign: string;
  dmrId: string;
  latitude: number;
  longitude: number;
  location: string;
  description: string;
  url: string;
  radio: "MMDVM_HS_Hat" | "MMDVM_HS_Dual_Hat" | "Nano_hotSPOT" | "ZUMspot" | "DVMEGA_HR3" | "Other";
  timezone: string;
}

export interface MmdvmHostConfig {
  duplex: boolean;
  rxFrequencyHz: number;
  txFrequencyHz: number;
  rxOffsetHz: number;
  txOffsetHz: number;
  rfLevelPercent: number;
  displayLevel: boolean;
}

export interface DmrGatewayConfig {
  enabled: boolean;
  id: string;
  colorCode: number;
  ts1Enabled: boolean;
  ts2Enabled: boolean;
  master: string;
  bmApiKey: string;
}

export interface DStarRepeaterConfig {
  enabled: boolean;
  rpt1: string;
  rpt2: string;
  ircddbHost: string;
  aprsHost: string;
}

export interface YsfGatewayConfig {
  enabled: boolean;
  wiresXMakeUpper: boolean;
  defaultRoom: string;
}

export interface P25GatewayConfig {
  enabled: boolean;
  nac: string;
  defaultReflector: string;
}

export interface NxdnGatewayConfig {
  enabled: boolean;
  ran: number;
  defaultReflector: string;
}

export interface M17GatewayConfig {
  enabled: boolean;
  module: string;
  defaultReflector: string;
}

export interface DapnetGatewayConfig {
  enabled: boolean;
  callsign: string;
  authKey: string;
}

// Not an NTP client — this is D-Star's periodic time-beacon feature
// (the "W3EZE/TIME" entries seen in the activity feed come from it).
// `modules` lists which D-Star modules (A-E) currently broadcast it.
export interface TimeServerConfig {
  enabled: boolean;
  callsign: string;
  modules: string[];
  intervalHours: number;
}

export interface FullConfig {
  general: GeneralConfig;
  mmdvmHost: MmdvmHostConfig;
  dmrGateway: DmrGatewayConfig;
  dstarRepeater: DStarRepeaterConfig;
  ysfGateway: YsfGatewayConfig;
  p25Gateway: P25GatewayConfig;
  nxdnGateway: NxdnGatewayConfig;
  m17Gateway: M17GatewayConfig;
  dapnetGateway: DapnetGatewayConfig;
  timeServer: TimeServerConfig;
}

export type ConfigSection = keyof FullConfig;

// ---------------------------------------------------------------------------
// Link manager
// ---------------------------------------------------------------------------

export type LinkProtocol = "dstar" | "dmr" | "ysf" | "p25" | "nxdn" | "m17";

export interface LinkTarget {
  id: string;
  name: string;
  description: string;
}

export interface LinkState {
  protocol: LinkProtocol;
  linked: boolean;
  current?: LinkTarget;
  available: LinkTarget[];
}

// ---------------------------------------------------------------------------
// System / power / wifi / ssh / firmware / calibration
// ---------------------------------------------------------------------------

export interface SystemInfo {
  hostname: string;
  pistarVersion: string;
  dashboardVersion: string;
  uptimeSeconds: number;
  cpuTemperatureC: number;
  cpuLoad: [number, number, number];
  memoryUsedMb: number;
  memoryTotalMb: number;
  diskUsedMb: number;
  diskTotalMb: number;
  ipAddress: string;
}

export type PowerAction = "reboot" | "shutdown";

export interface WifiNetwork {
  ssid: string;
  signalPercent: number;
  secured: boolean;
  connected: boolean;
}

export interface SshAccessState {
  enabled: boolean;
}

export interface FirmwareUpgradeState {
  inProgress: boolean;
  progressPercent: number;
  currentVersion: string;
  latestVersion: string;
  logLines: string[];
}

export interface CalibrationState {
  mode: "off" | "rx" | "tx" | "duplex";
  rssiDbm?: number;
}

export interface LogLine {
  timestamp: number;
  text: string;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthUser {
  username: string;
}

// ---------------------------------------------------------------------------
// WebSocket push messages
// ---------------------------------------------------------------------------

export type ServerEvent =
  | { type: "dashboard:update"; payload: DashboardState }
  | { type: "activity:new"; payload: { scope: "gateway" | "localRf"; entry: ActivityEntry } }
  | { type: "system:update"; payload: SystemInfo }
  | { type: "firmware:update"; payload: FirmwareUpgradeState }
  | { type: "log:line"; payload: LogLine };
