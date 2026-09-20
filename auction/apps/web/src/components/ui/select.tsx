"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "group flex h-13 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-4 py-3 text-left text-[0.9375rem] transition-all duration-200 outline-none",
        "hover:border-foreground/25 focus-visible:border-foreground/60 focus-visible:ring-4 focus-visible:ring-ring/12",
        "disabled:cursor-not-allowed disabled:opacity-45 data-[placeholder]:text-muted-foreground/60 [&>span]:truncate",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 shrink-0 opacity-50 transition-transform duration-300 group-data-[state=open]:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({ className, children, position = "popper", ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        className={cn(
          "relative z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)]",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          position === "popper" && "data-[side=bottom]:translate-y-1.5 data-[side=top]:-translate-y-1.5",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex justify-center py-1"><ChevronUpIcon className="size-4" /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className={cn("thin-scroll p-1.5", position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]")}>
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex justify-center py-1"><ChevronDownIcon className="size-4" /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md py-2.5 pr-9 pl-3 text-sm outline-none transition-colors",
        "focus:bg-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-3 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator><CheckIcon className="size-4 text-brand" /></SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label className={cn("eyebrow px-3 py-2", className)} {...props} />;
}

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectLabel };
