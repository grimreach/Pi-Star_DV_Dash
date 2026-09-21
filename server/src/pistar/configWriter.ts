import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Section-aware, allow-listed writer for /etc/mmdvmhost — mirrors the
 * atomic-write pattern the original PHP dashboard's own config_writer.php
 * uses (stage a temp file, install it atomically as root via a narrowly
 * scoped sudoers rule), but is section-AWARE rather than a blind first-
 * match-of-`key=` replace.
 *
 * That distinction matters here specifically: /etc/mmdvmhost has ~20
 * sections and keys like "Enable" appear in nearly all of them. A naive
 * "replace the first line starting with Enable=" (which is what the
 * original helper does, and why /etc/mmdvmhost is notably NOT in its own
 * allow-list) would silently edit the wrong section.
 *
 * Requires a sudoers rule granting the user this process runs as
 * passwordless access to exactly:
 *   /usr/bin/mount -o remount,rw /
 *   /usr/bin/mount -o remount,ro /
 *   /usr/bin/install -m 644 -o root -g root /tmp/pistar-node-cw-*.mmdvmhost /etc/mmdvmhost
 * See README for the full sudoers file content — this deliberately does
 * NOT attempt to write sudoers itself.
 */

/**
 * Config files this process may write, mapped to the temp-file suffix the
 * sudoers install rule for each one matches on
 * (/tmp/pistar-node-cw-*.<suffix> → <path>). Adding a file here requires
 * the matching line in deploy/sudoers.d/040-pistar-dashboard-node.
 */
const ALLOWED_FILES = new Map<string, string>([
  ["/etc/mmdvmhost", "mmdvmhost"],
  ["/etc/dmrgateway", "dmrgateway"],
  ["/etc/bmapi.key", "bmapikey"],
]);

function allowedSuffix(configPath: string): string {
  // Dev/test override: MMDVMHOST_CONFIG_PATH etc. may point anywhere; the
  // basename still decides the suffix so the same code path is exercised.
  const suffix = ALLOWED_FILES.get(configPath) ?? [...ALLOWED_FILES.entries()].find(([p]) => configPath.endsWith(path.basename(p)))?.[1];
  if (!suffix) throw new Error(`refusing to write non-allowlisted path: ${configPath}`);
  return suffix;
}

export interface SectionEdit {
  section: string;
  key: string;
  value: string;
  /**
   * Add the key at the end of the section when it isn't present, instead
   * of reporting it as skipped. Used for keys stock configs may lack
   * (e.g. [DMR Network 1] Id, which only exists once an ESSID was set).
   */
  insertIfMissing?: boolean;
}

function assertSafeValue(value: string) {
  if (/[\x00\r\n]/.test(value)) {
    throw new Error(`refusing to write value containing NUL/CR/LF`);
  }
}

function assertSafeName(name: string, label: string) {
  if (!/^[A-Za-z0-9_. -]+$/.test(name)) {
    throw new Error(`unsafe ${label}: ${JSON.stringify(name)}`);
  }
}

/** Pure function — easy to unit-test without touching a real file. */
export function applySectionEdits(originalLines: string[], edits: SectionEdit[]) {
  const lines = [...originalLines];
  const skipped: SectionEdit[] = [];

  for (const edit of edits) {
    assertSafeName(edit.section, "section name");
    assertSafeName(edit.key, "key name");
    assertSafeValue(edit.value);

    const sectionStart = lines.findIndex((l) => l.trim() === `[${edit.section}]`);
    if (sectionStart === -1) {
      skipped.push(edit);
      continue;
    }
    let sectionEnd = lines.length;
    for (let i = sectionStart + 1; i < lines.length; i++) {
      if (/^\[.+\]$/.test(lines[i]!.trim())) {
        sectionEnd = i;
        break;
      }
    }

    const prefix = `${edit.key}=`;
    let applied = false;
    for (let i = sectionStart + 1; i < sectionEnd; i++) {
      if (lines[i]!.startsWith(prefix)) {
        lines[i] = `${prefix}${edit.value}`;
        applied = true;
        break;
      }
    }
    if (!applied) {
      if (edit.insertIfMissing) {
        // Insert before any trailing blank lines so the section's spacing
        // to the next header is preserved.
        let insertAt = sectionEnd;
        while (insertAt > sectionStart + 1 && lines[insertAt - 1]!.trim() === "") insertAt--;
        lines.splice(insertAt, 0, `${prefix}${edit.value}`);
      } else {
        skipped.push(edit);
      }
    }
  }

  return { lines, skipped };
}

export interface WriteResult {
  skipped: SectionEdit[];
}

/** Stage content in /tmp and atomically install it as root over an allow-listed path. */
export async function installConfigFile(configPath: string, content: string): Promise<void> {
  const suffix = allowedSuffix(configPath);
  const tmpFile = path.join(tmpdir(), `pistar-node-cw-${randomBytes(8).toString("hex")}.${suffix}`);
  try {
    await writeFile(tmpFile, content, { mode: 0o600 });
    await execFileAsync("sudo", ["/usr/bin/mount", "-o", "remount,rw", "/"]);
    try {
      await execFileAsync("sudo", ["/usr/bin/install", "-m", "644", "-o", "root", "-g", "root", tmpFile, configPath]);
    } finally {
      await execFileAsync("sudo", ["/usr/bin/mount", "-o", "remount,ro", "/"]);
    }
  } finally {
    await rm(tmpFile, { force: true });
  }
}

/** Section-aware key=value edits to an existing allow-listed INI file. */
export async function writeIniConfig(configPath: string, edits: SectionEdit[]): Promise<WriteResult> {
  allowedSuffix(configPath);
  if (edits.length === 0) return { skipped: [] };

  const original = await readFile(configPath, "utf8");
  const trailingNewline = original.endsWith("\n");
  const originalLines = original.split("\n");
  const withoutTrailingEmpty = trailingNewline ? originalLines.slice(0, -1) : originalLines;

  const { lines, skipped } = applySectionEdits(withoutTrailingEmpty, edits);
  await installConfigFile(configPath, lines.join("\n") + "\n");
  return { skipped };
}

/** Kept for existing callers/tests — /etc/mmdvmhost is just one allow-listed INI file now. */
export const writeMmdvmHostConfig = writeIniConfig;

export async function restartMmdvmHost(): Promise<void> {
  await execFileAsync("sudo", ["/usr/bin/systemctl", "restart", "mmdvmhost.service"]);
}

export async function restartDmrGateway(): Promise<void> {
  await execFileAsync("sudo", ["/usr/bin/systemctl", "restart", "dmrgateway.service"]);
}
