import { randomUUID } from "node:crypto";
import type { ActivityEntry, Mode } from "@pistar/shared";

/**
 * Parses MMDVMHost's log lines into ActivityEntry objects.
 *
 * Ported from the original PHP dashboard's mmdvmhost/functions.php
 * (getHeardList/getLastHeard) — the sample log lines documented there
 * (with a column-offset ruler) are the ground truth for this format:
 *
 *   M: 2000-00-00 00:00:00.000 D-Star, received RF header from M1ABC   /ABCD to CQCQCQ
 *   M: 2000-00-00 00:00:00.000 D-Star, received RF end of transmission from M1ABC   /ABCD to CQCQCQ  , 00.0 seconds, BER: 0.0%, RSSI: -43/-43/-43 dBm
 *   M: 2000-00-00 00:00:00.000 DMR Slot 2, received network voice header from M1ABC to TG 1
 *   M: 2000-00-00 00:00:00.000 DMR Slot 2, received RF end of voice transmission, 1.8 seconds, BER: 3.9%
 *   M: 2000-00-00 00:00:00.000 YSF, received RF data from MW0MWZ     to ALL
 *   M: 2000-00-00 00:00:00.000 YSF, received RF end of transmission, 5.1 seconds, BER: 3.8%
 *   M: 2000-00-00 00:00:00.000 P25, received RF transmission from M1ABC to TG 10200
 *   M: 2000-00-00 00:00:00.000 P25, received RF end of transmission, 0.4 seconds, BER: 0.0%
 *   M: 2000-00-00 00:00:00.000 NXDN, received RF transmission from MW0MWZ to TG 65000
 *   M: 2000-00-00 00:00:00.000 M17, received RF late entry voice transmission from M1ABC to INFO
 *   M: 2000-00-00 00:00:00.000 M17, received RF end of transmission from M1ABC to INFO, 2.1 seconds, BER: 0.2%, RSSI: -60/-60/-60 dBm
 *
 * The "mode" field always starts at a fixed column offset (27 chars in —
 * "M: " + "2000-00-00 00:00:00.000" + " "), running up to the first comma.
 *
 * Unlike the original PHP (which pushes a row per log line and dedupes by
 * first-occurrence, occasionally keeping a stale/empty duration from a
 * still-in-flight header line — see conversation notes), this parser
 * buffers each channel's in-flight header line and only emits a finished
 * ActivityEntry once the matching "end of transmission" line arrives with
 * real duration/loss/BER/RSSI. Simpler, and avoids that stale-duration
 * quirk; the tradeoff is no "TX in progress" live row while a call is
 * still active.
 *
 * D-Star is intentionally NOT handled here — real D-Star traffic on
 * Pi-Star flows through ircDDBGateway's own log, a different format not
 * yet ported. D-Star activity stays simulated until that's built.
 */

type Channel = "DMR Slot 1" | "DMR Slot 2" | "YSF" | "P25" | "NXDN" | "M17" | "POCSAG";

const CHANNEL_TO_MODE: Record<Channel, Mode> = {
  "DMR Slot 1": "dmr",
  "DMR Slot 2": "dmr",
  YSF: "ysf",
  P25: "p25",
  NXDN: "nxdn",
  M17: "m17",
  POCSAG: "pocsag",
};

const MODE_COLUMN_START = 27;

const NOISE_PATTERNS = [
  "BS_Dwn_Act",
  "invalid access",
  "received RF header for wrong repeater",
  "unable to decode the network CSBK",
  "overflow in the DMR slot RF queue",
  "overflow in the M17 RF queue",
  "non repeater RF header received",
  "Embedded Talker Alias",
  "DMR Talker Alias",
  ", Talker Alias ",
  ", text Data: ",
  "CSBK Preamble",
  "Preamble CSBK",
];

const END_MARKERS = [
  "end of",
  "watchdog has expired",
  "invalid slow data header",
  "ended RF data",
  "d network data",
  "RF user has timed out",
  "transmission lost",
  "POCSAG",
];

interface PendingCall {
  timestamp: number;
  callsign: string;
  target: string;
  source: "RF" | "Net";
}

function extractMode(line: string): string {
  const comma = line.indexOf(",", MODE_COLUMN_START);
  if (comma === -1) return "";
  return line.slice(MODE_COLUMN_START, comma);
}

function extractTimestamp(line: string): number {
  // "M: 2000-00-00 00:00:00.000 ..." — timestamp is chars [3, 22), space-
  // separated date/time, log-local (Pi-Star logs in UTC by convention).
  const raw = line.slice(3, 3 + 23).trim();
  const iso = raw.replace(" ", "T") + "Z";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? Date.now() : ms;
}

function extractCallsignAndTarget(line: string): { callsign: string; target: string } | null {
  const fromIdx = line.indexOf("from");
  const toIdx = line.indexOf(" to ", fromIdx);
  if (fromIdx === -1 || toIdx === -1) return null;

  const callsign = line.slice(fromIdx + 5, toIdx).trim();

  let target = line.slice(toIdx + 4).trim();
  const comma = target.indexOf(",");
  if (comma !== -1) target = target.slice(0, comma).trim();

  return { callsign, target };
}

function parseEndMetrics(line: string): { durationSeconds: number; lossPercent: number; berPercent: number; rssiDbm?: number } {
  const tokens = line.split(", ");
  let durationToken = tokens[2] ?? "";
  let lossToken = tokens[3] ?? "";
  let berPercent = 0;
  let rssiDbm: number | undefined;

  if (line.includes("RF user has timed out") || line.includes("watchdog has expired") || line.includes("invalid slow data header")) {
    // Timeouts don't carry a real duration in the original UI either
    // (rendered as "TOut"); treat as zero rather than inventing a number.
    durationToken = durationToken.includes("seconds") ? durationToken : "0";
  }

  const durationSeconds = Number.parseFloat(durationToken) || 0;

  if (lossToken.startsWith("RSSI")) {
    // RF-only line with no BER reported — RSSI ends up where loss would be.
    rssiDbm = parseRssi(lossToken);
    return { durationSeconds, lossPercent: 0, berPercent: 0, rssiDbm };
  }

  if (lossToken.startsWith("BER")) {
    // RF-only line with no packet-loss figure — BER ends up where loss would be.
    berPercent = Number.parseFloat(lossToken.slice(5)) || 0;
    const rssiToken = tokens[4];
    if (rssiToken?.startsWith("RSSI")) rssiDbm = parseRssi(rssiToken);
    return { durationSeconds, lossPercent: 0, berPercent, rssiDbm };
  }

  const lossPercent = Number.parseFloat(lossToken) || 0;
  const berToken = tokens[4];
  if (berToken?.startsWith("BER")) berPercent = Number.parseFloat(berToken.slice(5)) || 0;
  const rssiToken = tokens[5];
  if (rssiToken?.startsWith("RSSI")) rssiDbm = parseRssi(rssiToken);

  return { durationSeconds, lossPercent, berPercent, rssiDbm };
}

function parseRssi(token: string): number | undefined {
  // "RSSI: -73/-71/-72 dBm" -> average (last) figure, e.g. -72
  const match = token.match(/(-?\d+)\/(-?\d+)\/(-?\d+)/);
  if (!match) return undefined;
  return Number.parseInt(match[3]!, 10);
}

export class MmdvmLogParser {
  private pending = new Map<Channel, PendingCall>();

  /** Feed one raw log line; returns a finished entry if this line completed a call. */
  feedLine(line: string): ActivityEntry | null {
    if (!line.startsWith("M:") && !line.startsWith("E:")) return null;
    if (NOISE_PATTERNS.some((p) => line.includes(p))) return null;

    const channelRaw = extractMode(line);
    const channel = channelRaw as Channel;
    if (!(channel in CHANNEL_TO_MODE)) return null;

    const isEnd = END_MARKERS.some((marker) => line.includes(marker));
    const source: "RF" | "Net" = line.includes("network") || line.includes("POCSAG") ? "Net" : "RF";

    if (!isEnd) {
      const parsed = extractCallsignAndTarget(line);
      if (!parsed) return null;
      this.pending.set(channel, {
        timestamp: extractTimestamp(line),
        callsign: parsed.callsign,
        target: parsed.target,
        source,
      });
      return null;
    }

    // End-of-transmission line.
    const pendingCall = this.pending.get(channel);
    this.pending.delete(channel);
    if (!pendingCall) return null; // no matching header seen — drop rather than guess

    const metrics = parseEndMetrics(line);
    const mode = CHANNEL_TO_MODE[channel];

    const entry: ActivityEntry = {
      id: randomUUID(),
      timestamp: pendingCall.timestamp,
      mode,
      callsign: pendingCall.callsign || "UNKNOWN",
      target: pendingCall.target || "",
      src: pendingCall.source,
      durationSeconds: metrics.durationSeconds,
      lossPercent: metrics.lossPercent,
      berPercent: metrics.berPercent,
      rssiDbm: metrics.rssiDbm,
    };
    return entry;
  }
}
