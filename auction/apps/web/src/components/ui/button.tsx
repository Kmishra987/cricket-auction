"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2.5 whitespace-nowrap font-semibold tracking-[-0.005em] transition-[transform,background-color,color,border-color,box-shadow] duration-300 ease-out disabled:pointer-events-none disabled:opacity-40 active:scale-[0.985] [&_svg]:shrink-0 [&_svg]:size-[1.1em] [&_svg]:stroke-[2.2] cursor-pointer",
  {
    variants: {
      variant: {
        // Solid weights carry an inset hairline; outlines gain a second rule on
        // hover, the way a printed rule doubles up.
        default:
          "bg-primary text-primary-foreground ring-1 ring-inset ring-white/12 hover:-translate-y-0.5 hover:shadow-[0_0_0_1.5px_var(--background),0_0_0_3px_color-mix(in_oklab,var(--foreground)_35%,transparent)]",
        brand:
          "bg-brand text-white ring-1 ring-inset ring-white/20 hover:-translate-y-0.5 hover:shadow-[0_0_0_1.5px_var(--background),0_0_0_3px_color-mix(in_oklab,var(--brand)_55%,transparent)]",
        outline:
          "border-[1.5px] border-input bg-transparent hover:-translate-y-0.5 hover:border-foreground hover:shadow-[0_0_0_1.5px_var(--background),0_0_0_3px_color-mix(in_oklab,var(--foreground)_28%,transparent)]",
        secondary: "bg-secondary text-secondary-foreground border-[1.5px] border-transparent hover:-translate-y-0.5 hover:border-foreground/25",
        ghost: "text-foreground/85 hover:bg-secondary/70 hover:text-foreground",
        success: "bg-success text-white ring-1 ring-inset ring-white/20 hover:-translate-y-0.5 hover:shadow-[0_0_0_1.5px_var(--background),0_0_0_3px_color-mix(in_oklab,var(--success)_55%,transparent)]",
        destructive: "bg-destructive text-destructive-foreground ring-1 ring-inset ring-white/20 hover:-translate-y-0.5",
        link: "text-foreground underline-offset-[6px] hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-11 rounded-full px-6 text-[0.8125rem]",
        default: "h-13 rounded-full px-8 text-[0.9375rem]",
        lg: "h-15 rounded-full px-10 text-[1.0625rem]",
        xl: "h-17 rounded-full px-12 text-[1.125rem]",
        icon: "size-12 rounded-full",
        block: "h-15 w-full rounded-full px-8 text-[1.0625rem]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
