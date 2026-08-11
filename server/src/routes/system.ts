import { existsSync } from "node:fs";
import { Router } from "express";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";
import { restartMmdvmHost } from "../pistar/configWriter.js";

export const systemRouter = Router();
systemRouter.use(requireAuth);

systemRouter.get("/", (_req, res) => {
  res.json(store.systemInfo());
});

const MMDVMHOST_CONFIG_PATH = process.env.MMDVMHOST_CONFIG_PATH ?? "/etc/mmdvmhost";

// Deliberately a separate, explicit action from Configuration saves —
// restarting MMDVMHost interrupts any in-progress transmission, so it
// should never happen silently as a side effect of PATCHing config.
systemRouter.post("/mmdvmhost/restart", async (_req, res) => {
  if (!existsSync(MMDVMHOST_CONFIG_PATH)) {
    res.json({ restarted: false, message: "No real MMDVMHost on this system (mock/dev mode) — nothing to restart." });
    return;
  }
  try {
    await restartMmdvmHost();
    res.json({ restarted: true });
  } catch (err) {
    res.status(500).json({ restarted: false, error: err instanceof Error ? err.message : String(err) });
  }
});
