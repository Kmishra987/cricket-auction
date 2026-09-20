"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Gavel, Hand, Pause, Play, RotateCcw, Share2, Undo2, X } from "lucide-react";
import { PlayerCard, type CardPlayer } from "@/components/player-card";
import { BidBurst, CountdownRing, CricketSeam, Odometer, SoldMark } from "@/components/auction-hero";
import { Mascot } from "@/components/mascots";
import { LivePip, Monogram, SeamMark, Wordmark } from "@/components/chrome";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, User } from "@/lib/api";
import { CRORE, money, shortMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type SquadPlayer = CardPlayer & { purchasePrice?: number | null };
type LiveTeam = { id: string; name: string; logo: string; captainId?: string | null; remainingPurse: number; spentPurse: number; squadCount: number; squad?: SquadPlayer[] };
type Snapshot = { auction: { id: string; organizerId: string; controllerUserId?: string | null; status: string; currentBid: number; bidCount: number; currentPlayerId?: string | null; timerEndsAt?: string | null; basePrice: number; incrementOne: number; incrementTwo: number; incrementThree: number }; currentPlayer?: { player: CardPlayer & { tierId?: string | null }; auctionPlayer: { status: string; orderIndex?: number } }; upcomingPlayers?: Array<{ player: CardPlayer; auctionPlayer: { orderIndex?: number } }>; teams: LiveTeam[] } | null;
type AuctionAccess = { canControl: boolean; controllerUserId?: string | null };
type AuctionEvent = { sequenceNumber: number; eventType: string; createdAt: string; payload: Record<string, unknown> };

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "";
const wsOrigin = process.env.NEXT_PUBLIC_WS_URL ?? "";

/** How long the sold/unsold takeover holds the screen. */
const SETTLE_MS = 3400;

/** Fallback cadence when no socket origin is configured. */
const POLL_MS = 1200;

type Settled = { key: number; outcome: "SOLD" | "UNSOLD"; teamName: string; price: number; playerName: string };

async function publicJson<T>(path: string) { const response = await fetch(`${apiOrigin}${path}`); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error?.message ?? "Could not load the auction room."); return data as T; }

/* ── small parts ────────────────────────────────────────────────────────── */

/** Ruled panel. The rule sits above the label, like a column head. */
function Panel({ title, children, className, accent }: { title: string; children: React.ReactNode; className?: string; accent?: boolean }) {
  return (
    <section className={cn("border-t pt-5", accent ? "border-brand/50" : "border-foreground/20", className)}>
      <p className={cn("caption mb-5 text-[0.625rem]", accent ? "text-brand" : "text-muted-foreground")}>{title}</p>
      {children}
    </section>
  );
}

function ControllerControls({ snapshot, auctionId, ownsControl, reauctionPlayerId, busy, runAction }: { snapshot: NonNullable<Snapshot>; auctionId: string; ownsControl: boolean; reauctionPlayerId: string | null; busy: boolean; runAction: (path: string, body?: Record<string, unknown>) => void }) {
  if (!ownsControl) return <Button variant="outline" size="sm" disabled={busy || Boolean(snapshot.auction.controllerUserId)} onClick={() => runAction(`/api/auctions/${auctionId}/control/acquire`)}><Hand /> Acquire control</Button>;
  return <>
    {snapshot.auction.status === "DRAFT" && <Button size="sm" disabled={busy} onClick={() => runAction(`/api/auctions/${auctionId}/start`)}><Play /> Start auction</Button>}
    {snapshot.auction.status === "LIVE" && snapshot.auction.currentPlayerId && <>
      <Button variant="success" size="sm" disabled={busy} onClick={() => runAction(`/api/auctions/${auctionId}/sell`)}><Gavel /> Sell</Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => runAction(`/api/auctions/${auctionId}/pause`)}><Pause /> Pause</Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => runAction(`/api/auctions/${auctionId}/undo`)}><Undo2 /> Undo bid</Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => runAction(`/api/auctions/${auctionId}/unsold`)}><X /> Unsold</Button>
    </>}
    {snapshot.auction.status === "LIVE" && !snapshot.auction.currentPlayerId && <>
      <Button size="sm" disabled={busy} onClick={() => runAction(`/api/auctions/${auctionId}/next`)}>Next player <ArrowUpRight /></Button>
      <Button variant="outline" size="sm" disabled={busy || !reauctionPlayerId} onClick={() => reauctionPlayerId && runAction(`/api/auctions/${auctionId}/reauction`, { playerId: reauctionPlayerId })}><RotateCcw /> Re-auction</Button>
    </>}
    {snapshot.auction.status === "PAUSED" && <Button size="sm" disabled={busy} onClick={() => runAction(`/api/auctions/${auctionId}/resume`)}><Play /> Resume</Button>}
  </>;
}

function SquadSheet({ team, onClose }: { team: LiveTeam | null; onClose: () => void }) {
  const squad = team?.squad ?? [];
  return (
    <Dialog open={Boolean(team)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent side="bottom" className="thin-scroll overflow-y-auto px-6 pt-8 pb-12 sm:px-10">
        <span aria-hidden className="mx-auto mb-7 h-1 w-11 shrink-0 rounded-full bg-foreground/20" />
        <Tabs defaultValue="list">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-center gap-5">
              <Monogram name={team?.name ?? "?"} className="size-14 text-2xl" />
              <div>
                <p className="caption mb-2 text-[0.625rem] text-muted-foreground">{squad.length} player{squad.length === 1 ? "" : "s"}</p>
                <DialogTitle className="display text-[clamp(1.9rem,4vw,2.8rem)]">{team?.name ?? "Squad"}</DialogTitle>
              </div>
            </div>
            <TabsList>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="cards">Cards</TabsTrigger>
            </TabsList>
          </div>

          {team && (
            <div className="mb-9 grid grid-cols-3 gap-8">
              <div className="border-t border-foreground/20 pt-4">
                <p className="caption text-[0.625rem] text-muted-foreground">Purse left</p>
                <p className="numeral mt-2 text-2xl">{money(team.remainingPurse)}</p>
              </div>
              <div className="border-t border-foreground/20 pt-4">
                <p className="caption text-[0.625rem] text-muted-foreground">Spent</p>
                <p className="numeral mt-2 text-2xl">{money(team.spentPurse)}</p>
              </div>
              <div className="border-t border-foreground/20 pt-4">
                <p className="caption text-[0.625rem] text-muted-foreground">Squad</p>
                <p className="numeral mt-2 text-2xl">{team.squadCount}</p>
              </div>
            </div>
          )}

          {squad.length === 0 ? (
            <p className="border-t border-foreground/20 py-10 text-[0.9375rem] text-muted-foreground">No players bought yet.</p>
          ) : (
            <>
              <TabsContent value="list">
                <div className="flex flex-col stagger">
                  {squad.map((player) => (
                    <div key={player.id} className="group flex items-center gap-5 border-t border-foreground/15 py-4 transition-colors hover:bg-foreground/[0.04]">
                      <Mascot seed={player.id} className="size-8 shrink-0 text-foreground/70 transition-colors group-hover:text-brand" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem]">{player.name}</span>
                        <span className="caption mt-0.5 block text-[0.625rem] text-muted-foreground">{player.role}{player.isForeign ? " · overseas" : ""}</span>
                      </span>
                      <b className="numeral text-[0.9375rem] font-normal">{player.purchasePrice ? money(player.purchasePrice) : "—"}</b>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="cards">
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 stagger">
                  {squad.map((player, position) => <PlayerCard key={player.id} player={player} bid={player.purchasePrice ?? undefined} status="SOLD" index={position + 1} compact />)}
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The result, called out loud. SOLD lands hot with drawn rays; UNSOLD is cooler
 * and greyer, so the two never read the same at a glance.
 */
function SettleTakeover({ settled }: { settled: Settled }) {
  const sold = settled.outcome === "SOLD";
  return (
    <div role="status" className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-background/94 px-6 backdrop-blur-xl animate-fade">
      {sold && (
        <svg aria-hidden className="pointer-events-none absolute inset-0 size-full text-brand opacity-45" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <g stroke="currentColor" strokeWidth="0.28" fill="none" style={{ animation: "burst 1.5s cubic-bezier(0.22,1,0.36,1) both", transformOrigin: "50px 50px" }}>
            {Array.from({ length: 28 }, (_, index) => {
              const angle = (index / 28) * Math.PI * 2;
              return <line key={index} x1={50 + Math.cos(angle) * 16} y1={50 + Math.sin(angle) * 16} x2={50 + Math.cos(angle) * 90} y2={50 + Math.sin(angle) * 90} />;
            })}
          </g>
        </svg>
      )}

      <div className="relative text-center" style={{ animation: "slam 0.75s cubic-bezier(0.22,1,0.36,1) both" }}>
        <p className={cn("display text-[clamp(3.6rem,15vw,10rem)] leading-none tracking-[-0.05em]", sold ? "text-brand" : "text-muted-foreground")}>
          {sold ? "SOLD" : "UNSOLD"}
        </p>
        <SoldMark className={cn("mx-auto mt-1 w-[min(70vw,22rem)]", sold ? "text-brand" : "text-muted-foreground/50")} />

        {sold ? (
          <>
            <p className="numeral mt-10 text-[clamp(2rem,6vw,3.4rem)]">{money(settled.price)}</p>
            <p className="caption mt-5 text-[0.7rem] text-muted-foreground">to {settled.teamName}</p>
          </>
        ) : (
          <p className="caption mt-9 text-[0.7rem] text-muted-foreground">No bids · back in the pool</p>
        )}

        <p className="display mt-4 text-[clamp(1.4rem,3.5vw,2.2rem)]">{settled.playerName}</p>
      </div>
    </div>
  );
}

/* ── page ───────────────────────────────────────────────────────────────── */

export default function PublicLivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [snapshot, setSnapshot] = useState<Snapshot>(null);
  const [events, setEvents] = useState<AuctionEvent[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<AuctionAccess | null>(null);
  const [connection, setConnection] = useState("Connecting");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bidding, setBidding] = useState(true);
  const [shareState, setShareState] = useState("Share");
  const [openSquad, setOpenSquad] = useState<string | null>(null);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [milestone, setMilestone] = useState<{ key: number; amount: number } | null>(null);
  const [burst, setBurst] = useState(0);

  const current = snapshot?.currentPlayer?.player;
  const auctionId = snapshot?.auction.id;
  const myTeam = snapshot?.teams.find((team) => team.captainId === user?.id);
  const canControl = Boolean(access?.canControl);
  const ownsControl = Boolean(user && snapshot?.auction.controllerUserId === user.id);
  const lastEvent = events.at(-1);
  const lastUnsoldPlayerId = useMemo(() => { const event = [...events].reverse().find((item) => item.eventType === "PLAYER_UNSOLD" && typeof item.payload.playerId === "string" && !item.payload.timerExpired); return typeof event?.payload.playerId === "string" ? event.payload.playerId : null; }, [events]);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let expectedSequence = 0;

    const pull = () => publicJson<{ snapshot: Snapshot }>(`/api/public/auctions/${slug}`)
      .then((data) => { if (cancelled) return; setSnapshot(data.snapshot); setConnection("Live"); })
      .catch(() => { if (!cancelled) setConnection("Reconnecting…"); });

    const connect = (id: string) => {
      if (cancelled) return;
      const origin = new URL(wsOrigin);
      origin.protocol = origin.protocol === "https:" ? "wss:" : origin.protocol === "http:" ? "ws:" : origin.protocol;
      origin.pathname = "/ws";
      origin.search = `?auctionId=${encodeURIComponent(id)}`;
      socket = new WebSocket(origin.toString());
      socket.onopen = () => setConnection("Live");
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as { type?: string; sequence?: number; snapshot?: Snapshot };
          if (message.type === "AUCTION_STATE" && message.snapshot) {
            if (message.sequence && expectedSequence && message.sequence > expectedSequence + 1) socket?.send(JSON.stringify({ type: "RESYNC" }));
            expectedSequence = message.sequence ?? expectedSequence;
            setSnapshot(message.snapshot);
          }
        } catch { /* Ignore malformed viewer messages. */ }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => { if (!cancelled) { setConnection("Reconnecting…"); retry = setTimeout(() => connect(id), 1200); } };
    };

    /**
     * A socket when one is reachable, polling otherwise. Serverless hosts cannot
     * hold a connection open, so the room falls back to pulling the snapshot.
     */
    const subscribe = (id: string) => { if (wsOrigin) connect(id); else { setConnection("Live"); poll = setInterval(pull, POLL_MS); } };

    Promise.all([publicJson<{ snapshot: Snapshot }>(`/api/public/auctions/${slug}`), api<{ user: User }>("/api/auth/me").catch(() => null)]).then(async ([data, me]) => {
      if (cancelled) return;
      setSnapshot(data.snapshot);
      setUser(me?.user ?? null);
      if (!data.snapshot) return;
      const history = await publicJson<{ events: AuctionEvent[] }>(`/api/public/auctions/${slug}/history`).catch(() => ({ events: [] }));
      if (!cancelled) setEvents(history.events);
      if (me?.user) api<AuctionAccess>(`/api/auctions/${data.snapshot.auction.id}/access`).then(setAccess).catch(() => undefined);
      subscribe(data.snapshot.auction.id);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load this auction."));

    return () => { cancelled = true; clearTimeout(retry); clearInterval(poll); socket?.close(); };
  }, [slug]);

  /**
   * The poll only carries snapshots, so the event log has to be pulled
   * whenever the room moves. Without this only the controller — who refetches
   * after their own action — ever sees the sold moment or the bid feed.
   */
  const auctionState = snapshot ? `${snapshot.auction.status}:${snapshot.auction.bidCount}:${snapshot.auction.currentPlayerId ?? ""}` : "";
  useEffect(() => {
    if (!auctionState) return;
    let cancelled = false;
    publicJson<{ events: AuctionEvent[] }>(`/api/public/auctions/${slug}/history`)
      .then((history) => { if (!cancelled) setEvents(history.events); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [slug, auctionState]);

  async function refreshSnapshot() { const [next, history] = await Promise.all([publicJson<{ snapshot: Snapshot }>(`/api/public/auctions/${slug}`), publicJson<{ events: AuctionEvent[] }>(`/api/public/auctions/${slug}/history`)]); setSnapshot(next.snapshot); setEvents(history.events); }
  async function runAction(path: string, body?: Record<string, unknown>) { setBusy(true); setActionError(null); try { await api(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }); await refreshSnapshot(); } catch (reason) { setActionError(reason instanceof Error ? reason.message : "Action could not be completed."); } finally { setBusy(false); } }
  async function shareRoom() { const url = window.location.href; try { if (navigator.share) await navigator.share({ title: "HowzTheBid", text: "Join the live auction", url }); else await navigator.clipboard.writeText(url); setShareState("Copied"); } catch { setShareState("Share"); } }

  const currentBid = snapshot?.auction.currentBid ?? 0;
  const bigBid = shortMoney(currentBid);
  const isLive = snapshot?.auction.status === "LIVE";

  // Increments ascend: the smallest raise is the recommended one, so it carries
  // the brand colour and the other two are tonal steps up from it.
  const increments = useMemo(() => {
    const raw = snapshot ? [snapshot.auction.incrementOne, snapshot.auction.incrementTwo, snapshot.auction.incrementThree] : [];
    return [...new Set(raw.filter((value) => value > 0))].sort((a, b) => a - b);
  }, [snapshot]);
  const bidsLocked = busy || !bidding || !isLive || !snapshot?.auction.currentPlayerId;

  // The team currently leading, read off the bid log rather than the snapshot.
  const leadingTeamId = useMemo(() => {
    const bid = [...events].reverse().find((item) => item.eventType === "BID_PLACED" && item.payload.playerId === snapshot?.auction.currentPlayerId);
    return typeof bid?.payload.teamId === "string" ? bid.payload.teamId : null;
  }, [events, snapshot?.auction.currentPlayerId]);
  const leadingTeam = snapshot?.teams.find((team) => team.id === leadingTeamId) ?? null;

  const activity = useMemo(() => events
    .filter((item) => item.eventType === "BID_PLACED")
    .slice(-7).reverse()
    .map((item) => ({
      key: item.sequenceNumber,
      team: snapshot?.teams.find((team) => team.id === item.payload.teamId)?.name ?? "Unknown",
      amount: Number(item.payload.amount ?? 0),
    })), [events, snapshot?.teams]);

  // Bid burst — one short mark per raise.
  useEffect(() => { if (!currentBid) return; setBurst((count) => count + 1); }, [currentBid]);

  // A new player on the block re-arms the captain's bidding.
  useEffect(() => { setBidding(true); }, [snapshot?.auction.currentPlayerId]);

  // The sale event only carries ids, so remember who was on the block to name them.
  const onBlock = useRef<{ id: string; name: string } | null>(null);
  useEffect(() => { if (current) onBlock.current = { id: current.id, name: current.name }; }, [current?.id, current?.name]);

  // The settle moment — sold or unsold, one takeover per event, self-clearing.
  const teamsRef = useRef<LiveTeam[]>([]);
  teamsRef.current = snapshot?.teams ?? teamsRef.current;
  useEffect(() => {
    if (!lastEvent || (lastEvent.eventType !== "PLAYER_SOLD" && lastEvent.eventType !== "PLAYER_UNSOLD")) return;
    const outcome = lastEvent.eventType === "PLAYER_SOLD" ? "SOLD" : "UNSOLD";
    const team = teamsRef.current.find((candidate) => candidate.id === lastEvent.payload.teamId);
    const seen = onBlock.current;
    setSettled({
      key: lastEvent.sequenceNumber,
      outcome,
      teamName: team?.name ?? "a team",
      price: Number(lastEvent.payload.salePrice ?? lastEvent.payload.amount ?? 0),
      playerName: seen && seen.id === lastEvent.payload.playerId ? seen.name : "The player",
    });
    const timer = setTimeout(() => setSettled(null), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [lastEvent?.sequenceNumber, lastEvent?.eventType]);

  /**
   * Roll on to the next player once the takeover has played, so the room keeps
   * moving without the organizer reaching for a button. Only the controller's
   * client posts it; everyone else just receives the new snapshot.
   */
  const advanced = useRef<number | null>(null);
  useEffect(() => {
    if (!ownsControl || !auctionId || !isLive) return;
    if (snapshot?.auction.currentPlayerId) return;
    if (!lastEvent || (lastEvent.eventType !== "PLAYER_SOLD" && lastEvent.eventType !== "PLAYER_UNSOLD")) return;
    if (advanced.current === lastEvent.sequenceNumber) return;
    advanced.current = lastEvent.sequenceNumber;
    const timer = setTimeout(() => { runAction(`/api/auctions/${auctionId}/next`); }, SETTLE_MS + 350);
    return () => clearTimeout(timer);
  }, [ownsControl, auctionId, isLive, snapshot?.auction.currentPlayerId, lastEvent?.sequenceNumber, lastEvent?.eventType]);

  // ₹1 crore club — one celebration per player, whenever the bid crosses the line.
  const celebrated = useRef(new Set<string>());
  useEffect(() => {
    const playerId = snapshot?.auction.currentPlayerId;
    if (!playerId || currentBid < CRORE || celebrated.current.has(playerId)) return;
    celebrated.current.add(playerId);
    setMilestone({ key: Date.now(), amount: currentBid });
    const timer = setTimeout(() => setMilestone(null), 3300);
    return () => clearTimeout(timer);
  }, [currentBid, snapshot?.auction.currentPlayerId]);

  const squadTeam = snapshot?.teams.find((team) => team.id === openSquad) ?? null;

  if (error) {
    return (
      <main className="dark grid min-h-dvh place-items-center bg-background px-6 text-foreground">
        <div className="max-w-lg text-center stagger">
          <SeamMark className="mx-auto size-10 text-brand" />
          <p className="caption mt-8 text-[0.7rem] text-muted-foreground">HowzTheBid</p>
          <h1 className="display mt-5 text-[clamp(2rem,5vw,3.2rem)]">{error}</h1>
          <p className="mt-5 text-[0.9375rem] text-muted-foreground">Check the shared link and try again.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="dark relative min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-foreground/15 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-[92rem] items-center justify-between gap-6 px-6 sm:px-10">
          <Wordmark />
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={shareRoom}><Share2 /> {shareState}</Button>
            <LivePip label={isLive ? "Live" : snapshot?.auction.status ?? connection} active={connection === "Live" && isLive} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[92rem] gap-12 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:gap-20 lg:py-16">
        {/* ── the block ───────────────────────────────────────────────── */}
        {current ? (
          <section className="min-w-0">
            <div className="flex items-baseline justify-between gap-4 border-t-2 border-foreground pt-4">
              <span className="caption flex items-center gap-2.5 text-[0.625rem] text-brand">
                <span className="size-1.5 rounded-full bg-brand animate-[breathe_1.8s_ease-in-out_infinite]" />
                On the block
              </span>
              <span className="numeral text-[0.75rem] text-muted-foreground">
                Lot {String((snapshot?.currentPlayer?.auctionPlayer.orderIndex ?? 0) + 1).padStart(2, "0")}
              </span>
            </div>

            {/* portrait + name, side by side so the name gets real size */}
            <div className="mt-10 flex flex-col items-center gap-10 sm:flex-row sm:items-end sm:gap-12">
              <CountdownRing endsAt={snapshot?.auction.timerEndsAt} running={isLive}>
                {current.photo
                  ? <img src={current.photo} alt={`${current.name} portrait`} key={current.id} />
                  : <Mascot seed={current.id} title={`${current.role} illustration`} className="size-[52%] text-foreground/85" />}
              </CountdownRing>

              <div key={current.id} className="min-w-0 flex-1 text-center sm:pb-4 sm:text-left">
                <h1 className="display animate-rise text-[clamp(2.4rem,6vw,4.4rem)]">{current.name}</h1>
                <p className="caption mt-4 text-[0.7rem] text-muted-foreground">
                  {current.role} · {current.isForeign ? "Overseas" : "India"}{current.age ? ` · ${current.age} yrs` : ""}
                </p>
                {leadingTeam && (
                  <p className="mt-6 inline-flex items-center gap-3 border-t border-brand/50 pt-3 animate-rise">
                    <Monogram name={leadingTeam.name} className="size-8 text-sm text-brand" />
                    <span className="text-[0.9375rem]">{leadingTeam.name}</span>
                    <span className="caption text-[0.625rem] text-brand">leading</span>
                  </p>
                )}
              </div>
            </div>

            {/* the number, and the climb that got there */}
            <div className="relative mt-14 border-t border-foreground/20 pt-8">
              {burst > 0 && <BidBurst className="absolute top-6 right-0 size-8 text-brand" key={burst} />}
              <div className="flex flex-wrap items-end justify-between gap-8">
                <div>
                  <p className="caption text-[0.625rem] text-muted-foreground">Current bid</p>
                  <div className="numeral mt-4 flex items-baseline gap-2 text-[clamp(3.2rem,9vw,5.6rem)] leading-none">
                    <span className="text-[0.4em] text-muted-foreground">₹</span>
                    <Odometer text={bigBid.value} />
                    <span className="text-[0.28em] tracking-[0.08em] text-brand uppercase">{bigBid.unit}</span>
                  </div>
                  <p className="caption mt-5 text-[0.625rem] text-muted-foreground">
                    {snapshot?.auction.bidCount ?? 0} bid{snapshot?.auction.bidCount === 1 ? "" : "s"} · base {money(snapshot?.auction.basePrice ?? 0)}
                  </p>
                </div>

              </div>
            </div>

            {/* raises — fixed steps, never the running total */}
            {myTeam ? (
              <div className="mt-12">
                <div className="grid gap-4 sm:grid-cols-3">
                  {increments.map((increment, position) => {
                    const step = shortMoney(increment);
                    return (
                      <button
                        key={increment}
                        disabled={bidsLocked}
                        onClick={() => auctionId && runAction(`/api/auctions/${auctionId}/bid`, { increment })}
                        className={cn(
                          "group relative flex h-28 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-none border-2 transition-all duration-300 ease-out active:translate-y-0 disabled:pointer-events-none disabled:opacity-25",
                          position === 0
                            ? "border-brand bg-brand text-white hover:-translate-y-1.5 hover:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--brand)]"
                            : "border-foreground/30 hover:-translate-y-1.5 hover:border-foreground hover:shadow-[0_0_0_2px_var(--background),0_0_0_4px_color-mix(in_oklab,var(--foreground)_45%,transparent)]",
                        )}
                      >
                        <span className="numeral flex items-baseline gap-1 text-[2rem] leading-none">
                          <span className={cn("text-[0.55em]", position === 0 ? "text-white/70" : "text-muted-foreground")}>+₹</span>
                          {step.value}
                          <span className={cn("text-[0.45em] tracking-[0.08em] uppercase", position === 0 ? "text-white/70" : "text-brand")}>{step.unit}</span>
                        </span>
                        <span className={cn("caption text-[0.5625rem]", position === 0 ? "text-white/70" : "text-muted-foreground")}>
                          {position === 0 ? "Quick raise" : "Raise"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={!bidding}
                  onClick={() => setBidding(false)}
                  className="caption mx-auto mt-7 block cursor-pointer text-[0.625rem] text-muted-foreground transition-colors hover:text-destructive disabled:cursor-default disabled:text-muted-foreground/50"
                >
                  {bidding ? "Cancel bid" : "You are out of this player"}
                </button>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="flex min-h-[50vh] flex-col items-center justify-center gap-7 text-center">
            <CricketSeam className="w-32 text-brand" />
            <h2 className="display text-[clamp(2rem,5vw,3.2rem)]">Preparing the<br /><em className="italic">next player.</em></h2>
            <p className="max-w-sm text-[0.9375rem] leading-relaxed text-muted-foreground">The stage lights up when the next name is called.</p>
          </section>
        )}

        {/* ── the room ────────────────────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-12">
          <Panel title="Teams">
            <div className="flex flex-col">
              {snapshot?.teams.map((team) => {
                const mine = team.id === myTeam?.id;
                const leading = team.id === leadingTeam?.id;
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setOpenSquad(team.id)}
                    className={cn(
                      "group flex cursor-pointer flex-col gap-3 border-b py-4 text-left transition-all duration-300 first:border-t",
                      leading ? "border-brand/40" : "border-foreground/12 hover:border-foreground/35",
                    )}
                  >
                    <span className="flex items-center gap-3.5">
                      <Monogram name={team.name} className={cn("size-9 text-base transition-colors", leading ? "text-brand" : "text-foreground/70 group-hover:text-foreground")} />
                      <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{team.name}</span>
                      {mine && <span className="caption shrink-0 text-[0.5625rem] text-brand">you</span>}
                      {leading && !mine && <span className="caption shrink-0 text-[0.5625rem] text-brand">lead</span>}
                    </span>

                    <span className="flex items-baseline justify-between gap-3">
                      <span className="numeral text-[0.8125rem]">{money(team.remainingPurse)}</span>
                      <span className="caption text-[0.5625rem] text-muted-foreground">{team.squadCount} picked</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>

          {activity.length > 0 && (
            <Panel title="Bid feed">
              <div className="flex flex-col">
                {activity.map((item, position) => (
                  <div key={item.key} className={cn("flex items-baseline justify-between gap-4 border-b border-foreground/12 py-2.5", position === 0 && "animate-rise")}>
                    <span className="truncate text-[0.875rem]">{item.team}</span>
                    <span className={cn("numeral shrink-0 text-[0.8125rem]", position === 0 ? "text-brand" : "text-muted-foreground")}>{money(item.amount)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {canControl && snapshot && auctionId && (
            <Panel title="Controller" accent>
              <p className={cn("mb-5 text-[0.8125rem] leading-relaxed", actionError ? "text-destructive" : "text-muted-foreground")}>
                {actionError ?? (ownsControl ? "You have the room. Players advance on their own after each result." : snapshot.auction.controllerUserId ? "Another controller is active." : "Control is available.")}
              </p>
              <div className="flex flex-wrap gap-2.5">
                <ControllerControls snapshot={snapshot} auctionId={auctionId} ownsControl={ownsControl} reauctionPlayerId={lastUnsoldPlayerId} busy={busy} runAction={runAction} />
              </div>
            </Panel>
          )}

          {!user && (
            <p className="border-t border-dashed border-foreground/25 pt-5 text-[0.8125rem] leading-relaxed text-muted-foreground">
              You are watching as a spectator. Sign in as a captain to bid.
            </p>
          )}
        </aside>
      </div>

      <SquadSheet team={squadTeam} onClose={() => setOpenSquad(null)} />

      {settled && <SettleTakeover settled={settled} key={`settle-${settled.key}`} />}

      {milestone && (
        <div role="status" key={`crore-${milestone.key}`} className="fixed right-6 bottom-6 z-50 flex max-w-sm items-start gap-4 border-2 border-brand bg-background px-6 py-5 animate-rise">
          <span className="text-2xl text-brand">★</span>
          <div>
            <strong className="block font-serif text-lg font-normal">₹1 Crore club</strong>
            <small className="mt-1 block text-[0.8125rem] leading-relaxed text-muted-foreground">{money(milestone.amount)} — that one changed the room.</small>
          </div>
        </div>
      )}
    </main>
  );
}
