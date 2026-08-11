import { existsSync } from "node:fs";
import { Router } from "express";
import type { ConfigSection } from "@pistar/shared";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";
import { wsHub } from "../ws.js";
import { writeMmdvmHostConfig } from "../pistar/configWriter.js";
import { buildMmdvmHostEdits } from "../pistar/mmdvmConfigWrite.js";

const MMDVMHOST_CONFIG_PATH = process.env.MMDVMHOST_CONFIG_PATH ?? "/etc/mmdvmhost";

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

configRouter.patch("/:section", async (req, res) => {
  const section = req.params.section as ConfigSection;
  if (!SECTIONS.includes(section)) {
    res.status(404).json({ error: `unknown config section '${section}'` });
    return;
  }
  if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
    res.status(400).json({ error: "request body must be an object" });
    return;
  }
  store.config = {
    ...store.config,
    [section]: { ...store.config[section], ...req.body },
  };
  syncDerivedState(section);
  wsHub.broadcast({ type: "dashboard:update", payload: store.dashboardState() });

  // Persist to the real /etc/mmdvmhost when present. Requires the
  // sudoers rule documented in README — if it's missing, this fails
  // loudly rather than silently pretending the save reached the device.
  let real: { written: boolean; skipped?: string[]; error?: string } = { written: false };
  if (existsSync(MMDVMHOST_CONFIG_PATH)) {
    const edits = buildMmdvmHostEdits(section, store.config);
    if (edits.length > 0) {
      try {
        const result = await writeMmdvmHostConfig(MMDVMHOST_CONFIG_PATH, edits);
        real = { written: true, skipped: result.skipped.map((e) => `${e.section}.${e.key}`) };
      } catch (err) {
        real = { written: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  }

  res.json({ config: store.config[section], real });
});
