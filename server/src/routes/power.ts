import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";

/**
 * Real Pi-Star shells out to `sudo shutdown -r now` / `sudo shutdown -h now`
 * (see admin/power.php). We never want an LLM-authored demo issuing real
 * power commands, so this endpoint only records the intent and reports
 * back — wire it to a real system call only when deploying to an actual
 * Pi-Star device you control.
 */
export const powerRouter = Router();
powerRouter.use(requireAuth);

const actionSchema = z.object({ action: z.enum(["reboot", "shutdown"]) });

powerRouter.post("/", (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "action must be 'reboot' or 'shutdown'" });
    return;
  }
  res.json({
    accepted: true,
    action: parsed.data.action,
    message: `Simulated ${parsed.data.action} requested. No real system command was issued.`,
  });
});
