import { route, json } from "./routes.ts";
import { currentUser } from "./auth.ts";
import { activeAuctionIds, broadcast, joinRoom, leaveRoom } from "./realtime.ts";
import { expireTimer, snapshot } from "./auction-engine.ts";

const port = Number(process.env.PORT ?? 4000);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const corsHeaders = {
  "access-control-allow-origin": webOrigin,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

type SocketData = { auctionId: string; userId?: string };

const server = Bun.serve<SocketData>({
  port,
  async fetch(request, server) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

    if (url.pathname === "/ws") {
      const auctionId = url.searchParams.get("auctionId");
      if (!auctionId) return new Response("auctionId is required", { status: 400, headers: corsHeaders });
      const userId = await currentUser(request).then((user) => user?.id).catch(() => undefined);
      return server.upgrade(request, { data: { auctionId, userId } }) ? undefined : new Response("WebSocket upgrade required", { status: 426, headers: corsHeaders });
    }

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "auction-server" }, { headers: corsHeaders });
    }

    const response = await route(request, { headers: corsHeaders });
    return response ?? json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404, { headers: corsHeaders });
  },
  websocket: {
    open(socket) {
      joinRoom(socket.data.auctionId, socket);
      socket.send(JSON.stringify({ type: "CONNECTED", auctionId: socket.data.auctionId, authenticated: Boolean(socket.data.userId), message: "Auction realtime channel ready." }));
      snapshot(socket.data.auctionId).then((state) => socket.send(JSON.stringify({ type: "AUCTION_STATE", sequence: state?.auction.eventSequence ?? 0, snapshot: state }))).catch(() => undefined);
    },
    message(socket, message) {
      if (typeof message === "string") {
        try {
          const input = JSON.parse(message) as { type?: string };
          if (input.type === "RESYNC") {
            snapshot(socket.data.auctionId).then((state) => socket.send(JSON.stringify({ type: "AUCTION_STATE", sequence: state?.auction.eventSequence ?? 0, snapshot: state }))).catch(() => undefined);
            return;
          }
        } catch { /* ignore malformed viewer messages */ }
      }
      socket.send(JSON.stringify({ type: "ACK", received: typeof message === "string" ? message : "binary" }));
    },
    close(socket) {
      leaveRoom(socket.data.auctionId, socket);
    },
  },
});

const expirySweep = setInterval(async () => {
  for (const auctionId of activeAuctionIds()) {
    try {
      if (await expireTimer(auctionId)) {
        const state = await snapshot(auctionId);
        broadcast(auctionId, { type: "AUCTION_STATE", sequence: state?.auction.eventSequence ?? 0, snapshot: state });
      }
    } catch { /* A transient database error is retried on the next sweep. */ }
  }
}, 1000);
expirySweep.unref?.();

console.log(`Auction server listening on ${server.url}`);
