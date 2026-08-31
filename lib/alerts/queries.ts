import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertSeverity, AlertStatus, Database } from "@/types/database";
import type { AlertWithOutlet } from "@/types/domain";

type Client = SupabaseClient<Database>;

const ALERT_SELECT = `
  id, outlet_id, review_id, type, severity, title, message, status, created_at, resolved_at,
  outlets ( name, slug )
`;

interface RawAlertRow {
  id: string;
  outlet_id: string;
  review_id: string | null;
  type: string;
  severity: string;
  title: string;
  message: string;
  status: AlertStatus;
  created_at: string;
  resolved_at: string | null;
  outlets: { name: string; slug: string } | null;
}

function mapAlertRow(row: RawAlertRow): AlertWithOutlet {
  return {
    id: row.id,
    outletId: row.outlet_id,
    outletName: row.outlets?.name ?? "Outlet",
    outletSlug: row.outlets?.slug ?? "",
    reviewId: row.review_id,
    type: row.type as AlertWithOutlet["type"],
    severity: row.severity as AlertWithOutlet["severity"],
    title: row.title,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

const SEVERITY_RANK: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };

export async function getAttentionOutletAlerts(supabase: Client, limit = 5): Promise<AlertWithOutlet[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select(ALERT_SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data as unknown as RawAlertRow[])
    .map(mapAlertRow)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, limit);
}

export interface AlertFilters {
  status?: AlertStatus;
  severity?: AlertSeverity;
  outletId?: string;
}

export async function getAlerts(supabase: Client, filters: AlertFilters = {}): Promise<AlertWithOutlet[]> {
  let query = supabase.from("alerts").select(ALERT_SELECT).order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.outletId) query = query.eq("outlet_id", filters.outletId);

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as RawAlertRow[]).map(mapAlertRow);
}

export async function getActiveAlertCount(supabase: Client): Promise<number> {
  const { count } = await supabase
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  return count ?? 0;
}
