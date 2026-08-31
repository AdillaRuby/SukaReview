"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Volume2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getReviewById } from "@/lib/reviews/queries";
import { realtimeBus } from "@/lib/realtime/bus";
import { useNotificationPreferences } from "@/components/providers/notification-preferences-provider";
import { ReviewToastContent } from "./review-toast";
import { Button } from "@/components/ui/button";

/**
 * Mounted once near the root of the authenticated app. Owns the only piece
 * of UI that actually calls `.play()` on the notification sound, and shows
 * the toast for every new review — decoupled from whichever page happens to
 * be visible, so notifications work even when you're not on the dashboard.
 */
export function SoundController() {
  const { hydrated, audioUnlocked, prefs, unlockAudio, playNotification } = useNotificationPreferences();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    return realtimeBus.on("review-insert", async (row) => {
      const full = await getReviewById(supabase, row.id);
      if (!full) return;

      toast(<ReviewToastContent review={row} outletName={full.outletName} />);
      playNotification(row.rating);
    });
  }, [playNotification]);

  if (!hydrated || audioUnlocked || dismissed || !prefs.soundEnabled) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-xl">
      <p className="text-sm text-foreground">Aktifkan suara notifikasi?</p>
      <Button
        size="sm"
        variant="accent"
        onClick={() => {
          unlockAudio();
        }}
      >
        <Volume2 className="size-4" /> Aktifkan Suara
      </Button>
      <button
        onClick={() => setDismissed(true)}
        className="text-xs text-muted-foreground hover:text-foreground"
        aria-label="Tutup"
      >
        Nanti
      </button>
    </div>
  );
}
