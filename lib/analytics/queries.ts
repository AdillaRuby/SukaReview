import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { RatingTrendPoint, CategoryFrequency } from "@/types/domain";
import type { ReviewCategoryTag } from "@/types/database";

type Client = SupabaseClient<Database>;

export async function getOverallRatingTrend(supabase: Client, days: number): Promise<RatingTrendPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from("reviews")
    .select("rating, google_created_at")
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
    .map(([date, { sum, count }]) => ({ date, rating: Math.round((sum / count) * 10) / 10, reviewCount: count }));
}

export async function getRatingDistribution(supabase: Client, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase.from("reviews").select("rating").gte("google_created_at", since.toISOString());

  const counts = new Map<number, number>();
  for (const r of data ?? []) counts.set(r.rating, (counts.get(r.rating) ?? 0) + 1);

  return Array.from(counts.entries()).map(([rating, count]) => ({ rating, count }));
}

export async function getTopComplaintCategoriesOverall(
  supabase: Client,
  days: number
): Promise<CategoryFrequency[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id")
    .lte("rating", 3)
    .gte("google_created_at", since.toISOString());

  const ids = (reviews ?? []).map((r) => r.id);
  if (ids.length === 0) return [];

  const { data: categories } = await supabase.from("review_categories").select("category").in("review_id", ids);

  const counts = new Map<ReviewCategoryTag, number>();
  for (const c of categories ?? []) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);

  const total = categories?.length ?? 0;
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count, percentage: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export interface OutletRankingRow {
  id: string;
  name: string;
  slug: string;
  currentRating: number;
  totalReviews: number;
}

export async function getOutletRankings(supabase: Client) {
  const { data } = await supabase
    .from("outlets")
    .select("id, name, slug, current_rating, total_reviews")
    .eq("is_active", true)
    .gt("total_reviews", 0);

  const outlets: OutletRankingRow[] = (data ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    currentRating: o.current_rating,
    totalReviews: o.total_reviews,
  }));

  const bestRated = [...outlets].sort((a, b) => b.currentRating - a.currentRating).slice(0, 5);
  const lowestRated = [...outlets].sort((a, b) => a.currentRating - b.currentRating).slice(0, 5);
  const mostReviewed = [...outlets].sort((a, b) => b.totalReviews - a.totalReviews).slice(0, 5);

  return { bestRated, lowestRated, mostReviewed, all: outlets };
}
