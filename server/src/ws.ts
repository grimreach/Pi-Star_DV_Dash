import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import type { ServerEvent } from "@pistar/shared";

/**
 * Thin pub/sub hub over a single WebSocket endpoint (/ws). Real Pi-Star
 * would tail MMDVMHost.log with inotify; here `broadcast()` is called by
 * the simulator and by route handlers after a mutation.
 */
class WsHub {
  private wss = new WebSocketServer({ noServer: true });
  private clients = new Set<WebSocket>();

  constructor() {
    this.wss.on("connection", (socket) => {
      this.clients.add(socket);
      socket.on("close", () => this.clients.delete(socket));
      socket.on("error", () => this.clients.delete(socket));
    });
  }

  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit("connection", ws, req);
    });
  }

  broadcast(event: ServerEvent) {
    const data = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) client.send(data);
    }
  }
}

export const wsHub = new WsHub();
