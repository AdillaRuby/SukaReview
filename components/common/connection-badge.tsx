"use client";

import { cn } from "@/lib/utils";
import { useRealtimeStatus } from "@/components/providers/realtime-provider";

const STATUS_CONFIG = {
  live: { label: "LIVE", dot: "bg-positive", text: "text-positive-foreground", pulse: true },
  reconnecting: { label: "RECONNECTING", dot: "bg-medium", text: "text-neutral-foreground", pulse: true },
  offline: { label: "OFFLINE", dot: "bg-negative", text: "text-negative-foreground", pulse: false },
} as const;

export function ConnectionBadge() {
  const status = useRealtimeStatus();
  const config = STATUS_CONFIG[status];

  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium"
      role="status"
      aria-live="polite"
    >
      <span className={cn("size-1.5 rounded-full", config.dot, config.pulse && "animate-pulse-dot")} />
      <span className={config.text}>{config.label}</span>
    </div>
  );
}
