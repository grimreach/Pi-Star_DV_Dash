import { Router } from "express";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";

export const logsRouter = Router();
logsRouter.use(requireAuth);

logsRouter.get("/", (_req, res) => {
  res.json(store.logBuffer);
});
