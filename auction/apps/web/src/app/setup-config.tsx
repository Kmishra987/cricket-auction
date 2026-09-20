"use client";

import { FormEvent, useEffect, useState } from "react";
import { Lock, Plus } from "lucide-react";
import { api, UserOption } from "@/lib/api";
import { money } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Block, Notice } from "@/components/chrome";

type Config = {
  tournament: { name: string; description?: string | null; numberOfTeams?: number | null; scheduledAt?: string | null; timezone: string };
  auction: { id: string; squadSize: number; pursePerTeam: number; basePrice: number; incrementOne: number; incrementTwo: number; incrementThree: number; timerEnabled: boolean; timerDurationSeconds?: number | null; tierSystemEnabled: boolean; orderingStrategy: string; configurationLocked: boolean };
};
type Tier = { id: string; name: string; description?: string | null; displayOrder: number };
type Auctioneer = { userId: string; displayName: string; username: string };

const moneyInput = (value: number) => String(value);

/** Small heading for a group of fields inside the block. */
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-hairline pt-7">
      <p className="eyebrow mb-6">{label}</p>
      {children}
    </div>
  );
}

export default function SetupConfig({ tournamentId }: { tournamentId: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [auctioneers, setAuctioneers] = useState<Auctioneer[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [tierName, setTierName] = useState("");
  const [auctioneerId, setAuctioneerId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const nextConfig = await api<Config>(`/api/tournaments/${tournamentId}`);
    const [nextTiers, nextAuctioneers, nextUsers] = await Promise.all([
      api<{ tiers: Tier[] }>(`/api/tournaments/${tournamentId}/tiers`),
      api<{ auctioneers: Auctioneer[] }>(`/api/auctions/${nextConfig.auction.id}/auctioneers`).catch(() => ({ auctioneers: [] })),
      api<{ users: UserOption[] }>(`/api/users?tournamentId=${tournamentId}`),
    ]);
    setConfig(nextConfig);
    setTiers(nextTiers.tiers);
    setAuctioneers(nextAuctioneers.auctioneers);
    setUsers(nextUsers.users);
    setForm({
      name: nextConfig.tournament.name,
      description: nextConfig.tournament.description ?? "",
      numberOfTeams: String(nextConfig.tournament.numberOfTeams ?? 1),
      squadSize: String(nextConfig.auction.squadSize),
      pursePerTeam: moneyInput(nextConfig.auction.pursePerTeam),
      basePrice: moneyInput(nextConfig.auction.basePrice),
      incrementOne: moneyInput(nextConfig.auction.incrementOne),
      incrementTwo: moneyInput(nextConfig.auction.incrementTwo),
      incrementThree: moneyInput(nextConfig.auction.incrementThree),
      timerEnabled: nextConfig.auction.timerEnabled,
      timerDurationSeconds: String(nextConfig.auction.timerDurationSeconds ?? 20),
      tierSystemEnabled: nextConfig.auction.tierSystemEnabled,
      orderingStrategy: nextConfig.auction.orderingStrategy,
      scheduledAt: nextConfig.tournament.scheduledAt ? new Date(nextConfig.tournament.scheduledAt).toISOString().slice(0, 16) : "",
      timezone: nextConfig.tournament.timezone,
    });
  }

  useEffect(() => { refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load auction rules.")); }, [tournamentId]);

  function change(name: string, value: string | boolean) { setForm((current) => ({ ...current, [name]: value })); }
  function number(name: string) { return Number(form[name]); }
  const text = (name: string, fallback = "") => String(form[name] ?? fallback);

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setNotice(null);
    try {
      await api(`/api/tournaments/${tournamentId}`, { method: "PATCH", body: JSON.stringify({
        name: form.name, description: form.description, numberOfTeams: number("numberOfTeams"), squadSize: number("squadSize"), pursePerTeam: number("pursePerTeam"), basePrice: number("basePrice"), incrementOne: number("incrementOne"), incrementTwo: number("incrementTwo"), incrementThree: number("incrementThree"), timerEnabled: form.timerEnabled, timerDurationSeconds: number("timerDurationSeconds"), tierSystemEnabled: form.tierSystemEnabled, orderingStrategy: form.orderingStrategy, scheduledAt: form.scheduledAt || null, timezone: form.timezone,
      }) });
      setNotice("Auction rules saved."); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save auction rules."); } finally { setBusy(false); }
  }

  async function addTier(event: FormEvent) {
    event.preventDefault(); if (!tierName.trim()) return; setBusy(true); setError(null);
    try { await api(`/api/tournaments/${tournamentId}/tiers`, { method: "POST", body: JSON.stringify({ name: tierName }) }); setTierName(""); setNotice("Tier added."); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add tier."); } finally { setBusy(false); }
  }

  async function addAuctioneer(event: FormEvent) {
    event.preventDefault(); if (!auctioneerId || !config) return; setBusy(true); setError(null);
    try { await api(`/api/auctions/${config.auction.id}/auctioneers`, { method: "POST", body: JSON.stringify({ userId: auctioneerId }) }); setAuctioneerId(""); setNotice("Auctioneer added."); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add auctioneer."); } finally { setBusy(false); }
  }

  if (!config) {
    return (
      <Block index="04" title="Rules & access" lede="Loading the room rules…">
        <div className="h-40 animate-pulse rounded-xl bg-secondary/60" />
      </Block>
    );
  }

  const locked = config.auction.configurationLocked;
  return (
    <Block
      index="04"
      title={locked ? "Room locked" : "Rules & access"}
      lede={locked ? "The auction has started, so the numbers are fixed. Access can still be reviewed." : "The maths behind the room: purse, base price, and the three raise steps captains can pick from."}
      aside={locked ? <Badge variant="soft"><Lock /> Locked</Badge> : <Badge variant="outline">Editable</Badge>}
    >
      <div className="mb-8 flex flex-col gap-4">
        <Notice tone="error">{error}</Notice>
        <Notice tone="success">{notice}</Notice>
      </div>

      <form className="flex flex-col gap-10" onSubmit={save}>
        <Group label="Auction identity">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Name"><Input disabled={locked} value={text("name")} onChange={(e) => change("name", e.target.value)} /></Field>
            <Field label="Teams"><Input disabled={locked} type="number" min="1" value={text("numberOfTeams")} onChange={(e) => change("numberOfTeams", e.target.value)} /></Field>
            <Field label="Schedule"><Input disabled={locked} type="datetime-local" value={text("scheduledAt")} onChange={(e) => change("scheduledAt", e.target.value)} /></Field>
            <Field label="Timezone"><Input disabled={locked} value={text("timezone", "UTC")} onChange={(e) => change("timezone", e.target.value)} /></Field>
          </div>
        </Group>

        <Group label="Purse & bidding">
          <div className="grid gap-6 sm:grid-cols-3">
            <Field label="Purse / team" hint={money(number("pursePerTeam") || 0)}><Input disabled={locked} type="number" min="1" value={text("pursePerTeam")} onChange={(e) => change("pursePerTeam", e.target.value)} /></Field>
            <Field label="Base price" hint={money(number("basePrice") || 0)}><Input disabled={locked} type="number" min="1" value={text("basePrice")} onChange={(e) => change("basePrice", e.target.value)} /></Field>
            <Field label="Squad size"><Input disabled={locked} type="number" min="1" value={text("squadSize")} onChange={(e) => change("squadSize", e.target.value)} /></Field>
            <Field label="Raise 1" hint={money(number("incrementOne") || 0)}><Input disabled={locked} type="number" min="1" value={text("incrementOne")} onChange={(e) => change("incrementOne", e.target.value)} /></Field>
            <Field label="Raise 2" hint={money(number("incrementTwo") || 0)}><Input disabled={locked} type="number" min="1" value={text("incrementTwo")} onChange={(e) => change("incrementTwo", e.target.value)} /></Field>
            <Field label="Raise 3" hint={money(number("incrementThree") || 0)}><Input disabled={locked} type="number" min="1" value={text("incrementThree")} onChange={(e) => change("incrementThree", e.target.value)} /></Field>
          </div>
        </Group>

        <Group label="Flow">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Ordering">
              <Select disabled={locked} value={text("orderingStrategy", "sequential")} onValueChange={(value) => change("orderingStrategy", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                  <SelectItem value="tier">By tier</SelectItem>
                  <SelectItem value="role">By role</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Timer seconds">
              <Input disabled={locked || !form.timerEnabled} type="number" min="1" value={text("timerDurationSeconds", "20")} onChange={(e) => change("timerDurationSeconds", e.target.value)} />
            </Field>
            {[
              ["timerEnabled", "Bidding timer", "Close a player automatically when the clock runs out"],
              ["tierSystemEnabled", "Tier system", "Group players into tiers and auction them in order"],
            ].map(([key, title, sub]) => (
              <label key={key} className="flex h-13 cursor-pointer items-center justify-between gap-4 rounded-lg border border-input bg-card px-4 transition-colors hover:border-foreground/25 has-[:disabled]:opacity-45">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[0.9375rem]">{title}</span>
                  <span className="text-[0.75rem] text-muted-foreground">{sub}</span>
                </span>
                <Switch disabled={locked} checked={Boolean(form[key])} onCheckedChange={(value) => change(key, value)} />
              </label>
            ))}
          </div>
        </Group>

        {!locked && <Button type="submit" size="lg" className="gleam w-fit" disabled={busy}>Save room rules</Button>}
      </form>

      <div className="mt-12 flex flex-col gap-10">
        <Group label="Tiers">
          <div className="flex flex-wrap items-center gap-2.5">
            {tiers.map((tier) => <Badge key={tier.id} variant="default" className="py-1.5">{tier.name}</Badge>)}
            {!tiers.length && <p className="text-[0.9375rem] text-muted-foreground">Optional tiers can shape the running order.</p>}
          </div>
          {!locked && (
            <form className="mt-6 flex max-w-md gap-3" onSubmit={addTier}>
              <Input value={tierName} onChange={(e) => setTierName(e.target.value)} placeholder="Tier name" />
              <Button type="submit" variant="outline" size="default" disabled={busy}><Plus /> Add</Button>
            </form>
          )}
        </Group>

        <Group label="Auctioneers">
          <div className="flex flex-wrap items-center gap-2.5">
            {auctioneers.map((auctioneer) => <Badge key={auctioneer.userId} variant="default" className="py-1.5">{auctioneer.displayName}</Badge>)}
            {!auctioneers.length && <p className="text-[0.9375rem] text-muted-foreground">Only you can control this room for now.</p>}
          </div>
          {!locked && (
            <form className="mt-6 flex max-w-md gap-3" onSubmit={addAuctioneer}>
              <Select value={auctioneerId} onValueChange={setAuctioneerId}>
                <SelectTrigger><SelectValue placeholder="Choose a registered user" /></SelectTrigger>
                <SelectContent>
                  {users.filter((user) => !auctioneers.some((item) => item.userId === user.id)).map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.displayName} · @{user.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline" size="default" disabled={busy || !auctioneerId}><Plus /> Add</Button>
            </form>
          )}
        </Group>
      </div>
    </Block>
  );
}
