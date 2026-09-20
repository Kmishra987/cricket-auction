type Socket = { send(message: string): void };

const rooms = new Map<string, Set<Socket>>();

export function joinRoom(auctionId: string, socket: Socket) {
  const room = rooms.get(auctionId) ?? new Set<Socket>();
  room.add(socket);
  rooms.set(auctionId, room);
}

export function leaveRoom(auctionId: string, socket: Socket) {
  const room = rooms.get(auctionId);
  if (!room) return;
  room.delete(socket);
  if (!room.size) rooms.delete(auctionId);
}

export function broadcast(auctionId: string, payload: unknown) {
  const message = JSON.stringify(payload);
  for (const socket of rooms.get(auctionId) ?? []) socket.send(message);
}

export function activeAuctionIds() { return [...rooms.keys()]; }
