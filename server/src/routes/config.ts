import { existsSync } from "node:fs";
import { Router } from "express";
import type { Request, Response } from "express";
import type { ConfigSection } from "@pistar/shared";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";
import { wsHub } from "../ws.js";
import { BMAPI_KEY_PATH, renderBmApiKeyFile } from "../pistar/bmApiKey.js";
import { installConfigFile, writeIniConfig } from "../pistar/configWriter.js";
import { readDmrHosts, sortDmrHosts } from "../pistar/dmrHosts.js";
import { buildDmrGatewayFileEdits, buildMmdvmHostEdits } from "../pistar/mmdvmConfigWrite.js";

const MMDVMHOST_CONFIG_PATH = process.env.MMDVMHOST_CONFIG_PATH ?? "/etc/mmdvmhost";
const DMRGATEWAY_CONFIG_PATH = process.env.DMRGATEWAY_CONFIG_PATH ?? "/etc/dmrgateway";
const DMR_HOSTS_PATH = process.env.DMR_HOSTS_PATH ?? "/usr/local/etc/DMR_Hosts.txt";

export const configRouter = Router();
configRouter.use(requireAuth);

const SECTIONS: ConfigSection[] = [
  "general",
  "mmdvmHost",
  "dmrGateway",
  "dstarRepeater",
  "ysfGateway",
  "p25Gateway",
  "nxdnGateway",
  "m17Gateway",
  "dapnetGateway",
  "timeServer",
];

configRouter.get("/", (_req, res) => {
  res.json(store.config);
});

// Master list for the DMR tab's dropdown — the same DMR_Hosts.txt
// Pi-Star/WPSD build theirs from, with a built-in fallback off-device.
configRouter.get("/dmr-masters", (_req, res) => {
  const { hosts, source } = readDmrHosts(DMR_HOSTS_PATH);
  res.json({ hosts: sortDmrHosts(hosts), source });
});

configRouter.get("/:section", (req, res) => {
  const section = req.params.section as ConfigSection;
  if (!SECTIONS.includes(section)) {
    res.status(404).json({ error: `unknown config section '${section}'` });
    return;
  }
  res.json(store.config[section]);
});

// Applying a saved section back onto live dashboard state mimics what
// Pi-Star does by restarting MMDVMHost/the gateways after a config
// write — here it's just re-deriving the in-memory fields the
// dashboard reads.
function syncDerivedState(section: ConfigSection) {
  if (section === "general") {
    store.callsign = store.config.general.callsign;
  }
  if (section === "dmrGateway") {
    const cfg = store.config.dmrGateway;
    store.dmr = {
      ...store.dmr,
      dmrId: cfg.id,
      colorCode: cfg.colorCode,
      ts1: { enabled: cfg.ts1Enabled, talkgroup: store.dmr.ts1.talkgroup },
      ts2: { enabled: cfg.ts2Enabled, talkgroup: store.dmr.ts2.talkgroup },
      master: cfg.master,
    };
    store.enabledModes = cfg.enabled
      ? Array.from(new Set([...store.enabledModes, "dmr" as const]))
      : store.enabledModes.filter((m) => m !== "dmr");
  }
  if (section === "dstarRepeater") {
    const cfg = store.config.dstarRepeater;
    store.dstar = { ...store.dstar, rpt1: cfg.rpt1, rpt2: cfg.rpt2, aprsServer: cfg.aprsHost };
    store.enabledModes = cfg.enabled
      ? Array.from(new Set([...store.enabledModes, "dstar" as const]))
      : store.enabledModes.filter((m) => m !== "dstar");
  }
  if (section === "mmdvmHost") {
    const cfg = store.config.mmdvmHost;
    store.radio = { ...store.radio, txFrequencyHz: cfg.txFrequencyHz, rxFrequencyHz: cfg.rxFrequencyHz };
  }
  for (const [mode, key] of [
    ["ysf", "ysfGateway"],
    ["p25", "p25Gateway"],
    ["nxdn", "nxdnGateway"],
    ["m17", "m17Gateway"],
  ] as const) {
    if (section === key) {
      const enabled = (store.config[key] as { enabled: boolean }).enabled;
      store.enabledModes = enabled
        ? Array.from(new Set([...store.enabledModes, mode]))
        : store.enabledModes.filter((m) => m !== mode);
    }
  }
}

// POST rather than PATCH: the stock Pi-Star nginx site config includes
// /etc/nginx/default.d/security.conf, which closes the connection
// (`return 444`) on any method other than GET/HEAD/POST. A PATCH from the
// browser never reaches this process — the client just sees a dropped
// connection and shows "Save failed". PATCH is kept as an alias for direct
// :8080 access (side-by-side testing, curl) where nginx isn't in the path.
async function updateSection(req: Request, res: Response) {
  const section = req.params.section as ConfigSection;
  if (!SECTIONS.includes(section)) {
    res.status(404).json({ error: `unknown config section '${section}'` });
    return;
  }
  if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
    res.status(400).json({ error: "request body must be an object" });
    return;
  }
  const previous = store.config[section];
  store.config = {
    ...store.config,
    [section]: { ...store.config[section], ...req.body },
  };
  syncDerivedState(section);
  wsHub.broadcast({ type: "dashboard:update", payload: store.dashboardState() });

  // Persist to the real /etc/mmdvmhost when present. Requires the
  // sudoers rule documented in README — if it's missing, this fails
  // loudly rather than silently pretending the save reached the device.
  let real: { written: boolean; skipped?: string[]; error?: string; files?: string[] } = { written: false };
  if (existsSync(MMDVMHOST_CONFIG_PATH)) {
    const files: string[] = [];
    const skipped: string[] = [];
    try {
      const edits = buildMmdvmHostEdits(section, store.config);
      if (edits.length > 0) {
        const result = await writeIniConfig(MMDVMHOST_CONFIG_PATH, edits);
        files.push(MMDVMHOST_CONFIG_PATH);
        skipped.push(...result.skipped.map((e) => `${e.section}.${e.key}`));
      }
      if (section === "dmrGateway") {
        // Gateway mode: the BrandMeister block lives in DMRGateway's file.
        const gwEdits = buildDmrGatewayFileEdits(store.config);
        if (gwEdits.length > 0 && existsSync(DMRGATEWAY_CONFIG_PATH)) {
          const result = await writeIniConfig(DMRGATEWAY_CONFIG_PATH, gwEdits);
          files.push(DMRGATEWAY_CONFIG_PATH);
          skipped.push(...result.skipped.map((e) => `dmrgateway ${e.section}.${e.key}`));
        }
        // The API key is its own tiny file; only rewrite it when it changed.
        const prevKey = (previous as { bmApiKey?: string }).bmApiKey ?? "";
        if (store.config.dmrGateway.bmApiKey.trim() !== prevKey.trim()) {
          await installConfigFile(BMAPI_KEY_PATH, renderBmApiKeyFile(store.config.dmrGateway.bmApiKey));
          files.push(BMAPI_KEY_PATH);
        }
      }
      real = { written: files.length > 0, skipped, files };
    } catch (err) {
      real = { written: false, error: err instanceof Error ? err.message : String(err), files };
    }
  }

  res.json({ config: store.config[section], real });
}

configRouter.post("/:section", updateSection);
configRouter.patch("/:section", updateSection);
