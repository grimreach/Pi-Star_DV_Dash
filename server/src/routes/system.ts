import { Router } from "express";
import { requireAuth } from "../auth.js";
import { store } from "../store.js";

export const systemRouter = Router();
systemRouter.use(requireAuth);

systemRouter.get("/", (_req, res) => {
  res.json(store.systemInfo());
});
