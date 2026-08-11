import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";

/**
 * Minimal session-backed admin auth, standing in for Pi-Star's
 * htpasswd-based basic auth. Default credentials match stock Pi-Star
 * (admin / pi-star) purely so the demo is recognizable; change on
 * first login in a real deployment.
 */

const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync("pi-star", 10);

let credentials = { username: DEFAULT_USERNAME, passwordHash: DEFAULT_PASSWORD_HASH };

export function verifyLogin(username: string, password: string): boolean {
  return username === credentials.username && bcrypt.compareSync(password, credentials.passwordHash);
}

export function changePassword(currentPassword: string, newPassword: string): boolean {
  if (!bcrypt.compareSync(currentPassword, credentials.passwordHash)) return false;
  credentials = { ...credentials, passwordHash: bcrypt.hashSync(newPassword, 10) };
  return true;
}

export function isDefaultPassword(): boolean {
  return bcrypt.compareSync("pi-star", credentials.passwordHash);
}

declare module "express-session" {
  interface SessionData {
    user?: { username: string };
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.user) {
    next();
    return;
  }
  res.status(401).json({ error: "authentication required" });
}
