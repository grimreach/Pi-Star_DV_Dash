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

const ALLOWED_FILES = new Set(["/etc/mmdvmhost"]);

export interface SectionEdit {
  section: string;
  key: string;
  value: string;
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
    if (!applied) skipped.push(edit);
  }

  return { lines, skipped };
}

export interface WriteResult {
  skipped: SectionEdit[];
}

export async function writeMmdvmHostConfig(configPath: string, edits: SectionEdit[]): Promise<WriteResult> {
  if (!ALLOWED_FILES.has(configPath)) {
    throw new Error(`refusing to write non-allowlisted path: ${configPath}`);
  }
  if (edits.length === 0) return { skipped: [] };

  const original = await readFile(configPath, "utf8");
  const trailingNewline = original.endsWith("\n");
  const originalLines = original.split("\n");
  const withoutTrailingEmpty = trailingNewline ? originalLines.slice(0, -1) : originalLines;

  const { lines, skipped } = applySectionEdits(withoutTrailingEmpty, edits);
  const newContent = lines.join("\n") + "\n";

  const tmpFile = path.join(tmpdir(), `pistar-node-cw-${randomBytes(8).toString("hex")}.mmdvmhost`);
  try {
    await writeFile(tmpFile, newContent, { mode: 0o600 });
    await execFileAsync("sudo", ["/usr/bin/mount", "-o", "remount,rw", "/"]);
    try {
      await execFileAsync("sudo", ["/usr/bin/install", "-m", "644", "-o", "root", "-g", "root", tmpFile, configPath]);
    } finally {
      await execFileAsync("sudo", ["/usr/bin/mount", "-o", "remount,ro", "/"]);
    }
  } finally {
    await rm(tmpFile, { force: true });
  }

  return { skipped };
}

export async function restartMmdvmHost(): Promise<void> {
  await execFileAsync("sudo", ["/usr/bin/systemctl", "restart", "mmdvmhost.service"]);
}
