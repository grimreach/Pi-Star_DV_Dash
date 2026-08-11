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
| Config (write) | `server/src/routes/config.ts` | Still mock — `PATCH` only updates the in-memory store, doesn't write `/etc/mmdvmhost` back or restart MMDVMHost. Needed before Configuration-editor saves affect the real device. |
| DAPNET / time server config | `server/src/store.ts` | Still mock — live in separate Pi-Star config files not read yet. |
| DMR per-slot talkgroup routing | `server/src/pistar/mmdvmConfig.ts` | Approximated from `[DMR Network] Slot1/Slot2` (which slot that network entry carries) rather than true per-slot/per-talkgroup state, which lives in `DMRGateway.ini` (not read). |
| Live activity — D-Star | `server/src/pistar/mmdvmLog.ts`, `logTail.ts`, `activityFeed.ts` | **Real**, confirmed against live traffic — an actual RF+network D-Star echo test round-tripped correctly through the parser on a real device (`W3EZE/ECHO`, `W3EZE/ROB`, `W3EZE/TIME`). |
| Live activity — DMR/YSF/P25/NXDN/M17/POCSAG | same files | **Real**, verified against the exact sample log lines documented in the original PHP dashboard's source (`mmdvmhost/functions.php`), not yet against live traffic on this specific device (no hardware for those modes). Log dir/prefix overridable via `MMDVM_LOG_DIR`/`MMDVM_LOG_PREFIX`. |
| Live network connection status | `server/src/pistar/networkHealth.ts`, `processCheck.ts` | **Real** — ported from the original PHP's `isProcessRunning()`/`checkDMRLogin()`: most networks check whether their gateway daemon process is actually running (`ps -eo comm`), and DMR additionally checks the log for the latest "master...successfully"/"master...failed" line. Failure-line matching confirmed against the real DMR login failure seen earlier in development; the success-line pattern is the well-known MMDVMHost convention but not yet confirmed against a successful login on this device. Only active alongside the real activity feed (falls back to config-derived state otherwise). |
| Power | `server/src/routes/power.ts` | Still mock — a no-op that only logs intent. Needs `sudo shutdown -r/-h now`, wired deliberately and carefully. |
| WiFi | `server/src/routes/wifi.ts` | Still mock — needs `wpa_cli` scan/connect. |
| SSH toggle | `server/src/routes/ssh.ts` | Still mock — needs `systemctl enable/disable ssh`. |
| Firmware upgrade | `server/src/routes/firmware.ts` | Still mock — needs the real modem flashing tool, streaming its output instead of the simulated step list. |
| Calibration | `server/src/routes/calibration.ts` | Still mock — needs MMDVMHost's calibration mode + real RSSI readback. |
| System info | `server/src/store.ts#systemInfo()` | Still mock — needs `/proc`, `vcgencmd measure_temp`, `df`, etc. |

Auth is a simple session (default `admin` / `pi-star`, changeable from the Admin Overview page) — swap in
Pi-Star's real credential store if you want continuity with existing installs.

Not ported: the multi-language UI (English only), and the D-Star-only "dstarrepeater mode" vs. MMDVMHost-mode
branching from the original `index.php` — this rewrite always renders the full MMDVMHost-style dashboard.
