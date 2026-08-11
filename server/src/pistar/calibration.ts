import { execFile } from "node:child_process";
import dgram from "node:dgram";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import type { CalibrationMode, CalibrationState, CalibrationStats } from "@pistar/shared";
import { writeMmdvmHostConfig } from "./configWriter.js";
import { FileTailer } from "./logTail.js";
import { store } from "../store.js";
import { wsHub } from "../ws.js";

const execFileAsync = promisify(execFile);

/**
 * Real calibration, matching admin/calibration.php's actual mechanism —
 * NOT a config toggle. Clicking Start spawns a separate MMDVMCal process
 * (via the pistar-calibration-start wrapper) that takes MMDVMHost offline
 * and drives the modem directly; control happens by sending single-letter
 * commands over a UDP socket to the running process, and all feedback
 * (BER stats, mode changes, frequency) comes from tailing its raw log
 * output — not from a request/response protocol.
 *
 * Ported to a persistent server-side engine (rather than PHP's
 * per-request session-offset tailing) since this is naturally a long-
 * lived stateful session, broadcasting over WebSocket instead of client-
 * side polling.
 */

const CALIBRATION_SCRIPT = "/usr/local/sbin/pistar-calibration-start";
const LOG_PATH = "/tmp/pi-star_mmdvmcal.log";
const LOCAL_PORT = 33272;
const REMOTE_PORT = 33273;

const MODE_MARKERS: [string, CalibrationMode][] = [
  ["BER Test Mode (FEC) for D-Star", "dstar"],
  ["BER Test Mode (FEC) for DMR Simplex", "dmr"],
  ["BER Test Mode (FEC) for YSF", "ysf"],
  ["BER Test Mode (FEC) for P25", "p25"],
  ["BER Test Mode (FEC) for NXDN", "nxdn"],
];

const MODE_COMMANDS: Record<CalibrationMode, string> = {
  dstar: "k",
  dmr: "b",
  ysf: "J",
  p25: "j",
  nxdn: "n",
};

const EMPTY_STATS: CalibrationStats = { frames: 0, bits: 0, errors: 0, berPercent: 0 };

class CalibrationEngine {
  private socket: dgram.Socket | null = null;
  private tailer: FileTailer | null = null;
  private state: CalibrationState = {
    running: false,
    activeMode: null,
    baseFrequencyHz: 0,
    offsetHz: 0,
    stepHz: 25,
    current: EMPTY_STATS,
    total: EMPTY_STATS,
  };

  getState(): CalibrationState {
    return this.state;
  }

  isAvailable(): boolean {
    return existsSync(CALIBRATION_SCRIPT);
  }

  private setState(patch: Partial<CalibrationState>) {
    this.state = { ...this.state, ...patch };
    wsHub.broadcast({ type: "calibration:update", payload: this.state });
  }

  async start(): Promise<{ ok: boolean; message?: string }> {
    if (!this.isAvailable()) {
      return { ok: false, message: `${CALIBRATION_SCRIPT} not found — not a real Pi-Star device.` };
    }

    this.setState({
      running: true,
      activeMode: null,
      baseFrequencyHz: store.config.mmdvmHost.rxFrequencyHz,
      offsetHz: store.config.mmdvmHost.rxOffsetHz,
      current: EMPTY_STATS,
      total: EMPTY_STATS,
    });

    try {
      // Idempotent single-instance guard, matching the original: always
      // stop any previous session before starting a fresh one.
      await execFileAsync("sudo", [CALIBRATION_SCRIPT, "stop"]).catch(() => {});
      await execFileAsync("sudo", [CALIBRATION_SCRIPT]);
    } catch (err) {
      this.setState({ running: false });
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }

    this.openSocket();
    this.attachTailer();
    return { ok: true };
  }

  private openSocket() {
    this.socket?.close();
    this.socket = dgram.createSocket("udp4");
    this.socket.bind(LOCAL_PORT, "127.0.0.1");
    this.socket.on("error", () => {});
  }

  private attachTailer() {
    this.tailer?.stop();
    this.tailer = new FileTailer(LOG_PATH, {
      onData: (chunk) => this.handleChunk(chunk),
      onError: () => {},
    });
    // The wrapper (re)creates the log fresh on each start — give it a
    // moment to exist, then tail from the beginning of this run's output.
    setTimeout(() => this.tailer?.start(false), 500);
  }

  private sendRaw(text: string) {
    this.socket?.send(Buffer.from(text), REMOTE_PORT, "127.0.0.1");
  }

  private sendCommand(cmd: string, param?: string) {
    if (!this.socket) return;
    this.sendRaw(cmd);
    if (param !== undefined) {
      setTimeout(() => this.sendRaw(`${param}\n`), 500);
    }
  }

  selectMode(mode: CalibrationMode) {
    this.sendCommand(MODE_COMMANDS[mode]);
  }

  adjustFrequency(direction: "up" | "down") {
    this.sendCommand(direction === "up" ? "F" : "f");
    const delta = this.state.stepHz * (direction === "up" ? 1 : -1);
    this.setState({ offsetHz: this.state.offsetHz + delta });
  }

  setStep(step: 25 | 50 | 100) {
    this.sendCommand("z", String(step));
    this.setState({ stepHz: step });
  }

  stopTest() {
    this.sendCommand("q");
    setTimeout(() => this.sendRaw("\n"), 1000);
  }

  async saveOffset(): Promise<{ ok: boolean; message?: string }> {
    const offset = String(this.state.offsetHz);
    try {
      await writeMmdvmHostConfig("/etc/mmdvmhost", [
        { section: "Modem", key: "RXOffset", value: offset },
        { section: "Modem", key: "TXOffset", value: offset },
      ]);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  private teardown() {
    this.tailer?.stop();
    this.tailer = null;
    this.socket?.close();
    this.socket = null;
  }

  private handleChunk(chunk: string) {
    wsHub.broadcast({ type: "calibration:log", payload: { text: chunk } });

    if (chunk.includes("Version:")) {
      // Matches the original's auto-init handshake: once MMDVMCal
      // reports ready, set it to the current base+offset frequency so
      // calibration resumes where /etc/mmdvmhost left off.
      const freq = this.state.baseFrequencyHz + this.state.offsetHz;
      setTimeout(() => this.sendCommand("e", String(freq)), 1000);
    }

    if (chunk.includes("Finnished...")) {
      this.setState({ running: false, activeMode: null });
      this.teardown();
      return;
    }

    let patch: Partial<CalibrationState> = {};

    for (const [marker, mode] of MODE_MARKERS) {
      if (chunk.includes(marker)) patch.activeMode = mode;
    }

    const freqMatch = chunk.match(/ frequency: (\d+)/);
    if (freqMatch) {
      patch.offsetHz = Number.parseInt(freqMatch[1]!, 10) - this.state.baseFrequencyHz;
    }

    let current = chunk.includes("voice end received,") ? EMPTY_STATS : this.state.current;
    let total = this.state.total;
    let statsChanged = chunk.includes("voice end received,");

    const berRegex = /% \((\d+)\/(\d+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = berRegex.exec(chunk))) {
      const errors = Number.parseInt(match[1]!, 10);
      const bits = Number.parseInt(match[2]!, 10);
      current = { frames: current.frames + 1, errors: current.errors + errors, bits: current.bits + bits, berPercent: 0 };
      total = { frames: total.frames + 1, errors: total.errors + errors, bits: total.bits + bits, berPercent: 0 };
      statsChanged = true;
    }

    if (statsChanged) {
      current = { ...current, berPercent: current.bits > 0 ? (current.errors / current.bits) * 100 : 0 };
      total = { ...total, berPercent: total.bits > 0 ? (total.errors / total.bits) * 100 : 0 };
      patch = { ...patch, current, total };
    }

    if (Object.keys(patch).length > 0) this.setState(patch);
  }
}

export const calibrationEngine = new CalibrationEngine();
