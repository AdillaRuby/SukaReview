"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_PREFERENCES,
  isAudioUnlocked,
  loadLocalPreferences,
  markAudioUnlocked,
  saveLocalPreferences,
  shouldNotifyForRating,
  type NotificationPreferences,
  type RatingTrigger,
} from "@/lib/notifications/preferences";

const SOUND_SRC = "/sounds/review-notification.mp3";

export function useNotificationSound() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Reads localStorage after mount so server/client first render matches;
    // hydrated flips true only once this client-only state is ready.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(loadLocalPreferences());
    setAudioUnlocked(isAudioUnlocked());
    setHydrated(true);

    if (typeof Audio !== "undefined") {
      audioRef.current = new Audio(SOUND_SRC);
      audioRef.current.preload = "auto";
    }

    // Pull cross-device preference from Supabase if the user is signed in,
    // falling back silently to local defaults on any failure.
    (async () => {
      try {
        const supabase = createClient();
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;

        const { data } = await supabase
          .from("notification_preferences")
          .select("*")
          .eq("user_id", auth.user.id)
          .maybeSingle();

        if (data) {
          setPrefs({
            soundEnabled: data.sound_enabled,
            soundVolume: data.sound_volume,
            ratingTrigger: (data.rating_trigger ?? "all") as RatingTrigger,
            browserNotificationEnabled: data.browser_notification_enabled,
          });
        }
      } catch {
        // Offline / not configured — local prefs remain authoritative.
      }
    })();
  }, []);

  const persist = useCallback(async (next: NotificationPreferences) => {
    setPrefs(next);
    saveLocalPreferences(next);

    try {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      await supabase.from("notification_preferences").upsert(
        {
          user_id: auth.user.id,
          sound_enabled: next.soundEnabled,
          sound_volume: next.soundVolume,
          rating_trigger: next.ratingTrigger === "all" ? null : next.ratingTrigger,
          browser_notification_enabled: next.browserNotificationEnabled,
        },
        { onConflict: "user_id" }
      );
    } catch {
      // Cross-device sync is best-effort; local state already updated.
    }
  }, []);

  const unlockAudio = useCallback(() => {
    markAudioUnlocked();
    setAudioUnlocked(true);
    // Play+immediately-pause is the standard trick to satisfy the browser's
    // "must originate from a user gesture" autoplay requirement.
    audioRef.current?.play().then(
      () => audioRef.current?.pause(),
      () => {
        // File missing or blocked — silent fallback, no crash.
      }
    );
  }, []);

  const playNotification = useCallback(
    (rating: number) => {
      if (!prefs.soundEnabled) return;
      if (!shouldNotifyForRating(rating, prefs.ratingTrigger)) return;
      if (!audioRef.current) return;

      audioRef.current.volume = prefs.soundVolume;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Autoplay blocked or sound file missing — fail silently per spec.
      });
    },
    [prefs.soundEnabled, prefs.ratingTrigger, prefs.soundVolume]
  );

  const testSound = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = prefs.soundVolume;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, [prefs.soundVolume]);

  return {
    hydrated,
    prefs,
    audioUnlocked,
    unlockAudio,
    playNotification,
    testSound,
    setSoundEnabled: (v: boolean) => persist({ ...prefs, soundEnabled: v }),
    setSoundVolume: (v: number) => persist({ ...prefs, soundVolume: v }),
    setRatingTrigger: (v: RatingTrigger) => persist({ ...prefs, ratingTrigger: v }),
    setBrowserNotificationEnabled: (v: boolean) => persist({ ...prefs, browserNotificationEnabled: v }),
  };
}
