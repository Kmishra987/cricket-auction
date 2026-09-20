import { expect, test } from "bun:test";
import { rejectedFrom } from "./import-report.ts";

const json = JSON.stringify([
  { name: "Valid Player", role: "Batter" },
  { name: "  Bad Role  ", role: "Goalkeeper" },
  { role: "Batter" },
  "not an object",
]);

const records = [
  { index: 0, data: { name: "Valid Player" }, errors: [] },
  { index: 1, data: null, errors: ["Role must be Batter, Bowler, All-rounder, or Wicketkeeper."] },
  { index: 2, data: null, errors: ["Name must be 2–120 characters."] },
  { index: 3, data: null, errors: [] },
];

test("keeps only the records that failed, in source order", () => {
  expect(rejectedFrom(records, json).map((row) => row.index)).toEqual([1, 2, 3]);
});

test("recovers the pasted name by index and trims it", () => {
  const row = rejectedFrom(records, json)[0];
  expect(row.index).toBe(1);
  expect(row.name).toBe("Bad Role");
  expect(row.errors).toEqual(["Role must be Batter, Bowler, All-rounder, or Wicketkeeper."]);
});

test("pre-fills a draft from the salvageable fields", () => {
  const draft = rejectedFrom(
    [{ index: 0, data: null, errors: ["Age must be a positive whole number."] }],
    JSON.stringify([{ name: "Ravi Patil", role: "bowler", age: "27", foreign: true }]),
  )[0].draft;
  expect(draft).toEqual({ name: "Ravi Patil", role: "Bowler", age: "27", isForeign: true });
});

test("substitutes a valid role and drops an unusable age", () => {
  const draft = rejectedFrom(
    [{ index: 0, data: null, errors: ["bad"] }],
    JSON.stringify([{ name: "X Y", role: "Goalkeeper", age: "old" }]),
  )[0].draft;
  expect(draft.role).toBe("Batter");
  expect(draft.age).toBe("");
  expect(draft.isForeign).toBe(false);
});

test("falls back to a positional label when the record has no usable name", () => {
  const rows = rejectedFrom(records, json);
  expect(rows[1].name).toBe("Record 3");
  expect(rows[2].name).toBe("Record 4");
});

test("always gives a reason, even when the server sent none", () => {
  expect(rejectedFrom(records, json)[2].errors).toEqual(["This record could not be read."]);
});

test("survives JSON that no longer parses", () => {
  const rows = rejectedFrom(records, "{ broken");
  expect(rows).toHaveLength(3);
  expect(rows[0].name).toBe("Record 2");
});
