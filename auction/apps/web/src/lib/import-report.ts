export const PLAYER_ROLES = ["Batter", "Bowler", "All-rounder", "Wicketkeeper"] as const;

/** What the manual add form needs to be pre-filled from a rejected record. */
export type PlayerDraft = { name: string; role: string; age: string; isForeign: boolean };

export type Rejected = { index: number; name: string; errors: string[]; draft: PlayerDraft };

type PreviewRecord = { index: number; data: unknown; errors: string[] };

const field = (source: unknown, key: string): unknown =>
  source && typeof source === "object" && !Array.isArray(source) ? (source as Record<string, unknown>)[key] : undefined;

/**
 * Salvage whatever the organizer already typed, so fixing a rejected record is
 * editing one field rather than retyping the player. An unrecognised role falls
 * back to the first valid one — the form cannot hold an invalid value, and the
 * substitution is visible before they submit.
 */
function draftFrom(source: unknown, fallbackName: string): PlayerDraft {
  const name = field(source, "name");
  const role = field(source, "role");
  const age = field(source, "age");
  const foreign = field(source, "isForeign") ?? field(source, "foreign");
  const roleText = typeof role === "string" ? role.trim() : "";

  return {
    name: typeof name === "string" && name.trim() ? name.trim() : fallbackName,
    role: PLAYER_ROLES.find((candidate) => candidate.toLowerCase() === roleText.toLowerCase()) ?? PLAYER_ROLES[0],
    age: Number.isFinite(Number(age)) && Number(age) > 0 ? String(Math.trunc(Number(age))) : "",
    isForeign: foreign === true,
  };
}

/**
 * A record that fails validation comes back from the server with `data: null`,
 * so its name is gone with it. Recover it from the JSON the organizer actually
 * pasted, matching on the index the server echoed back.
 */
export function rejectedFrom(records: PreviewRecord[], json: string): Rejected[] {
  let raw: unknown[] = [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) raw = parsed;
  } catch {
    // Unparseable JSON never reaches preview, but a later edit to the textarea can.
  }

  return records
    .filter((record) => record.data === null)
    .map((record) => {
      const source = raw[record.index];
      const name = field(source, "name");
      const label = typeof name === "string" && name.trim() ? name.trim() : `Record ${record.index + 1}`;
      return {
        index: record.index,
        name: label,
        errors: record.errors.length ? record.errors : ["This record could not be read."],
        draft: draftFrom(source, typeof name === "string" && name.trim() ? name.trim() : ""),
      };
    });
}
