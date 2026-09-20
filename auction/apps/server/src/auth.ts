import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { getHttpDb } from "./db/client.ts";
import { sessions, users } from "./db/schema.ts";

const sessionCookie = "auction_session";
const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function cookieValue(token: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${sessionCookie}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);
  await getHttpDb().insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function destroySession(request: Request) {
  const token = readCookie(request, sessionCookie);
  if (token) await getHttpDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function currentUser(request: Request) {
  const token = readCookie(request, sessionCookie);
  if (!token) return null;

  const result = await getHttpDb()
    .select({ id: users.id, username: users.username, email: users.email, displayName: users.displayName, avatar: users.avatar })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return result[0] ?? null;
}

export function sessionCookieHeader(token: string, expiresAt: Date) {
  return cookieValue(token, Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)));
}

export function clearSessionCookie() {
  return cookieValue("", 0);
}

// scrypt from node:crypto, not Bun.password: the API also runs on Vercel's Node runtime.
// ponytail: sync scrypt blocks the event loop for ~100ms; move to the async form if login throughput matters.
function derive(password: string, salt: Buffer) {
  return scryptSync(password, salt, 32);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${derive(password, salt).toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string) {
  const [scheme, salt, key] = hash.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = derive(password, Buffer.from(salt, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
