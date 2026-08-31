import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getReviewsPage } from "@/lib/reviews/queries";
import { getAllOutlets } from "@/lib/outlets/queries";
import { ReviewFilters } from "@/components/reviews/review-filters";
import { ReviewCard } from "@/components/reviews/review-card";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import type { ReviewCategoryTag, Sentiment } from "@/types/database";

interface SearchParams {
  search?: string;
  outletId?: string;
  rating?: string;
  sentiment?: string;
  category?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: string;
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createClient();

  const [outlets, result] = await Promise.all([
    getAllOutlets(supabase),
    getReviewsPage(supabase, {
      search: params.search,
      outletId: params.outletId,
      rating: params.rating ? Number(params.rating) : undefined,
      sentiment: params.sentiment as Sentiment | undefined,
      category: params.category as ReviewCategoryTag | undefined,
      dateFrom: params.from,
      dateTo: params.to,
      sort: (params.sort as "newest" | "oldest" | "lowest" | "highest") ?? "newest",
      page: params.page ? Number(params.page) : 1,
      pageSize: 20,
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-semibold text-foreground">Reviews</h1>
        <p className="text-sm text-muted-foreground">Seluruh review historis dari semua outlet.</p>
      </div>

      <Suspense>
        <ReviewFilters outlets={outlets.map((o) => ({ id: o.id, name: o.name }))} />
      </Suspense>

      {result.reviews.length === 0 ? (
        <EmptyState title="Belum ada review pada periode ini." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {result.reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} />
    </div>
  );
}
