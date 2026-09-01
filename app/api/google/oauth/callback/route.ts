import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google/auth";
import { listGoogleAccounts } from "@/lib/google/accounts";
import { runFullSync } from "@/lib/google/sync";
import { encryptToken } from "@/lib/google/token-crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const STATE_COOKIE = "sukareview_oauth_state";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/settings?error=invalid_state", appUrl));
  }

  const supabase = createAdminClient();
  let connectedAccountId: string | undefined;

  try {
    const tokens = await exchangeCodeForTokens(code);
    const accounts = await listGoogleAccounts(tokens.accessToken);
    const account = accounts[0];

    if (!account) {
      return NextResponse.redirect(new URL("/settings?error=no_account", appUrl));
    }

    connectedAccountId = account.accountId;

    await supabase.from("google_connections").upsert(
      {
        account_id: account.accountId,
        account_name: account.accountName,
        status: "syncing",
        encrypted_access_token: encryptToken(tokens.accessToken),
        encrypted_refresh_token: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
        token_expires_at: tokens.expiresAt,
        scopes: tokens.scopes,
        last_sync_status: "running",
      },
      { onConflict: "account_id" }
    );

    await runFullSync(tokens.accessToken, account.accountId);

    const response = NextResponse.redirect(new URL("/settings?connected=1", appUrl));
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (err) {
    console.error("[google-oauth] callback failed:", err);

    // The connection row may already be sitting at status "syncing" from the
    // upsert above — leaving it there hides the account from every query that
    // filters on status "connected" with no way to retry short of a manual
    // DB edit, so bring it back to a visible, retriable state.
    if (connectedAccountId) {
      await supabase
        .from("google_connections")
        .update({
          status: "error",
          last_sync_status: "failed",
          last_error: err instanceof Error ? err.message : String(err),
        })
        .eq("account_id", connectedAccountId);
    }

    return NextResponse.redirect(new URL("/settings?error=sync_failed", appUrl));
  }
}
