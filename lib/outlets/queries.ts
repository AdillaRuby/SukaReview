import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { OutletSummary } from "@/types/domain";

type Client = SupabaseClient<Database>;

async function withTodayCounts(supabase: Client, outlets: Database["public"]["Tables"]["outlets"]["Row"][]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { data: todayReviews } = await supabase
    .from("reviews")
    .select("outlet_id, rating")
    .gte("google_created_at", startOfToday.toISOString());

  const todayByOutlet = new Map<string, { total: number; negative: number }>();
  for (const r of todayReviews ?? []) {
    const entry = todayByOutlet.get(r.outlet_id) ?? { total: 0, negative: 0 };
    entry.total += 1;
    if (r.rating <= 2) entry.negative += 1;
    todayByOutlet.set(r.outlet_id, entry);
  }

  return outlets.map((o): OutletSummary => {
    const today = todayByOutlet.get(o.id) ?? { total: 0, negative: 0 };
    return {
      id: o.id,
      googleLocationId: o.google_location_id,
      name: o.name,
      slug: o.slug,
      city: o.city,
      address: o.address,
      currentRating: o.current_rating,
      totalReviews: o.total_reviews,
      reviewsToday: today.total,
      negativeReviewsToday: today.negative,
      status: o.status,
      isActive: o.is_active,
    };
  });
}

export async function getAllOutlets(supabase: Client, search?: string): Promise<OutletSummary[]> {
  let query = supabase.from("outlets").select("*").eq("is_active", true).order("name");
  if (search) {
    query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return withTodayCounts(supabase, data ?? []);
}

export async function getOutletBySlug(supabase: Client, slug: string): Promise<OutletSummary | null> {
  const { data, error } = await supabase.from("outlets").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  const [summary] = await withTodayCounts(supabase, [data]);
  return summary;
}

export interface RatingTrendPoint {
  date: string;
  rating: number;
  reviewCount: number;
}

export async function getOutletRatingTrend(
  supabase: Client,
  outletId: string,
  days: number
): Promise<RatingTrendPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from("reviews")
    .select("rating, google_created_at")
    .eq("outlet_id", outletId)
    .gte("google_created_at", since.toISOString())
    .order("google_created_at", { ascending: true });

  const byDay = new Map<string, { sum: number; count: number }>();
  for (const r of data ?? []) {
    const day = r.google_created_at.slice(0, 10);
    const entry = byDay.get(day) ?? { sum: 0, count: 0 };
    entry.sum += r.rating;
    entry.count += 1;
    byDay.set(day, entry);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({
      date,
      rating: Math.round((sum / count) * 10) / 10,
      reviewCount: count,
    }));
}

export async function getOutletSentimentBreakdown(supabase: Client, outletId: string, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from("reviews")
    .select("sentiment")
    .eq("outlet_id", outletId)
    .gte("google_created_at", since.toISOString());

  const breakdown = { positive: 0, neutral: 0, negative: 0 };
  for (const r of data ?? []) {
    if (r.sentiment) breakdown[r.sentiment] += 1;
  }
  return breakdown;
}

export async function getOutletTopComplaints(supabase: Client, outletId: string, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id")
    .eq("outlet_id", outletId)
    .lte("rating", 3)
    .gte("google_created_at", since.toISOString());

  const reviewIds = (reviews ?? []).map((r) => r.id);
  if (reviewIds.length === 0) return [];

  const { data: categories } = await supabase
    .from("review_categories")
    .select("category")
    .in("review_id", reviewIds);

  const counts = new Map<string, number>();
  for (const c of categories ?? []) {
    counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  }

  const total = categories?.length ?? 0;
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count, percentage: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
