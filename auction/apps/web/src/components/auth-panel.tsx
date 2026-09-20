"use client";

import { FormEvent, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { api, User } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LivePip, Notice, SeamMark, Ticker, Wordmark } from "@/components/chrome";

type AuthMode = "login" | "register";

const marquee = [
  "₹1.2 Cr — Rohit Kadam",
  "Sold to Deccan Kings",
  "Base ₹5 L",
  "42 bids in 90 seconds",
  "₹86 L — Aisha Menon",
  "Purse ₹10 Cr",
];

export function AuthPanel({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = await api<{ user: User }>(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        body: JSON.stringify(mode === "login" ? { identifier: username, password } : { username, email, displayName, password }),
      });
      onAuthenticated(data.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not connect to the auction room.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* ── the poster ─────────────────────────────────────────────────── */}
      <section className="dark relative flex flex-col justify-between overflow-hidden bg-background px-8 py-12 text-foreground sm:px-14 lg:px-20 lg:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.055]"
          style={{ backgroundImage: "linear-gradient(var(--foreground) 1px,transparent 1px),linear-gradient(90deg,var(--foreground) 1px,transparent 1px)", backgroundSize: "84px 84px" }}
        />
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[34rem] rounded-full bg-brand/18 blur-[130px]" />

        <div className="relative flex items-center justify-between gap-6">
          <Wordmark />
          <LivePip label="Room open" active />
        </div>

        <div className="relative mt-20 max-w-2xl stagger">
          <p className="eyebrow mb-8">Cricket auctions, run properly</p>
          <h1 className="display text-[clamp(3.1rem,7.4vw,6.2rem)]">
            Make the room
            <br />
            <em className="italic text-brand">come alive.</em>
          </h1>
          <p className="mt-9 max-w-md text-[1.0625rem] leading-relaxed text-muted-foreground">
            Set the rules, invite your captains, and put every raise on one screen. The gavel falls where everyone can see it.
          </p>
          <div className="mt-12 grid max-w-lg grid-cols-3 gap-x-8 gap-y-3 border-t border-hairline pt-7">
            {[
              ["Live", "websocket room"],
              ["Fair", "full audit trail"],
              ["Shareable", "one link"],
            ].map(([head, sub]) => (
              <div key={head}>
                <p className="font-serif text-xl">{head}</p>
                <p className="mt-1 caption text-[0.65rem] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-16 flex items-center gap-6 border-t border-hairline pt-7">
          <SeamMark className="size-5 shrink-0 text-brand" />
          <Ticker items={marquee} className="flex-1" />
        </div>
      </section>

      {/* ── the form ───────────────────────────────────────────────────── */}
      <section className="flex items-center justify-center bg-background px-6 py-16 sm:px-12 lg:px-16">
        <div className="w-full max-w-[27rem] stagger">
          <Tabs value={mode} onValueChange={(value) => { setMode(value as AuthMode); setError(null); }}>
            <TabsList className="w-full [&>*]:flex-1">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Create account</TabsTrigger>
            </TabsList>
          </Tabs>

          <h2 className="display mt-11 text-[clamp(2.2rem,4vw,2.9rem)]">
            {mode === "login" ? (
              <>
                Welcome
                <br />
                <em className="italic">back.</em>
              </>
            ) : (
              <>
                Start something
                <br />
                <em className="italic">great.</em>
              </>
            )}
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
            {mode === "login" ? "Your next auction is waiting." : "One account runs every room you organise."}
          </p>

          <form onSubmit={submit} className="mt-10 flex flex-col gap-6">
            {mode === "register" ? (
              <>
                <Field label="Username">
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ayaan_shah" autoComplete="username" required />
                </Field>
                <Field label="Email">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
                </Field>
                <Field label="Display name">
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ayaan Shah" required />
                </Field>
              </>
            ) : (
              <Field label="Username or email">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ayaan_shah" autoComplete="username" required />
              </Field>
            )}
            <Field label="Password" hint={mode === "register" ? "8 characters minimum" : undefined}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
            </Field>

            <Notice tone="error">{error}</Notice>

            <Button type="submit" size="block" className="gleam mt-2" disabled={busy}>
              {busy ? "Opening your room…" : mode === "login" ? "Enter the room" : "Create account"}
              <ArrowUpRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </Button>
          </form>

          <p className="mt-8 text-center text-[0.8125rem] text-muted-foreground">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button type="button" className="link-sweep font-medium text-foreground" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>
              {mode === "login" ? "Create an account" : "Sign in instead"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
