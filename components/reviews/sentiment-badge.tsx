"use client";

import { Badge } from "@/components/ui/badge";
import type { Sentiment } from "@/types/database";

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

export function SentimentBadge({ sentiment }: { sentiment: Sentiment | null }) {
  // AI analysis is an optional add-on (needs GEMINI_API_KEY) — when it's not
  // configured, every review has no sentiment forever, so render nothing
  // rather than a permanent "analysis failed"/"analyzing" badge on every
  // single review card.
  if (!sentiment) return null;

  return <Badge variant={VARIANTS[sentiment]}>{LABELS[sentiment]}</Badge>;
}
