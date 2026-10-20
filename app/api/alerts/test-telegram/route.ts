import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile, canManage } from "@/lib/auth/get-current-profile";
import { sendTelegramAlert, parseChatIdList } from "@/lib/alerts/notify-telegram";

/** "Kirim Test Telegram" endpoint for verifying bot connectivity. */
export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || !canManage(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const chatId = typeof body?.chat_id === "string" ? body.chat_id.trim() : "";
  const customChatIds = chatId ? parseChatIdList(chatId) : undefined;

  const success = await sendTelegramAlert({
    type: "LOW_RATING_REVIEW",
    severity: "high",
    title: "TEST NOTIFIKASI BOT SUKAREVIEW",
    message: "Ini adalah pesan uji koneksi notifikasi alert Telegram dari SukaReview.",
    outletName: "SUKA SHAWARMA DRAMAGA",
    rating: 1,
    reviewerName: "Sistem Penguji Bot",
    comment: "Uji integrasi webhook & telegram alert Bot SukaReview berjalan dengan baik.",
    customChatIds,
  });

  if (!success) {
    return NextResponse.json(
      {
        error:
          "Gagal mengirim pesan test Telegram. Pastikan TELEGRAM_REVIEW_BOT_TOKEN / TELEGRAM_BOT_TOKEN atau TELEGRAM_REVIEW_SEND_URL sudah dikonfigurasi di environment.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, message: "Pesan test Telegram berhasil dikirim!" });
}
