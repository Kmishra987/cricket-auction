import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "thin-scroll flex min-h-40 w-full rounded-lg border border-input bg-card px-4 py-3.5 font-mono text-[0.8125rem] leading-relaxed transition-all duration-200 outline-none",
        "placeholder:text-muted-foreground/60 hover:border-foreground/25 focus-visible:border-foreground/60 focus-visible:ring-4 focus-visible:ring-ring/12",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
