import { describe, expect, test } from "bun:test";
import { bidAllowed, normalizePlayer } from "./routes.ts";

test("throttles repeated bids from one captain in the same room", () => {
  const key = `test-${crypto.randomUUID()}`;
  expect(bidAllowed(key)).toBe(true);
  expect(bidAllowed(key)).toBe(false);
});

describe("player import validation", () => {
  test("accepts a valid flexible cricket record", () => {
    const result = normalizePlayer({ name: "Virat Sharma", role: "Batter", age: 26, foreign: false, stats: { matches: 42, runs: 1640 } });
    expect(result.errors).toEqual([]);
    expect(result.data?.name).toBe("Virat Sharma");
    expect(result.data?.stats?.runs).toBe(1640);
  });

  test("keeps unknown fields visible as warnings", () => {
    const result = normalizePlayer({ name: "A Player", role: "Bowler", club: "Unknown Club" });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([`Unknown field "club" was ignored.`]);
  });

  test("rejects malformed role and stats without silently importing", () => {
    const result = normalizePlayer({ name: "A Player", role: "Keeper-ish", stats: { runs: "many" } });
    expect(result.data).toBeNull();
    expect(result.errors.length).toBe(2);
  });
});
