"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getReviewById } from "@/lib/reviews/queries";
import { realtimeBus } from "@/lib/realtime/bus";
import type { ReviewWithRelations } from "@/types/domain";

const NEW_BADGE_DURATION_MS = 60_000;
const MAX_FEED_SIZE = 50;

interface Options {
  initialReviews: ReviewWithRelations[];
  outletId?: string;
  onNewReview?: (review: ReviewWithRelations) => void;
}

export function useLiveReviews({ initialReviews, outletId, onNewReview }: Options) {
  const [reviews, setReviews] = useState(initialReviews);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const supabaseRef = useRef(createClient());
  const onNewReviewRef = useRef(onNewReview);

  useEffect(() => {
    onNewReviewRef.current = onNewReview;
  });

  useEffect(() => {
    // Synchronizes local state with a genuinely external change: the server
    // re-fetches initialReviews on navigation/filter changes, while this
    // hook's own state also accumulates realtime inserts independently —
    // so it can't be derived from props alone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReviews(initialReviews);
  }, [initialReviews]);

  useEffect(() => {
    const supabase = supabaseRef.current;

    const offInsert = realtimeBus.on("review-insert", async (row) => {
      if (outletId && row.outlet_id !== outletId) return;

      const full = await getReviewById(supabase, row.id);
      if (!full) return;

      setReviews((prev) => {
        if (prev.some((r) => r.id === full.id)) return prev;
        return [full, ...prev].slice(0, MAX_FEED_SIZE);
      });

      setNewIds((prev) => new Set(prev).add(full.id));
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(full.id);
          return next;
        });
      }, NEW_BADGE_DURATION_MS);

      onNewReviewRef.current?.(full);
    });

    const offUpdate = realtimeBus.on("review-update", async (row) => {
      if (outletId && row.outlet_id !== outletId) return;

      setReviews((prev) => {
        if (!prev.some((r) => r.id === row.id)) return prev;
        return prev;
      });

      const full = await getReviewById(supabase, row.id);
      if (!full) return;

      setReviews((prev) => prev.map((r) => (r.id === full.id ? full : r)));
    });

    return () => {
      offInsert();
      offUpdate();
    };
  }, [outletId]);

  return { reviews, newIds };
}
