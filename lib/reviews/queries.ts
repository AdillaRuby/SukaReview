import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ReviewCategoryTag, Sentiment } from "@/types/database";
import type { ReviewWithRelations } from "@/types/domain";

type Client = SupabaseClient<Database>;

const REVIEW_SELECT = `
  id, google_review_id, outlet_id, reviewer_name, reviewer_avatar, rating, comment,
  google_created_at, google_updated_at, sentiment, ai_summary, urgency, analysis_status, created_at,
  outlets ( name, slug, city ),
  review_categories ( category, aspect_sentiment )
`;

// Supabase's generated join type isn't available (hand-written types.ts),
// so the raw row from `.select()` with embedded resources is typed loosely
// here and normalized by mapReviewRow below.
interface RawReviewJoinRow {
  id: string;
  google_review_id: string;
  outlet_id: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
  rating: number;
  comment: string | null;
  google_created_at: string;
  google_updated_at: string | null;
  sentiment: Sentiment | null;
  ai_summary: string | null;
  urgency: "low" | "medium" | "high" | null;
  analysis_status: "pending" | "completed" | "failed";
  created_at: string;
  outlets: { name: string; slug: string; city: string | null } | null;
  review_categories: { category: ReviewCategoryTag; aspect_sentiment: Sentiment | null }[] | null;
}

export function mapReviewRow(row: RawReviewJoinRow): ReviewWithRelations {
  const aspects: Partial<Record<ReviewCategoryTag, Sentiment>> = {};
  for (const c of row.review_categories ?? []) {
    if (c.aspect_sentiment) aspects[c.category] = c.aspect_sentiment;
  }

  return {
    id: row.id,
    googleReviewId: row.google_review_id,
    outletId: row.outlet_id,
    outletName: row.outlets?.name ?? "Outlet",
    outletSlug: row.outlets?.slug ?? "",
    outletCity: row.outlets?.city ?? null,
    reviewerName: row.reviewer_name,
    reviewerAvatar: row.reviewer_avatar,
    rating: row.rating,
    comment: row.comment,
    googleCreatedAt: row.google_created_at,
    googleUpdatedAt: row.google_updated_at,
    sentiment: row.sentiment,
    aiSummary: row.ai_summary,
    urgency: row.urgency,
    analysisStatus: row.analysis_status,
    categories: (row.review_categories ?? []).map((c) => c.category),
    aspects,
    createdAt: row.created_at,
  };
}

export async function getLiveReviewFeed(supabase: Client, limit = 25): Promise<ReviewWithRelations[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_SELECT)
    .order("google_created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as unknown as RawReviewJoinRow[]).map(mapReviewRow);
}

export async function getReviewById(supabase: Client, id: string): Promise<ReviewWithRelations | null> {
  const { data, error } = await supabase.from("reviews").select(REVIEW_SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return mapReviewRow(data as unknown as RawReviewJoinRow);
}

export interface ReviewFilters {
  search?: string;
  outletId?: string;
  rating?: number;
  sentiment?: Sentiment;
  category?: ReviewCategoryTag;
  dateFrom?: string;
  dateTo?: string;
  sort?: "newest" | "oldest" | "lowest" | "highest";
  page?: number;
  pageSize?: number;
}

export interface PaginatedReviews {
  reviews: ReviewWithRelations[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getReviewsPage(supabase: Client, filters: ReviewFilters): Promise<PaginatedReviews> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("reviews").select(REVIEW_SELECT, { count: "exact" });

  if (filters.search) {
    query = query.or(`comment.ilike.%${filters.search}%,reviewer_name.ilike.%${filters.search}%`);
  }
  if (filters.outletId) query = query.eq("outlet_id", filters.outletId);
  if (filters.rating) query = query.eq("rating", filters.rating);
  if (filters.sentiment) query = query.eq("sentiment", filters.sentiment);
  if (filters.dateFrom) query = query.gte("google_created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("google_created_at", filters.dateTo);

  if (filters.category) {
    const { data: matches } = await supabase
      .from("review_categories")
      .select("review_id")
      .eq("category", filters.category);
    const ids = (matches ?? []).map((m) => m.review_id);
    if (ids.length === 0) return { reviews: [], total: 0, page, pageSize };
    query = query.in("id", ids);
  }

  switch (filters.sort) {
    case "oldest":
      query = query.order("google_created_at", { ascending: true });
      break;
    case "lowest":
      query = query.order("rating", { ascending: true }).order("google_created_at", { ascending: false });
      break;
    case "highest":
      query = query.order("rating", { ascending: false }).order("google_created_at", { ascending: false });
      break;
    default:
      query = query.order("google_created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  const reviews = (data as unknown as RawReviewJoinRow[]).map(mapReviewRow);

  return { reviews, total: count ?? reviews.length, page, pageSize };
}

export async function getReviewsForOutlet(
  supabase: Client,
  outletId: string,
  filters: Omit<ReviewFilters, "outletId"> = {}
): Promise<PaginatedReviews> {
  return getReviewsPage(supabase, { ...filters, outletId });
}
