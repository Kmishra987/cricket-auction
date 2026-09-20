"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-[#0a0908]/72 backdrop-blur-md",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-300",
        className,
      )}
      {...props}
    />
  );
}

/** `side="bottom"` gives a sheet that rises from the edge; default is centred. */
function DialogContent({
  className,
  children,
  side = "center",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "center" | "bottom" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col border border-hairline bg-card shadow-[0_40px_120px_-30px_rgba(0,0,0,0.6)] duration-400",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          side === "bottom"
            ? "inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8"
            : "top-1/2 left-1/2 w-[calc(100vw-2.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-6 right-6 grid size-10 place-items-center rounded-full border border-hairline text-muted-foreground transition-all duration-300 hover:rotate-90 hover:border-foreground/40 hover:text-foreground">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogOverlay, DialogTitle, DialogDescription };
