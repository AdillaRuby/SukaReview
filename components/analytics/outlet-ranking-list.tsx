import Link from "next/link";
import { StarRating } from "@/components/reviews/star-rating";
import { formatNumberID } from "@/lib/format";
import type { OutletRankingRow } from "@/lib/analytics/queries";

export function OutletRankingList({
  title,
  outlets,
  metric = "rating",
}: {
  title: string;
  outlets: OutletRankingRow[];
  metric?: "rating" | "reviews";
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {outlets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada data.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {outlets.map((o, i) => (
            <li key={o.id}>
              <Link
                href={`/outlets/${o.slug}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-hover"
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="w-4 shrink-0 font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <span className="truncate text-foreground">{o.name}</span>
                </span>
                {metric === "rating" ? (
                  <StarRating rating={Math.round(o.currentRating)} size="sm" showNumber />
                ) : (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {formatNumberID(o.totalReviews)} review
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
