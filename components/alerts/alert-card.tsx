"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeID } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AlertWithOutlet } from "@/types/domain";
import type { AlertSeverity } from "@/types/database";

const SEVERITY_VARIANT: Record<AlertSeverity, "negative" | "neutral" | "outline"> = {
  critical: "negative",
  high: "negative",
  medium: "neutral",
  low: "outline",
};

const TYPE_LABELS: Record<string, string> = {
  LOW_RATING_REVIEW: "Rating Rendah",
  RATING_DROP: "Rating Turun",
  NEGATIVE_SPIKE: "Lonjakan Negatif",
  LOW_OUTLET_RATING: "Rating Outlet Rendah",
};

export function AlertCard({
  alert,
  canResolve,
  onResolved,
}: {
  alert: AlertWithOutlet;
  canResolve: boolean;
  onResolved?: (id: string) => void;
}) {
  const [resolving, setResolving] = useState(false);

  async function handleResolve() {
    setResolving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("alerts")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: user?.id })
      .eq("id", alert.id);

    setResolving(false);
    if (!error) onResolved?.(alert.id);
  }

  return (
    <Card className={cn(alert.status === "resolved" && "opacity-60")}>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={SEVERITY_VARIANT[alert.severity]} className="uppercase">
            {alert.severity}
          </Badge>
          <Badge variant="outline">{TYPE_LABELS[alert.type] ?? alert.type}</Badge>
          {alert.status === "resolved" && (
            <Badge variant="positive">
              <CheckCircle2 className="size-3" /> Resolved
            </Badge>
          )}
        </div>

        <Link href={`/outlets/${alert.outletSlug}`} className="font-display text-sm font-semibold text-foreground hover:text-accent">
          {alert.outletName}
        </Link>
        <p className="text-sm text-muted-foreground">{alert.message}</p>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">Created: {formatRelativeID(alert.createdAt)}</span>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/outlets/${alert.outletSlug}`}>View Outlet</Link>
            </Button>
            {canResolve && alert.status === "active" && (
              <Button size="sm" onClick={handleResolve} disabled={resolving}>
                {resolving && <Loader2 className="size-3.5 animate-spin" />}
                Mark Resolved
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
