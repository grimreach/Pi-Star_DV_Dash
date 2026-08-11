import { Router } from "express";
import { store } from "../store.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", (_req, res) => {
  res.json(store.dashboardState());
});
