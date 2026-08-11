# Pi-Star Digital Voice Dashboard — Node.js + React

A modernized rewrite of [Pi-Star_DV_Dash](https://github.com/grimreach/Pi-Star_DV_Dash), replacing the PHP/lighttpd
stack with a Node.js API and a React SPA. Built with the latest stable releases at time of writing: Node 22,
Express 5, React 19, React Router 8, Vite 8, Tailwind CSS 4, TypeScript 7.

## Structure (npm workspaces)

- `shared/` — TypeScript types shared by server and client (dashboard state, config, activity log, WS events).
- `server/` — Express API + WebSocket server. Config (general/mmdvmHost/dmrGateway/dstarRepeater/ysf/p25/nxdn/m17)
  is read from the real `/etc/mmdvmhost` when present (`server/src/pistar/mmdvmConfig.ts`). D-Star/DMR/YSF/P25/NXDN/
  M17/POCSAG activity is a real tail of `/var/log/pi-star/MMDVM-*.log`, parsed against the log-line formats
  documented in the original PHP dashboard's source (`server/src/pistar/mmdvmLog.ts` + `logTail.ts` +
  `activityFeed.ts`). Both fall back to an in-memory mock seed/simulator when the real files aren't present (e.g.
  local dev off-device). DAPNET/time-server config and all admin-action routes (WiFi/SSH/power/firmware/calibration) are
  still mock/simulated (`server/src/simulator.ts`) so the UI stays fully interactive wherever it runs.
- `client/` — React SPA (Vite): public Dashboard (mirrors the original screenshot) + an authenticated Admin section
  (Configuration, Link Manager, WiFi, SSH Access, Live Logs, System Info, Firmware Upgrade, Calibration, Power).

## Running it

```bash
npm install
npm run build:shared   # shared types must be built once before first run
npm run dev            # starts API on :4000 and Vite dev server on :5173
```

Open http://localhost:5173. Admin login: `admin` / `pi-star`.

For a single-process production build (serves the built client from the API server, matching how Pi-Star ran one
process on the Pi):

```bash
npm run build
NODE_ENV=production node server/dist/index.js
```

## What's real vs. mocked

This was scoped to fully replace the PHP app's UI and API surface, including the system-admin pages (WiFi, SSH,
power, firmware, calibration) — but it was built and tested without access to real Pi-Star hardware. Every route
that would touch the real system on a Pi is isolated behind a small, clearly-commented seam so it's a targeted
swap, not a rewrite:

| Area | File | Status |
|---|---|---|
| Config (read) | `server/src/pistar/mmdvmConfig.ts` | **Real** — parses `/etc/mmdvmhost` (path overridable via `MMDVMHOST_CONFIG_PATH`), verified against a live Pi-Star device. `Enable=1` reflects *configured* state, not live connection health — see caveat below. |
| Config (write) | `server/src/pistar/configWriter.ts`, `mmdvmConfigWrite.ts` | **Real**, requires one-time setup — atomically writes the specific `[Section] key=value` lines back to `/etc/mmdvmhost` via a narrowly-scoped sudo rule (see "Config write setup" below). Section-*aware* editing (not a blind first-match-of-`key=` replace) — verified this matters, since `Enable` appears in ~20 sections. Restarting MMDVMHost to apply changes is a deliberately separate, explicit action in the UI, never automatic on save. |
| DAPNET config (read) | `server/src/pistar/dapnetConfig.ts` | **Real** — parses `/etc/dapnetgateway`. `enabled` is derived from whether `DAPNETGateway` is actually running (`isProcessRunning`), not a flag in the file — that file has no enable flag of its own; DAPNET is a systemd service like the other gateways. Verified against a real device's file, though DAPNET isn't actually configured there (still shows Pi-Star's placeholder `M1ABC` callsign). |
| Time server config (read) | `server/src/pistar/timeServerConfig.ts` | **Real** — parses `/etc/timeserver`, which turned out to *not* be NTP config (an earlier wrong assumption) but D-Star's periodic time-beacon feature — the source of the `CALLSIGN/TIME` entries in the activity feed. `enabled` is derived from whether any module's send flag is on. Verified against a real device's file. |
| DAPNET / time server config (write) | — | Still mock — these two aren't in the config writer's allow-list yet. |
| DMR per-slot talkgroup routing | `server/src/pistar/mmdvmConfig.ts` | Approximated from `[DMR Network] Slot1/Slot2` (which slot that network entry carries) rather than true per-slot/per-talkgroup state, which lives in `DMRGateway.ini` (not read). |
| Live activity — D-Star | `server/src/pistar/mmdvmLog.ts`, `logTail.ts`, `activityFeed.ts` | **Real**, confirmed against live traffic — an actual RF+network D-Star echo test round-tripped correctly through the parser on a real device (`W3EZE/ECHO`, `W3EZE/ROB`, `W3EZE/TIME`). |
| Live activity — DMR/YSF/P25/NXDN/M17/POCSAG | same files | **Real**, verified against the exact sample log lines documented in the original PHP dashboard's source (`mmdvmhost/functions.php`), not yet against live traffic on this specific device (no hardware for those modes). Log dir/prefix overridable via `MMDVM_LOG_DIR`/`MMDVM_LOG_PREFIX`. |
| Live network connection status | `server/src/pistar/networkHealth.ts`, `processCheck.ts` | **Real** — ported from the original PHP's `isProcessRunning()`/`checkDMRLogin()`: most networks check whether their gateway daemon process is actually running (`ps -eo comm`), and DMR additionally checks the log for the latest "master...successfully"/"master...failed" line. Failure-line matching confirmed against the real DMR login failure seen earlier in development; the success-line pattern is the well-known MMDVMHost convention but not yet confirmed against a successful login on this device. Only active alongside the real activity feed (falls back to config-derived state otherwise). |
| Power | `server/src/routes/power.ts` | Still mock — a no-op that only logs intent. Needs `sudo shutdown -r/-h now`, wired deliberately and carefully. |
| WiFi scan (read) | `server/src/pistar/wifiScan.ts` | **Real** — `wpa_cli scan`/`scan_results`/`status`, requires the sudo grant below. Deliberately excludes `ifdown`/`ifup`/`reconfigure` — nothing here can disrupt the device's current network connection. |
| WiFi connect/disconnect (write) | `server/src/pistar/wifiConnect.ts` | **Real**, requires the WiFi sudo grant. Uses `add_network`/`enable_network` rather than `select_network` — the latter disables every other configured network profile, which could break a previously-working connection if the new one fails. Polls `status` for an actual `wpa_state=COMPLETED` before reporting success, and automatically cleans up (`disable_network`/`remove_network`) on failure rather than leaving an orphaned profile. Falls back to mock only when `wpa_cli` is entirely unreachable — a real attempt that fails (wrong password, timeout) is shown as a real failure, not silently swapped for a fake success. |
| SSH Terminal | `server/src/pistar/shellinabox.ts` | **Real** — turns out the original's "SSH Access" page isn't an sshd toggle at all (checked `admin/expert/ssh_access.php` and the real sudoers dump — no `ssh`/`sshd`/`shellinabox` entry anywhere in the systemctl grants), it's an embedded ShellInABox web terminal. Reads the real port from `/etc/default/shellinabox` (world-readable, no sudo) and embeds it via iframe, matching the original. |
| Firmware upgrade | `server/src/routes/firmware.ts` | Still mock — needs the real modem flashing tool, streaming its output instead of the simulated step list. |
| Calibration | `server/src/routes/calibration.ts` | Still mock — needs MMDVMHost's calibration mode + real RSSI readback. |
| System info | `server/src/pistar/systemInfo.ts` | **Real** — uptime/load/memory via Node's `os` module, disk via `fs.statfsSync`, CPU temp via `/sys/class/thermal/thermal_zone0/temp` (no `vcgencmd`, no shelling out, no sudo needed). Falls back to mock on non-Linux hosts. |

Auth is a simple session (default `admin` / `pi-star`, changeable from the Admin Overview page) — swap in
Pi-Star's real credential store if you want continuity with existing installs.

Not ported: the multi-language UI (English only), and the D-Star-only "dstarrepeater mode" vs. MMDVMHost-mode
branching from the original `index.php` — this rewrite always renders the full MMDVMHost-style dashboard.

## Config write setup (one-time, on the Pi)

Saving from the Configuration page writes back to `/etc/mmdvmhost`, which is root-owned — the dashboard's Node
process (running as `pi-star`) needs a scoped `sudo` rule to do that. `deploy/sudoers.d/040-pistar-dashboard-node`
in this repo has it, mirroring the exact pattern Pi-Star's own PHP dashboard uses for `www-data` (see that file's
comments for the reasoning). To install it:

```
rpi-rw
sudo cp ~/pistar-dashboard/deploy/sudoers.d/040-pistar-dashboard-node /etc/sudoers.d/040-pistar-dashboard-node
sudo chmod 440 /etc/sudoers.d/040-pistar-dashboard-node
sudo visudo -c -f /etc/sudoers.d/040-pistar-dashboard-node
rpi-ro
```

`visudo -c` validates the syntax without opening an editor — if it doesn't say the file is parsed correctly, fix
it before trusting it (a broken sudoers file can lock out privilege escalation). The paths in that file
(`/usr/bin/mount`, `/usr/bin/install`, `/usr/bin/systemctl`) were verified against a real device via `which` —
confirm they match yours (`which mount install systemctl`) before installing, since sudoers matches the literal
invoked path.

Without this rule, Configuration saves still work (update the in-memory/API state and the live dashboard) — they
just won't persist to the real file, and the save response will say so.
