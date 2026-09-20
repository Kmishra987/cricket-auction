"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ── marks ──────────────────────────────────────────────────────────────── */

/** The cricket-seam mark. Doubles as the logo glyph and as a section divider. */
export function SeamMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.5 4.6C13 9 13 23 9.5 27.4" stroke="currentColor" strokeWidth="1.2" strokeOpacity=".45" />
      <path d="M22.5 4.6C19 9 19 23 22.5 27.4" stroke="currentColor" strokeWidth="1.2" strokeOpacity=".45" />
      {[9, 13, 17, 21].map((y) => (
        <g key={y} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d={`M10.6 ${y}l1.8 1.2`} />
          <path d={`M21.4 ${y}l-1.8 1.2`} />
        </g>
      ))}
    </svg>
  );
}

export function Wordmark({ className, tone = "auto" }: { className?: string; tone?: "auto" | "invert" }) {
  return (
    <span className={cn("group inline-flex items-center gap-2.5 select-none", className)}>
      <SeamMark className={cn("size-7 transition-transform duration-700 ease-out group-hover:rotate-[140deg]", tone === "invert" && "text-brand")} />
      <span className="font-serif text-[1.35rem] tracking-[-0.03em]">
        Howz<em className="not-italic text-brand">The</em>Bid
      </span>
    </span>
  );
}


/** Team mark: a drawn ring and an initial. No plate, no gradient, no fill. */
export function Monogram({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full border border-current/30 font-serif leading-none", className)}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/* ── layout primitives ──────────────────────────────────────────────────── */

export function Shell({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[86rem] px-6 sm:px-10 lg:px-16", className)}>{children}</div>;
}

/** Kicker + oversized serif title + optional trailing action, over a hairline. */
export function SectionHead({
  index,
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  index?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-t border-hairline pt-8", className)}>
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-2xl">
          {(index || eyebrow) && (
            <p className="eyebrow mb-5 flex items-center gap-3">
              {index && <span className="text-brand">{index}</span>}
              {index && eyebrow && <span aria-hidden className="h-px w-6 bg-hairline" />}
              {eyebrow}
            </p>
          )}
          <h2 className="display text-[clamp(2.1rem,4.6vw,3.6rem)]">{title}</h2>
          {description && <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

/** Big numeral over a small mono caption. The workhorse of every summary row. */
export function Stat({ label, value, caption, className }: { label: string; value: ReactNode; caption?: ReactNode; className?: string }) {
  return (
    <div className={cn("group flex flex-col gap-2 border-t border-hairline pt-5 transition-colors duration-500 hover:border-foreground/40", className)}>
      <span className="eyebrow">{label}</span>
      <span className="numeral text-[clamp(1.9rem,3.4vw,2.9rem)] leading-none">{value}</span>
      {caption && <span className="text-[0.8125rem] text-muted-foreground">{caption}</span>}
    </div>
  );
}


/** Two-column editorial block: sticky numbered heading left, the work right. */
export function Block({ index, title, lede, aside, children }: { index: string; title: string; lede: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-10 border-t border-hairline pt-12 lg:grid-cols-[19rem_1fr] lg:gap-16">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <p className="eyebrow mb-6 flex items-center gap-3">
          <span className="text-brand">{index}</span>
          <span aria-hidden className="h-px w-6 bg-hairline" />
        </p>
        <h3 className="display text-[2rem]">{title}</h3>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">{lede}</p>
        {aside && <div className="mt-6">{aside}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/* ── feedback ───────────────────────────────────────────────────────────── */

export function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3.5 text-[0.875rem] leading-relaxed animate-rise",
        tone === "error"
          ? "border-destructive/25 bg-destructive/8 text-destructive"
          : "border-success/25 bg-success/10 text-success",
      )}
    >
      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </p>
  );
}

/** Live status pill. Dot pings while the socket is connected. */
export function LivePip({ label, active, className }: { label: string; active?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 caption text-[0.6875rem] transition-colors",
        active ? "border-brand/40 bg-brand/10 text-brand" : "border-hairline text-muted-foreground",
        className,
      )}
    >
      <span className="relative flex size-1.5">
        {active && <span className="absolute inset-0 rounded-full bg-brand" style={{ animation: "ping-ring 1.8s ease-out infinite" }} />}
        <span className={cn("size-1.5 rounded-full", active ? "bg-brand" : "bg-muted-foreground")} />
      </span>
      {label}
    </span>
  );
}

/** Endless ticker. Content is duplicated so the loop has no seam. */
export function Ticker({ items, className }: { items: string[]; className?: string }) {
  if (!items.length) return null;
  return (
    <div className={cn("relative flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_9%,#000_91%,transparent)]", className)}>
      <div className="flex shrink-0 animate-marquee">
        {[0, 1].map((pass) => (
          <div className="flex shrink-0 items-center" key={pass} aria-hidden={pass === 1}>
            {items.map((item, index) => (
              <span key={`${pass}-${index}`} className="flex items-center gap-8 pr-8 caption text-[0.7rem] whitespace-nowrap text-muted-foreground">
                {item}
                <span className="size-1 rounded-full bg-brand/60" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoadingScreen({ message }: { message: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background">
      <div className="flex flex-col items-center gap-7 animate-fade">
        <SeamMark className="size-10 animate-[spin_2.6s_linear_infinite] text-brand" />
        <span className="eyebrow">{message}</span>
        <span className="relative h-px w-40 overflow-hidden bg-hairline">
          <span className="absolute inset-y-0 w-1/3 bg-brand animate-sweep" />
        </span>
      </div>
    </main>
  );
}
