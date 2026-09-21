import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * On-disk persistence for the dashboard admin credentials, so a changed
 * password survives `systemctl restart pistar-dashboard-node` and reboots.
 *
 * Stored as a small JSON file holding only the username and bcrypt hash —
 * never the plaintext password. Default location is <repo>/data/auth.json
 * (the service's WorkingDirectory, owned by the `pi-star` user, so no
 * sudo is needed for the write itself), overridable via AUTH_STATE_PATH.
 *
 * Pi-Star mounts / read-only. If the write fails with EROFS, remount rw,
 * retry, and remount ro again — both mount commands are already in the
 * sudoers grant used by the /etc/mmdvmhost writer, so no new rule is
 * needed. On a dev machine the first write simply succeeds.
 */

export interface StoredCredentials {
  username: string;
  passwordHash: string;
}

function isStoredCredentials(value: unknown): value is StoredCredentials {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as StoredCredentials).username === "string" &&
    (value as StoredCredentials).username.length > 0 &&
    typeof (value as StoredCredentials).passwordHash === "string" &&
    (value as StoredCredentials).passwordHash.startsWith("$2")
  );
}

/** Returns null when the file is missing or malformed (first run, or a corrupt file — fall back to defaults). */
export async function readCredentialsFile(filePath: string): Promise<StoredCredentials | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredCredentials(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeAtomically(filePath: string, content: string) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const tmp = `${filePath}.${process.pid}.tmp`;
  await writeFile(tmp, content, { mode: 0o600 });
  await rename(tmp, filePath);
}

export async function writeCredentialsFile(filePath: string, creds: StoredCredentials): Promise<void> {
  const content = JSON.stringify({ username: creds.username, passwordHash: creds.passwordHash }, null, 2) + "\n";
  try {
    await writeAtomically(filePath, content);
    return;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EROFS") throw err;
  }
  // Read-only root (real Pi-Star): remount rw around the write.
  await execFileAsync("sudo", ["/usr/bin/mount", "-o", "remount,rw", "/"]);
  try {
    await writeAtomically(filePath, content);
  } finally {
    await execFileAsync("sudo", ["/usr/bin/mount", "-o", "remount,ro", "/"]);
  }
}
