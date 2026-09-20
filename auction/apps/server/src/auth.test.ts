import { expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "./auth.ts";

test("scrypt password hashing round-trips and rejects wrong input", async () => {
  const hash = await hashPassword("demo-password-123");
  expect(hash.startsWith("scrypt$")).toBe(true);
  expect(await verifyPassword("demo-password-123", hash)).toBe(true);
  expect(await verifyPassword("wrong-password", hash)).toBe(false);
  expect(await verifyPassword("demo-password-123", "$argon2id$v=19$m=65536")).toBe(false);
  expect(await hashPassword("demo-password-123")).not.toBe(hash);
});
