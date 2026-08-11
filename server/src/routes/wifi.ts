import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";

export const wifiRouter = Router();
wifiRouter.use(requireAuth);

wifiRouter.get("/", (_req, res) => {
  res.json(store.wifiNetworks);
});

const connectSchema = z.object({ ssid: z.string().min(1), password: z.string().optional() });

wifiRouter.post("/connect", (req, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ssid is required" });
    return;
  }
  const network = store.wifiNetworks.find((n) => n.ssid === parsed.data.ssid);
  if (!network) {
    res.status(404).json({ error: "unknown network" });
    return;
  }
  store.wifiNetworks = store.wifiNetworks.map((n) => ({ ...n, connected: n.ssid === network.ssid }));
  res.json(store.wifiNetworks);
});

wifiRouter.post("/disconnect", (_req, res) => {
  store.wifiNetworks = store.wifiNetworks.map((n) => ({ ...n, connected: false }));
  res.json(store.wifiNetworks);
});
