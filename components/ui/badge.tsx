import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-hover text-foreground",
        outline: "border-border text-muted-foreground",
        positive: "border-transparent bg-positive-bg text-positive-foreground",
        neutral: "border-transparent bg-neutral-bg text-neutral-foreground",
        negative: "border-transparent bg-negative-bg text-negative-foreground",
        accent: "border-transparent bg-accent/15 text-accent",
        primary: "border-transparent bg-primary/15 text-primary-hover",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
