import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile, canManage } from "@/lib/auth/get-current-profile";
import { sendTestAlertEmail } from "@/lib/alerts/notify-email";

/** "Kirim Test Email" button next to the email alert toggle in Settings. */
export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || !canManage(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "Alamat email belum diisi." }, { status: 400 });
  }

  const result = await sendTestAlertEmail(email);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Gagal mengirim email." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
