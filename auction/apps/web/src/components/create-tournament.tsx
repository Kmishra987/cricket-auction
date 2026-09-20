"use client";

import { FormEvent, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { api, Tournament } from "@/lib/api";
import { money } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Notice, SeamMark } from "@/components/chrome";

const orderings = [
  ["sequential", "Sequential"],
  ["random", "Random"],
  ["tier", "By tier"],
  ["role", "By role"],
];

export function CreateTournament({ onCreated }: { onCreated: (tournament: Tournament) => void }) {
  const [name, setName] = useState("");
  const [purse, setPurse] = useState("10000000");
  const [basePrice, setBasePrice] = useState("500000");
  const [squadSize, setSquadSize] = useState("11");
  const [numberOfTeams, setNumberOfTeams] = useState("4");
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState("20");
  const [orderingStrategy, setOrderingStrategy] = useState("sequential");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ tournament: Tournament }>("/api/tournaments", {
        method: "POST",
        body: JSON.stringify({
          name,
          pursePerTeam: Number(purse),
          basePrice: Number(basePrice),
          squadSize: Number(squadSize),
          numberOfTeams: Number(numberOfTeams),
          timerEnabled,
          timerDurationSeconds: Number(timerDuration),
          orderingStrategy,
        }),
      });
      onCreated(data.tournament);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create tournament.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl py-16 stagger">
      <div className="flex flex-col items-start gap-7">
        <SeamMark className="size-9 text-brand" />
        <p className="eyebrow">Your first auction</p>
        <h2 className="display text-[clamp(2.6rem,6vw,4.4rem)]">
          Give the room
          <br />
          <em className="italic">a name.</em>
        </h2>
        <p className="max-w-lg text-[1.0625rem] leading-relaxed text-muted-foreground">
          These are the rules the room runs on. Everything is editable until the first player goes under the hammer, then it locks.
        </p>
      </div>

      <form className="mt-16 flex flex-col gap-14" onSubmit={submit}>
        <div className="border-t border-hairline pt-9">
          <p className="eyebrow mb-7">
            <span className="text-brand">01</span> <span className="ml-3">The tournament</span>
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mumbai Cricket League"
            aria-label="Tournament name"
            required
            className="display w-full border-b border-input bg-transparent pb-4 text-[clamp(1.8rem,4.2vw,2.8rem)] outline-none transition-colors duration-300 placeholder:text-muted-foreground/35 focus:border-brand"
          />
        </div>

        <div className="border-t border-hairline pt-9">
          <p className="eyebrow mb-7">
            <span className="text-brand">02</span> <span className="ml-3">Purse & squads</span>
          </p>
          <div className="grid gap-7 sm:grid-cols-2">
            <Field label="Teams">
              <Input type="number" min="1" max="100" value={numberOfTeams} onChange={(e) => setNumberOfTeams(e.target.value)} />
            </Field>
            <Field label="Squad size">
              <Input type="number" min="1" max="100" value={squadSize} onChange={(e) => setSquadSize(e.target.value)} />
            </Field>
            <Field label="Purse per team" hint={money(Number(purse) || 0)}>
              <Input type="number" min="1" value={purse} onChange={(e) => setPurse(e.target.value)} />
            </Field>
            <Field label="Base price" hint={money(Number(basePrice) || 0)}>
              <Input type="number" min="1" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="border-t border-hairline pt-9">
          <p className="eyebrow mb-7">
            <span className="text-brand">03</span> <span className="ml-3">How it runs</span>
          </p>
          <div className="grid gap-7 sm:grid-cols-2">
            <Field label="Player order">
              <Select value={orderingStrategy} onValueChange={setOrderingStrategy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {orderings.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {timerEnabled && (
              <Field label="Seconds per player">
                <Input type="number" min="1" max="3600" value={timerDuration} onChange={(e) => setTimerDuration(e.target.value)} />
              </Field>
            )}
            <label className="flex h-13 cursor-pointer items-center justify-between gap-4 rounded-lg border border-input bg-card px-4 transition-colors hover:border-foreground/25 sm:col-span-2">
              <span className="flex flex-col gap-0.5">
                <span className="text-[0.9375rem]">Bidding timer</span>
                <span className="text-[0.75rem] text-muted-foreground">Auto-close a player when the clock runs out</span>
              </span>
              <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />
            </label>
          </div>
        </div>

        <Notice tone="error">{error}</Notice>

        <div className="flex flex-wrap items-center gap-6 border-t border-hairline pt-9">
          <Button type="submit" size="xl" className="gleam" disabled={busy}>
            {busy ? "Creating the room…" : "Create tournament"}
            <ArrowUpRight />
          </Button>
          <p className="text-[0.8125rem] text-muted-foreground">You can change all of this before the auction starts.</p>
        </div>
      </form>
    </section>
  );
}
