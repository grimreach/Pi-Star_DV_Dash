# Pi-Star Digital Voice Dashboard — Node.js + React

A modernized rewrite of [Pi-Star_DV_Dash](https://github.com/grimreach/Pi-Star_DV_Dash), replacing the PHP/lighttpd
stack with a Node.js API and a React SPA. Built with the latest stable releases at time of writing: Node 22,
Express 5, React 19, React Router 8, Vite 8, Tailwind CSS 4, TypeScript 7.

## Structure (npm workspaces)

- `shared/` — TypeScript types shared by server and client (dashboard state, config, activity log, WS events).
- `server/` — Express API + WebSocket server. All data currently comes from an **in-memory mock layer**
  (`server/src/store.ts` + `server/src/simulator.ts`) that generates realistic-looking activity so the UI is fully
  interactive out of the box.
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

| Area | File | What to change for real hardware |
|---|---|---|
| Config storage | `server/src/store.ts` | Read/write `/etc/mmdvmhost`, `/etc/dstarrepeater`, etc. instead of the in-memory `config` object |
| Live activity | `server/src/simulator.ts` | Replace with an MMDVMHost.log tail (inotify) feeding the same `ActivityEntry` shape |
| Power | `server/src/routes/power.ts` | Currently a no-op that only logs intent — wire to `sudo shutdown -r/-h now` deliberately and carefully |
| WiFi | `server/src/routes/wifi.ts` | Wire to `wpa_cli` scan/connect |
| SSH toggle | `server/src/routes/ssh.ts` | Wire to `systemctl enable/disable ssh` |
| Firmware upgrade | `server/src/routes/firmware.ts` | Wire to the real modem flashing tool, streaming its output instead of the simulated step list |
| Calibration | `server/src/routes/calibration.ts` | Wire to MMDVMHost's calibration mode + real RSSI readback |
| System info | `server/src/store.ts#systemInfo()` | Read `/proc`, `vcgencmd measure_temp`, `df`, etc. |

Auth is a simple session (default `admin` / `pi-star`, changeable from the Admin Overview page) — swap in
Pi-Star's real credential store if you want continuity with existing installs.

Not ported: the multi-language UI (English only), and the D-Star-only "dstarrepeater mode" vs. MMDVMHost-mode
branching from the original `index.php` — this rewrite always renders the full MMDVMHost-style dashboard.
