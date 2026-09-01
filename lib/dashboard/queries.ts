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
  const twoWeeksAgoStart = startOfDay(14).toISOString();

  const [
    { count: reviewsToday },
    { count: reviewsYesterday },
    { data: recentWeekReviews },
    { data: priorWeekReviews },
  ] = await Promise.all([
    supabase.from("reviews").select("id", { count: "exact", head: true }).gte("google_created_at", todayStart),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .gte("google_created_at", yesterdayStart)
      .lt("google_created_at", todayStart),
    supabase.from("reviews").select("rating").gte("google_created_at", weekAgoStart),
    supabase.from("reviews").select("rating").gte("google_created_at", twoWeeksAgoStart).lt("google_created_at", weekAgoStart),
  ]);

  const { count: negativeToday } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .gte("google_created_at", todayStart)
    .lte("rating", 2);

  // Both sides of the delta are review-weighted averages over comparable
  // windows (recent 7d vs the 7d before that) — comparing against
  // `overallRating` here would mix an unweighted per-outlet average with a
  // review-weighted one and produce a meaningless number.
  let overallRatingDeltaWeek: number | null = null;
  if (recentWeekReviews && priorWeekReviews && recentWeekReviews.length >= 5 && priorWeekReviews.length >= 5) {
    const avg = (rows: { rating: number }[]) => rows.reduce((s, r) => s + r.rating, 0) / rows.length;
    overallRatingDeltaWeek = Math.round((avg(recentWeekReviews) - avg(priorWeekReviews)) * 10) / 10;
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
