import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";
import { scanWifiNetworks } from "../pistar/wifiScan.js";

export const wifiRouter = Router();
wifiRouter.use(requireAuth);

// Real scan when the sudo grant + wlan0 are available (takes ~3s — wpa_cli's
// scan is asynchronous, so this waits for results the same way the original
// PHP dashboard's own scan flow does). Falls back to the mock list otherwise.
// Connect/disconnect below stay mock deliberately — see wifiScan.ts.
wifiRouter.get("/", async (_req, res) => {
  const real = await scanWifiNetworks();
  res.json(real ?? store.wifiNetworks);
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
