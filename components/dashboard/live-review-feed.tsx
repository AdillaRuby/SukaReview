"use client";

import { useMemo, useState } from "react";
import { Search, Radio } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ReviewCard } from "@/components/reviews/review-card";
import { EmptyState } from "@/components/common/empty-state";
import { useLiveReviews } from "@/hooks/use-live-reviews";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { ReviewWithRelations } from "@/types/domain";
import type { Sentiment } from "@/types/database";

interface Props {
  initialReviews: ReviewWithRelations[];
  outlets: { id: string; name: string }[];
  onNewReview?: (review: ReviewWithRelations) => void;
}

export function LiveReviewFeed({ initialReviews, outlets, onNewReview }: Props) {
  const { reviews, newIds } = useLiveReviews({ initialReviews, onNewReview });
  const [search, setSearch] = useState("");
  const [outletId, setOutletId] = useState("");
  const [rating, setRating] = useState("");
  const [sentiment, setSentiment] = useState<"" | Sentiment>("");
  const debouncedSearch = useDebouncedValue(search, 250);

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (outletId && r.outletId !== outletId) return false;
      if (rating && r.rating !== Number(rating)) return false;
      if (sentiment && r.sentiment !== sentiment) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const haystack = `${r.comment ?? ""} ${r.reviewerName} ${r.outletName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [reviews, outletId, rating, sentiment, debouncedSearch]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Radio className="size-4 text-primary" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">Live Reviews</h2>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 sm:min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search review..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={outletId} onChange={(e) => setOutletId(e.target.value)} className="sm:w-44">
          <option value="">All Outlets</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Select value={rating} onChange={(e) => setRating(e.target.value)} className="sm:w-36">
          <option value="">All Ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} Bintang
            </option>
          ))}
        </Select>
        <Select value={sentiment} onChange={(e) => setSentiment(e.target.value as "" | Sentiment)} className="sm:w-36">
          <option value="">All Sentiments</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Belum ada review pada periode ini." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((review) => (
            <div key={review.id} className={newIds.has(review.id) ? "animate-review-enter" : undefined}>
              <ReviewCard review={review} isNew={newIds.has(review.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
