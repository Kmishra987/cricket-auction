"use client";

import { Mascot } from "@/components/mascots";
import { money, shortMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type CardPlayer = {
  id: string;
  name: string;
  role: string;
  age?: number | null;
  bio?: string | null;
  isForeign: boolean;
  photo?: string | null;
  battingStyle?: string | null;
  bowlingStyle?: string | null;
  stats?: Record<string, number> | null;
};

const statLabels: Record<string, string> = { matches: "MAT", runs: "RUNS", wickets: "WKT", strikeRate: "SR", economy: "ECO", average: "AVG", fifties: "50s", hundreds: "100s" };

/** Collectible-style card. Tilts a touch on hover; the portrait lifts with it. */
export function PlayerCard({
  player,
  bid,
  basePrice,
  status,
  index = 1,
  compact = false,
}: {
  player: CardPlayer;
  bid?: number;
  basePrice?: number;
  status?: string;
  index?: number;
  compact?: boolean;
}) {
  const stats = Object.entries(player.stats ?? {}).slice(0, compact ? 3 : 4);
  const big = bid ? shortMoney(bid) : null;

  return (
    <article
      aria-label={`${player.name} player card`}
      className="group/pc relative flex flex-col border-2 border-foreground/15 bg-card transition-all duration-500 ease-out hover:-translate-y-1.5 hover:border-foreground"
    >
      <div className="flex items-center justify-between gap-4 border-b border-foreground/15 px-5 py-3">
        <span className="caption text-[0.5625rem] text-muted-foreground">HowzTheBid</span>
        <span className="numeral text-[0.6875rem] text-brand">#{String(index).padStart(2, "0")}</span>
      </div>

      {/* drawn portrait — ruled ground, no plate behind it */}
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden">
        <span
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg,currentColor 0 1px,transparent 1px 7px)" }}
        />
        {player.photo ? (
          <img src={player.photo} alt={`${player.name} portrait`} className="size-full object-cover transition-transform duration-700 ease-out group-hover/pc:scale-[1.05]" />
        ) : (
          <Mascot seed={player.id} title={`${player.role} illustration`} className="relative h-[58%] text-foreground/85 transition-all duration-700 ease-out group-hover/pc:scale-[1.05] group-hover/pc:text-brand" />
        )}
        <span className="caption absolute top-3 right-3 border border-foreground/25 bg-background px-2.5 py-1 text-[0.5625rem]">
          {player.isForeign ? "Overseas" : "India"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <div>
          <p className="eyebrow">{status ?? "On the block"}</p>
          <h3 className={cn("display mt-2 leading-tight", compact ? "text-[1.35rem]" : "text-[1.7rem]")}>{player.name}</h3>
          <p className="mt-1.5 caption text-[0.6875rem] text-muted-foreground">
            {player.role}
            {player.age ? ` · ${player.age} yrs` : ""}
          </p>
        </div>

        {!compact && player.bio && <p className="text-[0.875rem] leading-relaxed text-muted-foreground">{player.bio}</p>}

        {(player.battingStyle || player.bowlingStyle) && (
          <div className="flex flex-wrap gap-2">
            {[player.battingStyle, player.bowlingStyle].filter(Boolean).map((style) => (
              <span key={style} className="border border-foreground/20 px-3 py-1 text-[0.6875rem] text-muted-foreground">{style}</span>
            ))}
          </div>
        )}

        {stats.length > 0 && (
          <div className="grid grid-cols-3 gap-3 border-t border-foreground/15 pt-4">
            {stats.map(([key, value]) => (
              <div key={key}>
                <p className="numeral text-lg leading-none">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</p>
                <p className="mt-1.5 caption text-[0.5625rem] text-muted-foreground">{statLabels[key] ?? key.toUpperCase()}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-4 border-t border-foreground/15 pt-4">
          <div>
            <p className="eyebrow">{status === "SOLD" ? "Sold for" : "Current bid"}</p>
            <p className="numeral mt-1.5 text-2xl leading-none">
              {big ? <>₹{big.value}<span className="ml-1 text-sm text-muted-foreground">{big.unit}</span></> : "—"}
            </p>
          </div>
          <span className="caption text-[0.625rem] text-muted-foreground">
            Base {basePrice ? money(basePrice) : "—"}
          </span>
        </div>
      </div>
    </article>
  );
}
