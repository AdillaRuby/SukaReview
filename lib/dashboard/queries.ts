import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { DashboardKpis } from "@/types/domain";

type Client = SupabaseClient<Database>;

function startOfDay(daysAgo = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardKpis(supabase: Client): Promise<DashboardKpis> {
  const { data: outlets } = await supabase.from("outlets").select("current_rating, total_reviews").eq("is_active", true);

  const activeOutlets = outlets ?? [];
  const totalOutlets = activeOutlets.length;
  const ratedOutlets = activeOutlets.filter((o) => o.total_reviews > 0);
  const overallRating =
    ratedOutlets.length > 0
      ? Math.round((ratedOutlets.reduce((s, o) => s + o.current_rating, 0) / ratedOutlets.length) * 10) / 10
      : 0;

  const todayStart = startOfDay(0).toISOString();
  const yesterdayStart = startOfDay(1).toISOString();
  const weekAgoStart = startOfDay(7).toISOString();

  const [{ count: reviewsToday }, { count: reviewsYesterday }, { data: weekOldReviews }] = await Promise.all([
    supabase.from("reviews").select("id", { count: "exact", head: true }).gte("google_created_at", todayStart),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .gte("google_created_at", yesterdayStart)
      .lt("google_created_at", todayStart),
    supabase.from("reviews").select("rating").gte("google_created_at", weekAgoStart).lt("google_created_at", todayStart),
  ]);

  const { count: negativeToday } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .gte("google_created_at", todayStart)
    .lte("rating", 2);

  let overallRatingDeltaWeek: number | null = null;
  if (weekOldReviews && weekOldReviews.length >= 5) {
    const weekAgoAvg = weekOldReviews.reduce((s, r) => s + r.rating, 0) / weekOldReviews.length;
    overallRatingDeltaWeek = Math.round((overallRating - weekAgoAvg) * 10) / 10;
  }

  return {
    overallRating,
    overallRatingDeltaWeek,
    totalOutlets,
    reviewsToday: reviewsToday ?? 0,
    reviewsTodayDeltaYesterday: reviewsYesterday !== null ? (reviewsToday ?? 0) - reviewsYesterday : null,
    negativeToday: negativeToday ?? 0,
  };
}
