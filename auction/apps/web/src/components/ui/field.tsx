import * as React from "react";
import { cn } from "@/lib/utils";

/** Label above control, consistent rhythm. Every form in the app uses it. */
export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("group flex flex-col gap-2.5", className)}>
      <span className="flex items-baseline justify-between gap-3">
        <span className="caption text-[0.6875rem] text-muted-foreground transition-colors group-focus-within:text-foreground">
          {label}
        </span>
        {hint && <span className="text-[0.6875rem] text-muted-foreground/70">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
