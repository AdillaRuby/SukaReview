"use client";

import { createContext, useContext } from "react";
import { useNotificationSound } from "@/hooks/use-notification-sound";

type NotificationSoundApi = ReturnType<typeof useNotificationSound>;

const NotificationPreferencesContext = createContext<NotificationSoundApi | null>(null);

/**
 * Single shared instance of useNotificationSound. Everything that reads or
 * toggles sound preferences (header quick-toggle, Settings page, the global
 * SoundController that actually plays audio) must go through this context —
 * otherwise each component would hold its own stale copy of `prefs` and
 * toggling Sound OFF in the header wouldn't stop playback elsewhere.
 */
export function NotificationPreferencesProvider({ children }: { children: React.ReactNode }) {
  const api = useNotificationSound();
  return (
    <NotificationPreferencesContext.Provider value={api}>
      {children}
    </NotificationPreferencesContext.Provider>
  );
}

export function useNotificationPreferences(): NotificationSoundApi {
  const ctx = useContext(NotificationPreferencesContext);
  if (!ctx) {
    throw new Error("useNotificationPreferences must be used within NotificationPreferencesProvider");
  }
  return ctx;
}
