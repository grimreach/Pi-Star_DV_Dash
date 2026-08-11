import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";

export const calibrationRouter = Router();
calibrationRouter.use(requireAuth);

calibrationRouter.get("/", (_req, res) => {
  res.json(store.calibration);
});

const setSchema = z.object({ mode: z.enum(["off", "rx", "tx", "duplex"]) });

calibrationRouter.put("/", (req, res) => {
  const parsed = setSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "mode must be one of off|rx|tx|duplex" });
    return;
  }
  const rssiDbm = parsed.data.mode === "off" ? undefined : -70 - Math.round(Math.random() * 20);
  store.calibration = { mode: parsed.data.mode, rssiDbm };
  res.json(store.calibration);
});
