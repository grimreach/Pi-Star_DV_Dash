import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";
import { readSshEnabled } from "../pistar/sshStatus.js";

export const sshRouter = Router();
sshRouter.use(requireAuth);

sshRouter.get("/", (_req, res) => {
  const real = readSshEnabled();
  res.json(real === null ? store.sshAccess : { enabled: real });
});

const setSchema = z.object({ enabled: z.boolean() });

// Toggling is still mock — actually changing sshd's enabled state needs a
// new sudo grant (`systemctl enable/disable ssh`), same pattern as the
// config writer. Read status above is already real and unaffected by this.
sshRouter.put("/", (req, res) => {
  const parsed = setSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "enabled must be a boolean" });
    return;
  }
  store.sshAccess = { enabled: parsed.data.enabled };
  res.json(store.sshAccess);
});
