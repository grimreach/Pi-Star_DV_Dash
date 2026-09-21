import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCredentialsFile, writeCredentialsFile } from "./pistar/credentialsFile.js";

/**
 * Minimal session-backed admin auth, standing in for Pi-Star's
 * htpasswd-based basic auth. Default credentials match stock Pi-Star
 * (admin / pi-star) purely so the demo is recognizable; change on
 * first login in a real deployment.
 *
 * A changed password is persisted to AUTH_STATE_PATH (default
 * <repo>/data/auth.json) so it survives service restarts and reboots —
 * see pistar/credentialsFile.ts for the read-only-root handling.
 */

const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync("pi-star", 10);

// Resolves to <repo>/data/auth.json from both server/src (tsx dev) and
// server/dist (production build).
const AUTH_STATE_PATH =
  process.env.AUTH_STATE_PATH ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/auth.json");

let credentials = { username: DEFAULT_USERNAME, passwordHash: DEFAULT_PASSWORD_HASH };

/** Call once at startup, before serving requests. Missing/corrupt file → defaults. */
export async function loadPersistedCredentials(): Promise<void> {
  try {
    const stored = await readCredentialsFile(AUTH_STATE_PATH);
    if (stored) {
      credentials = stored;
      console.log(`[auth] loaded admin credentials from ${AUTH_STATE_PATH}`);
    }
  } catch (err) {
    console.error(`[auth] could not read ${AUTH_STATE_PATH}, using default credentials:`, err);
  }
}

export function verifyLogin(username: string, password: string): boolean {
  return username === credentials.username && bcrypt.compareSync(password, credentials.passwordHash);
}

export type ChangePasswordResult = { ok: true } | { ok: false; reason: "wrong-password" | "persist-failed"; detail?: string };

/**
 * Persists first, then swaps the in-memory hash — if the write fails the
 * old password keeps working rather than the change silently evaporating
 * on the next restart.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  if (!bcrypt.compareSync(currentPassword, credentials.passwordHash)) return { ok: false, reason: "wrong-password" };
  const next = { username: credentials.username, passwordHash: bcrypt.hashSync(newPassword, 10) };
  try {
    await writeCredentialsFile(AUTH_STATE_PATH, next);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[auth] failed to persist new password to ${AUTH_STATE_PATH}:`, detail);
    return { ok: false, reason: "persist-failed", detail };
  }
  credentials = next;
  return { ok: true };
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
