import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetPlaceDetails = vi.fn();
vi.mock("./client", () => ({ getPlaceDetails: mockGetPlaceDetails }));

const mockIngestGoogleReview = vi.fn();
const mockProcessIngestedReview = vi.fn();
vi.mock("@/lib/reviews/ingest-review", () => ({
  ingestGoogleReview: mockIngestGoogleReview,
  processIngestedReview: mockProcessIngestedReview,
}));

interface FakeOutlet {
  id: string;
  name: string;
  google_place_id: string | null;
}

function mockSupabase(outlets: FakeOutlet[]) {
  const updateCalls: { table: string; values: Record<string, unknown> }[] = [];
  return {
    client: {
      from(table: string) {
        return {
          select: () => ({
            eq: async () => ({ data: outlets, error: null }),
          }),
          update: (values: Record<string, unknown>) => ({
            eq: async () => {
              updateCalls.push({ table, values });
              return { data: null, error: null };
            },
          }),
        };
      },
    },
    updateCalls,
  };
}

const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockCreateAdminClient() }));

describe("runPlacesSync", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("processes new reviews through the pipeline and skips already-seen ones", async () => {
    const { updateCalls, client } = mockSupabase([{ id: "o1", name: "Outlet 1", google_place_id: "place-1" }]);
    mockCreateAdminClient.mockReturnValue(client);

    mockGetPlaceDetails.mockResolvedValue({
      rating: 4.7,
      userRatingCount: 200,
      reviews: [
        { reviewId: "r-new", locationId: "places/place-1", reviewer: { displayName: "A", photoUrl: null }, starRating: 5, comment: null, createTime: "t", updateTime: "t" },
        { reviewId: "r-old", locationId: "places/place-1", reviewer: { displayName: "B", photoUrl: null }, starRating: 3, comment: null, createTime: "t", updateTime: "t" },
      ],
    });

    mockIngestGoogleReview
      .mockResolvedValueOnce({ reviewId: "id-new", outletId: "o1", isNew: true })
      .mockResolvedValueOnce({ reviewId: "id-old", outletId: "o1", isNew: false });

    const { runPlacesSync } = await import("./sync");
    const summary = await runPlacesSync();

    expect(mockProcessIngestedReview).toHaveBeenCalledTimes(1);
    expect(mockProcessIngestedReview).toHaveBeenCalledWith({ reviewId: "id-new", outletId: "o1", isNew: true }, "Outlet 1", 5);
    expect(summary.newReviewsFound).toBe(1);
    expect(summary.outletsProcessed).toBe(1);
    expect(summary.errors).toEqual([]);

    const ratingUpdate = updateCalls.find((c) => c.table === "outlets");
    expect(ratingUpdate?.values).toEqual({ current_rating: 4.7, total_reviews: 200 });
  });

  it("continues to the next outlet when one outlet's Places lookup fails", async () => {
    const { client } = mockSupabase([
      { id: "o1", name: "Outlet 1", google_place_id: "place-1" },
      { id: "o2", name: "Outlet 2", google_place_id: "place-2" },
    ]);
    mockCreateAdminClient.mockReturnValue(client);

    mockGetPlaceDetails
      .mockRejectedValueOnce(new Error("Places API getPlaceDetails failed: 404 NOT_FOUND"))
      .mockResolvedValueOnce({ rating: 4.0, userRatingCount: 50, reviews: [] });

    const { runPlacesSync } = await import("./sync");
    const summary = await runPlacesSync();

    expect(summary.outletsProcessed).toBe(1);
    expect(summary.errors).toEqual([{ outletId: "o1", outletName: "Outlet 1", message: "Places API getPlaceDetails failed: 404 NOT_FOUND" }]);
  });

  it("skips outlets with no google_place_id and counts them separately", async () => {
    const { client } = mockSupabase([{ id: "o1", name: "Outlet 1", google_place_id: null }]);
    mockCreateAdminClient.mockReturnValue(client);

    const { runPlacesSync } = await import("./sync");
    const summary = await runPlacesSync();

    expect(mockGetPlaceDetails).not.toHaveBeenCalled();
    expect(summary.outletsSkippedNoPlaceId).toBe(1);
    expect(summary.outletsProcessed).toBe(0);
  });
});
