import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";
import { getWifiConnectionStatus, scanWifiNetworks } from "../pistar/wifiScan.js";
import { connectToWifi, disconnectWifi } from "../pistar/wifiConnect.js";

export const wifiRouter = Router();
wifiRouter.use(requireAuth);

// Real scan when the sudo grant + wlan0 are available (takes ~3s — wpa_cli's
// scan is asynchronous, so this waits for results the same way the original
// PHP dashboard's own scan flow does). Falls back to the mock list otherwise.
wifiRouter.get("/", async (_req, res) => {
  const real = await scanWifiNetworks();
  res.json(real ?? store.wifiNetworks);
});

// Fast path for places (the dashboard widget) that just need "connected to
// X or not" — no 3s scan, just `wpa_cli status`.
wifiRouter.get("/status", async (_req, res) => {
  const real = await getWifiConnectionStatus();
  if (real) {
    res.json(real);
    return;
  }
  const connected = store.wifiNetworks.find((n) => n.connected);
  res.json({ connected: Boolean(connected), ssid: connected?.ssid ?? null });
});

const connectSchema = z.object({ ssid: z.string().min(1), password: z.string().optional() });

// Real connect/disconnect when reachable; falls back to mock ONLY when
// wpa_cli itself is unreachable (reason: "no-capability") — any other
// failure (wrong password, timeout) is shown to the user as-is rather
// than papered over with a fake mock "success".
wifiRouter.post("/connect", async (req, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ssid is required" });
    return;
  }

  const result = await connectToWifi(parsed.data.ssid, parsed.data.password);
  if (result.reason === "no-capability") {
    const network = store.wifiNetworks.find((n) => n.ssid === parsed.data.ssid);
    if (!network) {
      res.status(404).json({ error: "unknown network" });
      return;
    }
    store.wifiNetworks = store.wifiNetworks.map((n) => ({ ...n, connected: n.ssid === network.ssid }));
    res.json({ real: false, success: true, message: "Connected (mock — no real device detected).", networks: store.wifiNetworks });
    return;
  }

  res.json({ real: true, success: result.success, message: result.message });
});

wifiRouter.post("/disconnect", async (_req, res) => {
  const result = await disconnectWifi();
  if (result.reason === "no-capability") {
    store.wifiNetworks = store.wifiNetworks.map((n) => ({ ...n, connected: false }));
    res.json({ real: false, success: true, message: "Disconnected (mock).", networks: store.wifiNetworks });
    return;
  }

  res.json({ real: true, success: result.success, message: result.message });
});
