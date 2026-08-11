import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { calibrationEngine } from "../pistar/calibration.js";

export const calibrationRouter = Router();
calibrationRouter.use(requireAuth);

calibrationRouter.get("/", (_req, res) => {
  res.json(calibrationEngine.getState());
});

calibrationRouter.post("/start", async (_req, res) => {
  const result = await calibrationEngine.start();
  res.json(result);
});

calibrationRouter.post("/stop", (_req, res) => {
  calibrationEngine.stopTest();
  res.json({ ok: true });
});

const modeSchema = z.object({ mode: z.enum(["dstar", "dmr", "ysf", "p25", "nxdn"]) });
calibrationRouter.post("/mode", (req, res) => {
  const parsed = modeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid mode" });
    return;
  }
  calibrationEngine.selectMode(parsed.data.mode);
  res.json({ ok: true });
});

const freqSchema = z.object({ direction: z.enum(["up", "down"]) });
calibrationRouter.post("/frequency", (req, res) => {
  const parsed = freqSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid direction" });
    return;
  }
  calibrationEngine.adjustFrequency(parsed.data.direction);
  res.json({ ok: true });
});

const stepSchema = z.object({ step: z.union([z.literal(25), z.literal(50), z.literal(100)]) });
calibrationRouter.post("/step", (req, res) => {
  const parsed = stepSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid step" });
    return;
  }
  calibrationEngine.setStep(parsed.data.step);
  res.json({ ok: true });
});

calibrationRouter.post("/saveoffset", async (_req, res) => {
  const result = await calibrationEngine.saveOffset();
  res.json(result);
});
