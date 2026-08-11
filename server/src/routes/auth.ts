import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { changePassword, isDefaultPassword, verifyLogin } from "../auth.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", loginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }
  const { username, password } = parsed.data;
  if (!verifyLogin(username, password)) {
    res.status(401).json({ error: "invalid credentials" });
    return;
  }
  req.session.user = { username };
  res.json({ user: { username }, defaultPassword: isDefaultPassword() });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => res.status(204).end());
});

authRouter.get("/session", (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ error: "not authenticated" });
    return;
  }
  res.json({ user: req.session.user, defaultPassword: isDefaultPassword() });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.post("/password", (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ error: "authentication required" });
    return;
  }
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "newPassword must be at least 8 characters" });
    return;
  }
  const ok = changePassword(parsed.data.currentPassword, parsed.data.newPassword);
  if (!ok) {
    res.status(401).json({ error: "current password is incorrect" });
    return;
  }
  res.status(204).end();
});
