import { existsSync } from "node:fs";
import { Router } from "express";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";
import { restartDmrGateway, restartMmdvmHost } from "../pistar/configWriter.js";
import { readShellInABoxPort } from "../pistar/shellinabox.js";

export const systemRouter = Router();
systemRouter.use(requireAuth);

systemRouter.get("/", (_req, res) => {
  res.json(store.systemInfo());
});

systemRouter.get("/shellinabox", (_req, res) => {
  res.json({ port: readShellInABoxPort() });
});

const MMDVMHOST_CONFIG_PATH = process.env.MMDVMHOST_CONFIG_PATH ?? "/etc/mmdvmhost";

// Deliberately a separate, explicit action from Configuration saves —
// restarting MMDVMHost interrupts any in-progress transmission, so it
// should never happen silently as a side effect of PATCHing config.
// Body may carry { dmrGateway: true } to bounce DMRGateway as well — needed
// after a DMR save in gateway mode, since the master/password/ESSID it
// logs in with come from /etc/dmrgateway, which only DMRGateway reads.
systemRouter.post("/mmdvmhost/restart", async (req, res) => {
  if (!existsSync(MMDVMHOST_CONFIG_PATH)) {
    res.json({ restarted: false, message: "No real MMDVMHost on this system (mock/dev mode) — nothing to restart." });
    return;
  }
  const alsoDmrGateway = req.body?.dmrGateway === true;
  try {
    if (alsoDmrGateway) await restartDmrGateway();
    await restartMmdvmHost();
    res.json({ restarted: true, services: alsoDmrGateway ? ["dmrgateway", "mmdvmhost"] : ["mmdvmhost"] });
  } catch (err) {
    res.status(500).json({ restarted: false, error: err instanceof Error ? err.message : String(err) });
  }
});
