import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-13 w-full rounded-lg border border-input bg-card px-4 py-3 text-[0.9375rem] text-foreground shadow-none transition-all duration-200 outline-none",
        "placeholder:text-muted-foreground/60 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "hover:border-foreground/25 focus-visible:border-foreground/60 focus-visible:ring-4 focus-visible:ring-ring/12 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:bg-muted",
        "[&[type=number]]:numeral",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
