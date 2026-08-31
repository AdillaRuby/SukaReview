import Link from "next/link";
import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StarRating } from "@/components/reviews/star-rating";
import { OutletStatusBadge } from "./outlet-status";
import { formatNumberID } from "@/lib/format";
import type { OutletSummary } from "@/types/domain";

export function OutletCard({ outlet }: { outlet: OutletSummary }) {
  return (
    <Link href={`/outlets/${outlet.slug}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col gap-2.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-sm font-semibold text-foreground">{outlet.name}</p>
              {outlet.city && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" /> {outlet.city}
                </p>
              )}
            </div>
            <OutletStatusBadge status={outlet.status} />
          </div>

          <StarRating rating={Math.round(outlet.currentRating)} size="sm" showNumber />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatNumberID(outlet.totalReviews)} Reviews</span>
            <span>{outlet.reviewsToday} hari ini</span>
            {outlet.negativeReviewsToday > 0 && (
              <span className="text-negative-foreground">{outlet.negativeReviewsToday} negatif</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
