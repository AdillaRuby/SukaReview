import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "./token-crypto";
import { refreshAccessToken } from "./auth";

/**
 * Returns a valid (non-expired) access token for a connected Google
 * account, refreshing and persisting it first if needed. Shared by the
 * Pub/Sub webhook and the "Sync Now" route so token-refresh logic lives in
 * exactly one place.
 */
export async function getValidAccessToken(accountId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data: connection } = await supabase
    .from("google_connections")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "connected")
    .maybeSingle();

  if (!connection?.encrypted_access_token) {
    throw new Error(`No connected Google account found for ${accountId}`);
  }

  const isExpired = connection.token_expires_at && new Date(connection.token_expires_at) <= new Date();

  if (!isExpired) {
    return decryptToken(connection.encrypted_access_token);
  }

  if (!connection.encrypted_refresh_token) {
    throw new Error(`Access token expired and no refresh token stored for ${accountId}`);
  }

  const refreshed = await refreshAccessToken(decryptToken(connection.encrypted_refresh_token));

  await supabase
    .from("google_connections")
    .update({
      encrypted_access_token: encryptToken(refreshed.accessToken),
      token_expires_at: refreshed.expiresAt,
    })
    .eq("id", connection.id);

  return refreshed.accessToken;
}
