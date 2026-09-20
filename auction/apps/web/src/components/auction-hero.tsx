"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* ── artifacts ──────────────────────────────────────────────────────────────
   Hand-drawn marks, deliberately irregular. The one place the interface stops
   being perfectly geometric. Shared stroke language: round caps, no fills. */

export function CricketSeam({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 8" fill="none" aria-hidden="true">
      <path d="M2 4h116" stroke="currentColor" strokeOpacity=".18" strokeWidth="1" />
      {[22, 38, 54, 70, 86].map((x) => (
        <path key={x} d={`M${x} 1.5c1.6 1 1.6 4 0 5`} stroke="currentColor" strokeOpacity=".5" strokeWidth="1.4" strokeLinecap="round" />
      ))}
    </svg>
  );
}

/** Irregular asterisk. Flashes for ~600ms when a bid lands. */
export function BidBurst({ className }: { className?: string }) {
  return (
    <svg className={cn("pointer-events-none", className)} viewBox="0 0 64 64" fill="none" aria-hidden="true" style={{ animation: "burst 0.6s cubic-bezier(0.22,1,0.36,1) forwards" }}>
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M32 6v16" /><path d="M32 42v16" />
        <path d="M6 32h16" /><path d="M42 32h16" />
        <path d="M14 13l11 12" /><path d="M39 39l12 11" />
        <path d="M50 13L38 25" /><path d="M25 39L13 51" />
      </g>
    </svg>
  );
}

/** The sold stamp. Rough underline, not a perfect rectangle. Draws itself in. */
export function SoldMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 22" fill="none" aria-hidden="true">
      <path d="M4 14c26-6 54-9 78-9 26 0 51 3 74 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="170" style={{ ["--len" as string]: 170, animation: "draw 0.9s 0.25s cubic-bezier(0.22,1,0.36,1) both" }} />
      <path d="M12 20c24-5 50-7 72-7 24 0 46 2 66 6" stroke="currentColor" strokeWidth="1.6" strokeOpacity=".45" strokeLinecap="round" strokeDasharray="160" style={{ ["--len" as string]: 160, animation: "draw 0.9s 0.45s cubic-bezier(0.22,1,0.36,1) both" }} />
    </svg>
  );
}

/* ── countdown ──────────────────────────────────────────────────────────────
   Drains against the wall clock, so a slow frame never desyncs it from the
   server's timer. The ring stays quiet until the last ten seconds. */

const RADIUS = 132;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const urgencyTone = {
  idle: "text-foreground/25",
  normal: "text-brand",
  warn: "text-amber-400",
  critical: "text-brand",
} as const;

export function CountdownRing({ endsAt, running, children }: { endsAt?: string | null; running: boolean; children: React.ReactNode }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const total = useRef(0);

  useEffect(() => {
    if (!endsAt) { setRemaining(null); total.current = 0; return; }
    const end = new Date(endsAt).getTime();
    const read = () => setRemaining(Math.max(0, (end - Date.now()) / 1000));
    // The server sends only an end time, so the first reading defines the span.
    total.current = Math.max(1, (end - Date.now()) / 1000);
    read();
    if (!running) return;
    let frame = requestAnimationFrame(function tick() { read(); frame = requestAnimationFrame(tick); });
    return () => cancelAnimationFrame(frame);
  }, [endsAt, running]);

  const fraction = remaining === null ? 0 : Math.min(1, remaining / total.current);
  const urgency = remaining === null ? "idle" : remaining <= 5 ? "critical" : remaining <= 10 ? "warn" : "normal";

  return (
    <div className={cn("relative isolate grid aspect-square w-[min(74vw,21rem)] place-items-center", urgency === "critical" && "animate-[breathe_0.9s_ease-in-out_infinite]")}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 300 300" aria-hidden="true">
        <circle cx="150" cy="150" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground/10" />
        {remaining !== null && (
          <circle
            cx="150" cy="150" r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className={cn("transition-colors duration-500", urgencyTone[urgency])}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          />
        )}
      </svg>

      <div className="relative grid size-[82%] place-items-center overflow-hidden rounded-full border border-foreground/10 bg-gradient-to-b from-foreground/[0.07] to-transparent [&>img]:size-full [&>img]:object-cover [&>img]:animate-fade">
        {children}
      </div>

      {remaining !== null && (
        <div
          role="timer"
          aria-live="off"
          className={cn(
            "numeral absolute -bottom-3 grid h-14 min-w-14 place-items-center rounded-full border border-foreground/12 bg-background px-4 text-2xl tabular-nums transition-colors duration-500",
            urgencyTone[urgency],
          )}
        >
          {Math.ceil(remaining)}
        </div>
      )}
    </div>
  );
}

/* ── odometer ───────────────────────────────────────────────────────────────
   Each digit is a reel of 0-9 that slides. A crossfade would read as a value
   swap; this reads as a machine counting up. */

export function Odometer({ text }: { text: string }) {
  return (
    <span className="inline-flex items-baseline">
      <span className="sr-only">{text}</span>
      {text.split("").map((character, index) =>
        /\d/.test(character) ? (
          <span className="inline-block h-[0.92em] overflow-hidden align-baseline" key={index} aria-hidden="true">
            <span
              className="flex flex-col transition-transform duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: `translateY(${-Number(character) * 10}%)` }}
            >
              {["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <span className="h-[0.92em] leading-[0.92em]" key={digit}>{digit}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={index} aria-hidden="true">{character}</span>
        ),
      )}
    </span>
  );
}
