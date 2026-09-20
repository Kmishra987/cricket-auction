import { and, eq, or } from "drizzle-orm";
import { AuctionError, acquireControl, nextPlayer, pauseOrResume, placeBid, reauctionPlayer, releaseControl, settlePlayer, snapshot, startAuction, undoLastBid } from "./auction-engine.ts";
import { createSession, currentUser, destroySession, hashPassword, sessionCookieHeader, clearSessionCookie, verifyPassword } from "./auth.ts";
import { getDb } from "./db/client.ts";
import { getHttpDb } from "./db/client.ts";
import { auctionControls, auctioneers, auctions, players, teams, tiers, tournaments, users } from "./db/schema.ts";
import { broadcast } from "./realtime.ts";
import { duplicateAuction, history, ResultsError, results, resultsPdf } from "./results.ts";

type RouteContext = { headers: HeadersInit };

export function json(data: unknown, status = 200, context?: RouteContext, extra?: Record<string, string>) {
  return Response.json(data, { status, headers: { ...context?.headers, ...extra } });
}

export function domainError(status: number, code: string, message: string, context?: RouteContext) {
  return json({ error: { code, message } }, status, context);
}

async function body(request: Request) {
  try {
    const value = await request.json();
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || `auction-${crypto.randomUUID().slice(0, 8)}`;
}

function validPositiveInteger(value: unknown, min = 1) {
  return typeof value === "number" && Number.isInteger(value) && value >= min;
}

function positiveIntegerValue(value: unknown, fallback: number) {
  const number = value === undefined ? fallback : typeof value === "number" ? value : Number(value);
  return validPositiveInteger(number) ? number : null;
}

const roles = new Set(["Batter", "Bowler", "All-rounder", "Wicketkeeper"]);
const playerKeys = new Set(["name", "photo", "age", "role", "battingStyle", "batting_style", "bowlingStyle", "bowling_style", "isForeign", "foreign", "bio", "stats", "tierId", "tier_id"]);
// ponytail: process-local throttle; use a shared limiter only when running multiple API instances.
const bidThrottle = new Map<string, number>();

export function bidAllowed(key: string) {
  const now = Date.now();
  const previous = bidThrottle.get(key) ?? 0;
  if (now - previous < 250) return false;
  bidThrottle.set(key, now);
  if (bidThrottle.size > 10_000) for (const [entry, timestamp] of bidThrottle) if (now - timestamp > 60_000) bidThrottle.delete(entry);
  return true;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeStats(value: unknown) {
  if (value === undefined) return { stats: null as Record<string, number> | null, errors: [] as string[] };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { stats: null, errors: ["Stats must be an object of numeric values."] };
  const stats: Record<string, number> = {};
  const errors: string[] = [];
  for (const [key, stat] of Object.entries(value)) {
    if (typeof stat !== "number" || !Number.isFinite(stat)) errors.push(`Stats.${key} must be a finite number.`);
    else stats[key] = stat;
  }
  return { stats, errors };
}

export function normalizePlayer(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { data: null, errors: ["Each player must be an object."], warnings: [] as string[] };
  const value = input as Record<string, unknown>;
  const errors: string[] = [];
  const warnings = Object.keys(value).filter((key) => !playerKeys.has(key)).map((key) => `Unknown field "${key}" was ignored.`);
  const name = stringValue(value.name);
  const role = stringValue(value.role);
  if (name.length < 2 || name.length > 120) errors.push("Name must be 2–120 characters.");
  if (!roles.has(role)) errors.push("Role must be Batter, Bowler, All-rounder, or Wicketkeeper.");
  const age = value.age === undefined || value.age === null || value.age === "" ? null : positiveIntegerValue(value.age, 0);
  if (value.age !== undefined && age === null) errors.push("Age must be a positive whole number.");
  const foreignValue = value.isForeign ?? value.foreign ?? false;
  if (typeof foreignValue !== "boolean") errors.push("Foreign must be true or false.");
  const tierIdValue = value.tierId ?? value.tier_id ?? null;
  if (tierIdValue !== null && !isUuid(tierIdValue)) errors.push("Tier ID must be a valid UUID.");
  const statsResult = normalizeStats(value.stats);
  errors.push(...statsResult.errors);
  const data = {
    name,
    role,
    photo: stringValue(value.photo) || null,
    age,
    battingStyle: stringValue(value.battingStyle ?? value.batting_style) || null,
    bowlingStyle: stringValue(value.bowlingStyle ?? value.bowling_style) || null,
    isForeign: foreignValue === true,
    bio: stringValue(value.bio) || null,
    stats: statsResult.stats,
    tierId: tierIdValue as string | null,
  };
  return { data: errors.length ? null : data, errors, warnings };
}

function escapedSvgText(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" })[character] ?? character);
}

function teamLogo(icon: string, primaryColor: string, secondaryColor: string, shape: string) {
  const safeIcon = Array.from(icon || "✦").slice(0, 2).join("");
  const radius = shape === "circle" ? "50%" : shape === "shield" ? "18 18 30 30" : "18";
  const clip = shape === "circle" ? ` rx="50%"` : ` rx="${radius}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${primaryColor}"/><stop offset="1" stop-color="${secondaryColor}"/></linearGradient></defs><rect width="96" height="96" fill="url(#g)"${clip}/><text x="48" y="59" text-anchor="middle" font-size="38">${escapedSvgText(safeIcon)}</text></svg>`;
}

async function ownedTournament(userId: string, tournamentId: string) {
  const [row] = await getDb().select({ id: tournaments.id, locked: auctions.configurationLocked }).from(tournaments).innerJoin(auctions, eq(auctions.tournamentId, tournaments.id)).where(and(eq(tournaments.id, tournamentId), eq(tournaments.organizerId, userId))).limit(1);
  return row ?? null;
}

function colorValue(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function engineError(error: unknown, context: RouteContext) {
  if (error instanceof AuctionError) return domainError(error.status, error.code, error.message, context);
  if (error instanceof ResultsError) return domainError(error.status, error.code, error.message, context);
  return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context);
}

async function requireUser(request: Request, context: RouteContext) {
  try {
    const user = await currentUser(request);
    return user ? { user } : { response: domainError(401, "UNAUTHENTICATED", "Sign in to continue.", context) };
  } catch {
    return { response: domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context) };
  }
}

export async function route(request: Request, context: RouteContext) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "POST" && path === "/api/auth/register") {
    const input = await body(request);
    const username = stringValue(input?.username).toLowerCase();
    const email = stringValue(input?.email).toLowerCase();
    const password = stringValue(input?.password);
    const displayName = stringValue(input?.displayName) || username;
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return domainError(400, "INVALID_USERNAME", "Username must be 3–24 characters using letters, numbers, or underscores.", context);
    if (!validEmail(email)) return domainError(400, "INVALID_EMAIL", "Enter a valid email address.", context);
    if (password.length < 8 || password.length > 128) return domainError(400, "INVALID_PASSWORD", "Password must be 8–128 characters.", context);
    if (displayName.length < 2 || displayName.length > 80) return domainError(400, "INVALID_DISPLAY_NAME", "Display name must be 2–80 characters.", context);
    try {
      const db = getHttpDb();
      const existing = await db.select({ id: users.id }).from(users).where(or(eq(users.username, username), eq(users.email, email))).limit(1);
      if (existing.length) return domainError(409, "ACCOUNT_EXISTS", "That username or email is already in use.", context);
      const [user] = await db.insert(users).values({ username, email, passwordHash: await hashPassword(password), displayName }).returning({ id: users.id, username: users.username, email: users.email, displayName: users.displayName });
      const session = await createSession(user.id);
      return json({ user }, 201, context, { "set-cookie": sessionCookieHeader(session.token, session.expiresAt) });
    } catch {
      return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context);
    }
  }

  if (request.method === "POST" && path === "/api/auth/login") {
    const input = await body(request);
    const identifier = stringValue(input?.identifier).toLowerCase();
    const password = stringValue(input?.password);
    if (!identifier || !password) return domainError(400, "INVALID_CREDENTIALS", "Enter your username or email and password.", context);
    try {
      const [user] = await getHttpDb().select().from(users).where(or(eq(users.username, identifier), eq(users.email, identifier))).limit(1);
      if (!user || !(await verifyPassword(password, user.passwordHash))) return domainError(401, "INVALID_CREDENTIALS", "Those credentials do not match.", context);
      const session = await createSession(user.id);
      return json({ user: { id: user.id, username: user.username, email: user.email, displayName: user.displayName, avatar: user.avatar } }, 200, context, { "set-cookie": sessionCookieHeader(session.token, session.expiresAt) });
    } catch {
      return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context);
    }
  }

  if (request.method === "POST" && path === "/api/auth/logout") {
    try { await destroySession(request); return json({ ok: true }, 200, context, { "set-cookie": clearSessionCookie() }); }
    catch { return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context); }
  }

  if (request.method === "GET" && path === "/api/auth/me") {
    const access = await requireUser(request, context);
    return "response" in access ? access.response : json({ user: access.user }, 200, context);
  }

  if (request.method === "GET" && path === "/api/users") {
    const access = await requireUser(request, context);
    if ("response" in access) return access.response;
    const query = new URL(request.url).searchParams;
    const tournamentId = query.get("tournamentId");
    const search = (query.get("search") ?? "").trim().toLowerCase();
    try {
      if (!tournamentId || !(await ownedTournament(access.user.id, tournamentId))) return domainError(403, "FORBIDDEN", "Only a tournament organizer can search captain accounts.", context);
      const rows = await getDb().select({ id: users.id, username: users.username, displayName: users.displayName, email: users.email }).from(users).orderBy(users.displayName).limit(20);
      return json({ users: search.length < 2 ? rows : rows.filter((user) => `${user.username} ${user.displayName} ${user.email}`.toLowerCase().includes(search)) }, 200, context);
    } catch { return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context); }
  }

  if (request.method === "GET" && path === "/api/tournaments") {
    const access = await requireUser(request, context);
    if ("response" in access) return access.response;
    try {
      const rows = await getDb().select({ id: tournaments.id, name: tournaments.name, slug: tournaments.slug, description: tournaments.description, createdAt: tournaments.createdAt }).from(tournaments).where(eq(tournaments.organizerId, access.user.id)).orderBy(tournaments.createdAt);
      return json({ tournaments: rows }, 200, context);
    } catch { return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context); }
  }

  if (request.method === "POST" && path === "/api/tournaments") {
    const access = await requireUser(request, context);
    if ("response" in access) return access.response;
    const input = await body(request);
    const name = stringValue(input?.name);
    const description = stringValue(input?.description) || null;
    const timezone = stringValue(input?.timezone) || "UTC";
    const scheduledAt = input?.scheduledAt ? new Date(stringValue(input.scheduledAt)) : null;
    const numberOfTeams = positiveIntegerValue(input?.numberOfTeams, 1);
    const squadSize = positiveIntegerValue(input?.squadSize, 11);
    const pursePerTeam = positiveIntegerValue(input?.pursePerTeam, 10000000);
    const basePrice = positiveIntegerValue(input?.basePrice, 500000);
    const incrementOne = positiveIntegerValue(input?.incrementOne, 500000);
    const incrementTwo = positiveIntegerValue(input?.incrementTwo, 200000);
    const incrementThree = positiveIntegerValue(input?.incrementThree, 100000);
    const timerEnabled = input?.timerEnabled === true;
    const timerDurationSeconds = timerEnabled ? positiveIntegerValue(input?.timerDurationSeconds, 1) : null;
    const tierSystemEnabled = input?.tierSystemEnabled === true;
    const orderingStrategy = ["sequential", "random", "tier", "role"].includes(stringValue(input?.orderingStrategy)) ? stringValue(input?.orderingStrategy) : "sequential";
    if (name.length < 3 || name.length > 120) return domainError(400, "INVALID_TOURNAMENT_NAME", "Tournament name must be 3–120 characters.", context);
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) return domainError(400, "INVALID_SCHEDULE", "Scheduled date must be a valid ISO timestamp.", context);
    if (squadSize === null || squadSize > 100 || numberOfTeams === null || pursePerTeam === null || basePrice === null || incrementOne === null || incrementTwo === null || incrementThree === null || (timerEnabled && timerDurationSeconds === null)) return domainError(400, "INVALID_AUCTION_CONFIG", "Team count, squad size, purse, base price, and all increments must be positive whole numbers.", context);
    try {
      const db = getDb();
      const baseSlug = slugify(name);
      const existingSlugs = await db.select({ slug: tournaments.slug }).from(tournaments).where(eq(tournaments.slug, baseSlug));
      const slug = existingSlugs.length ? `${baseSlug}-${crypto.randomUUID().slice(0, 6)}` : baseSlug;
      const result = await db.transaction(async (tx) => {
        const [tournament] = await tx.insert(tournaments).values({ organizerId: access.user.id, name, slug, description, scheduledAt, timezone, numberOfTeams }).returning();
        const status = scheduledAt && scheduledAt.getTime() > Date.now() ? "SCHEDULED" : "DRAFT";
        const [auction] = await tx.insert(auctions).values({ tournamentId: tournament.id, status, squadSize, pursePerTeam, basePrice, incrementOne, incrementTwo, incrementThree, timerEnabled, timerDurationSeconds, tierSystemEnabled, orderingStrategy }).returning();
        return { tournament, auction };
      });
      return json(result, 201, context);
    } catch { return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context); }
  }

  const tournamentConfigMatch = path.match(/^\/api\/tournaments\/([^/]+)$/);
  if (tournamentConfigMatch && ["GET", "PATCH"].includes(request.method)) {
    const tournamentId = tournamentConfigMatch[1];
    const access = await requireUser(request, context);
    if ("response" in access) return access.response;
    try {
      const [row] = await getDb().select({ tournament: tournaments, auction: auctions }).from(tournaments).innerJoin(auctions, eq(auctions.tournamentId, tournaments.id)).where(and(eq(tournaments.id, tournamentId), eq(tournaments.organizerId, access.user.id))).limit(1);
      if (!row) return domainError(404, "TOURNAMENT_NOT_FOUND", "Tournament not found.", context);
      if (request.method === "GET") return json(row, 200, context);
      if (row.auction.configurationLocked) return domainError(409, "CONFIGURATION_LOCKED", "Tournament configuration cannot change after the auction starts.", context);
      const input = await body(request);
      const name = input?.name === undefined ? row.tournament.name : stringValue(input.name);
      const description = input?.description === undefined ? row.tournament.description : stringValue(input.description) || null;
      const numberOfTeams = input?.numberOfTeams === undefined ? row.tournament.numberOfTeams : positiveIntegerValue(input.numberOfTeams, 1);
      const squadSize = input?.squadSize === undefined ? row.auction.squadSize : positiveIntegerValue(input.squadSize, 1);
      const pursePerTeam = input?.pursePerTeam === undefined ? row.auction.pursePerTeam : positiveIntegerValue(input.pursePerTeam, 1);
      const basePrice = input?.basePrice === undefined ? row.auction.basePrice : positiveIntegerValue(input.basePrice, 1);
      const incrementOne = input?.incrementOne === undefined ? row.auction.incrementOne : positiveIntegerValue(input.incrementOne, 1);
      const incrementTwo = input?.incrementTwo === undefined ? row.auction.incrementTwo : positiveIntegerValue(input.incrementTwo, 1);
      const incrementThree = input?.incrementThree === undefined ? row.auction.incrementThree : positiveIntegerValue(input.incrementThree, 1);
      const timerEnabled = input?.timerEnabled === undefined ? row.auction.timerEnabled : input.timerEnabled === true;
      const timerDurationSeconds = timerEnabled ? (input?.timerDurationSeconds === undefined ? row.auction.timerDurationSeconds : positiveIntegerValue(input.timerDurationSeconds, 1)) : null;
      const tierSystemEnabled = input?.tierSystemEnabled === undefined ? row.auction.tierSystemEnabled : input.tierSystemEnabled === true;
      const orderingStrategy = input?.orderingStrategy === undefined ? row.auction.orderingStrategy : stringValue(input.orderingStrategy);
      const timezone = input?.timezone === undefined ? row.tournament.timezone : stringValue(input.timezone) || "UTC";
      const scheduledAt = input?.scheduledAt === undefined ? row.tournament.scheduledAt : (input.scheduledAt ? new Date(stringValue(input.scheduledAt)) : null);
      if (name.length < 3 || name.length > 120 || numberOfTeams === null || squadSize === null || squadSize > 100 || pursePerTeam === null || basePrice === null || incrementOne === null || incrementTwo === null || incrementThree === null || (timerEnabled && timerDurationSeconds === null) || !["sequential", "random", "tier", "role"].includes(orderingStrategy) || (scheduledAt && Number.isNaN(scheduledAt.getTime()))) return domainError(400, "INVALID_AUCTION_CONFIG", "One or more tournament settings are invalid.", context);
      const updated = await getDb().transaction(async (tx) => {
        const [tournament] = await tx.update(tournaments).set({ name, description, timezone, scheduledAt, numberOfTeams }).where(eq(tournaments.id, tournamentId)).returning();
        const status = scheduledAt && scheduledAt.getTime() > Date.now() ? "SCHEDULED" : row.auction.status === "SCHEDULED" ? "DRAFT" : row.auction.status;
        const [auction] = await tx.update(auctions).set({ status, squadSize, pursePerTeam, basePrice, incrementOne, incrementTwo, incrementThree, timerEnabled, timerDurationSeconds, tierSystemEnabled, orderingStrategy }).where(eq(auctions.id, row.auction.id)).returning();
        return { tournament, auction };
      });
      return json(updated, 200, context);
    } catch { return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context); }
  }

  const teamsMatch = path.match(/^\/api\/tournaments\/([^/]+)\/teams$/);
  if (teamsMatch) {
    const tournamentId = teamsMatch[1];
    const access = await requireUser(request, context);
    if ("response" in access) return access.response;
    try {
      const tournament = await ownedTournament(access.user.id, tournamentId);
      if (!tournament) return domainError(404, "TOURNAMENT_NOT_FOUND", "Tournament not found.", context);
      if (request.method === "GET") {
        const rows = await getDb().select({ id: teams.id, name: teams.name, logo: teams.logo, logoConfig: teams.logoConfig, captainId: teams.captainId, captainName: users.displayName }).from(teams).leftJoin(users, eq(users.id, teams.captainId)).where(eq(teams.tournamentId, tournamentId)).orderBy(teams.createdAt);
        return json({ teams: rows }, 200, context);
      }
      if (request.method === "POST") {
        if (tournament.locked) return domainError(409, "CONFIGURATION_LOCKED", "Teams cannot be changed after the auction starts.", context);
        const input = await body(request);
        const name = stringValue(input?.name);
        const icon = stringValue(input?.icon) || "✦";
        const primaryColor = colorValue(input?.primaryColor, "#0099FF");
        const secondaryColor = colorValue(input?.secondaryColor, "#005A9C");
        const shape = ["rounded", "circle", "shield"].includes(stringValue(input?.shape)) ? stringValue(input?.shape) : "rounded";
        const captainId = input?.captainId === null || input?.captainId === undefined || input?.captainId === "" ? null : stringValue(input?.captainId);
        if (name.length < 2 || name.length > 60) return domainError(400, "INVALID_TEAM_NAME", "Team name must be 2–60 characters.", context);
        if (captainId && !isUuid(captainId)) return domainError(400, "INVALID_CAPTAIN", "Captain ID must be a valid user ID.", context);
        if (captainId) {
          const [captain] = await getDb().select({ id: users.id }).from(users).where(eq(users.id, captainId)).limit(1);
          if (!captain) return domainError(404, "CAPTAIN_NOT_FOUND", "That captain account was not found.", context);
        }
        const [team] = await getDb().insert(teams).values({ tournamentId, name, captainId, logoConfig: { icon, primaryColor, secondaryColor, shape }, logo: teamLogo(icon, primaryColor, secondaryColor, shape) }).returning();
        return json({ team }, 201, context);
      }
    } catch { return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context); }
  }

  const teamMatch = path.match(/^\/api\/teams\/([^/]+)$/);
  if (teamMatch && request.method === "PATCH") {
    const teamId = teamMatch[1];
    const access = await requireUser(request, context);
    if ("response" in access) return access.response;
    try {
      const [existing] = await getDb().select({ team: teams, tournamentId: tournaments.id, locked: auctions.configurationLocked }).from(teams).innerJoin(tournaments, eq(tournaments.id, teams.tournamentId)).innerJoin(auctions, eq(auctions.tournamentId, tournaments.id)).where(and(eq(teams.id, teamId), eq(tournaments.organizerId, access.user.id))).limit(1);
      if (!existing) return domainError(404, "TEAM_NOT_FOUND", "Team not found.", context);
      if (existing.locked) return domainError(409, "CONFIGURATION_LOCKED", "Teams cannot be changed after the auction starts.", context);
      const input = await body(request);
      const name = input?.name === undefined ? existing.team.name : stringValue(input.name);
      const icon = input?.icon === undefined ? existing.team.logoConfig.icon : stringValue(input.icon) || "✦";
      const primaryColor = colorValue(input?.primaryColor, existing.team.logoConfig.primaryColor);
      const secondaryColor = colorValue(input?.secondaryColor, existing.team.logoConfig.secondaryColor);
      const shape = input?.shape === undefined ? existing.team.logoConfig.shape : ["rounded", "circle", "shield"].includes(stringValue(input.shape)) ? stringValue(input.shape) : "rounded";
      const captainId = input?.captainId === undefined ? existing.team.captainId : input.captainId === null || input.captainId === "" ? null : stringValue(input.captainId);
      if (name.length < 2 || name.length > 60) return domainError(400, "INVALID_TEAM_NAME", "Team name must be 2–60 characters.", context);
      if (captainId && !isUuid(captainId)) return domainError(400, "INVALID_CAPTAIN", "Captain ID must be a valid user ID.", context);
      if (captainId) {
        const [captain] = await getDb().select({ id: users.id }).from(users).where(eq(users.id, captainId)).limit(1);
        if (!captain) return domainError(404, "CAPTAIN_NOT_FOUND", "That captain account was not found.", context);
      }
      const [team] = await getDb().update(teams).set({ name, captainId, logoConfig: { icon, primaryColor, secondaryColor, shape }, logo: teamLogo(icon, primaryColor, secondaryColor, shape) }).where(eq(teams.id, teamId)).returning();
      return json({ team }, 200, context);
    } catch { return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context); }
  }

  const publicAuctionMatch = path.match(/^\/api\/public\/auctions\/([^/]+)$/);
  if (publicAuctionMatch && request.method === "GET") {
    try {
      const [auction] = await getHttpDb().select({ id: auctions.id }).from(auctions).innerJoin(tournaments, eq(tournaments.id, auctions.tournamentId)).where(eq(tournaments.slug, publicAuctionMatch[1])).limit(1);
      if (!auction) return domainError(404, "AUCTION_NOT_FOUND", "Auction not found.", context);
      return json({ snapshot: await snapshot(auction.id) }, 200, context);
    } catch { return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context); }
  }

  const publicResultsMatch = path.match(/^\/api\/public\/auctions\/([^/]+)\/(results|history)$/);
  if (publicResultsMatch && request.method === "GET") {
    try {
      const [auction] = await getHttpDb().select({ id: auctions.id }).from(auctions).innerJoin(tournaments, eq(tournaments.id, auctions.tournamentId)).where(eq(tournaments.slug, publicResultsMatch[1])).limit(1);
      if (!auction) return domainError(404, "AUCTION_NOT_FOUND", "Auction not found.", context);
      return publicResultsMatch[2] === "results" ? json({ results: await results(auction.id) }, 200, context) : json({ events: await history(auction.id) }, 200, context);
    } catch { return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context); }
  }

  const publicPdfMatch = path.match(/^\/api\/public\/auctions\/([^/]+)\/pdf$/);
  if (publicPdfMatch && request.method === "GET") {
    try {
      const [auction] = await getDb().select({ id: auctions.id }).from(auctions).innerJoin(tournaments, eq(tournaments.id, auctions.tournamentId)).where(eq(tournaments.slug, publicPdfMatch[1])).limit(1);
      if (!auction) return domainError(404, "AUCTION_NOT_FOUND", "Auction not found.", context);
      const report = await results(auction.id);
      const pdf = await resultsPdf(auction.id);
      if (!report || !pdf) return domainError(404, "AUCTION_NOT_FOUND", "Auction not found.", context);
      return new Response(pdf, { status: 200, headers: { ...context.headers, "content-type": "application/pdf", "content-disposition": `attachment; filename="${report.tournament.slug}-results.pdf"` } });
    } catch { return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context); }
  }

  const auctioneersMatch = path.match(/^\/api\/auctions\/([^/]+)\/auctioneers$/);
  if (auctioneersMatch && ["GET", "POST"].includes(request.method)) {
    const auctionId = auctioneersMatch[1];
    const access = await requireUser(request, context);
    if ("response" in access) return access.response;
    try {
      const [auction] = await getDb().select({ organizerId: tournaments.organizerId, locked: auctions.configurationLocked }).from(auctions).innerJoin(tournaments, eq(tournaments.id, auctions.tournamentId)).where(eq(auctions.id, auctionId)).limit(1);
      if (!auction) return domainError(404, "AUCTION_NOT_FOUND", "Auction not found.", context);
      if (auction.organizerId !== access.user.id) return domainError(403, "FORBIDDEN", "Only the organizer can manage auctioneers.", context);
      if (request.method === "GET") return json({ auctioneers: await getDb().select({ userId: auctioneers.userId, displayName: users.displayName, username: users.username }).from(auctioneers).innerJoin(users, eq(users.id, auctioneers.userId)).where(eq(auctioneers.auctionId, auctionId)) }, 200, context);
      if (auction.locked) return domainError(409, "CONFIGURATION_LOCKED", "Auctioneers cannot be changed after the auction starts.", context);
      const input = await body(request);
      const userId = stringValue(input?.userId);
      if (!isUuid(userId)) return domainError(400, "INVALID_USER", "User ID must be a valid UUID.", context);
      const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return domainError(404, "USER_NOT_FOUND", "That user account was not found.", context);
      const [auctioneer] = await getDb().insert(auctioneers).values({ auctionId, userId }).onConflictDoNothing().returning();
      return json({ auctioneer }, 201, context);
    } catch { return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context); }
  }

  const auctionSnapshotMatch = path.match(/^\/api\/auctions\/([^/]+)\/snapshot$/);
  const auctionReportMatch = path.match(/^\/api\/auctions\/([^/]+)\/(results|history|duplicate|pdf)$/);
  const auctionAccessMatch = path.match(/^\/api\/auctions\/([^/]+)\/access$/);
  const auctionControlMatch = path.match(/^\/api\/auctions\/([^/]+)\/control\/(acquire|release)$/);
  const auctionActionMatch = path.match(/^\/api\/auctions\/([^/]+)\/(start|next|pause|resume|sell|unsold|bid|reauction|undo)$/);
  if (auctionSnapshotMatch || auctionReportMatch || auctionAccessMatch || auctionControlMatch || auctionActionMatch) {
    const auctionId = (auctionSnapshotMatch ?? auctionReportMatch ?? auctionAccessMatch ?? auctionControlMatch ?? auctionActionMatch)?.[1] ?? "";
    const access = await requireUser(request, context);
    if ("response" in access) return access.response;
    try {
      if (auctionSnapshotMatch && request.method === "GET") return json({ snapshot: await snapshot(auctionId) }, 200, context);
      if (auctionReportMatch && request.method === "GET" && ["results", "history"].includes(auctionReportMatch[2])) {
        const report = await results(auctionId);
        if (!report) return domainError(404, "AUCTION_NOT_FOUND", "Auction not found.", context);
        if (report.tournament.organizerId !== access.user.id) return domainError(403, "FORBIDDEN", "You do not have access to this auction report.", context);
        return auctionReportMatch[2] === "results" ? json({ results: report }, 200, context) : json({ events: await history(auctionId) }, 200, context);
      }
      if (auctionReportMatch && auctionReportMatch[2] === "duplicate" && request.method === "POST") {
        const copy = await duplicateAuction(auctionId, access.user.id);
        if (!copy) return domainError(404, "AUCTION_NOT_FOUND", "Auction not found.", context);
        return json(copy, 201, context);
      }
      if (auctionReportMatch && auctionReportMatch[2] === "pdf" && request.method === "GET") {
        const report = await results(auctionId);
        if (!report) return domainError(404, "AUCTION_NOT_FOUND", "Auction not found.", context);
        if (report.tournament.organizerId !== access.user.id) return domainError(403, "FORBIDDEN", "You do not have access to this PDF.", context);
        const pdf = await resultsPdf(auctionId);
        if (!pdf) return domainError(404, "AUCTION_NOT_FOUND", "Auction not found.", context);
        return new Response(pdf, { status: 200, headers: { ...context.headers, "content-type": "application/pdf", "content-disposition": `attachment; filename="${report.tournament.slug}-results.pdf"` } });
      }
      if (auctionAccessMatch && request.method === "GET") {
        const [auction] = await getDb().select({ organizerId: tournaments.organizerId, controllerUserId: auctionControls.controllerUserId }).from(auctions).innerJoin(tournaments, eq(tournaments.id, auctions.tournamentId)).leftJoin(auctionControls, eq(auctionControls.auctionId, auctions.id)).where(eq(auctions.id, auctionId)).limit(1);
        if (!auction) return domainError(404, "AUCTION_NOT_FOUND", "Auction not found.", context);
        const [auctioneer] = await getDb().select({ userId: auctioneers.userId }).from(auctioneers).where(and(eq(auctioneers.auctionId, auctionId), eq(auctioneers.userId, access.user.id))).limit(1);
        return json({ isOrganizer: auction.organizerId === access.user.id, isAuctioneer: Boolean(auctioneer), canControl: auction.organizerId === access.user.id || Boolean(auctioneer), controllerUserId: auction.controllerUserId }, 200, context);
      }
      if (auctionControlMatch && request.method === "POST") {
        const result = auctionControlMatch[2] === "acquire" ? await acquireControl(auctionId, access.user.id) : await releaseControl(auctionId, access.user.id);
        broadcast(auctionId, { type: "AUCTION_EVENT", event: result });
        return json({ result }, 200, context);
      }
      if (auctionActionMatch && request.method === "POST") {
        const action = auctionActionMatch[2];
        if (action === "start") { const result = await startAuction(auctionId, access.user.id); broadcast(auctionId, { type: "AUCTION_STATE", sequence: result.event.sequenceNumber, ...result }); return json(result, 200, context); }
        if (action === "next") { const result = await nextPlayer(auctionId, access.user.id); broadcast(auctionId, { type: "AUCTION_STATE", sequence: result.event.sequenceNumber, ...result }); return json(result, 200, context); }
        if (action === "pause" || action === "resume") { const result = await pauseOrResume(auctionId, access.user.id, action); broadcast(auctionId, { type: "AUCTION_STATE", sequence: result.event.sequenceNumber, ...result }); return json(result, 200, context); }
        if (action === "sell" || action === "unsold") { const result = await settlePlayer(auctionId, access.user.id, action === "sell" ? "SOLD" : "UNSOLD"); broadcast(auctionId, { type: "AUCTION_STATE", sequence: result.event.sequenceNumber, ...result }); return json(result, 200, context); }
        if (action === "reauction") { const input = await body(request); const playerId = stringValue(input?.playerId); if (!isUuid(playerId)) return domainError(400, "INVALID_PLAYER", "Player ID must be a valid UUID.", context); const result = await reauctionPlayer(auctionId, access.user.id, playerId); broadcast(auctionId, { type: "AUCTION_STATE", sequence: result.event.sequenceNumber, ...result }); return json(result, 200, context); }
        if (action === "undo") { const result = await undoLastBid(auctionId, access.user.id); broadcast(auctionId, { type: "AUCTION_STATE", sequence: result.event.sequenceNumber, ...result }); return json(result, 200, context); }
        if (!bidAllowed(`${auctionId}:${access.user.id}`)) return domainError(429, "BID_THROTTLED", "Slow down briefly between bids.", context);
        const input = await body(request);
        const increment = positiveIntegerValue(input?.increment, 0);
        if (increment === null) return domainError(400, "INVALID_BID_INCREMENT", "Bid increment must be a positive whole number.", context);
        const result = await placeBid(auctionId, access.user.id, increment); broadcast(auctionId, { type: "AUCTION_STATE", sequence: result.event.sequenceNumber, ...result }); return json(result, 200, context);
      }
    } catch (error) { return engineError(error, context); }
  }

  const tiersMatch = path.match(/^\/api\/tournaments\/([^/]+)\/tiers$/);
  if (tiersMatch) {
    const tournamentId = tiersMatch[1];
    const access = await requireUser(request, context);
    if ("response" in access) return access.response;
    try {
      const tournament = await ownedTournament(access.user.id, tournamentId);
      if (!tournament) return domainError(404, "TOURNAMENT_NOT_FOUND", "Tournament not found.", context);
      if (request.method === "GET") return json({ tiers: await getDb().select().from(tiers).where(eq(tiers.tournamentId, tournamentId)).orderBy(tiers.displayOrder, tiers.name) }, 200, context);
      if (request.method === "POST") {
        if (tournament.locked) return domainError(409, "CONFIGURATION_LOCKED", "Tiers cannot be changed after the auction starts.", context);
        const input = await body(request);
        const name = stringValue(input?.name);
        const description = stringValue(input?.description) || null;
        const displayOrder = positiveIntegerValue(input?.displayOrder, 0) ?? 0;
        if (name.length < 2 || name.length > 80) return domainError(400, "INVALID_TIER_NAME", "Tier name must be 2–80 characters.", context);
        const [tier] = await getDb().insert(tiers).values({ tournamentId, name, description, displayOrder }).returning();
        return json({ tier }, 201, context);
      }
    } catch { return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context); }
  }

  const importPreviewMatch = path.match(/^\/api\/tournaments\/([^/]+)\/players\/import\/preview$/);
  const importConfirmMatch = path.match(/^\/api\/tournaments\/([^/]+)\/players\/import\/confirm$/);
  const playersMatch = path.match(/^\/api\/tournaments\/([^/]+)\/players$/);
  if (importPreviewMatch || importConfirmMatch || playersMatch) {
    const tournamentId = (importPreviewMatch ?? importConfirmMatch ?? playersMatch)?.[1] ?? "";
    const access = await requireUser(request, context);
    if ("response" in access) return access.response;
    try {
      const tournament = await ownedTournament(access.user.id, tournamentId);
      if (!tournament) return domainError(404, "TOURNAMENT_NOT_FOUND", "Tournament not found.", context);

      if (playersMatch && request.method === "GET") {
        const rows = await getDb().select().from(players).where(eq(players.tournamentId, tournamentId)).orderBy(players.name);
        const search = (new URL(request.url).searchParams.get("search") ?? "").toLowerCase();
        const role = new URL(request.url).searchParams.get("role");
        const status = new URL(request.url).searchParams.get("status");
        const foreign = new URL(request.url).searchParams.get("foreign");
        const filtered = rows.filter((player) => (!search || player.name.toLowerCase().includes(search)) && (!role || player.role === role) && (!status || player.status === status) && (foreign === null || String(player.isForeign) === foreign));
        return json({ players: filtered }, 200, context);
      }

      if (importPreviewMatch && request.method === "POST") {
        const input = await body(request);
        let source: unknown = input?.players ?? input?.json;
        if (typeof source === "string") {
          try { source = JSON.parse(source); } catch { return domainError(400, "INVALID_JSON", "The player JSON could not be parsed.", context); }
        }
        if (!Array.isArray(source)) return domainError(400, "INVALID_IMPORT", "Import must be a JSON array of player records.", context);
        const records = source.map((record, index) => ({ index, ...normalizePlayer(record) }));
        return json({ total: records.length, valid: records.filter((record) => record.data !== null).length, invalid: records.filter((record) => record.data === null).length, records }, 200, context);
      }

      if (importConfirmMatch && request.method === "POST") {
        if (tournament.locked) return domainError(409, "CONFIGURATION_LOCKED", "Players cannot be imported after the auction starts.", context);
        const input = await body(request);
        if (!Array.isArray(input?.players) || input.players.length === 0) return domainError(400, "INVALID_IMPORT", "Confirm requires at least one previewed player.", context);
        const records = input.players.map((record) => normalizePlayer(record));
        const firstInvalid = records.find((record) => record.data === null);
        if (firstInvalid) return json({ error: { code: "IMPORT_INVALID", message: "Fix all invalid records before confirming the import.", details: records.map((record, index) => ({ index, errors: record.errors, warnings: record.warnings })) } }, 400, context);
        const inserted = await getDb().transaction((tx) => tx.insert(players).values(records.map((record) => ({ ...record.data!, tournamentId }))).returning());
        return json({ players: inserted }, 201, context);
      }

      if (playersMatch && request.method === "POST") {
        if (tournament.locked) return domainError(409, "CONFIGURATION_LOCKED", "Players cannot be added after the auction starts.", context);
        const normalized = normalizePlayer(await body(request));
        if (!normalized.data) return json({ error: { code: "INVALID_PLAYER", message: "Player details are invalid.", details: normalized.errors } }, 400, context);
        const [player] = await getDb().insert(players).values({ ...normalized.data, tournamentId }).returning();
        return json({ player }, 201, context);
      }
    } catch { return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context); }
  }

  const playerMatch = path.match(/^\/api\/players\/([^/]+)$/);
  if (playerMatch && ["PATCH", "DELETE"].includes(request.method)) {
    const playerId = playerMatch[1];
    const access = await requireUser(request, context);
    if ("response" in access) return access.response;
    try {
      const [existing] = await getDb().select({ player: players, tournamentId: tournaments.id, locked: auctions.configurationLocked }).from(players).innerJoin(tournaments, eq(tournaments.id, players.tournamentId)).innerJoin(auctions, eq(auctions.tournamentId, tournaments.id)).where(and(eq(players.id, playerId), eq(tournaments.organizerId, access.user.id))).limit(1);
      if (!existing) return domainError(404, "PLAYER_NOT_FOUND", "Player not found.", context);
      if (existing.locked) return domainError(409, "CONFIGURATION_LOCKED", "Players cannot be changed after the auction starts.", context);
      if (request.method === "DELETE") { await getDb().delete(players).where(eq(players.id, playerId)); return json({ ok: true }, 200, context); }
      const input = await body(request);
      const normalized = normalizePlayer({ ...existing.player, ...input });
      if (!normalized.data) return json({ error: { code: "INVALID_PLAYER", message: "Player details are invalid.", details: normalized.errors } }, 400, context);
      const [player] = await getDb().update(players).set(normalized.data).where(eq(players.id, playerId)).returning();
      return json({ player }, 200, context);
    } catch { return domainError(503, "DATABASE_UNAVAILABLE", "The database is not configured or reachable.", context); }
  }

  return null;
}
