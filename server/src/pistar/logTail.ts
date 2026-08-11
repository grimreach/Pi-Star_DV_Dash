import { existsSync, statSync, watch, type FSWatcher } from "node:fs";
import { open } from "node:fs/promises";

export interface TailOptions {
  onLine: (line: string) => void;
  onError?: (err: unknown) => void;
}

/**
 * Minimal `tail -f`-style follower for a single file: reads only newly
 * appended bytes, splits on newlines, and hands complete lines to onLine.
 * A shrinking file size (rotation/truncation) restarts from byte 0.
 *
 * Uses fs.watch as the primary trigger plus a periodic poll as a safety
 * net — inotify-based watch can occasionally miss events on some
 * filesystems, and this file matters enough (it drives the live activity
 * feed) to not silently go stale.
 */
export class FileTailer {
  private watcher: FSWatcher | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private position = 0;
  private buffer = "";
  private reading = false;

  constructor(
    private path: string,
    private options: TailOptions,
  ) {}

  start(fromEnd = true) {
    if (!existsSync(this.path)) return;
    this.position = fromEnd ? statSync(this.path).size : 0;
    this.watcher = watch(this.path, () => void this.readNewData());
    this.pollTimer = setInterval(() => void this.readNewData(), 3000);
    void this.readNewData();
  }

  stop() {
    this.watcher?.close();
    this.watcher = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async readNewData() {
    if (this.reading) return;
    this.reading = true;
    try {
      const stat = statSync(this.path);
      if (stat.size < this.position) this.position = 0; // rotated/truncated
      if (stat.size === this.position) return;

      const handle = await open(this.path, "r");
      try {
        const length = stat.size - this.position;
        const chunk = Buffer.alloc(length);
        await handle.read(chunk, 0, length, this.position);
        this.position = stat.size;
        this.buffer += chunk.toString("utf8");

        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.length > 0) this.options.onLine(line);
        }
      } finally {
        await handle.close();
      }
    } catch (err) {
      this.options.onError?.(err);
    } finally {
      this.reading = false;
    }
  }
}
