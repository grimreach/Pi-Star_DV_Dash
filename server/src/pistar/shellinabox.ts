import { readFileSync } from "node:fs";

/**
 * Reads the real ShellInABox port from /etc/default/shellinabox — a
 * world-readable file (644 root:root), no sudo needed. Matches what the
 * original admin/expert/ssh_access.php reads to build its terminal
 * iframe. Real sample line: `SHELLINABOX_PORT=2222`.
 *
 * Returns null if the file is missing or has no active port line (e.g.
 * shellinabox isn't installed, or SHELLINABOX_DAEMON_START=0).
 */
export function readShellInABoxPort(path = "/etc/default/shellinabox"): number | null {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("#")) continue;
    const match = line.match(/^SHELLINABOX_PORT=(\d+)/);
    if (match) return Number.parseInt(match[1]!, 10);
  }
  return null;
}
