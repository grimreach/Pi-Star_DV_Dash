import { Router } from "express";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";
import { wsHub } from "../ws.js";

export const firmwareRouter = Router();
firmwareRouter.use(requireAuth);

firmwareRouter.get("/", (_req, res) => {
  res.json(store.firmware);
});

firmwareRouter.post("/upgrade", (_req, res) => {
  if (store.firmware.inProgress) {
    res.status(409).json({ error: "an upgrade is already in progress" });
    return;
  }
  store.firmware = { ...store.firmware, inProgress: true, progressPercent: 0, logLines: ["Starting firmware upgrade (simulated)..."] };
  res.status(202).json(store.firmware);

  const steps = [
    "Downloading firmware image...",
    "Verifying checksum...",
    "Erasing flash...",
    "Writing firmware...",
    "Verifying write...",
    "Restarting modem...",
  ];
  let step = 0;
  const tick = setInterval(() => {
    step += 1;
    const progressPercent = Math.min(100, Math.round((step / steps.length) * 100));
    const logLines = [...store.firmware.logLines, steps[step - 1] ?? "Done."];
    const inProgress = step < steps.length;
    store.firmware = {
      ...store.firmware,
      inProgress,
      progressPercent,
      logLines,
      currentVersion: inProgress ? store.firmware.currentVersion : store.firmware.latestVersion,
    };
    wsHub.broadcast({ type: "firmware:update", payload: store.firmware });
    if (!inProgress) clearInterval(tick);
  }, 1200);
});
