import { and, asc, desc, eq } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { getDb, getHttpDb } from "./db/client.ts";
import { auctionControls, auctionEvents, auctionPlayers, auctions, auctioneers, bids, players, teams, tournaments } from "./db/schema.ts";

export class AuctionError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}

function fail(code: string, message: string, status = 409): never { throw new AuctionError(code, message, status); }

async function event(tx: any, auctionId: string, type: string, actorUserId: string | null, payload: Record<string, unknown>) {
  const [current] = await tx.select({ sequence: auctions.eventSequence }).from(auctions).where(eq(auctions.id, auctionId)).for("update");
  const sequence = (current?.sequence ?? 0) + 1;
  await tx.update(auctions).set({ eventSequence: sequence }).where(eq(auctions.id, auctionId));
  const [created] = await tx.insert(auctionEvents).values({ auctionId, eventType: type, actorUserId, sequenceNumber: sequence, payload }).returning();
  return created;
}

async function controller(tx: any, auctionId: string, userId: string) {
  const [auction] = await tx.select({ organizerId: tournaments.organizerId, controllerUserId: auctionControls.controllerUserId }).from(auctions).innerJoin(tournaments, eq(tournaments.id, auctions.tournamentId)).leftJoin(auctionControls, eq(auctionControls.auctionId, auctions.id)).where(eq(auctions.id, auctionId)).limit(1);
  if (!auction) fail("AUCTION_NOT_FOUND", "Auction not found.", 404);
  if (auction.organizerId !== userId) {
    const [auctioneer] = await tx.select({ userId: auctioneers.userId }).from(auctioneers).where(and(eq(auctioneers.auctionId, auctionId), eq(auctioneers.userId, userId))).limit(1);
    if (!auctioneer) fail("NOT_AUCTION_CONTROLLER", "You are not authorized to control this auction.", 403);
  }
  if (auction.controllerUserId !== userId) fail("NOT_AUCTION_CONTROLLER", "Acquire auction control before performing this action.", 403);
}

export async function acquireControl(auctionId: string, userId: string) {
  try {
    return await getDb().transaction(async (tx) => {
      const [auction] = await tx.select({ organizerId: tournaments.organizerId }).from(auctions).innerJoin(tournaments, eq(tournaments.id, auctions.tournamentId)).where(eq(auctions.id, auctionId)).limit(1);
      if (!auction) fail("AUCTION_NOT_FOUND", "Auction not found.", 404);
      if (auction.organizerId !== userId) {
        const [auctioneer] = await tx.select({ userId: auctioneers.userId }).from(auctioneers).where(and(eq(auctioneers.auctionId, auctionId), eq(auctioneers.userId, userId))).limit(1);
        if (!auctioneer) fail("FORBIDDEN", "You are not authorized to control this auction.", 403);
      }
      const [lock] = await tx.insert(auctionControls).values({ auctionId, controllerUserId: userId }).onConflictDoNothing().returning();
      if (!lock) fail("CONTROL_ALREADY_ACQUIRED", "Another auction controller currently has control.");
      await event(tx, auctionId, "CONTROL_ACQUIRED", userId, { controllerUserId: userId });
      return lock;
    });
  } catch (error) { if (error instanceof AuctionError) throw error; throw new AuctionError("CONTROL_ACQUISITION_FAILED", "Could not acquire auction control."); }
}

export async function releaseControl(auctionId: string, userId: string) {
  return getDb().transaction(async (tx) => {
    await controller(tx, auctionId, userId);
    await tx.delete(auctionControls).where(and(eq(auctionControls.auctionId, auctionId), eq(auctionControls.controllerUserId, userId)));
    return event(tx, auctionId, "CONTROL_RELEASED", userId, { controllerUserId: userId });
  });
}

export async function startAuction(auctionId: string, userId: string) {
  return getDb().transaction(async (tx) => {
    await controller(tx, auctionId, userId);
    const [auctionRow] = await tx.select({ auction: auctions, numberOfTeams: tournaments.numberOfTeams, scheduledAt: tournaments.scheduledAt }).from(auctions).innerJoin(tournaments, eq(tournaments.id, auctions.tournamentId)).where(eq(auctions.id, auctionId)).for("update");
    const auction = auctionRow?.auction ? { ...auctionRow.auction, numberOfTeams: auctionRow.numberOfTeams, scheduledAt: auctionRow.scheduledAt } : undefined;
    if (!auction) fail("AUCTION_NOT_FOUND", "Auction not found.", 404);
    if (!["DRAFT", "CONFIGURED", "SCHEDULED"].includes(auction.status)) fail("AUCTION_ALREADY_STARTED", "This auction has already started.");
    if (auction.scheduledAt && auction.scheduledAt.getTime() > Date.now()) fail("AUCTION_SCHEDULED", "This auction is scheduled to start later.", 409);
    const teamRows = await tx.select().from(teams).where(eq(teams.tournamentId, auction.tournamentId)).for("update");
    if (!teamRows.length) fail("TEAMS_REQUIRED", "Add at least one team before starting the auction.", 400);
    if (auction.numberOfTeams && teamRows.length !== auction.numberOfTeams) fail("TEAM_COUNT_MISMATCH", `Add exactly ${auction.numberOfTeams} teams before starting the auction.`, 400);
    if (teamRows.some((team) => !team.captainId)) fail("CAPTAINS_REQUIRED", "Every team needs a captain before the auction starts.", 400);
    const playerRows = await tx.select({ id: players.id, role: players.role, tierId: players.tierId, createdAt: players.createdAt }).from(players).where(eq(players.tournamentId, auction.tournamentId)).orderBy(asc(players.createdAt));
    if (!playerRows.length) fail("PLAYERS_REQUIRED", "Add at least one player before starting the auction.", 400);
    const orderedPlayers = [...playerRows];
    if (auction.orderingStrategy === "random") for (let index = orderedPlayers.length - 1; index > 0; index -= 1) { const swapIndex = randomInt(index + 1); [orderedPlayers[index], orderedPlayers[swapIndex]] = [orderedPlayers[swapIndex], orderedPlayers[index]]; }
    if (auction.orderingStrategy === "role") orderedPlayers.sort((a, b) => a.role.localeCompare(b.role) || a.createdAt.getTime() - b.createdAt.getTime());
    if (auction.orderingStrategy === "tier") orderedPlayers.sort((a, b) => (a.tierId ?? "").localeCompare(b.tierId ?? "") || a.createdAt.getTime() - b.createdAt.getTime());
    await tx.insert(auctionPlayers).values(orderedPlayers.map((player, index) => ({ auctionId, playerId: player.id, orderIndex: index, status: index === 0 ? "CURRENT" as const : "PENDING" as const })));
    await tx.update(teams).set({ spentPurse: 0, remainingPurse: auction.pursePerTeam, squadCount: 0 }).where(eq(teams.tournamentId, auction.tournamentId));
    await tx.update(players).set({ status: "PENDING" }).where(eq(players.tournamentId, auction.tournamentId));
    await tx.update(players).set({ status: "CURRENT" }).where(eq(players.id, orderedPlayers[0].id));
    await tx.update(auctions).set({ status: "LIVE", configurationLocked: true, currentPlayerId: orderedPlayers[0].id, currentBid: auction.basePrice, highestBidderTeamId: null, bidCount: 0, timerEndsAt: null, timerRemainingSeconds: null }).where(eq(auctions.id, auctionId));
    const created = await event(tx, auctionId, "AUCTION_STARTED", userId, { currentPlayerId: orderedPlayers[0].id, orderingStrategy: auction.orderingStrategy });
    return { event: created, snapshot: await snapshotInTransaction(tx, auctionId) };
  });
}

export async function placeBid(auctionId: string, userId: string, increment: number) {
  return getDb().transaction(async (tx) => {
    const [auction] = await tx.select().from(auctions).where(eq(auctions.id, auctionId)).for("update");
    if (!auction) fail("AUCTION_NOT_FOUND", "Auction not found.", 404);
    if (auction.status !== "LIVE") fail("AUCTION_NOT_ACTIVE", "This auction is not accepting bids.");
    if (auction.timerEndsAt && auction.timerEndsAt.getTime() <= Date.now()) fail("TIMER_EXPIRED", "The bidding timer has expired. The controller must settle this player.");
    if (!auction.currentPlayerId) fail("PLAYER_NOT_CURRENT", "There is no player currently being auctioned.");
    if (![auction.incrementOne, auction.incrementTwo, auction.incrementThree].includes(increment)) fail("INVALID_BID_INCREMENT", "Choose one of the configured bid increments.", 400);
    const [team] = await tx.select({ team: teams }).from(teams).innerJoin(tournaments, eq(tournaments.id, teams.tournamentId)).where(and(eq(tournaments.id, auction.tournamentId), eq(teams.captainId, userId))).for("update");
    if (!team) fail("NOT_CAPTAIN", "Only an assigned team captain can bid.", 403);
    if (team.team.squadCount >= auction.squadSize) fail("SQUAD_FULL", "Your team has reached its squad limit.");
    const amount = auction.currentBid + increment;
    if (team.team.remainingPurse < amount) fail("INSUFFICIENT_PURSE", "Your team cannot afford that bid.");
    await tx.update(auctions).set({ currentBid: amount, highestBidderTeamId: team.team.id, bidCount: auction.bidCount + 1, timerEndsAt: auction.timerEnabled && !auction.timerEndsAt && auction.timerDurationSeconds ? new Date(Date.now() + auction.timerDurationSeconds * 1000) : auction.timerEndsAt, timerRemainingSeconds: null }).where(eq(auctions.id, auctionId));
    await tx.insert(bids).values({ auctionId, playerId: auction.currentPlayerId, teamId: team.team.id, captainId: userId, amount, increment });
    const created = await event(tx, auctionId, "BID_PLACED", userId, { playerId: auction.currentPlayerId, teamId: team.team.id, amount, increment });
    return { event: created, snapshot: await snapshotInTransaction(tx, auctionId) };
  });
}

export async function settlePlayer(auctionId: string, userId: string, outcome: "SOLD" | "UNSOLD") {
  return getDb().transaction(async (tx) => {
    await controller(tx, auctionId, userId);
    const [auction] = await tx.select().from(auctions).where(eq(auctions.id, auctionId)).for("update");
    if (!auction || auction.status !== "LIVE") fail("AUCTION_NOT_ACTIVE", "This auction is not active.");
    if (!auction.currentPlayerId) fail("PLAYER_NOT_CURRENT", "There is no current player.");
    if (outcome === "SOLD" && !auction.highestBidderTeamId) fail("NO_BID", "A player without a bid cannot be sold.");
    const [auctionPlayer] = await tx.select().from(auctionPlayers).where(and(eq(auctionPlayers.auctionId, auctionId), eq(auctionPlayers.playerId, auction.currentPlayerId))).for("update");
    if (!auctionPlayer) fail("PLAYER_NOT_CURRENT", "Current player is not in this auction.");
    if (outcome === "SOLD") {
      const [team] = await tx.select().from(teams).where(eq(teams.id, auction.highestBidderTeamId!)).for("update");
      if (!team) fail("TEAM_NOT_FOUND", "Winning team not found.", 404);
      if (team.squadCount >= auction.squadSize) fail("SQUAD_FULL", "Winning team has reached its squad limit.");
      await tx.update(teams).set({ spentPurse: team.spentPurse + auction.currentBid, remainingPurse: team.remainingPurse - auction.currentBid, squadCount: team.squadCount + 1 }).where(eq(teams.id, team.id));
      await tx.update(auctionPlayers).set({ status: "SOLD", soldToTeamId: team.id, salePrice: auction.currentBid }).where(eq(auctionPlayers.id, auctionPlayer.id));
      await tx.update(players).set({ status: "SOLD" }).where(eq(players.id, auction.currentPlayerId));
    } else {
      await tx.update(auctionPlayers).set({ status: "UNSOLD" }).where(eq(auctionPlayers.id, auctionPlayer.id));
      await tx.update(players).set({ status: "UNSOLD" }).where(eq(players.id, auction.currentPlayerId));
    }
    await tx.update(auctions).set({ currentPlayerId: null, currentBid: 0, highestBidderTeamId: null, bidCount: 0, timerEndsAt: null, timerRemainingSeconds: null }).where(eq(auctions.id, auctionId));
    const salePrice = outcome === "SOLD" ? auction.currentBid : null;
    const created = await event(tx, auctionId, `PLAYER_${outcome}`, userId, { playerId: auction.currentPlayerId, teamId: auction.highestBidderTeamId, amount: salePrice, salePrice });
    return { event: created, snapshot: await snapshotInTransaction(tx, auctionId) };
  });
}

export async function nextPlayer(auctionId: string, userId: string) {
  return getDb().transaction(async (tx) => {
    await controller(tx, auctionId, userId);
    const [auction] = await tx.select().from(auctions).where(eq(auctions.id, auctionId)).for("update");
    if (!auction || auction.status !== "LIVE") fail("AUCTION_NOT_ACTIVE", "This auction is not active.");
    if (auction.currentPlayerId) fail("CURRENT_PLAYER_UNSETTLED", "Settle the current player before selecting the next one.");
    const [next] = await tx.select().from(auctionPlayers).where(and(eq(auctionPlayers.auctionId, auctionId), eq(auctionPlayers.status, "PENDING"))).orderBy(asc(auctionPlayers.orderIndex)).limit(1);
    if (!next) {
      await tx.update(auctions).set({ status: "COMPLETED" }).where(eq(auctions.id, auctionId));
      const created = await event(tx, auctionId, "AUCTION_COMPLETED", userId, {});
      return { event: created, snapshot: await snapshotInTransaction(tx, auctionId) };
    }
    await tx.update(auctions).set({ currentPlayerId: next.playerId, currentBid: auction.basePrice, highestBidderTeamId: null, bidCount: 0, timerEndsAt: null, timerRemainingSeconds: null }).where(eq(auctions.id, auctionId));
    await tx.update(auctionPlayers).set({ status: "CURRENT" }).where(eq(auctionPlayers.id, next.id));
    await tx.update(players).set({ status: "CURRENT" }).where(eq(players.id, next.playerId));
    const created = await event(tx, auctionId, "PLAYER_INTRODUCED", userId, { playerId: next.playerId });
    return { event: created, snapshot: await snapshotInTransaction(tx, auctionId) };
  });
}

export async function pauseOrResume(auctionId: string, userId: string, action: "pause" | "resume") {
  return getDb().transaction(async (tx) => {
    await controller(tx, auctionId, userId);
    const [auction] = await tx.select().from(auctions).where(eq(auctions.id, auctionId)).for("update");
    if (!auction) fail("AUCTION_NOT_FOUND", "Auction not found.", 404);
    if (action === "pause" && auction.status !== "LIVE") fail("AUCTION_NOT_ACTIVE", "Only a live auction can be paused.");
    if (action === "resume" && auction.status !== "PAUSED") fail("AUCTION_NOT_PAUSED", "This auction is not paused.");
    const remaining = action === "pause" && auction.timerEndsAt ? Math.max(0, Math.ceil((auction.timerEndsAt.getTime() - Date.now()) / 1000)) : auction.timerRemainingSeconds;
    const timerEndsAt = action === "resume" && auction.timerEnabled && remaining ? new Date(Date.now() + remaining * 1000) : null;
    await tx.update(auctions).set({ status: action === "pause" ? "PAUSED" : "LIVE", timerEndsAt, timerRemainingSeconds: action === "pause" ? remaining : null }).where(eq(auctions.id, auctionId));
    const created = await event(tx, auctionId, action === "pause" ? "AUCTION_PAUSED" : "AUCTION_RESUMED", userId, {});
    return { event: created, snapshot: await snapshotInTransaction(tx, auctionId) };
  });
}

export async function reauctionPlayer(auctionId: string, userId: string, playerId: string) {
  return getDb().transaction(async (tx) => {
    await controller(tx, auctionId, userId);
    const [auction] = await tx.select().from(auctions).where(eq(auctions.id, auctionId)).for("update");
    if (!auction || auction.status !== "LIVE") fail("AUCTION_NOT_ACTIVE", "This auction is not active.");
    if (auction.currentPlayerId) fail("CURRENT_PLAYER_UNSETTLED", "Settle the current player before re-auctioning another player.");
    const [player] = await tx.select().from(auctionPlayers).where(and(eq(auctionPlayers.auctionId, auctionId), eq(auctionPlayers.playerId, playerId))).for("update");
    if (!player || player.status !== "UNSOLD") fail("PLAYER_NOT_UNSOLD", "Only an unsold player can be re-auctioned.");
    await tx.update(auctionPlayers).set({ status: "CURRENT", soldToTeamId: null, salePrice: null }).where(eq(auctionPlayers.id, player.id));
    await tx.update(players).set({ status: "CURRENT" }).where(eq(players.id, playerId));
    await tx.update(auctions).set({ currentPlayerId: playerId, currentBid: auction.basePrice, highestBidderTeamId: null, bidCount: 0, timerEndsAt: null, timerRemainingSeconds: null }).where(eq(auctions.id, auctionId));
    const created = await event(tx, auctionId, "PLAYER_REAUCTIONED", userId, { playerId, basePrice: auction.basePrice });
    return { event: created, snapshot: await snapshotInTransaction(tx, auctionId) };
  });
}

export async function undoLastBid(auctionId: string, userId: string) {
  return getDb().transaction(async (tx) => {
    await controller(tx, auctionId, userId);
    const [auction] = await tx.select().from(auctions).where(eq(auctions.id, auctionId)).for("update");
    if (!auction || auction.status !== "LIVE" || !auction.currentPlayerId) fail("UNDO_NOT_AVAILABLE", "Undo is only available for the current live player.");
    const bidHistory = await tx.select().from(bids).where(and(eq(bids.auctionId, auctionId), eq(bids.playerId, auction.currentPlayerId))).orderBy(desc(bids.createdAt)).limit(2).for("update");
    const [lastBid, previousBid] = bidHistory;
    if (!lastBid) fail("UNDO_NOT_AVAILABLE", "There is no bid to undo.");
    await tx.delete(bids).where(eq(bids.id, lastBid.id));
    const replacement = previousBid ? { currentBid: previousBid.amount, highestBidderTeamId: previousBid.teamId, bidCount: Math.max(0, auction.bidCount - 1) } : { currentBid: auction.basePrice, highestBidderTeamId: null, bidCount: 0 };
    await tx.update(auctions).set({ ...replacement, timerEndsAt: null, timerRemainingSeconds: null }).where(eq(auctions.id, auctionId));
    const created = await event(tx, auctionId, "AUCTION_UNDO", userId, { undoneEvent: "BID_PLACED", bidId: lastBid.id, playerId: auction.currentPlayerId, amount: lastBid.amount });
    return { event: created, snapshot: await snapshotInTransaction(tx, auctionId) };
  });
}

async function snapshotInTransaction(tx: any, auctionId: string) {
  const [row] = await tx.select({ auction: auctions, organizerId: tournaments.organizerId, controllerUserId: auctionControls.controllerUserId }).from(auctions).innerJoin(tournaments, eq(tournaments.id, auctions.tournamentId)).leftJoin(auctionControls, eq(auctionControls.auctionId, auctions.id)).where(eq(auctions.id, auctionId));
  if (!row) return null;
  const currentPlayer = row.auction.currentPlayerId ? (await tx.select({ player: players, auctionPlayer: auctionPlayers }).from(players).innerJoin(auctionPlayers, and(eq(auctionPlayers.playerId, players.id), eq(auctionPlayers.auctionId, auctionId))).where(eq(players.id, row.auction.currentPlayerId)).limit(1))[0] : undefined;
  const upcomingPlayers = await tx.select({ player: players, auctionPlayer: auctionPlayers }).from(auctionPlayers).innerJoin(players, eq(players.id, auctionPlayers.playerId)).where(and(eq(auctionPlayers.auctionId, auctionId), eq(auctionPlayers.status, "PENDING"))).orderBy(asc(auctionPlayers.orderIndex)).limit(5);
  const teamRows = await tx.select().from(teams).where(eq(teams.tournamentId, row.auction.tournamentId)).orderBy(asc(teams.name));
  const squadRows = await tx.select({ player: players, auctionPlayer: auctionPlayers }).from(auctionPlayers).innerJoin(players, eq(players.id, auctionPlayers.playerId)).where(and(eq(auctionPlayers.auctionId, auctionId), eq(auctionPlayers.status, "SOLD")));
  const teamsWithSquads = teamRows.map((team: typeof teams.$inferSelect) => ({ ...team, squad: squadRows.filter(({ auctionPlayer }: { auctionPlayer: typeof auctionPlayers.$inferSelect }) => auctionPlayer.soldToTeamId === team.id).map(({ player, auctionPlayer }: { player: typeof players.$inferSelect; auctionPlayer: typeof auctionPlayers.$inferSelect }) => ({ ...player, purchasePrice: auctionPlayer.salePrice })) }));
  return { auction: { ...row.auction, organizerId: row.organizerId, controllerUserId: row.controllerUserId }, currentPlayer, upcomingPlayers, teams: teamsWithSquads };
}

export async function expireTimer(auctionId: string) {
  return getDb().transaction(async (tx) => {
    const [auction] = await tx.select().from(auctions).where(eq(auctions.id, auctionId)).for("update");
    if (!auction || auction.status !== "LIVE" || !auction.currentPlayerId || !auction.timerEndsAt || auction.timerEndsAt.getTime() > Date.now()) return false;
    const [auctionPlayer] = await tx.select({ id: auctionPlayers.id }).from(auctionPlayers).where(and(eq(auctionPlayers.auctionId, auctionId), eq(auctionPlayers.playerId, auction.currentPlayerId))).limit(1).for("update");
    if (!auctionPlayer) return false;
    await tx.update(auctionPlayers).set({ status: "UNSOLD" }).where(eq(auctionPlayers.id, auctionPlayer.id));
    await tx.update(players).set({ status: "UNSOLD" }).where(eq(players.id, auction.currentPlayerId));
    await tx.update(auctions).set({ currentPlayerId: null, currentBid: 0, highestBidderTeamId: null, bidCount: 0, timerEndsAt: null, timerRemainingSeconds: null }).where(eq(auctions.id, auctionId));
    await event(tx, auctionId, "PLAYER_UNSOLD", null, { playerId: auction.currentPlayerId, timerExpired: true });
    return true;
  });
}

export async function snapshot(auctionId: string) {
  // ponytail: expiry is best-effort for a read; the mutation sweep remains authoritative.
  await expireTimer(auctionId).catch(() => false);
  return snapshotInTransaction(getHttpDb(), auctionId);
}
