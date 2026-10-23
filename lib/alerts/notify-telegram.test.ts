import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendTelegramAlert } from "./notify-telegram";

describe("sendTelegramAlert", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ delivered: true }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("meneruskan ulasan bintang <= 2 ke Bot Telegram CEO", async () => {
    vi.stubEnv("TELEGRAM_CEO_SEND_SECRET", "secret-ceo-123");
    vi.stubEnv("TELEGRAM_CEO_SEND_URL", "https://agents.sukashawarma.com/api/telegram/ceo/send");

    const sukses = await sendTelegramAlert({
      type: "LOW_RATING_REVIEW",
      severity: "high",
      title: "Sentul",
      outletName: "Sentul City",
      rating: 1,
      reviewerName: "Budi Santoso",
      comment: "Ayamnya agak bau dan dingin.",
      message: "Review baru 1⭐ masuk",
    });

    expect(sukses).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://agents.sukashawarma.com/api/telegram/ceo/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret-ceo-123",
        }),
        body: expect.stringContaining("ESKALASI REVIEW"),
      })
    );
  });

  it("tidak mengekalasikan ulasan rating 5⭐ ke Bot Telegram CEO", async () => {
    vi.stubEnv("TELEGRAM_CEO_SEND_SECRET", "secret-ceo-123");
    vi.stubEnv("TELEGRAM_REVIEW_SEND_URL", "https://agents.sukashawarma.com/api/telegram/review/send");
    vi.stubEnv("TELEGRAM_REVIEW_SEND_SECRET", "secret-review-123");

    const sukses = await sendTelegramAlert({
      type: "LOW_RATING_REVIEW",
      severity: "low",
      title: "Sentul",
      outletName: "Sentul City",
      rating: 5,
      reviewerName: "Siti Rahma",
      comment: "Enak banget shawarmanya!",
      message: "Review bagus",
    });

    expect(sukses).toBe(true);
    // Hanya dipanggil 1 kali ke review send, tidak dipanggil ke ceo send
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://agents.sukashawarma.com/api/telegram/review/send",
      expect.anything()
    );
  });
});
