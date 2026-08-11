import { Router } from "express";
import type { LinkProtocol } from "@pistar/shared";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";
import { wsHub } from "../ws.js";

export const linksRouter = Router();
linksRouter.use(requireAuth);

const PROTOCOLS: LinkProtocol[] = ["dstar", "dmr", "ysf", "p25", "nxdn", "m17"];

function assertProtocol(value: string): value is LinkProtocol {
  return (PROTOCOLS as string[]).includes(value);
}

linksRouter.get("/", (_req, res) => {
  res.json(Object.values(store.links));
});

linksRouter.post("/:protocol/link", (req, res) => {
  const { protocol } = req.params;
  if (!assertProtocol(protocol)) {
    res.status(404).json({ error: `unknown protocol '${protocol}'` });
    return;
  }
  const targetId = typeof req.body?.targetId === "string" ? req.body.targetId : undefined;
  const link = store.links[protocol];
  const target = link.available.find((t) => t.id === targetId);
  if (!target) {
    res.status(400).json({ error: "targetId is required and must be a known target" });
    return;
  }
  store.links[protocol] = { ...link, linked: true, current: target };
  if (protocol === "dstar") store.dstar = { ...store.dstar, currentLink: `${target.name}` };
  if (protocol === "dmr") store.dmr = { ...store.dmr, ts2: { ...store.dmr.ts2, talkgroup: target.name } };
  wsHub.broadcast({ type: "dashboard:update", payload: store.dashboardState() });
  res.json(store.links[protocol]);
});

linksRouter.post("/:protocol/unlink", (req, res) => {
  const { protocol } = req.params;
  if (!assertProtocol(protocol)) {
    res.status(404).json({ error: `unknown protocol '${protocol}'` });
    return;
  }
  const link = store.links[protocol];
  store.links[protocol] = { ...link, linked: false, current: undefined };
  if (protocol === "dstar") store.dstar = { ...store.dstar, currentLink: "Not linked" };
  wsHub.broadcast({ type: "dashboard:update", payload: store.dashboardState() });
  res.json(store.links[protocol]);
});
