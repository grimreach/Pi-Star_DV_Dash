import { readFileSync } from "node:fs";
import type { TimeServerConfig } from "@pistar/shared";
import { parseFlatKv } from "./ini.js";

/**
 * Reads Pi-Star's /etc/timeserver — flat key=value, no [Section] headers.
 * Real sample from a live device:
 *
 *   callsign=W3EZE
 *   sendA=0
 *   sendB=1
 *   sendC=0
 *   sendD=0
 *   sendE=0
 *   address=127.0.0.1
 *   language=0
 *   format=1
 *   interval=2
 *   windowX=0
 *   windowY=0
 *
 * This is D-Star's periodic time-beacon feature, not NTP — sendA-sendE
 * are per-module broadcast flags (which D-Star module(s) announce the
 * time), matching the "TIME" suffix seen in the activity feed
 * (mmdvmLog.ts). `enabled` here means "broadcasting on at least one
 * module", derived rather than a single flag in the file.
 */
export function readTimeServerConfig(path: string): TimeServerConfig | null {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }

  const kv = parseFlatKv(text);
  const moduleFlags: [string, string][] = [
    ["A", "sendA"],
    ["B", "sendB"],
    ["C", "sendC"],
    ["D", "sendD"],
    ["E", "sendE"],
  ];
  const modules = moduleFlags.filter(([, key]) => kv[key] === "1").map(([letter]) => letter);

  return {
    enabled: modules.length > 0,
    callsign: (kv.callsign ?? "").toUpperCase(),
    modules,
    intervalHours: Number(kv.interval) || 0,
  };
}
