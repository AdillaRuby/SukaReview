"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useNotificationPreferences } from "@/components/providers/notification-preferences-provider";

export function SoundToggle() {
  const { hydrated, prefs, setSoundEnabled } = useNotificationPreferences();

  if (!hydrated) {
    return <div className="h-9 w-20" />;
  }

  return (
    <button
      onClick={() => setSoundEnabled(!prefs.soundEnabled)}
      className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
      aria-pressed={prefs.soundEnabled}
      aria-label={prefs.soundEnabled ? "Matikan suara notifikasi" : "Aktifkan suara notifikasi"}
    >
      {prefs.soundEnabled ? (
        <>
          <Volume2 className="size-4 text-accent" /> Sound ON
        </>
      ) : (
        <>
          <VolumeX className="size-4" /> Sound OFF
        </>
      )}
    </button>
  );
}
