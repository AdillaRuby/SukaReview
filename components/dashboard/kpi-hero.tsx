import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { StarRating } from "@/components/reviews/star-rating";
import { MiniSparkline } from "@/components/charts/mini-sparkline";
import { cn } from "@/lib/utils";
import { formatNumberID, formatRating } from "@/lib/format";
import type { DashboardKpis } from "@/types/domain";

function DeltaLine({
  delta,
  label,
  goodDirection = "up",
}: {
  delta: number | null | undefined;
  label: string;
  goodDirection?: "up" | "down";
}) {
  if (delta === undefined || delta === null) return <div className="h-4" />;

  if (delta === 0) {
    return (
      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Minus className="size-3" /> Sama seperti kemarin
      </p>
    );
  }

  const isGood = (delta > 0) === (goodDirection === "up");

  return (
    <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", isGood ? "text-positive" : "text-negative")}>
      {delta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {delta > 0 ? "+" : ""}
      {delta} {label}
    </p>
  );
}

export function KpiHero({ kpis, ratingTrend }: { kpis: DashboardKpis; ratingTrend: number[] }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <div
        className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full opacity-[0.07]"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }}
      />

      <div className="flex flex-col divide-y divide-border lg:flex-row lg:divide-x lg:divide-y-0">
        <div className="relative flex-[1.3] p-5 lg:p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overall Rating</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="font-mono text-5xl font-bold leading-none tracking-tight text-foreground">
              {formatRating(kpis.overallRating)}
            </span>
            <StarRating rating={Math.round(kpis.overallRating)} size="md" />
          </div>
          <DeltaLine delta={kpis.overallRatingDeltaWeek} label="minggu ini" />

          {ratingTrend.length >= 2 && (
            <div className="mt-3 h-10 w-full max-w-40">
              <MiniSparkline data={ratingTrend} />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center p-5 lg:p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Outlet</p>
          <span className="mt-2 font-mono text-3xl font-semibold text-foreground">
            {formatNumberID(kpis.totalOutlets)}
          </span>
          <p className="mt-1 text-xs text-muted-foreground">outlet aktif dipantau</p>
        </div>

        <div className="flex flex-1 flex-col justify-center p-5 lg:p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Review Hari Ini</p>
          <span className="mt-2 font-mono text-3xl font-semibold text-foreground">
            {formatNumberID(kpis.reviewsToday)}
          </span>
          <DeltaLine delta={kpis.reviewsTodayDeltaYesterday} label="dibanding kemarin" />
        </div>

        <div className="flex flex-1 flex-col justify-center p-5 lg:p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Negative Hari Ini</p>
          <span
            className={cn(
              "mt-2 font-mono text-3xl font-semibold",
              kpis.negativeToday > 0 ? "text-negative" : "text-foreground"
            )}
          >
            {formatNumberID(kpis.negativeToday)}
          </span>
          <p className="mt-1 text-xs text-muted-foreground">
            {kpis.negativeToday > 0 ? "perlu ditinjau" : "tidak ada review negatif"}
          </p>
        </div>
      </div>
    </div>
  );
}
