"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowUpRight, Check, Pencil, Plane, Plus, Search, Trash2 } from "lucide-react";
import { api, Player, Team, Tournament, User, UserOption } from "@/lib/api";
import SetupConfig from "@/app/setup-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Block, Monogram, Notice, Stat } from "@/components/chrome";
import { rejectedFrom, type Rejected } from "@/lib/import-report";
import { cn } from "@/lib/utils";

const roles = ["Batter", "Bowler", "All-rounder", "Wicketkeeper"];

/** The records that did not make it, why, and a way to fix each one in place. */
function RejectedList({ heading, lede, rows, onAdd }: { heading: string; lede: string; rows: Rejected[]; onAdd: (row: Rejected) => void }) {
  if (!rows.length) return null;
  return (
    <section className="mt-8 rounded-xl border border-destructive/25 bg-destructive/[0.04] px-6 py-6 animate-rise">
      <div className="flex items-center gap-3">
        <AlertTriangle className="size-4 shrink-0 text-destructive" />
        <p className="eyebrow !text-destructive">{heading} · {rows.length}</p>
      </div>
      <p className="mt-3 text-[0.875rem] leading-relaxed text-muted-foreground">{lede}</p>
      <ul className="mt-6 flex flex-col">
        {rows.map((row) => (
          <li key={row.index} className="flex gap-5 border-t border-destructive/15 py-4">
            <span className="numeral w-8 shrink-0 pt-0.5 text-[0.6875rem] text-destructive">{String(row.index + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem]">{row.name}</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {row.errors.map((message) => (
                  <li key={message} className="text-[0.8125rem] leading-relaxed text-muted-foreground">{message}</li>
                ))}
              </ul>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0 self-start" onClick={() => onAdd(row)}>
              <Plus /> Add
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SetupView({ tournament, user, onBack }: { tournament: Tournament; user: User; onBack: () => void }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [captains, setCaptains] = useState<UserOption[]>([user]);
  const [teamName, setTeamName] = useState("");
  const [teamIcon, setTeamIcon] = useState("⚡");
  const [captainId, setCaptainId] = useState(user.id);
  const [assignSelf, setAssignSelf] = useState(true);
  const [playerName, setPlayerName] = useState("");
  const [playerRole, setPlayerRole] = useState("Batter");
  const [playerAge, setPlayerAge] = useState("");
  const [playerForeign, setPlayerForeign] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerStatusFilter, setPlayerStatusFilter] = useState("");
  const [playerRoleFilter, setPlayerRoleFilter] = useState("");
  const [playerJson, setPlayerJson] = useState('[\n  {\n    "name": "Virat Sharma",\n    "role": "Batter",\n    "age": 26,\n    "foreign": false,\n    "stats": { "matches": 42, "runs": 1640 }\n  }\n]');
  const [preview, setPreview] = useState<{ total: number; valid: number; invalid: number; records: Array<{ index: number; data: Player | null; errors: string[]; warnings: string[] }> } | null>(null);
  const [skipped, setSkipped] = useState<Rejected[] | null>(null);
  const playerForm = useRef<HTMLFormElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [teamData, playerData, captainData] = await Promise.all([
      api<{ teams: Team[] }>(`/api/tournaments/${tournament.id}/teams`),
      api<{ players: Player[] }>(`/api/tournaments/${tournament.id}/players`),
      api<{ users: UserOption[] }>(`/api/users?tournamentId=${tournament.id}`),
    ]);
    setTeams(teamData.teams);
    setPlayers(playerData.players);
    setCaptains(captainData.users.some((candidate) => candidate.id === user.id) ? captainData.users : [user, ...captainData.users]);
  }

  useEffect(() => { refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load setup.")); }, [tournament.id]);

  async function addTeam(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const selectedCaptain = assignSelf ? user.id : captainId || null;
      await api(`/api/tournaments/${tournament.id}/teams`, { method: "POST", body: JSON.stringify({ name: teamName, icon: teamIcon, captainId: selectedCaptain }) });
      setTeamName("");
      setNotice(selectedCaptain ? "Team added with its captain." : "Team added to the room.");
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add team."); }
  }

  async function addPlayer(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const payload = { name: playerName, role: playerRole, age: playerAge ? Number(playerAge) : null, isForeign: playerForeign };
      await api(editingPlayer ? `/api/players/${editingPlayer.id}` : `/api/tournaments/${tournament.id}/players`, { method: editingPlayer ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setPlayerName(""); setPlayerAge(""); setPlayerForeign(false); setEditingPlayer(null);
      setNotice(editingPlayer ? "Player updated." : "Player added to the pool.");
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add player."); }
  }

  async function deletePlayer(player: Player) {
    if (!window.confirm(`Remove ${player.name} from the player pool?`)) return;
    setError(null);
    try { await api(`/api/players/${player.id}`, { method: "DELETE" }); setNotice(`${player.name} removed.`); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove player."); }
  }

  /** Load a rejected import row into the manual form so it can be fixed in place. */
  function addFromRejected(row: Rejected) {
    setEditingPlayer(null);
    setPlayerName(row.draft.name);
    setPlayerRole(row.draft.role);
    setPlayerAge(row.draft.age);
    setPlayerForeign(row.draft.isForeign);
    setNotice(`${row.name} loaded into the add form. Check the highlighted details, then add.`);
    playerForm.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => playerForm.current?.querySelector("input")?.focus(), 400);
  }

  function editPlayer(player: Player) {
    setEditingPlayer(player); setPlayerName(player.name); setPlayerRole(player.role); setPlayerAge(player.age ? String(player.age) : ""); setPlayerForeign(Boolean(player.isForeign));
  }

  async function previewImport() {
    setError(null); setNotice(null); setSkipped(null);
    try { setPreview(await api<typeof preview>(`/api/tournaments/${tournament.id}/players/import/preview`, { method: "POST", body: JSON.stringify({ json: playerJson }) })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not preview import."); }
  }

  /** Import every record that parsed, and hand back a list of the ones that did not. */
  async function confirmImport() {
    if (!preview) return;
    const accepted = preview.records.filter((record) => record.data !== null).map((record) => record.data);
    const rejected = rejectedFrom(preview.records, playerJson);
    if (!accepted.length) {
      setError("None of these records could be imported. Fix the errors listed below, then preview again.");
      setSkipped(rejected);
      return;
    }
    setError(null);
    try {
      await api(`/api/tournaments/${tournament.id}/players/import/confirm`, { method: "POST", body: JSON.stringify({ players: accepted }) });
      setPreview(null);
      setSkipped(rejected.length ? rejected : null);
      setNotice(`${accepted.length} player${accepted.length === 1 ? "" : "s"} added to the pool.${rejected.length ? ` ${rejected.length} could not be read and ${rejected.length === 1 ? "was" : "were"} skipped.` : ""}`);
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not confirm import."); }
  }

  const filteredPlayers = players.filter((player) =>
    (!playerSearch || player.name.toLowerCase().includes(playerSearch.toLowerCase())) &&
    (!playerRoleFilter || player.role === playerRoleFilter) &&
    (!playerStatusFilter || player.status === playerStatusFilter));

  return (
    <div className="pb-40">
      <header className="pt-4 pb-14">
        <button className="link-sweep mb-12 inline-flex items-center gap-2 caption text-[0.7rem] text-muted-foreground transition-colors hover:text-foreground" onClick={onBack}>
          <ArrowLeft className="size-3.5" /> Overview
        </button>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="eyebrow mb-5">Tournament setup</p>
            <h2 className="display text-[clamp(2.6rem,6vw,4.6rem)]">{tournament.name}</h2>
          </div>
          <Badge variant="outline" className="mb-2">Config locks at first bid</Badge>
        </div>
      </header>

      <div className="flex flex-col gap-4 pb-14">
        <Notice tone="error">{error}</Notice>
        <Notice tone="success">{notice}</Notice>
      </div>

      <div className="grid grid-cols-2 gap-x-10 gap-y-8 pb-16 md:grid-cols-4">
        <Stat label="Teams" value={teams.length} />
        <Stat label="Players" value={players.length} />
        <Stat label="Sold" value={players.filter((player) => player.status === "SOLD").length} />
        <Stat label="Unsold" value={players.filter((player) => player.status === "UNSOLD").length} />
      </div>

      <div className="flex flex-col gap-20">
        {/* ── 01 teams ─────────────────────────────────────────────────── */}
        <Block index="01" title="Build the room" lede="Every team needs a name and, ideally, a captain who can bid from their own screen." aside={<span className="numeral text-5xl text-brand">{String(teams.length).padStart(2, "0")}</span>}>
          <form className="flex flex-col gap-6" onSubmit={addTeam}>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
              <Field label="Mark" className="sm:w-24">
                <Input value={teamIcon} onChange={(e) => setTeamIcon(e.target.value)} aria-label="Team icon" maxLength={2} className="text-center text-xl" />
              </Field>
              <Field label="Team name" className="flex-1">
                <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Deccan Kings" required />
              </Field>
              <Button type="submit" variant="outline" size="lg">Add team</Button>
            </div>

            <label className="flex w-fit cursor-pointer items-center gap-3 text-[0.875rem] text-muted-foreground transition-colors hover:text-foreground">
              <Checkbox checked={assignSelf} onCheckedChange={(value) => setAssignSelf(value === true)} />
              Assign me as captain
            </label>

            {!assignSelf && (
              <Field label="Captain" className="max-w-sm">
                <Select value={captainId || "none"} onValueChange={(value) => setCaptainId(value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No captain yet</SelectItem>
                    {captains.map((captain) => <SelectItem key={captain.id} value={captain.id}>{captain.displayName} · @{captain.username}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form>

          <div className="mt-10 flex flex-col">
            {teams.map((team) => (
              <div key={team.id} className="group flex items-center gap-5 border-t border-hairline py-5 transition-colors duration-300 hover:bg-secondary/45">
                <Monogram name={team.name} className="size-11 text-lg text-foreground/70 transition-colors duration-500 group-hover:text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[1.0625rem]">{team.name}</p>
                  <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{team.captainName ?? "Captain unassigned"}</p>
                </div>
              </div>
            ))}
            {teams.length === 0 && <p className="border-t border-hairline py-8 text-[0.9375rem] text-muted-foreground">No teams yet. Add the first one above.</p>}
          </div>
        </Block>

        {/* ── 02 player pool ───────────────────────────────────────────── */}
        <Block index="02" title={editingPlayer ? `Editing ${editingPlayer.name}` : "The player pool"} lede="Add players one by one, or paste the whole list in the next step. Roles and nationality drive the cards on the stage." aside={<span className="numeral text-5xl text-brand">{String(players.length).padStart(2, "0")}</span>}>
          <form ref={playerForm} className="flex flex-col gap-6" onSubmit={addPlayer}>
            <div className="grid gap-6 sm:grid-cols-[1.6fr_1fr_0.7fr]">
              <Field label="Player name">
                <Input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Rohit Kadam" required />
              </Field>
              <Field label="Role">
                <Select value={playerRole} onValueChange={setPlayerRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{roles.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Age">
                <Input type="number" min="1" max="100" value={playerAge} onChange={(e) => setPlayerAge(e.target.value)} placeholder="26" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex cursor-pointer items-center gap-3 text-[0.875rem] text-muted-foreground transition-colors hover:text-foreground">
                <Checkbox checked={playerForeign} onCheckedChange={(value) => setPlayerForeign(value === true)} />
                Overseas player
              </label>
              <Button type="submit" variant="outline" size="lg">{editingPlayer ? "Save player" : "Add player"}</Button>
              {editingPlayer && (
                <Button type="button" variant="ghost" size="lg" onClick={() => { setEditingPlayer(null); setPlayerName(""); setPlayerAge(""); setPlayerForeign(false); }}>Cancel</Button>
              )}
            </div>
          </form>

          <div className="mt-12 grid gap-4 sm:grid-cols-[1.5fr_1fr_1fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} placeholder="Search players" aria-label="Search players" className="pl-11" />
            </div>
            <Select value={playerRoleFilter || "all"} onValueChange={(value) => setPlayerRoleFilter(value === "all" ? "" : value)}>
              <SelectTrigger aria-label="Filter by role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={playerStatusFilter || "all"} onValueChange={(value) => setPlayerStatusFilter(value === "all" ? "" : value)}>
              <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SOLD">Sold</SelectItem>
                <SelectItem value="UNSOLD">Unsold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="thin-scroll mt-8 max-h-[32rem] overflow-y-auto">
            {filteredPlayers.map((player) => (
              <div key={player.id} className="group flex items-center gap-5 border-t border-hairline py-4 transition-colors duration-300 hover:bg-secondary/45">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-hairline font-serif text-lg transition-colors duration-300 group-hover:border-brand group-hover:text-brand">
                  {player.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem]">{player.name}</p>
                  <p className="mt-0.5 flex items-center gap-2 caption text-[0.6875rem] text-muted-foreground">
                    {player.role}
                    {player.isForeign && <Plane className="size-3" />}
                    <span className={cn("size-1 rounded-full", player.status === "SOLD" ? "bg-success" : player.status === "UNSOLD" ? "bg-destructive" : "bg-muted-foreground/50")} />
                    {player.status}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-within:opacity-100">
                  <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${player.name}`} onClick={() => editPlayer(player)}><Pencil /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${player.name}`} className="hover:text-destructive" onClick={() => deletePlayer(player)}><Trash2 /></Button>
                </div>
              </div>
            ))}
            {!filteredPlayers.length && <p className="border-t border-hairline py-8 text-[0.9375rem] text-muted-foreground">No players match these filters.</p>}
          </div>
        </Block>

        {/* ── 03 bulk import ───────────────────────────────────────────── */}
        <Block index="03" title="Bring the whole list" lede="Paste a JSON array of players. Preview validates every record before anything is written." aside={<Badge variant="outline">JSON</Badge>}>
          <Textarea value={playerJson} onChange={(e) => setPlayerJson(e.target.value)} aria-label="Player JSON" className="min-h-64" />
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button type="button" variant="outline" size="lg" onClick={previewImport}>Preview JSON</Button>
            {preview && (
              <Button type="button" size="lg" className="gleam" onClick={confirmImport} disabled={preview.valid === 0}>
                <Check /> Import {preview.valid} player{preview.valid === 1 ? "" : "s"}
              </Button>
            )}
          </div>

          {preview && (
            <div className={cn("mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2 rounded-xl border px-6 py-5 animate-rise", preview.invalid ? "border-destructive/25 bg-destructive/8" : "border-success/25 bg-success/10")}>
              <strong className="numeral text-2xl">{preview.valid}/{preview.total}</strong>
              <span className="text-[0.9375rem] text-muted-foreground">
                {preview.invalid
                  ? `ready to import · ${preview.invalid} will be skipped`
                  : "Everything checks out"}
              </span>
            </div>
          )}

          <RejectedList
            heading={preview ? "Will be skipped" : "Skipped — not imported"}
            lede={preview
              ? "These records could not be read. Importing adds everyone else and leaves these behind."
              : "Everyone else was added. Fix these below and preview again to bring them in."}
            rows={preview ? rejectedFrom(preview.records, playerJson) : skipped ?? []}
            onAdd={addFromRejected}
          />
        </Block>

        {/* ── 04 rules & access ────────────────────────────────────────── */}
        <SetupConfig tournamentId={tournament.id} />
      </div>

      {/* ── sticky action bar ──────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[86rem] flex-wrap items-center justify-between gap-5 px-6 py-5 sm:px-10 lg:px-16">
          <span className="flex items-center gap-2.5 caption text-[0.6875rem] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" /> Changes save as you go
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="lg" asChild>
              <a href={`/auction/${tournament.slug}/live`}>Preview live room <ArrowUpRight /></a>
            </Button>
            <Button size="lg" className="gleam" onClick={onBack}>Back to overview <ArrowUpRight /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
