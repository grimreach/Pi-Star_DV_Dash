import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";
import {
  addStaticTalkgroup,
  BmApiError,
  dropCurrentQso,
  dropDynamicTalkgroups,
  dropStaticTalkgroup,
  getProfile,
} from "../pistar/bmApi.js";

/**
 * BrandMeister Manager — the WPSD "BM Manager" / Pi-Star "BrandMeister
 * Manager" feature: static talkgroup add/drop plus dropping dynamic TGs
 * or the current QSO per timeslot, via BrandMeister's own API.
 *
 * Everything mutating is POST: the stock Pi-Star nginx security include
 * closes the connection on any method other than GET/HEAD/POST.
 */
export const bmRouter = Router();
bmRouter.use(requireAuth);

function deviceId(): string {
  const d = store.config.dmrGateway;
  return `${d.id.trim().slice(0, 7)}${d.essid.trim()}`;
}

function context() {
  const d = store.config.dmrGateway;
  return {
    deviceId: deviceId(),
    hasKey: d.bmApiKey.trim().length > 0,
    isBrandMeister: /brandmeister/i.test(d.master),
    master: d.master,
    slots: { ts1: d.ts1Enabled, ts2: d.ts2Enabled },
  };
}

function fail(res: import("express").Response, err: unknown) {
  if (err instanceof BmApiError) {
    res.status(err.status === 401 || err.status === 403 ? 400 : 502).json({ error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  res.status(502).json({ error: /abort|timeout/i.test(message) ? "BrandMeister API timed out" : message });
}

bmRouter.get("/status", async (_req, res) => {
  const ctx = context();
  if (!/^\d{7,9}$/.test(ctx.deviceId)) {
    res.json({ ...ctx, profile: null, error: "DMR ID is not configured" });
    return;
  }
  try {
    const profile = await getProfile(ctx.deviceId);
    res.json({ ...ctx, profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.json({ ...ctx, profile: null, error: message });
  }
});

const staticSchema = z.object({ talkgroup: z.number().int().positive().max(16777215), slot: z.number().int().min(1).max(2) });
const slotSchema = z.object({ slot: z.number().int().min(1).max(2) });

function requireKey(res: import("express").Response): string | null {
  const key = store.config.dmrGateway.bmApiKey.trim();
  if (!key) {
    res.status(400).json({ error: "No BrandMeister API key configured — add one under Configuration → DMR Gateway." });
    return null;
  }
  return key;
}

bmRouter.post("/static/add", async (req, res) => {
  const parsed = staticSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "talkgroup (number) and slot (1 or 2) are required" });
    return;
  }
  const key = requireKey(res);
  if (!key) return;
  try {
    await addStaticTalkgroup(deviceId(), key, parsed.data.talkgroup, parsed.data.slot);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

bmRouter.post("/static/drop", async (req, res) => {
  const parsed = staticSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "talkgroup (number) and slot (1 or 2) are required" });
    return;
  }
  const key = requireKey(res);
  if (!key) return;
  try {
    await dropStaticTalkgroup(deviceId(), key, parsed.data.talkgroup, parsed.data.slot);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

bmRouter.post("/dynamic/drop", async (req, res) => {
  const parsed = slotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "slot (1 or 2) is required" });
    return;
  }
  const key = requireKey(res);
  if (!key) return;
  try {
    await dropDynamicTalkgroups(deviceId(), key, parsed.data.slot);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

bmRouter.post("/qso/drop", async (req, res) => {
  const parsed = slotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "slot (1 or 2) is required" });
    return;
  }
  const key = requireKey(res);
  if (!key) return;
  try {
    await dropCurrentQso(deviceId(), key, parsed.data.slot);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});
