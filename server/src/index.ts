import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import session from "express-session";
import { authRouter } from "./routes/auth.js";
import { calibrationRouter } from "./routes/calibration.js";
import { configRouter } from "./routes/config.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { firmwareRouter } from "./routes/firmware.js";
import { linksRouter } from "./routes/links.js";
import { logsRouter } from "./routes/logs.js";
import { powerRouter } from "./routes/power.js";
import { sshRouter } from "./routes/ssh.js";
import { systemRouter } from "./routes/system.js";
import { wifiRouter } from "./routes/wifi.js";
import { startRealActivityFeed } from "./pistar/activityFeed.js";
import { startActivitySimulator, startSystemInfoBroadcast } from "./simulator.js";
import { wsHub } from "./ws.js";

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "pistar-dev-secret-change-me";
const NODE_ENV = process.env.NODE_ENV ?? "development";
// Pi-Star dashboards are typically served over plain HTTP on the LAN, so
// tying this to NODE_ENV would silently break login in production (browsers
// drop `secure` cookies on a non-HTTPS connection). Opt in explicitly if
// you later put this behind TLS.
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    name: "pistar.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: COOKIE_SECURE,
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/config", configRouter);
app.use("/api/links", linksRouter);
app.use("/api/power", powerRouter);
app.use("/api/wifi", wifiRouter);
app.use("/api/ssh", sshRouter);
app.use("/api/system", systemRouter);
app.use("/api/firmware", firmwareRouter);
app.use("/api/calibration", calibrationRouter);
app.use("/api/logs", logsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Serve the built client in production so a single Node process can
// replace the PHP + lighttpd stack on the Pi.
if (NODE_ENV === "production") {
  const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|ws).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const httpServer = createServer(app);
httpServer.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws") {
    wsHub.handleUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

const stopSystemInfo = startSystemInfoBroadcast();
const stopRealActivityFeed = startRealActivityFeed();
let stopActivitySimulator: (() => void) | null = null;
if (stopRealActivityFeed) {
  console.log("[activityFeed] real MMDVM log found — activity feed is live, not simulated");
} else {
  console.log("[activityFeed] no real MMDVM log found — falling back to simulated activity");
  stopActivitySimulator = startActivitySimulator();
}

httpServer.listen(PORT, () => {
  console.log(`Pi-Star dashboard API listening on http://localhost:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopSystemInfo();
    stopRealActivityFeed?.();
    stopActivitySimulator?.();
    httpServer.close(() => process.exit(0));
  });
}
