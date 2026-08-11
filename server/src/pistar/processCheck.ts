import { execSync } from "node:child_process";

/**
 * Ported from the original PHP dashboard's isProcessRunning() (mmdvmhost/
 * tools.php): `ps -eo comm` and a substring match against each command
 * name. Used to tell "configured" apart from "actually running" for each
 * gateway daemon.
 */
export function isProcessRunning(name: string): boolean {
  try {
    const output = execSync("ps -eo comm", { encoding: "utf8" });
    return output.split("\n").some((line) => line.includes(name));
  } catch {
    return false;
  }
}
