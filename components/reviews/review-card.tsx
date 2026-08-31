import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "./star-rating";
import { SentimentBadge } from "./sentiment-badge";
import { CategoryBadge } from "./category-badge";
import { formatRelativeID } from "@/lib/format";
import type { ReviewWithRelations } from "@/types/domain";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ReviewCard({
  review,
  showOutlet = true,
  isNew = false,
  className,
}: {
  review: ReviewWithRelations;
  showOutlet?: boolean;
  isNew?: boolean;
  className?: string;
}) {
  return (
    <article
      className={`rounded-lg border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <Avatar>
          {review.reviewerAvatar && <AvatarImage src={review.reviewerAvatar} alt="" />}
          <AvatarFallback>{initials(review.reviewerName)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {isNew && (
              <Badge variant="accent" className="animate-pulse-dot">
                BARU
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{formatRelativeID(review.googleCreatedAt)}</span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StarRating rating={review.rating} size="sm" />
            {showOutlet && (
              <Link
                href={`/outlets/${review.outletSlug}`}
                className="text-sm font-medium text-foreground hover:text-accent"
              >
                {review.outletName}
              </Link>
            )}
          </div>

          <p className="mt-0.5 text-xs text-muted-foreground">{review.reviewerName}</p>

          {review.comment ? (
            <p className="mt-2 text-sm leading-relaxed text-foreground">{review.comment}</p>
          ) : (
            <p className="mt-2 text-sm italic text-muted-foreground">Tidak ada komentar.</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <SentimentBadge sentiment={review.sentiment} analysisStatus={review.analysisStatus} reviewId={review.id} />
            {review.categories.map((c) => (
              <CategoryBadge key={c} category={c} />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export function ReviewCardGoogleLink({ placeId }: { placeId: string | null }) {
  if (!placeId) return null;
  const href = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
    >
      Buka Google <ExternalLink className="size-3" />
    </a>
  );
}
