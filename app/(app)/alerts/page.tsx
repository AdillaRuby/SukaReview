import { createClient } from "@/lib/supabase/server";
import { getAlerts } from "@/lib/alerts/queries";
import { getAllOutlets } from "@/lib/outlets/queries";
import { getCurrentProfile, canManage } from "@/lib/auth/get-current-profile";
import { AlertsList } from "@/components/alerts/alerts-list";
import { AlertsFilterBar } from "@/components/alerts/alerts-filter-bar";
import type { AlertSeverity, AlertStatus } from "@/types/database";

interface SearchParams {
  status?: string;
  severity?: string;
  outletId?: string;
}

export default async function AlertsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createClient();

  const [alerts, outlets, profile] = await Promise.all([
    getAlerts(supabase, {
      status: params.status as AlertStatus | undefined,
      severity: params.severity as AlertSeverity | undefined,
      outletId: params.outletId,
    }),
    getAllOutlets(supabase),
    getCurrentProfile(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-semibold text-foreground">Alerts</h1>
        <p className="text-sm text-muted-foreground">Semua alert operasional dari seluruh outlet.</p>
      </div>

      <AlertsFilterBar outlets={outlets.map((o) => ({ id: o.id, name: o.name }))} />

      <AlertsList alerts={alerts} canResolve={canManage(profile?.role)} />
    </div>
  );
}
