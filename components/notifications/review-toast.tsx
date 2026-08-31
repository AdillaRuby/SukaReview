import { StarRating } from "@/components/reviews/star-rating";
import type { Database } from "@/types/database";

type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];

export function ReviewToastContent({ review, outletName }: { review: ReviewRow; outletName: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Review Baru</p>
      <div className="flex items-center gap-2">
        <StarRating rating={review.rating} size="sm" />
        <span className="text-sm font-medium text-foreground">{outletName}</span>
      </div>
      {review.comment ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">&ldquo;{review.comment}&rdquo;</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">Tidak ada komentar.</p>
      )}
    </div>
  );
}
