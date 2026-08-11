import type { CalibrationState, DashboardState, FirmwareUpgradeState, LogLine, ServerEvent, SystemInfo } from "@pistar/shared";
import { create } from "zustand";

interface LiveState {
  connected: boolean;
  dashboard: DashboardState | null;
  system: SystemInfo | null;
  firmware: FirmwareUpgradeState | null;
  recentLogs: LogLine[];
  calibration: CalibrationState | null;
  calibrationLog: string[];
  connect: () => void;
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useLiveStore = create<LiveState>((set, get) => ({
  connected: false,
  dashboard: null,
  system: null,
  firmware: null,
  recentLogs: [],
  calibration: null,
  calibrationLog: [],

  connect: () => {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${protocol}://${window.location.host}/ws`);

    socket.onopen = () => set({ connected: true });
    socket.onclose = () => {
      set({ connected: false });
      socket = null;
      reconnectTimer = setTimeout(() => get().connect(), 2000);
    };
    socket.onerror = () => socket?.close();
    socket.onmessage = (event) => {
      let message: ServerEvent;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (message.type) {
        case "dashboard:update":
          set({ dashboard: message.payload });
          break;
        case "system:update":
          set({ system: message.payload });
          break;
        case "firmware:update":
          set({ firmware: message.payload });
          break;
        case "log:line":
          set((state) => ({ recentLogs: [...state.recentLogs, message.payload].slice(-200) }));
          break;
        case "activity:new":
          // dashboard:update already carries the merged activity list;
          // this event exists for consumers that want deltas only.
          break;
        case "calibration:update":
          set({ calibration: message.payload });
          break;
        case "calibration:log":
          set((state) => ({ calibrationLog: [...state.calibrationLog, message.payload.text].slice(-500) }));
          break;
      }
    };
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
  });
}
