import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";

export const sshRouter = Router();
sshRouter.use(requireAuth);

sshRouter.get("/", (_req, res) => {
  res.json(store.sshAccess);
});

const setSchema = z.object({ enabled: z.boolean() });

sshRouter.put("/", (req, res) => {
  const parsed = setSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "enabled must be a boolean" });
    return;
  }
  store.sshAccess = { enabled: parsed.data.enabled };
  res.json(store.sshAccess);
});
