"use client";

import { use, useEffect, useState } from "react";
import { ArrowUpRight, Download } from "lucide-react";
import { PlayerCard } from "@/components/player-card";
import { LoadingScreen, Monogram, SeamMark, SectionHead, Shell, Stat, Wordmark } from "@/components/chrome";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { money, shortMoney } from "@/lib/money";

type Report = { tournament: { name: string; slug: string }; auction: { id: string; status: string }; teams: Array<{ team: { id: string; name: string; logo: string; captainName?: string | null; spentPurse: number; remainingPurse: number; squadCount: number }; players: Array<{ id: string; name: string; role: string; photo?: string | null; age?: number | null; isForeign: boolean; bio?: string | null; battingStyle?: string | null; bowlingStyle?: string | null; stats?: Record<string, number> | null; purchasePrice?: number | null }> }>; summary: { totalPlayers: number; soldPlayers: number; unsoldPlayers: number; totalSpent: number; averagePurchase: number; highestPurchase?: { name: string; price: number } | null } };
type Event = { sequenceNumber: number; eventType: string; createdAt: string; payload: Record<string, unknown> };

function BigMoney({ amount }: { amount: number }) {
  const short = shortMoney(amount);
  return <>₹{short.value}{short.unit && <span className="ml-1 text-[0.42em] text-muted-foreground">{short.unit}</span>}</>;
}

export default function ResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [report, setReport] = useState<Report | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<{ results: Report }>(`/api/public/auctions/${slug}/results`), api<{ events: Event[] }>(`/api/public/auctions/${slug}/history`)])
      .then(([result, history]) => { setReport(result.results); setEvents(history.events); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load results."));
  }, [slug]);

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center px-6">
        <div className="max-w-lg text-center stagger">
          <SeamMark className="mx-auto size-10 text-brand" />
          <p className="eyebrow mt-8">Results</p>
          <h1 className="display mt-5 text-[clamp(2rem,5vw,3.2rem)]">{error}</h1>
        </div>
      </main>
    );
  }
  if (!report) return <LoadingScreen message="Loading results" />;

  return (
    <main className="min-h-dvh pb-32">
      <header className="sticky top-0 z-40 border-b border-hairline bg-background/80 backdrop-blur-xl">
        <Shell className="flex h-20 items-center justify-between gap-6">
          <Wordmark />
          <Button variant="outline" size="sm" asChild>
            <a href={`/auction/${slug}/live`}>Live room <ArrowUpRight /></a>
          </Button>
        </Shell>
      </header>

      <Shell>
        {/* ── cover ──────────────────────────────────────────────────── */}
        <section className="py-20 lg:py-28 stagger">
          <p className="eyebrow mb-8">Final results · {report.auction.status}</p>
          <h1 className="display max-w-4xl text-[clamp(3rem,8vw,7rem)]">{report.tournament.name}</h1>
          <p className="mt-9 max-w-lg text-[1.0625rem] leading-relaxed text-muted-foreground">
            Every bid, every squad, every rupee. The whole room in one page.
          </p>
          <Button size="xl" className="gleam mt-11" asChild>
            <a href={`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/public/auctions/${slug}/pdf`}>
              Download team PDF <Download />
            </a>
          </Button>
        </section>

        {/* ── the numbers ────────────────────────────────────────────── */}
        <section className="grid gap-x-10 gap-y-9 pb-24 sm:grid-cols-2 lg:grid-cols-4 stagger">
          <Stat label="Players sold" value={`${report.summary.soldPlayers}/${report.summary.totalPlayers}`} caption={`${report.summary.unsoldPlayers} went unsold`} />
          <Stat label="Total spent" value={<BigMoney amount={report.summary.totalSpent} />} caption="across every squad" />
          <Stat label="Average buy" value={<BigMoney amount={report.summary.averagePurchase} />} caption="per sold player" />
          <Stat
            label="Top purchase"
            value={report.summary.highestPurchase ? <BigMoney amount={report.summary.highestPurchase.price} /> : "—"}
            caption={report.summary.highestPurchase?.name ?? "No sales yet"}
          />
        </section>

        <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-20">
          {/* ── squads ───────────────────────────────────────────────── */}
          <Tabs defaultValue="list">
            <SectionHead
              index="01"
              eyebrow="The final table"
              title={<>Squads, <em className="italic">locked in.</em></>}
              action={
                <TabsList className="mb-2">
                  <TabsTrigger value="list">List</TabsTrigger>
                  <TabsTrigger value="cards">Cards</TabsTrigger>
                </TabsList>
              }
            />

            <div className="mt-14 flex flex-col gap-16">
              {report.teams.map((squad) => (
                <article key={squad.team.id} className="reveal">
                  <div className="flex flex-wrap items-end justify-between gap-6 border-b border-hairline pb-6">
                    <div className="flex items-center gap-5">
                      <Monogram name={squad.team.name} className="size-14 text-2xl text-foreground/70" />
                      <div>
                        <h3 className="display text-[1.85rem]">{squad.team.name}</h3>
                        <p className="mt-1 caption text-[0.6875rem] text-muted-foreground">
                          {squad.team.captainName ?? "Captain unassigned"} · {squad.team.squadCount} players
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="numeral text-2xl"><BigMoney amount={squad.team.spentPurse} /></p>
                      <p className="mt-1 caption text-[0.6875rem] text-muted-foreground">
                        spent · {money(squad.team.remainingPurse)} left
                      </p>
                    </div>
                  </div>

                  <TabsContent value="list">
                    {squad.players.length ? (
                      <div className="flex flex-col">
                        {squad.players.map((player) => (
                          <div key={player.id} className="group flex items-center gap-5 border-b border-hairline py-4 transition-colors duration-300 hover:bg-secondary/45">
                            <span className="min-w-0 flex-1 truncate text-[1.0625rem]">{player.name}</span>
                            <span className="hidden shrink-0 caption text-[0.6875rem] text-muted-foreground sm:block">
                              {player.role}{player.isForeign ? " · ✈" : ""}
                            </span>
                            <strong className="numeral w-28 shrink-0 text-right text-[0.9375rem] font-normal">
                              {player.purchasePrice ? money(player.purchasePrice) : "—"}
                            </strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="border-b border-hairline py-8 text-[0.9375rem] text-muted-foreground">No players purchased.</p>
                    )}
                  </TabsContent>

                  <TabsContent value="cards">
                    <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3 stagger">
                      {squad.players.map((player, index) => (
                        <PlayerCard key={player.id} player={player} bid={player.purchasePrice ?? undefined} status="SOLD" index={index + 1} compact />
                      ))}
                    </div>
                  </TabsContent>
                </article>
              ))}
            </div>
          </Tabs>

          {/* ── audit trail ──────────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead index="02" eyebrow="Audit trail" title={<>What <em className="italic">happened.</em></>} />
            <div className="thin-scroll mt-8 max-h-[34rem] overflow-y-auto pr-2">
              {events.slice().reverse().map((event) => (
                <div key={event.sequenceNumber} className="flex items-baseline gap-4 border-t border-hairline py-3.5">
                  <span className="numeral shrink-0 text-[0.6875rem] text-brand">{String(event.sequenceNumber).padStart(3, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate caption text-[0.6875rem]">{event.eventType.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-[0.75rem] text-muted-foreground">
                      {new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              {!events.length && <p className="border-t border-hairline py-8 text-[0.9375rem] text-muted-foreground">No events recorded.</p>}
            </div>
          </aside>
        </div>
      </Shell>
    </main>
  );
}
