import { Resend } from "resend";

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cachedClient ??= new Resend(key);
  return cachedClient;
}

interface LowRatingEmailInput {
  to: string;
  outletName: string;
  rating: number;
  reviewerName: string;
  comment: string | null;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Sends a "new low-rating review" alert email via Resend. Never throws —
 * email delivery is best-effort and must not block alert creation or review
 * ingestion (same contract as lib/gemini/analyze-review.ts). Silently no-ops
 * if RESEND_API_KEY isn't configured, so email stays fully optional.
 */
export async function sendLowRatingReviewEmail(input: LowRatingEmailInput): Promise<void> {
  const resend = getClient();
  if (!resend) return;

  const from = process.env.RESEND_FROM_EMAIL || "SukaReview Alerts <onboarding@resend.dev>";
  const stars = "⭐".repeat(input.rating);

  try {
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: `[${input.outletName}] Review baru ${stars} dari ${input.reviewerName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px;">
          <h2 style="margin-bottom: 4px;">${escapeHtml(input.outletName)}</h2>
          <p style="color: #b45309; font-weight: 600; margin: 0 0 12px;">${stars} (${input.rating}/5) — ${escapeHtml(input.reviewerName)}</p>
          <p style="white-space: pre-wrap; color: #374151;">${input.comment ? escapeHtml(input.comment) : "(tidak ada komentar)"}</p>
        </div>
      `,
    });

    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("[alerts] failed to send low-rating review email:", err instanceof Error ? err.message : err);
  }
}
