import { asc, eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDb, getHttpDb } from "./db/client.ts";
import { auctionEvents, auctionPlayers, auctions, auctioneers, players, teams, tiers, tournaments, users } from "./db/schema.ts";

export class ResultsError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}

export async function results(auctionId: string) {
  const db = getHttpDb();
  const [source] = await db.select({ auction: auctions, tournament: tournaments }).from(auctions).innerJoin(tournaments, eq(tournaments.id, auctions.tournamentId)).where(eq(auctions.id, auctionId)).limit(1);
  if (!source) return null;
  const teamRows = await db.select({ team: teams, captainName: users.displayName }).from(teams).leftJoin(users, eq(users.id, teams.captainId)).where(eq(teams.tournamentId, source.tournament.id)).orderBy(asc(teams.name));
  const playerRows = await db.select({ auctionPlayer: auctionPlayers, player: players }).from(auctionPlayers).innerJoin(players, eq(players.id, auctionPlayers.playerId)).where(eq(auctionPlayers.auctionId, auctionId)).orderBy(asc(auctionPlayers.orderIndex));
  const squads = teamRows.map(({ team, captainName }) => ({ team: { ...team, captainName }, players: playerRows.filter(({ auctionPlayer }) => auctionPlayer.soldToTeamId === team.id).map(({ auctionPlayer, player }) => ({ ...player, purchasePrice: auctionPlayer.salePrice })) }));
  const sold = playerRows.filter(({ auctionPlayer }) => auctionPlayer.status === "SOLD");
  const totalSpent = squads.reduce((sum, squad) => sum + squad.team.spentPurse, 0);
  const highest = sold.reduce<{ name: string; price: number } | null>((current, row) => row.auctionPlayer.salePrice && (!current || row.auctionPlayer.salePrice > current.price) ? { name: row.player.name, price: row.auctionPlayer.salePrice } : current, null);
  return { tournament: source.tournament, auction: source.auction, teams: squads, summary: { totalPlayers: playerRows.length, soldPlayers: sold.length, unsoldPlayers: playerRows.filter(({ auctionPlayer }) => auctionPlayer.status === "UNSOLD").length, totalSpent, highestPurchase: highest, averagePurchase: sold.length ? Math.round(totalSpent / sold.length) : 0 } };
}

export async function history(auctionId: string) {
  return getHttpDb().select().from(auctionEvents).where(eq(auctionEvents.auctionId, auctionId)).orderBy(asc(auctionEvents.sequenceNumber));
}

export async function duplicateAuction(auctionId: string, userId: string) {
  const db = getDb();
  const [source] = await db.select({ auction: auctions, tournament: tournaments }).from(auctions).innerJoin(tournaments, eq(tournaments.id, auctions.tournamentId)).where(eq(auctions.id, auctionId)).limit(1);
  if (!source) return null;
  if (source.tournament.organizerId !== userId) throw new ResultsError("FORBIDDEN", "Only the organizer can duplicate this auction.", 403);
  return db.transaction(async (tx) => {
    const newTournamentName = `${source.tournament.name} Copy`;
    const newSlug = `${source.tournament.slug}-copy-${crypto.randomUUID().slice(0, 6)}`;
    const [tournament] = await tx.insert(tournaments).values({ organizerId: userId, name: newTournamentName, slug: newSlug, description: source.tournament.description, timezone: source.tournament.timezone, numberOfTeams: source.tournament.numberOfTeams, scheduledAt: null }).returning();
    const [auction] = await tx.insert(auctions).values({ tournamentId: tournament.id, squadSize: source.auction.squadSize, pursePerTeam: source.auction.pursePerTeam, basePrice: source.auction.basePrice, incrementOne: source.auction.incrementOne, incrementTwo: source.auction.incrementTwo, incrementThree: source.auction.incrementThree, timerEnabled: source.auction.timerEnabled, timerDurationSeconds: source.auction.timerDurationSeconds, tierSystemEnabled: source.auction.tierSystemEnabled, orderingStrategy: source.auction.orderingStrategy }).returning();
    const tierMap = new Map<string, string>();
    for (const tier of await tx.select().from(tiers).where(eq(tiers.tournamentId, source.tournament.id))) {
      const [copy] = await tx.insert(tiers).values({ tournamentId: tournament.id, name: tier.name, description: tier.description, displayOrder: tier.displayOrder }).returning({ id: tiers.id });
      tierMap.set(tier.id, copy.id);
    }
    for (const player of await tx.select().from(players).where(eq(players.tournamentId, source.tournament.id))) {
      await tx.insert(players).values({ tournamentId: tournament.id, tierId: player.tierId ? tierMap.get(player.tierId) ?? null : null, name: player.name, role: player.role, photo: player.photo, age: player.age, battingStyle: player.battingStyle, bowlingStyle: player.bowlingStyle, isForeign: player.isForeign, bio: player.bio, stats: player.stats });
    }
    for (const team of await tx.select().from(teams).where(eq(teams.tournamentId, source.tournament.id))) {
      await tx.insert(teams).values({ tournamentId: tournament.id, captainId: team.captainId, name: team.name, logo: team.logo, logoConfig: team.logoConfig });
    }
    for (const auctioneer of await tx.select().from(auctioneers).where(eq(auctioneers.auctionId, auctionId))) await tx.insert(auctioneers).values({ auctionId: auction.id, userId: auctioneer.userId });
    return { tournament, auction };
  });
}

function formatMoney(value: number) { return `INR ${new Intl.NumberFormat("en-IN").format(value)}`; }

export type ResultsReport = NonNullable<Awaited<ReturnType<typeof results>>>;

export async function buildResultsPdf(report: ResultsReport) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const blue = rgb(0, 0.6, 1); const dark = rgb(0.03, 0.07, 0.12); const muted = rgb(0.35, 0.43, 0.53);
  let page = document.addPage([595, 842]); let y = 790;
  const newPage = () => { page = document.addPage([595, 842]); y = 790; };
  const text = (value: string, x: number, size: number, font = regular, color = dark) => page.drawText(value, { x, y, size, font, color });
  text(report.tournament.name, 42, 25, bold, dark); y -= 28; text("Cricket Auction Results", 42, 12, regular, muted); y -= 28; text(`Status: ${report.auction.status}`, 42, 10, regular, muted); text(`Players: ${report.summary.soldPlayers}/${report.summary.totalPlayers} sold`, 300, 10, regular, muted); y -= 30; page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, thickness: 2, color: blue }); y -= 28;
  text("AUCTION SUMMARY", 42, 10, bold, blue); y -= 18; text(`Total spent  ${formatMoney(report.summary.totalSpent)}`, 42, 12, regular, dark); text(`Highest purchase  ${report.summary.highestPurchase ? `${report.summary.highestPurchase.name} · ${formatMoney(report.summary.highestPurchase.price)}` : "-"}`, 300, 12, regular, dark); y -= 18; text(`Average purchase  ${formatMoney(report.summary.averagePurchase)}`, 42, 11, regular, muted); text(`Unsold  ${report.summary.unsoldPlayers}`, 300, 11, regular, muted); y -= 32;
  for (const squad of report.teams) {
    if (y < 150) newPage();
    page.drawRectangle({ x: 42, y: y - 8, width: 511, height: 44, color: rgb(0.93, 0.96, 0.98) }); const headerY = y; text(squad.team.name, 56, 15, bold, dark); text(`${formatMoney(squad.team.spentPurse)} spent · ${formatMoney(squad.team.remainingPurse)} left`, 330, 10, regular, dark); y -= 16; text(`Captain: ${squad.team.captainName ?? "Unassigned"}`, 56, 9, regular, muted); y = headerY - 58;
    if (!squad.players.length) { text("No players purchased", 56, 10, regular, muted); y -= 22; continue; }
    text("PLAYER", 56, 9, bold, muted); text("ROLE", 330, 9, bold, muted); text("PRICE", 470, 9, bold, muted); y -= 18;
    for (const player of squad.players) { if (y < 50) { newPage(); } text(player.name, 56, 10, regular, dark); text(player.role, 330, 10, regular, muted); text(player.purchasePrice ? formatMoney(player.purchasePrice) : "-", 470, 10, regular, dark); y -= 18; }
    y -= 18;
  }
  const bytes = await document.save();
  return Buffer.from(bytes);
}

export async function resultsPdf(auctionId: string) {
  const report = await results(auctionId);
  return report ? buildResultsPdf(report) : null;
}
