import { NextResponse } from "next/server";
import { getCurrentProfile, canManage } from "@/lib/auth/get-current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/google/token-store";
import { isLiveMode } from "@/lib/google/auth";
import { runFullSync } from "@/lib/google/sync";

export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile || !canManage(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isLiveMode()) {
    return NextResponse.json({ error: "Sync Now hanya tersedia saat GOOGLE_MODE=live" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: connection } = await supabase
    .from("google_connections")
    .select("*")
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ error: "Belum ada koneksi Google" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken(connection.account_id);

    await supabase.from("google_connections").update({ status: "syncing", last_sync_status: "running" }).eq("id", connection.id);

    const result = await runFullSync(accessToken, connection.account_id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await supabase
      .from("google_connections")
      .update({ status: "error", last_sync_status: "failed", last_error: message.slice(0, 500) })
      .eq("id", connection.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
