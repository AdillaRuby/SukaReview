import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getOutletBySlug,
  getOutletRatingTrend,
  getOutletSentimentBreakdown,
  getOutletTopComplaints,
} from "@/lib/outlets/queries";
import { getReviewsForOutlet } from "@/lib/reviews/queries";
import { StarRating } from "@/components/reviews/star-rating";
import { OutletStatusBadge } from "@/components/outlets/outlet-status";
import { OutletPeriodView, type Period } from "@/components/outlets/outlet-period-view";
import { OutletReviewsList } from "@/components/outlets/outlet-reviews-list";
import { formatNumberID, formatRating } from "@/lib/format";
import type { ReviewCategoryTag } from "@/types/database";

const PERIODS: { key: Period; days: number }[] = [
  { key: "7", days: 7 },
  { key: "30", days: 30 },
  { key: "90", days: 90 },
];

export default async function OutletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params;
  const supabase = await createClient();

  const outlet = await getOutletBySlug(supabase, slug);
  if (!outlet) notFound();

  const [periodResults, reviewsPage] = await Promise.all([
    Promise.all(
      PERIODS.map(async ({ key, days }) => {
        const [trend, sentiment, complaints] = await Promise.all([
          getOutletRatingTrend(supabase, outlet.id, days),
          getOutletSentimentBreakdown(supabase, outlet.id, days),
          getOutletTopComplaints(supabase, outlet.id, days),
        ]);
        return [key, { trend, sentiment, complaints: complaints as { category: ReviewCategoryTag; count: number; percentage: number }[] }] as const;
      })
    ),
    getReviewsForOutlet(supabase, outlet.id, { pageSize: 20 }),
  ]);

  const periodData = Object.fromEntries(periodResults) as Record<Period, (typeof periodResults)[number][1]>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">{outlet.name}</h1>
          {outlet.address && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5" /> {outlet.address}
            </p>
          )}
        </div>
        <OutletStatusBadge status={outlet.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBlock label="Current Rating" value={formatRating(outlet.currentRating)} extra={<StarRating rating={Math.round(outlet.currentRating)} size="sm" />} />
        <StatBlock label="Total Reviews" value={formatNumberID(outlet.totalReviews)} />
        <StatBlock label="Reviews Today" value={formatNumberID(outlet.reviewsToday)} />
        <StatBlock label="Negative Today" value={formatNumberID(outlet.negativeReviewsToday)} negative={outlet.negativeReviewsToday > 0} />
      </div>

      <OutletPeriodView data={periodData} />

      <OutletReviewsList outletId={outlet.id} initialReviews={reviewsPage.reviews} />
    </div>
  );
}

function StatBlock({
  label,
  value,
  extra,
  negative,
}: {
  label: string;
  value: string;
  extra?: React.ReactNode;
  negative?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold ${negative ? "text-negative-foreground" : "text-foreground"}`}>
        {value}
      </p>
      {extra && <div className="mt-1">{extra}</div>}
    </div>
  );
}
