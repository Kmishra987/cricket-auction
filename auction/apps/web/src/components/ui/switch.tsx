"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input transition-colors duration-300 outline-none",
        "focus-visible:ring-4 focus-visible:ring-ring/15 data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-out data-[state=checked]:translate-x-[1.35rem] data-[state=unchecked]:translate-x-0.5" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
