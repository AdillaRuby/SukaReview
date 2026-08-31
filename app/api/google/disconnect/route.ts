import { NextResponse } from "next/server";
import { getCurrentProfile, canManage } from "@/lib/auth/get-current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile || !canManage(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  await supabase
    .from("google_connections")
    .update({
      status: "disconnected",
      encrypted_access_token: null,
      encrypted_refresh_token: null,
    })
    .eq("status", "connected");

  return NextResponse.json({ ok: true });
}
