import { expect, test } from "bun:test";
import { buildResultsPdf } from "./results.ts";

test("results PDF renderer returns a valid PDF document", async () => {
  const report = {
    tournament: { name: "Demo Auction", slug: "demo" },
    auction: { status: "COMPLETED" },
    teams: [{ team: { name: "Thunderbolts", captainName: "Ayaan", spentPurse: 100, remainingPurse: 900, squadCount: 1, logo: "", id: "t", captainId: null, tournamentId: "t", logoConfig: { icon: "", primaryColor: "#000000", secondaryColor: "#000000", shape: "rounded" }, createdAt: new Date() }, players: [{ id: "p", name: "A Player", role: "Batter", purchasePrice: 100 }] }],
    summary: { totalPlayers: 1, soldPlayers: 1, unsoldPlayers: 0, totalSpent: 100, averagePurchase: 100, highestPurchase: { name: "A Player", price: 100 } },
  };
  const bytes = await buildResultsPdf(report as never);
  expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
});
