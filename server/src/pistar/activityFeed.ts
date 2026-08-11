import { existsSync } from "node:fs";
import { store } from "../store.js";
import { wsHub } from "../ws.js";
import { FileTailer } from "./logTail.js";
import { MmdvmLogParser } from "./mmdvmLog.js";

/**
 * Wires the real MMDVM log into the dashboard: tails today's log file,
 * feeds every line into both the raw live-log broadcast (Admin > Live
 * Logs) and the MmdvmLogParser (activity feed — D-Star included, see
 * mmdvmLog.ts). Returns null if the log directory isn't present (e.g.
 * local dev off-device) so the caller can fall back to the simulator.
 */

const LOG_DIR = process.env.MMDVM_LOG_DIR ?? "/var/log/pi-star";
const LOG_PREFIX = process.env.MMDVM_LOG_PREFIX ?? "MMDVM";

function todayLogPath(): string {
  // UTC date, matching Pi-Star's own gmdate("Y-m-d") log naming.
  const date = new Date().toISOString().slice(0, 10);
  return `${LOG_DIR}/${LOG_PREFIX}-${date}.log`;
}

export function startRealActivityFeed(): (() => void) | null {
  if (!existsSync(LOG_DIR)) return null;

  const parser = new MmdvmLogParser();
  let tailer: FileTailer | null = null;
  let currentPath = "";

  function handleLine(line: string) {
    store.pushLog(line);
    wsHub.broadcast({ type: "log:line", payload: { timestamp: Date.now(), text: line } });

    const entry = parser.feedLine(line);
    if (!entry) return;

    const scope = entry.src === "RF" ? "localRf" : "gateway";
    store.pushActivity(scope, entry);
    wsHub.broadcast({ type: "activity:new", payload: { scope, entry } });
    wsHub.broadcast({ type: "dashboard:update", payload: store.dashboardState() });
  }

  function attach() {
    const path = todayLogPath();
    if (path === currentPath && tailer) return;
    if (!existsSync(path)) return;

    tailer?.stop();
    currentPath = path;
    tailer = new FileTailer(path, {
      onLine: handleLine,
      onError: (err) => console.error(`[activityFeed] tail error on ${path}:`, err),
    });
    tailer.start(true);
    console.log(`[activityFeed] tailing ${path}`);
  }

  attach();
  // Cheap check; run it often enough to notice a midnight log rollover
  // (or the file appearing shortly after boot) without much overhead.
  const rolloverInterval = setInterval(attach, 60_000);

  return () => {
    clearInterval(rolloverInterval);
    tailer?.stop();
  };
}
