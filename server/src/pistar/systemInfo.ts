import { readFileSync, statfsSync } from "node:fs";
import os from "node:os";
import type { SystemInfo } from "@pistar/shared";

/**
 * Real system stats via Node's built-in os/fs modules only — no shelling
 * out, no sudo needed. CPU temperature reads /sys/class/thermal directly
 * (standard on any Linux ARM SBC including Raspberry Pi, world-readable),
 * which is simpler and more portable than shelling out to `vcgencmd`.
 *
 * Returns null on non-Linux hosts (e.g. local Mac dev) so the caller can
 * fall back to the mock values.
 */
export function readRealSystemInfo(): Omit<SystemInfo, "hostname" | "pistarVersion" | "dashboardVersion"> | null {
  if (process.platform !== "linux") return null;

  let cpuTemperatureC = 0;
  try {
    const raw = readFileSync("/sys/class/thermal/thermal_zone0/temp", "utf8");
    cpuTemperatureC = Number.parseInt(raw, 10) / 1000;
  } catch {
    return null; // not actually on ARM SBC-like hardware — don't report a fake temp
  }

  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  const disk = statfsSync("/");
  const diskTotalBytes = disk.blocks * disk.bsize;
  const diskAvailBytes = disk.bavail * disk.bsize;

  return {
    uptimeSeconds: Math.floor(os.uptime()),
    cpuTemperatureC,
    cpuLoad: os.loadavg() as [number, number, number],
    memoryUsedMb: Math.round((totalMem - freeMem) / 1024 / 1024),
    memoryTotalMb: Math.round(totalMem / 1024 / 1024),
    diskUsedMb: Math.round((diskTotalBytes - diskAvailBytes) / 1024 / 1024),
    diskTotalMb: Math.round(diskTotalBytes / 1024 / 1024),
    ipAddress: primaryIpAddress(),
  };
}

function primaryIpAddress(): string {
  const interfaces = os.networkInterfaces();
  // Prefer wlan0 (typical Pi-Star hotspot setup) then eth0, then any
  // other non-internal IPv4 interface.
  for (const name of ["wlan0", "eth0"]) {
    const addr = interfaces[name]?.find((i) => i.family === "IPv4" && !i.internal);
    if (addr) return addr.address;
  }
  for (const addrs of Object.values(interfaces)) {
    const addr = addrs?.find((i) => i.family === "IPv4" && !i.internal);
    if (addr) return addr.address;
  }
  return "unknown";
}
