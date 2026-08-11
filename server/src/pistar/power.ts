import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Reboot/shutdown, matching the original admin/power.php's exact
 * sequence: sync the disk 3x and remount read-only (protects the SD
 * card from corruption), then the actual power command. Requires sudo
 * grants for /bin/sync, /sbin/reboot, /sbin/shutdown -h now (mount
 * remount,ro is already granted for the config writer).
 *
 * Unlike the original's fire-everything-in-parallel-and-hope pattern
 * (sync+remount backgrounded as one shell chain, reboot backgrounded
 * separately, with no ordering guarantee between them), this properly
 * awaits sync/remount before triggering the actual power command.
 */

async function run(cmd: string, args: string[] = []): Promise<void> {
  await execFileAsync("sudo", [cmd, ...args]);
}

export async function prepareForPowerOff(): Promise<void> {
  await run("/bin/sync");
  await run("/bin/sync");
  await run("/bin/sync");
  await run("/usr/bin/mount", ["-o", "remount,ro", "/"]);
}

// Deliberately not awaited by callers — the process may not survive
// long enough to observe the result, especially for shutdown.
export function fireReboot(): void {
  execFile("sudo", ["/sbin/reboot"], () => {});
}

export function fireShutdown(): void {
  execFile("sudo", ["/sbin/shutdown", "-h", "now"], () => {});
}
