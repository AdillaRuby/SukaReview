"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Sentiment, AnalysisStatus } from "@/types/database";

const LABELS: Record<Sentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

const VARIANTS: Record<Sentiment, "positive" | "neutral" | "negative"> = {
  positive: "positive",
  neutral: "neutral",
  negative: "negative",
};

export function SentimentBadge({
  sentiment,
  analysisStatus,
  reviewId,
}: {
  sentiment: Sentiment | null;
  analysisStatus?: AnalysisStatus;
  reviewId?: string;
}) {
  const [retrying, setRetrying] = useState(false);
  const router = useRouter();

  if (!sentiment) {
    if (analysisStatus === "failed") {
      return (
        <span className="inline-flex items-center gap-1.5">
          <Badge variant="outline" className="text-negative">
            Analisis gagal
          </Badge>
          {reviewId && (
            <button
              onClick={async () => {
                setRetrying(true);
                try {
                  await fetch(`/api/reviews/${reviewId}/retry-analysis`, { method: "POST" });
                  router.refresh();
                } finally {
                  setRetrying(false);
                }
              }}
              disabled={retrying}
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50"
            >
              <RotateCw className={retrying ? "size-3 animate-spin" : "size-3"} /> Retry
            </button>
          )}
        </span>
      );
    }
    return (
      <Badge variant="outline" className="animate-pulse">
        Menganalisis…
      </Badge>
    );
  }

  return <Badge variant={VARIANTS[sentiment]}>{LABELS[sentiment]}</Badge>;
}
