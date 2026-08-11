import { existsSync } from "node:fs";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { fireReboot, fireShutdown, prepareForPowerOff } from "../pistar/power.js";

export const powerRouter = Router();
powerRouter.use(requireAuth);

const actionSchema = z.object({ action: z.enum(["reboot", "shutdown"]) });
const MMDVMHOST_CONFIG_PATH = process.env.MMDVMHOST_CONFIG_PATH ?? "/etc/mmdvmhost";

powerRouter.post("/", async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "action must be 'reboot' or 'shutdown'" });
    return;
  }

  if (!existsSync(MMDVMHOST_CONFIG_PATH)) {
    res.json({
      accepted: true,
      action: parsed.data.action,
      message: `Simulated ${parsed.data.action} requested. No real system command was issued.`,
    });
    return;
  }

  try {
    await prepareForPowerOff();
  } catch (err) {
    res.status(500).json({
      accepted: false,
      error: `Failed to sync/remount before power action: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  res.json({
    accepted: true,
    action: parsed.data.action,
    message:
      parsed.data.action === "reboot"
        ? "Reboot initiated — the device should be back in about 90 seconds."
        : "Shutdown initiated — wait ~30 seconds before removing power.",
  });

  // Give the response time to flush over the socket before the OS
  // actually goes down — this process won't survive to do it after.
  setTimeout(() => {
    if (parsed.data.action === "reboot") fireReboot();
    else fireShutdown();
  }, 300);
});
