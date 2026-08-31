import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";
import type { AlertWithOutlet } from "@/types/domain";
import type { AlertSeverity } from "@/types/database";

const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

const SEVERITY_DOT: Record<AlertSeverity, string> = {
  critical: "bg-critical",
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-low",
};

interface OutletGroup {
  outletId: string;
  outletName: string;
  outletSlug: string;
  severity: AlertSeverity;
  messages: string[];
}

function groupByOutlet(alerts: AlertWithOutlet[]): OutletGroup[] {
  const map = new Map<string, OutletGroup>();

  for (const alert of alerts) {
    const existing = map.get(alert.outletId);
    if (existing) {
      existing.messages.push(alert.message);
      if (SEVERITY_RANK[alert.severity] > SEVERITY_RANK[existing.severity]) existing.severity = alert.severity;
    } else {
      map.set(alert.outletId, {
        outletId: alert.outletId,
        outletName: alert.outletName,
        outletSlug: alert.outletSlug,
        severity: alert.severity,
        messages: [alert.message],
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

export function AttentionPanel({ alerts }: { alerts: AlertWithOutlet[] }) {
  const groups = groupByOutlet(alerts);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-primary" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
          Outlet Butuh Perhatian
        </h2>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Semua outlet dalam kondisi baik."
          description="Tidak ada alert aktif saat ini."
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.outletId} className="border-l-2" style={{ borderLeftColor: `var(--${group.severity})` }}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 shrink-0 rounded-full", SEVERITY_DOT[group.severity])} />
                  <span className="text-sm font-semibold text-foreground">{group.outletName}</span>
                </div>
                <ul className="space-y-1">
                  {group.messages.slice(0, 2).map((msg, i) => (
                    <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                      {msg}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="secondary" size="sm" className="mt-1 self-start">
                  <Link href={`/outlets/${group.outletSlug}`}>Lihat Outlet</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
