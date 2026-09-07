"use client";

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
}: {
  sentiment: Sentiment | null;
  analysisStatus?: AnalysisStatus;
}) {
  if (!sentiment) {
    // AI analysis is an optional add-on (needs GEMINI_API_KEY) — when it's
    // not configured, every review lands here permanently, so this stays a
    // quiet, neutral badge rather than something that reads as a system
    // error with a retry action that can never succeed.
    if (analysisStatus === "failed") {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Analisis AI tidak aktif
        </Badge>
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
