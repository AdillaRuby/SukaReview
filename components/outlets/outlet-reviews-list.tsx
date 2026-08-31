"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { ReviewCard } from "@/components/reviews/review-card";
import { EmptyState } from "@/components/common/empty-state";
import { useLiveReviews } from "@/hooks/use-live-reviews";
import type { ReviewWithRelations } from "@/types/domain";
import type { Sentiment } from "@/types/database";

export function OutletReviewsList({
  outletId,
  initialReviews,
}: {
  outletId: string;
  initialReviews: ReviewWithRelations[];
}) {
  const { reviews, newIds } = useLiveReviews({ initialReviews, outletId });
  const [rating, setRating] = useState("");
  const [sentiment, setSentiment] = useState<"" | Sentiment>("");

  const filtered = useMemo(
    () =>
      reviews.filter((r) => {
        if (rating && r.rating !== Number(rating)) return false;
        if (sentiment && r.sentiment !== sentiment) return false;
        return true;
      }),
    [reviews, rating, sentiment]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">Recent Reviews</h2>
        <div className="flex gap-2">
          <Select value={rating} onChange={(e) => setRating(e.target.value)} className="w-32">
            <option value="">All Ratings</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} Bintang
              </option>
            ))}
          </Select>
          <Select value={sentiment} onChange={(e) => setSentiment(e.target.value as "" | Sentiment)} className="w-32">
            <option value="">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Belum ada review pada periode ini." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((review) => (
            <ReviewCard key={review.id} review={review} showOutlet={false} isNew={newIds.has(review.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
