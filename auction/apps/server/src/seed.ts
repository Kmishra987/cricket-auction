import { eq } from "drizzle-orm";
import { hashPassword } from "./auth.ts";
import { getDb } from "./db/client.ts";
import { auctions, players, teams, tiers, tournaments, users } from "./db/schema.ts";

const db = getDb();

async function seed() {
  const existing = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.slug, "demo-premier-league")).limit(1);
  if (existing.length) { console.log("Demo data already exists."); return; }
  const passwordHash = await hashPassword("demo-password-123");
  await db.transaction(async (tx) => {
    await tx.insert(users).values([
      { username: "demo-organizer", email: "organizer@demo.auction", displayName: "Demo Organizer", passwordHash },
      { username: "demo-captain-a", email: "captain-a@demo.auction", displayName: "Aarav Captain", passwordHash },
      { username: "demo-captain-b", email: "captain-b@demo.auction", displayName: "Mira Captain", passwordHash },
    ]).onConflictDoNothing();
    const [organizer] = await tx.select({ id: users.id }).from(users).where(eq(users.username, "demo-organizer"));
    const [captainA] = await tx.select({ id: users.id }).from(users).where(eq(users.username, "demo-captain-a"));
    const [captainB] = await tx.select({ id: users.id }).from(users).where(eq(users.username, "demo-captain-b"));
    if (!organizer || !captainA || !captainB) throw new Error("Could not create demo users.");
    const [tournament] = await tx.insert(tournaments).values({ organizerId: organizer.id, name: "Demo Premier League", slug: "demo-premier-league", description: "A ready-to-run auction room.", timezone: "Asia/Kolkata", numberOfTeams: 2 }).returning();
    const [auction] = await tx.insert(auctions).values({ tournamentId: tournament.id, squadSize: 5, pursePerTeam: 10000000, basePrice: 500000, incrementOne: 500000, incrementTwo: 200000, incrementThree: 100000, orderingStrategy: "sequential" }).returning();
    const [tier] = await tx.insert(tiers).values({ tournamentId: tournament.id, name: "Marquee", description: "The first names on the board.", displayOrder: 1 }).returning();
    const logo = (color: string, icon: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="20" fill="${color}"/><text x="40" y="52" text-anchor="middle" font-size="34">${icon}</text></svg>`;
    await tx.insert(teams).values([
      { tournamentId: tournament.id, captainId: captainA.id, name: "Blue Strikers", logo: logo("#0099FF", "⚡"), logoConfig: { icon: "⚡", primaryColor: "#0099FF", secondaryColor: "#005A9C", shape: "rounded" } },
      { tournamentId: tournament.id, captainId: captainB.id, name: "Gold Titans", logo: logo("#F6B73C", "★"), logoConfig: { icon: "★", primaryColor: "#F6B73C", secondaryColor: "#A66500", shape: "rounded" } },
    ]);
    await tx.insert(players).values([
      { tournamentId: tournament.id, tierId: tier.id, name: "Rohan Mehta", role: "Batter", age: 26, isForeign: false, bio: "Explosive top-order batter.", stats: { matches: 42, runs: 1640 } },
      { tournamentId: tournament.id, tierId: tier.id, name: "Kabir Khan", role: "Bowler", age: 29, isForeign: false, bio: "Fast bowler with late movement.", stats: { matches: 38, wickets: 61 } },
      { tournamentId: tournament.id, name: "Theo James", role: "All-rounder", age: 27, isForeign: true, bio: "Reliable finisher and seam option.", stats: { matches: 51, runs: 1280, wickets: 34 } },
    ]);
    console.log(`Seeded ${tournament.name} (${auction.id}). Demo password: demo-password-123`);
  });
}

seed().catch((error) => { console.error(error); process.exitCode = 1; });
