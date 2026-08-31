import { createClient } from "@/lib/supabase/server";
import { getDashboardKpis } from "@/lib/dashboard/queries";
import { getAttentionOutletAlerts } from "@/lib/alerts/queries";
import { getLiveReviewFeed } from "@/lib/reviews/queries";
import { getAllOutlets } from "@/lib/outlets/queries";
import { getOverallRatingTrend } from "@/lib/analytics/queries";
import { KpiHero } from "@/components/dashboard/kpi-hero";
import { AttentionPanel } from "@/components/dashboard/attention-panel";
import { LiveReviewFeed } from "@/components/dashboard/live-review-feed";
import { SimulateReviewButton } from "@/components/dashboard/simulate-review-button";
import { getGoogleMode } from "@/lib/google/auth";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [kpis, attentionAlerts, liveReviews, outlets, ratingTrendPoints] = await Promise.all([
    getDashboardKpis(supabase),
    getAttentionOutletAlerts(supabase, 6),
    getLiveReviewFeed(supabase, 25),
    getAllOutlets(supabase),
    getOverallRatingTrend(supabase, 7),
  ]);

  const isDemoMode = getGoogleMode() === "demo";
  const showSimulator =
    isDemoMode &&
    (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SHOW_DEV_SIMULATOR === "true");

  return (
    <div className="flex flex-col gap-6">
      <KpiHero kpis={kpis} ratingTrend={ratingTrendPoints.map((p) => p.rating)} />

      <AttentionPanel alerts={attentionAlerts} />

      <LiveReviewFeed initialReviews={liveReviews} outlets={outlets.map((o) => ({ id: o.id, name: o.name }))} />

      {showSimulator && <SimulateReviewButton />}
    </div>
  );
}
