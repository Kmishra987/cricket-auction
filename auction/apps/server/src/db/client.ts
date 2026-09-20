import { Pool } from "@neondatabase/serverless";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import * as schema from "./schema.ts";

const url = process.env.DATABASE_URL;

export const pool = url ? new Pool({ connectionString: url }) : null;
export const db = pool ? drizzle(pool, { schema }) : null;
// Neon HTTP stays on standard HTTPS/443, which is important on networks that block WebSockets.
export const httpDb = url ? drizzleHttp(neon(url), { schema }) : null;

export function getDb() {
  if (!db) throw new Error("DATABASE_URL is not configured.");
  return db;
}

export function getHttpDb() {
  if (!httpDb) throw new Error("DATABASE_URL is not configured.");
  return httpDb;
}
