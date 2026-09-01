import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("lib/places/client", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GOOGLE_PLACES_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_PLACES_API_KEY = "test-api-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GOOGLE_PLACES_API_KEY = originalApiKey;
    vi.resetModules();
  });

  it("getPlaceDetails maps reviews and sends the right headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rating: 4.5,
        userRatingCount: 120,
        reviews: [
          {
            name: "places/ChIJabc/reviews/xyz",
            rating: 5,
            text: { text: "Enak banget!" },
            authorAttribution: { displayName: "Budi S.", photoUri: "https://example.com/p.jpg" },
            publishTime: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getPlaceDetails } = await import("./client");
    const result = await getPlaceDetails("ChIJabc");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places/ChIJabc",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Goog-Api-Key": "test-api-key",
          "X-Goog-FieldMask": "rating,userRatingCount,reviews",
        }),
      })
    );

    expect(result.rating).toBe(4.5);
    expect(result.userRatingCount).toBe(120);
    expect(result.reviews).toEqual([
      {
        reviewId: "places/ChIJabc/reviews/xyz",
        locationId: "places/ChIJabc",
        reviewer: { displayName: "Budi S.", photoUrl: "https://example.com/p.jpg" },
        starRating: 5,
        comment: "Enak banget!",
        createTime: "2026-01-01T00:00:00Z",
        updateTime: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("getPlaceDetails returns nulls/empty reviews when the place has none", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;

    const { getPlaceDetails } = await import("./client");
    const result = await getPlaceDetails("ChIJempty");

    expect(result).toEqual({ rating: null, userRatingCount: null, reviews: [] });
  });

  it("getPlaceDetails falls back to defaults for a review missing optional fields", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reviews: [{ name: "places/x/reviews/y", rating: 3, publishTime: "2026-02-01T00:00:00Z" }],
      }),
    }) as unknown as typeof fetch;

    const { getPlaceDetails } = await import("./client");
    const result = await getPlaceDetails("ChIJx");

    expect(result.reviews[0]).toEqual({
      reviewId: "places/x/reviews/y",
      locationId: "places/ChIJx",
      reviewer: { displayName: "Google User", photoUrl: null },
      starRating: 3,
      comment: null,
      createTime: "2026-02-01T00:00:00Z",
      updateTime: "2026-02-01T00:00:00Z",
    });
  });

  it("getPlaceDetails throws when the API responds with an error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "PERMISSION_DENIED",
    }) as unknown as typeof fetch;

    const { getPlaceDetails } = await import("./client");
    await expect(getPlaceDetails("ChIJbad")).rejects.toThrow(/403/);
  });

  it("throws a clear error when GOOGLE_PLACES_API_KEY is not configured", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const { getPlaceDetails } = await import("./client");
    await expect(getPlaceDetails("ChIJabc")).rejects.toThrow(/GOOGLE_PLACES_API_KEY/);
  });

  it("searchPlaceText returns null when no places match", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;

    const { searchPlaceText } = await import("./client");
    const result = await searchPlaceText("Suka Shawarma Nowhere");

    expect(result).toBeNull();
  });

  it("searchPlaceText maps the first candidate", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            id: "ChIJcibubur",
            displayName: { text: "Suka Shawarma Cibubur" },
            formattedAddress: "Jl. Alternatif Cibubur No. 45",
            location: { latitude: -6.3729, longitude: 106.9256 },
            rating: 4.6,
            userRatingCount: 340,
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const { searchPlaceText } = await import("./client");
    const result = await searchPlaceText("Suka Shawarma Cibubur, Jakarta Timur");

    expect(result).toEqual({
      placeId: "ChIJcibubur",
      name: "Suka Shawarma Cibubur",
      address: "Jl. Alternatif Cibubur No. 45",
      latitude: -6.3729,
      longitude: 106.9256,
      rating: 4.6,
      userRatingCount: 340,
    });
  });
});
