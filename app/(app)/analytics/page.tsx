import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  getOverallRatingTrend,
  getRatingDistribution,
  getTopComplaintCategoriesOverall,
  getOutletRankings,
} from "@/lib/analytics/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingTrendChart } from "@/components/charts/rating-trend";
import { ReviewVolumeChart } from "@/components/charts/review-volume-chart";
import { RatingDistributionChart } from "@/components/charts/rating-distribution-chart";
import { OutletComparisonChart } from "@/components/charts/outlet-comparison-chart";
import { OutletRankingList } from "@/components/analytics/outlet-ranking-list";
import { PeriodSelector } from "@/components/analytics/period-selector";
import { CategoryBadge } from "@/components/reviews/category-badge";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = Number(daysParam ?? "30");
  const supabase = await createClient();

  const [trend, distribution, topComplaints, rankings] = await Promise.all([
    getOverallRatingTrend(supabase, days),
    getRatingDistribution(supabase, days),
    getTopComplaintCategoriesOverall(supabase, days),
    getOutletRankings(supabase),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Tren dan performa review seluruh outlet.</p>
        </div>
        <Suspense>
          <PeriodSelector current={String(days)} />
        </Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overall Rating Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <RatingTrendChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Review Volume Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewVolumeChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <RatingDistributionChart data={distribution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perbandingan Outlet</CardTitle>
          </CardHeader>
          <CardContent>
            <OutletComparisonChart outlets={rankings.all} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <OutletRankingList title="Outlet Terbaik" outlets={rankings.bestRated} metric="rating" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <OutletRankingList title="Rating Terendah" outlets={rankings.lowestRated} metric="rating" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <OutletRankingList title="Review Terbanyak" outlets={rankings.mostReviewed} metric="reviews" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Complaint Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {topComplaints.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada keluhan signifikan pada periode ini.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {topComplaints.map((c) => (
                <div key={c.category} className="flex items-center gap-3">
                  <CategoryBadge category={c.category} />
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${c.percentage}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">{c.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
