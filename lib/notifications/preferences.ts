export type RatingTrigger = "all" | 3 | 2 | 1;

export interface NotificationPreferences {
  soundEnabled: boolean;
  soundVolume: number; // 0-1
  ratingTrigger: RatingTrigger;
  browserNotificationEnabled: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  soundEnabled: true,
  soundVolume: 0.7,
  ratingTrigger: "all",
  browserNotificationEnabled: false,
};

const STORAGE_KEY = "sukareview:notification-preferences";
const AUDIO_UNLOCKED_KEY = "sukareview:audio-unlocked";

export function loadLocalPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveLocalPreferences(prefs: NotificationPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable (private browsing quota etc.) — non-fatal.
  }
}

export function isAudioUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUDIO_UNLOCKED_KEY) === "true";
}

export function markAudioUnlocked(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUDIO_UNLOCKED_KEY, "true");
}

/** Should a review with this rating trigger a notification given the current preference? */
export function shouldNotifyForRating(rating: number, trigger: RatingTrigger): boolean {
  if (trigger === "all") return true;
  return rating <= trigger;
}
