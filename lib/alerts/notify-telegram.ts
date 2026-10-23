import type { AlertSeverity, AlertType } from "@/types/database";

export interface TelegramAlertInput {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  outletName: string;
  rating?: number;
  reviewerName?: string;
  comment?: string | null;
  reviewId?: string;
  customChatIds?: string[];
}

/**
 * Memecah string chat ID dari env atau database (dipisahkan koma atau titik koma)
 */
export function parseChatIdList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(/[,;]/).map((c) => c.trim()).filter(Boolean))];
}

/**
 * Format ikon status berdasarkan tingkat keparahan
 */
function getSeverityBadge(severity: AlertSeverity): string {
  switch (severity) {
    case "critical":
      return "🔴 CRITICAL";
    case "high":
      return "🟠 HIGH";
    case "medium":
      return "🟡 MEDIUM";
    default:
      return "🔵 LOW";
  }
}

/**
 * Mengirimkan alert ulasan ke Bot Telegram SukaReview,
 * dan secara otomatis mengekalasikan ulasan buruk/kritis ke Bot Telegram CEO (J.A.R.V.I.S.).
 * Tidak pernah melempar error (best-effort) agar tidak mengganggu aliran pipeline ulasan.
 */
export async function sendTelegramAlert(input: TelegramAlertInput): Promise<boolean> {
  const token = process.env.TELEGRAM_REVIEW_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const configuredChatIds = parseChatIdList(process.env.TELEGRAM_REVIEW_CHAT_ID || process.env.TELEGRAM_CHAT_ID);
  const targetChatIds = [...new Set([...configuredChatIds, ...(input.customChatIds || [])])];

  const sendUrl = process.env.TELEGRAM_REVIEW_SEND_URL;
  const sendSecret = process.env.TELEGRAM_REVIEW_SEND_SECRET;

  const ceoSendUrl = process.env.TELEGRAM_CEO_SEND_URL || "https://agents.sukashawarma.com/api/telegram/ceo/send";
  const ceoSendSecret =
    process.env.TELEGRAM_CEO_SEND_SECRET ||
    process.env.TELEGRAM_REVIEW_SEND_SECRET ||
    sendSecret;

  // Jika tidak ada konfigurasi Telegram sama sekali, skip secara graceful
  if (!token && !sendUrl && !ceoSendSecret) {
    return false;
  }

  const badge = getSeverityBadge(input.severity);
  let judulPesan = "";
  let isiPesan = "";

  if (input.type === "LOW_RATING_REVIEW") {
    const stars = input.rating ? "⭐".repeat(Math.min(5, Math.max(1, input.rating))) : "⭐";
    judulPesan = `🚨 *ALERT ULASAN BARU (${stars})*`;
    isiPesan =
      `📍 *Outlet:* ${input.outletName}\n` +
      `👤 *Reviewer:* ${input.reviewerName || "Google User"}\n` +
      `⭐ *Rating:* ${input.rating ?? "-"}/5\n` +
      `💬 *Ulasan:* "${input.comment || "(tidak ada komentar tertulis)"}"\n` +
      `⚠️ *Severity:* ${badge}`;
  } else if (input.type === "NEGATIVE_SPIKE") {
    judulPesan = `🔴 *ALERT LONJAKAN ULASAN NEGATIF*`;
    isiPesan =
      `📍 *Outlet:* ${input.outletName}\n` +
      `⚠️ *Peringatan:* ${input.message}\n` +
      `🚨 *Tingkat Keparahan:* ${badge}\n\n` +
      `_Mohon Area Manager atau SPV cabang segera memeriksa standar pelayanan & holding produk._`;
  } else if (input.type === "RATING_DROP") {
    judulPesan = `📉 *ALERT PENURUNAN RATING OUTLET*`;
    isiPesan =
      `📍 *Outlet:* ${input.outletName}\n` +
      `📊 *Detail:* ${input.message}\n` +
      `⚠️ *Severity:* ${badge}\n\n` +
      `_Periksa ulasan 7 hari terakhir untuk mendeteksi anomali rasa atau keluhan staf._`;
  } else if (input.type === "LOW_OUTLET_RATING") {
    judulPesan = `🚨 *ALERT OUTLET DI BAWAH STANDAR RATING*`;
    isiPesan =
      `📍 *Outlet:* ${input.outletName}\n` +
      `⭐ *Status:* ${input.message}\n` +
      `⚠️ *Severity:* ${badge}`;
  } else {
    judulPesan = `🔔 *ALERT SUKAREVIEW: ${input.title}*`;
    isiPesan =
      `📍 *Outlet:* ${input.outletName}\n` +
      `📝 *Pesan:* ${input.message}\n` +
      `⚠️ *Severity:* ${badge}`;
  }

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://review.sukashawarma.com"}/outlets`;
  const pesanLengkap = `${judulPesan}\n\n${isiPesan}`;
  let suksesKirim = false;

  try {
    // ─────────────────────────────────────────────────────────── METODE 1: Kirim lewat Bot Outbox Review (apps/bot)
    if (sendUrl && sendSecret) {
      const payload: Record<string, unknown> = {
        title: judulPesan,
        body: isiPesan,
        url: dashboardUrl,
      };

      if (targetChatIds.length > 0) {
        payload.chat_id = targetChatIds;
      } else {
        payload.broadcast = true;
      }

      const res = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sendSecret}`,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
      });

      if (res.ok) {
        suksesKirim = true;
      } else {
        console.warn(`[telegram-alert] Gagal kirim via outbox review ${sendUrl} (${res.status})`);
      }
    }

    // ─────────────────────────────────────────────────────────── METODE 2: Kirim langsung via Telegram Bot API (Review Bot)
    if (token && targetChatIds.length > 0) {
      for (const chatId of targetChatIds) {
        try {
          const bodyPayload: Record<string, unknown> = {
            chat_id: chatId,
            text: pesanLengkap.slice(0, 4000),
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [[{ text: "🔗 Buka di Dashboard SukaReview", url: dashboardUrl }]],
            },
          };

          const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyPayload),
            cache: "no-store",
            signal: AbortSignal.timeout(5_000),
          });

          if (tgRes.ok) {
            suksesKirim = true;
          } else {
            const errJson = await tgRes.json().catch(() => null);
            console.warn(`[telegram-alert] Telegram API error (${tgRes.status}):`, errJson);
          }
        } catch (singleErr) {
          console.warn(`[telegram-alert] Gagal kirim ke chatId ${chatId}:`, singleErr);
        }
      }
    }

    // ─────────────────────────────────────────────────────────── METODE 3: Eskalasi Kritis ke Bot Telegram CEO (J.A.R.V.I.S.)
    // Hanya dipicu jika review berbahaya (<= 2⭐), negative spike, rating drop, atau severity high/critical
    const isKritisUntukCeo =
      input.severity === "critical" ||
      input.severity === "high" ||
      (typeof input.rating === "number" && input.rating <= 2) ||
      input.type === "NEGATIVE_SPIKE";

    if (isKritisUntukCeo && ceoSendSecret) {
      try {
        const stars = input.rating ? "⭐".repeat(Math.min(5, Math.max(1, input.rating))) : "⚠️";
        const judulCeo = `🚨 [ESKALASI REVIEW] Ulasan Buruk ${stars} — ${input.outletName}`;
        const isiCeo =
          `Outlet: ${input.outletName}\n` +
          `Reviewer: ${input.reviewerName || "Pelanggan Google"}\n` +
          `Rating: ${input.rating ?? "-"} / 5\n` +
          `Ulasan: "${input.comment || "(tanpa komentar tertulis)"}"\n` +
          `Tingkat Bahaya: ${input.severity.toUpperCase()}\n\n` +
          `Perhatian Direksi: Ulasan negatif masuk ke Google Maps. Mohon evaluasi segera standar rasa dan pelayanan cabang.`;

        const ceoRes = await fetch(ceoSendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ceoSendSecret}`,
          },
          body: JSON.stringify({
            broadcast: true,
            title: judulCeo.slice(0, 180),
            body: isiCeo.slice(0, 1200),
            url: "https://suka.pantaureview.com",
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(5_000),
        });

        if (ceoRes.ok) {
          suksesKirim = true;
        } else {
          console.warn(`[telegram-alert] Gagal eskalasi ke Bot CEO (${ceoRes.status})`);
        }
      } catch (errCeo) {
        console.warn("[telegram-alert] Terjadi kesalahan saat eskalasi ke Bot CEO:", errCeo);
      }
    }

    return suksesKirim;
  } catch (error) {
    console.warn("[telegram-alert] Terjadi kesalahan saat pengiriman alert Telegram:", error);
    return false;
  }
}
