import { Router } from "express";
import { store } from "../store.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", (_req, res) => {
  res.json(store.dashboardState());
});

// Public, matching the rest of the dashboard's read-only activity data —
// no auth needed to see aggregate contact counts.
dashboardRouter.get("/activity-stats", (_req, res) => {
  res.json(store.activityStats());
});
