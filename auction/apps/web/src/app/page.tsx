"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, LogOut } from "lucide-react";
import { api, Tournament, User } from "@/lib/api";
import { AuthPanel } from "@/components/auth-panel";
import { CreateTournament } from "@/components/create-tournament";
import { SetupView } from "@/components/setup-view";
import { Button } from "@/components/ui/button";
import { LivePip, LoadingScreen, SectionHead, Shell, Wordmark } from "@/components/chrome";

function TopBar({ user, onSignOut, right }: { user: User; onSignOut: () => void; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-background/80 backdrop-blur-xl">
      <Shell className="flex h-20 items-center justify-between gap-6">
        <Wordmark />
        <div className="flex items-center gap-3">
          {right}
          <button
            onClick={onSignOut}
            className="group flex items-center gap-3 rounded-full border border-hairline py-1.5 pr-5 pl-1.5 transition-colors duration-300 hover:border-foreground/35"
          >
            <span className="grid size-9 place-items-center rounded-full bg-primary caption text-[0.7rem] text-primary-foreground">
              {user.displayName.slice(0, 2).toUpperCase()}
            </span>
            <span className="hidden text-[0.875rem] sm:inline">Sign out</span>
            <LogOut className="size-3.5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        </div>
      </Shell>
    </header>
  );
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUser() {
    try {
      const me = await api<{ user: User }>("/api/auth/me");
      setUser(me.user);
      setTournaments((await api<{ tournaments: Tournament[] }>("/api/tournaments")).tournaments);
    } catch { setUser(null); } finally { setLoading(false); }
  }

  useEffect(() => { loadUser(); }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null); setTournaments([]); setActiveTournament(null);
  }

  if (loading) return <LoadingScreen message="Opening your room" />;
  if (!user) return <AuthPanel onAuthenticated={(nextUser) => { setUser(nextUser); loadUser(); }} />;

  if (activeTournament) {
    return (
      <main className="min-h-dvh">
        <TopBar user={user} onSignOut={logout} />
        <Shell><SetupView tournament={activeTournament} user={user} onBack={() => setActiveTournament(null)} /></Shell>
      </main>
    );
  }

  const first = tournaments[0];

  return (
    <main className="min-h-dvh">
      <TopBar user={user} onSignOut={logout} right={first ? <LivePip label="Room ready" active className="hidden md:inline-flex" /> : undefined} />

      <Shell className="pb-32">
        {!first ? (
          <CreateTournament onCreated={(tournament) => { setTournaments([tournament]); setActiveTournament(tournament); }} />
        ) : (
          <>
            {/* ── hero ──────────────────────────────────────────────── */}
            <section className="grid gap-14 py-20 lg:grid-cols-[1.35fr_1fr] lg:gap-24 lg:py-28">
              <div className="stagger">
                <p className="eyebrow mb-8">Hi, {user.displayName.split(" ")[0]} — your next room</p>
                <h1 className="display text-[clamp(3rem,7.5vw,6.6rem)]">
                  Make it a
                  <br />
                  <em className="italic text-brand">great one.</em>
                </h1>
                <p className="mt-9 max-w-lg text-[1.0625rem] leading-relaxed text-muted-foreground">
                  {first.name} is ready for teams, captains, and the players who will make this auction worth remembering.
                </p>
                <div className="mt-11 flex flex-wrap items-center gap-4">
                  <Button size="xl" className="gleam" onClick={() => setActiveTournament(first)}>Open setup <ArrowUpRight /></Button>
                  <Button size="xl" variant="outline" asChild>
                    <a href={`/auction/${first.slug}/live`}>Live room <ArrowUpRight /></a>
                  </Button>
                  <a href={`/auction/${first.slug}/results`} className="link-sweep ml-2 text-[0.9375rem] text-muted-foreground hover:text-foreground">
                    Results
                  </a>
                </div>
              </div>

              {/* index card: the room at a glance */}
              <aside className="relative self-start overflow-hidden rounded-2xl border border-hairline bg-card p-9 transition-transform duration-700 ease-out hover:-translate-y-1.5 animate-rise">
                <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-brand/10 blur-3xl" />
                <p className="eyebrow">The room</p>
                <p className="display mt-5 text-[2.1rem]">{first.name}</p>
                <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
                  {first.description || "Configuration in progress."}
                </p>
                <dl className="mt-9 flex flex-col">
                  {[
                    ["Rooms", String(tournaments.length)],
                    ["Slug", first.slug],
                    ["Created", new Date(first.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-6 border-t border-hairline py-4">
                      <dt className="eyebrow">{label}</dt>
                      <dd className="numeral truncate text-[0.9375rem]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </aside>
            </section>

            {/* ── contents ──────────────────────────────────────────── */}
            <SectionHead
              index="01"
              eyebrow="Your tournaments"
              title={<>Keep the momentum <em className="italic">going.</em></>}
              description="Every room you organise, newest first. Open one to edit teams, players, and the rules it runs on."
            />

            <div className="mt-14 flex flex-col stagger">
              {tournaments.map((tournament, index) => (
                <button
                  key={tournament.id}
                  onClick={() => setActiveTournament(tournament)}
                  className="group relative flex items-center gap-6 border-t border-hairline py-8 text-left transition-colors duration-500 last:border-b hover:border-foreground/30 sm:gap-10"
                >
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-brand transition-transform duration-700 ease-out group-hover:scale-x-100" />
                  <span className="numeral w-12 shrink-0 text-[0.8125rem] text-muted-foreground transition-colors duration-300 group-hover:text-brand">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="display block truncate text-[clamp(1.5rem,3.2vw,2.35rem)] transition-transform duration-500 ease-out group-hover:translate-x-1.5">
                      {tournament.name}
                    </span>
                    <span className="mt-2 block truncate text-[0.9375rem] text-muted-foreground">
                      {tournament.description || "Configuration in progress"}
                    </span>
                  </span>
                  <ArrowUpRight className="size-6 shrink-0 text-muted-foreground transition-all duration-500 ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-brand" />
                </button>
              ))}
            </div>
          </>
        )}
      </Shell>
    </main>
  );
}
