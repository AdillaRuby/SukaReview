import { Badge } from "@/components/ui/badge";
import type { OutletStatus } from "@/types/database";

const CONFIG: Record<OutletStatus, { label: string; dot: string; variant: "positive" | "neutral" | "negative" | "outline" }> = {
  good: { label: "GOOD", dot: "🟢", variant: "positive" },
  watch: { label: "WATCH", dot: "🟡", variant: "neutral" },
  attention: { label: "ATTENTION", dot: "🟠", variant: "negative" },
  critical: { label: "CRITICAL", dot: "🔴", variant: "negative" },
};

export function OutletStatusBadge({ status }: { status: OutletStatus }) {
  const config = CONFIG[status];
  return (
    <Badge variant={config.variant}>
      <span aria-hidden>{config.dot}</span> {config.label}
    </Badge>
  );
}
