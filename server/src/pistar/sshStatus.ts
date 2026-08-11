import { execFileSync } from "node:child_process";

/**
 * Real (read-only, no sudo needed) check of whether sshd is enabled to
 * start on boot — `systemctl is-enabled <unit>` works for any user, only
 * *changing* enablement needs root. Tries both common service names since
 * Debian/Raspbian ships `ssh.service` while some other distros use
 * `sshd.service`.
 *
 * Returns null (falls back to mock) if neither unit exists — e.g. local
 * dev off-device, or systemd isn't present at all.
 */
export function readSshEnabled(): boolean | null {
  for (const unit of ["ssh.service", "sshd.service"]) {
    const state = queryIsEnabled(unit);
    if (state === "enabled") return true;
    if (state === "disabled" || state === "masked") return false;
  }
  return null;
}

function queryIsEnabled(unit: string): string | null {
  try {
    return execFileSync("systemctl", ["is-enabled", unit], { encoding: "utf8" }).trim();
  } catch (err) {
    // systemctl exits non-zero for "disabled"/"masked" too, not just
    // "unit not found" — the actual state string is still on stdout.
    const stdout = (err as { stdout?: Buffer | string })?.stdout?.toString().trim();
    return stdout || null;
  }
}
