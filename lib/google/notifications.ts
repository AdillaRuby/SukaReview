import { isLiveMode } from "./auth";

const NOTIFICATIONS_BASE = "https://mybusinessnotifications.googleapis.com/v1";

const NOTIFICATION_TYPES = ["NEW_REVIEW", "UPDATED_REVIEW"];

export interface NotificationSetting {
  name: string;
  topicName: string;
  notificationTypes: string[];
}

/**
 * Registers our Cloud Pub/Sub topic with Google so it publishes NEW_REVIEW /
 * UPDATED_REVIEW events for this account. Called once right after OAuth
 * connect (see app/api/google/oauth/callback).
 */
export async function configureReviewNotifications(
  accessToken: string,
  accountId: string
): Promise<NotificationSetting> {
  const topicName = process.env.GOOGLE_PUBSUB_TOPIC;
  if (!topicName) throw new Error("GOOGLE_PUBSUB_TOPIC is not configured");

  if (!isLiveMode()) {
    return { name: `accounts/${accountId}/notificationSetting`, topicName, notificationTypes: NOTIFICATION_TYPES };
  }

  const res = await fetch(
    `${NOTIFICATIONS_BASE}/accounts/${accountId}/notificationSetting?updateMask=notificationTypes,topicName`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `accounts/${accountId}/notificationSetting`,
        topicName,
        notificationTypes: NOTIFICATION_TYPES,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Google notificationSetting.patch failed: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as NotificationSetting;
}

export async function getReviewNotificationSettings(
  accessToken: string,
  accountId: string
): Promise<NotificationSetting | null> {
  if (!isLiveMode()) return null;

  const res = await fetch(`${NOTIFICATIONS_BASE}/accounts/${accountId}/notificationSetting`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Google notificationSetting.get failed: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as NotificationSetting;
}
