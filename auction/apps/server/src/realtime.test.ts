import { describe, expect, test } from "bun:test";
import { broadcast, joinRoom, leaveRoom } from "./realtime.ts";

function fakeSocket() {
  const messages: string[] = [];
  return { messages, send(message: string) { messages.push(message); } };
}

describe("auction realtime rooms", () => {
  test("broadcasts only to clients in the auction room", () => {
    const first = fakeSocket(); const second = fakeSocket(); const otherRoom = fakeSocket();
    joinRoom("auction-a", first); joinRoom("auction-a", second); joinRoom("auction-b", otherRoom);
    broadcast("auction-a", { type: "BID_PLACED", sequence: 2 });
    expect(first.messages).toHaveLength(1); expect(second.messages).toHaveLength(1); expect(otherRoom.messages).toHaveLength(0);
    leaveRoom("auction-a", first); broadcast("auction-a", { type: "PLAYER_SOLD", sequence: 3 });
    expect(first.messages).toHaveLength(1); expect(second.messages).toHaveLength(2);
    leaveRoom("auction-a", second); leaveRoom("auction-b", otherRoom);
  });
});
