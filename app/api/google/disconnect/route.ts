import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile, canManage } from "@/lib/auth/get-current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || !canManage(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const accountId = typeof body?.accountId === "string" ? body.accountId : undefined;
  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  await supabase
    .from("google_connections")
    .update({
      status: "disconnected",
      encrypted_access_token: null,
      encrypted_refresh_token: null,
    })
    .eq("account_id", accountId)
    .eq("status", "connected");

  return NextResponse.json({ ok: true });
}
