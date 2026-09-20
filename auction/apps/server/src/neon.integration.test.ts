import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { route } from "./routes.ts";
import { db } from "./db/client.ts";
import { acquireControl, nextPlayer, placeBid, reauctionPlayer, settlePlayer, startAuction } from "./auction-engine.ts";
import { auctionControls, auctionEvents, auctionPlayers, auctioneers, auctions, bids, players, teams, tiers, tournaments, users } from "./db/schema.ts";

const integration = process.env.DATABASE_URL ? test : test.skip;

describe("Neon integration", () => {
  integration("serves the seeded public auction snapshot", async () => {
    const response = await route(new Request("http://localhost/api/public/auctions/demo-premier-league"), { headers: {} });
    expect(response?.status).toBe(200);
    const payload = await response?.json() as { snapshot?: { auction?: { status?: string }; teams?: unknown[] } };
    expect(payload.snapshot?.auction?.status).toBe("DRAFT");
    expect(payload.snapshot?.teams).toHaveLength(2);
  });

  integration("reads seeded children inside a real transaction", async () => {
    if (!db) throw new Error("DATABASE_URL is required.");
    const result = await db.transaction(async (tx) => {
      const [tournament] = await tx.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.slug, "demo-premier-league"));
      if (!tournament) throw new Error("Seed tournament is missing.");
      const teamRows = await tx.select({ id: teams.id }).from(teams).where(eq(teams.tournamentId, tournament.id));
      const playerRows = await tx.select({ id: players.id }).from(players).where(eq(players.tournamentId, tournament.id));
      return { teams: teamRows.length, players: playerRows.length };
    });
    expect(result).toEqual({ teams: 2, players: 3 });
  });

  integration("authenticates the seeded organizer and reads protected configuration", async () => {
    if (!db) throw new Error("DATABASE_URL is required.");
    const database = db;
    const login = await route(new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ identifier: "demo-organizer", password: "demo-password-123" }) }), { headers: {} });
    expect(login?.status).toBe(200);
    const cookie = login?.headers.get("set-cookie")?.split(";", 1)[0];
    expect(cookie).toBeTruthy();
    const tournamentsResponse = await route(new Request("http://localhost/api/tournaments", { headers: { cookie: cookie! } }), { headers: {} });
    expect(tournamentsResponse?.status).toBe(200);
    const payload = await tournamentsResponse?.json() as { tournaments?: Array<{ id: string; slug: string }> };
    const tournament = payload.tournaments?.find((item) => item.slug === "demo-premier-league");
    expect(tournament).toBeTruthy();
    const configResponse = await route(new Request(`http://localhost/api/tournaments/${tournament!.id}`, { headers: { cookie: cookie! } }), { headers: {} });
    expect(configResponse?.status).toBe(200);
    const config = await configResponse?.json() as { auction?: { id?: string; pursePerTeam?: number; configurationLocked?: boolean } };
    expect(config.auction?.pursePerTeam).toBeGreaterThan(0);
    expect(config.auction?.configurationLocked).toBe(false);
    expect(config.auction?.id).toBeTruthy();
    const publicResults = await route(new Request("http://localhost/api/public/auctions/demo-premier-league/results"), { headers: {} });
    expect(publicResults?.status).toBe(200);
    const publicPdf = await route(new Request("http://localhost/api/public/auctions/demo-premier-league/pdf"), { headers: {} });
    expect(publicPdf?.status).toBe(200);
    expect(publicPdf?.headers.get("content-type")).toBe("application/pdf");
    const protectedResults = await route(new Request(`http://localhost/api/auctions/${config.auction!.id}/results`, { headers: { cookie: cookie! } }), { headers: {} });
    expect(protectedResults?.status).toBe(200);
    const pdf = await route(new Request(`http://localhost/api/auctions/${config.auction!.id}/pdf`, { headers: { cookie: cookie! } }), { headers: {} });
    expect(pdf?.status).toBe(200);
    expect(pdf?.headers.get("content-type")).toBe("application/pdf");
    let copiedTournamentId = "";
    let copiedAuctionId = "";
    try {
      const duplicate = await route(new Request(`http://localhost/api/auctions/${config.auction!.id}/duplicate`, { method: "POST", headers: { cookie: cookie! } }), { headers: {} });
      expect(duplicate?.status).toBe(201);
      const copy = await duplicate?.json() as { tournament?: { id: string; slug: string }; auction?: { id: string; status: string; configurationLocked: boolean } };
      copiedTournamentId = copy.tournament?.id ?? "";
      copiedAuctionId = copy.auction?.id ?? "";
      expect(copy.tournament?.slug).toContain("-copy-");
      expect(copy.auction?.status).toBe("DRAFT");
      expect(copy.auction?.configurationLocked).toBe(false);
      expect(copiedTournamentId).toBeTruthy();
    } finally {
      if (copiedAuctionId && copiedTournamentId) {
        await database.delete(bids).where(eq(bids.auctionId, copiedAuctionId));
        await database.delete(auctionEvents).where(eq(auctionEvents.auctionId, copiedAuctionId));
        await database.delete(auctionPlayers).where(eq(auctionPlayers.auctionId, copiedAuctionId));
        await database.delete(auctionControls).where(eq(auctionControls.auctionId, copiedAuctionId));
        await database.delete(auctioneers).where(eq(auctioneers.auctionId, copiedAuctionId));
        await database.delete(auctions).where(eq(auctions.id, copiedAuctionId));
        await database.delete(players).where(eq(players.tournamentId, copiedTournamentId));
        await database.delete(teams).where(eq(teams.tournamentId, copiedTournamentId));
        await database.delete(tiers).where(eq(tiers.tournamentId, copiedTournamentId));
        await database.delete(tournaments).where(eq(tournaments.id, copiedTournamentId));
      }
    }
  });

  integration("serializes simultaneous controller acquisition", async () => {
    if (!db) throw new Error("DATABASE_URL is required.");
    const database = db;
    const [organizer] = await database.select({ id: users.id }).from(users).where(eq(users.username, "demo-organizer"));
    const [tournament] = await database.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.slug, "demo-premier-league"));
    if (!organizer || !tournament) throw new Error("Seed organizer or tournament is missing.");
    const [auction] = await database.insert(auctions).values({ tournamentId: tournament.id, squadSize: 2, pursePerTeam: 1000000, basePrice: 100000, incrementOne: 50000, incrementTwo: 100000, incrementThree: 200000 }).returning({ id: auctions.id });
    try {
      const attempts = await Promise.allSettled([acquireControl(auction.id, organizer.id), acquireControl(auction.id, organizer.id)]);
      expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
      expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
      const rejected = attempts.find((attempt) => attempt.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason?.code).toBe("CONTROL_ALREADY_ACQUIRED");
    } finally {
      await database.delete(auctionEvents).where(eq(auctionEvents.auctionId, auction.id));
      await database.delete(auctionControls).where(eq(auctionControls.auctionId, auction.id));
      await database.delete(auctions).where(eq(auctions.id, auction.id));
    }
  });

  integration("completes the real auction lifecycle including re-auction", async () => {
    if (!db) throw new Error("DATABASE_URL is required.");
    const database = db;
    const [organizer] = await database.select({ id: users.id }).from(users).where(eq(users.username, "demo-organizer"));
    const [captainA] = await database.select({ id: users.id }).from(users).where(eq(users.username, "demo-captain-a"));
    const [captainB] = await database.select({ id: users.id }).from(users).where(eq(users.username, "demo-captain-b"));
    if (!organizer || !captainA || !captainB) throw new Error("Seed users are missing.");
    let tournamentId = "";
    let auctionId = "";
    try {
      const created = await database.transaction(async (tx) => {
        const [tournament] = await tx.insert(tournaments).values({ organizerId: organizer.id, name: "Lifecycle Integration", slug: `lifecycle-${crypto.randomUUID()}`, numberOfTeams: 2, scheduledAt: new Date(Date.now() + 60_000) }).returning({ id: tournaments.id });
        const [auction] = await tx.insert(auctions).values({ tournamentId: tournament.id, squadSize: 2, pursePerTeam: 1000000, basePrice: 100000, incrementOne: 50000, incrementTwo: 100000, incrementThree: 200000 }).returning({ id: auctions.id });
        await tx.insert(teams).values([
          { tournamentId: tournament.id, captainId: captainA.id, name: "Lifecycle Blue", logo: "<svg />", logoConfig: { icon: "B", primaryColor: "#0099FF", secondaryColor: "#005A9C", shape: "rounded" } },
          { tournamentId: tournament.id, captainId: captainB.id, name: "Lifecycle Gold", logo: "<svg />", logoConfig: { icon: "G", primaryColor: "#F6B73C", secondaryColor: "#A66500", shape: "rounded" } },
        ]);
        await tx.insert(players).values([
          { tournamentId: tournament.id, name: "Lifecycle Batter", role: "Batter", isForeign: false },
          { tournamentId: tournament.id, name: "Lifecycle Bowler", role: "Bowler", isForeign: false },
        ]);
        return { tournamentId: tournament.id, auctionId: auction.id };
      });
      tournamentId = created.tournamentId; auctionId = created.auctionId;
      await acquireControl(auctionId, organizer.id);
      await expect(startAuction(auctionId, organizer.id)).rejects.toMatchObject({ code: "AUCTION_SCHEDULED" });
      await database.update(tournaments).set({ scheduledAt: null }).where(eq(tournaments.id, tournamentId));
      const started = await startAuction(auctionId, organizer.id);
      if (!started.snapshot?.currentPlayer) throw new Error("Lifecycle auction did not start a player.");
      expect(started.snapshot.upcomingPlayers).toHaveLength(1);
      const firstPlayerId = started.snapshot.currentPlayer.player.id;
      const firstBid = await placeBid(auctionId, captainA.id, 50000);
      expect(firstBid.snapshot?.auction.currentBid).toBe(150000);
      const firstSale = await settlePlayer(auctionId, organizer.id, "SOLD");
      expect(firstSale.event.payload.salePrice).toBe(150000);
      const next = await nextPlayer(auctionId, organizer.id);
      const secondPlayerId = next.snapshot?.currentPlayer?.player.id;
      expect(secondPlayerId).toBeTruthy();
      expect(secondPlayerId).not.toBe(firstPlayerId);
      await settlePlayer(auctionId, organizer.id, "UNSOLD");
      const reauctioned = await reauctionPlayer(auctionId, organizer.id, secondPlayerId!);
      expect(reauctioned.snapshot?.currentPlayer?.player.id).toBe(secondPlayerId);
      await placeBid(auctionId, captainB.id, 50000);
      await settlePlayer(auctionId, organizer.id, "SOLD");
      const completed = await nextPlayer(auctionId, organizer.id);
      expect(completed.snapshot?.auction.status).toBe("COMPLETED");
    } finally {
      if (auctionId && tournamentId) {
        await database.delete(bids).where(eq(bids.auctionId, auctionId));
        await database.delete(auctionEvents).where(eq(auctionEvents.auctionId, auctionId));
        await database.delete(auctionPlayers).where(eq(auctionPlayers.auctionId, auctionId));
        await database.delete(auctionControls).where(eq(auctionControls.auctionId, auctionId));
        await database.delete(auctioneers).where(eq(auctioneers.auctionId, auctionId));
        await database.delete(auctions).where(eq(auctions.id, auctionId));
        await database.delete(players).where(eq(players.tournamentId, tournamentId));
        await database.delete(teams).where(eq(teams.tournamentId, tournamentId));
        await database.delete(tiers).where(eq(tiers.tournamentId, tournamentId));
        await database.delete(tournaments).where(eq(tournaments.id, tournamentId));
      }
    }
  });
});
