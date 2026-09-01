import { describe, it, expect } from "vitest";
import { parseAggregateRating, parseReviewStars, parseRelativeTimeToISO } from "./scrape-parse";

describe("parseAggregateRating", () => {
  it("parses the verified Indonesian format (comma decimal, dot thousands)", () => {
    expect(parseAggregateRating("4,6 bintang 4.046 Ulasan")).toEqual({ rating: 4.6, reviewCount: 4046 });
  });

  it("parses a review count with no thousands separator", () => {
    expect(parseAggregateRating("4,9 bintang 112 Ulasan")).toEqual({ rating: 4.9, reviewCount: 112 });
  });

  it("parses the English fallback format (dot decimal, comma thousands)", () => {
    expect(parseAggregateRating("4.6 stars 4,046 reviews")).toEqual({ rating: 4.6, reviewCount: 4046 });
  });

  it("returns null for an unrecognized format", () => {
    expect(parseAggregateRating("no rating yet")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseAggregateRating("")).toBeNull();
  });
});

describe("parseReviewStars", () => {
  it("parses a whole-star Indonesian review rating", () => {
    expect(parseReviewStars("5 bintang")).toBe(5);
  });

  it("parses a whole-star English review rating", () => {
    expect(parseReviewStars("1 star")).toBe(1);
  });

  it("parses the plural English form", () => {
    expect(parseReviewStars("4 stars")).toBe(4);
  });

  it("returns null for an out-of-range value", () => {
    expect(parseReviewStars("6 bintang")).toBeNull();
    expect(parseReviewStars("0 bintang")).toBeNull();
  });

  it("returns null for an unrecognized format", () => {
    expect(parseReviewStars("great place")).toBeNull();
  });
});

describe("parseRelativeTimeToISO", () => {
  const now = new Date("2026-09-01T12:00:00.000Z");

  it("parses 'se<unit> lalu' (a <unit> ago) as 1 unit", () => {
    expect(parseRelativeTimeToISO("sebulan lalu", now)).toBe(
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it("parses 'N <unit> lalu'", () => {
    expect(parseRelativeTimeToISO("5 bulan lalu", now)).toBe(
      new Date(now.getTime() - 5 * 30 * 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it("parses days", () => {
    expect(parseRelativeTimeToISO("3 hari lalu", now)).toBe(
      new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it("returns null for an unrecognized format", () => {
    expect(parseRelativeTimeToISO("last Tuesday", now)).toBeNull();
  });

  it("parses the English 'a <unit> ago' form as 1 unit", () => {
    expect(parseRelativeTimeToISO("a month ago", now)).toBe(
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it("parses the English 'an <unit> ago' form as 1 unit", () => {
    expect(parseRelativeTimeToISO("an hour ago", now)).toBe(new Date(now.getTime() - 60 * 60 * 1000).toISOString());
  });

  it("parses the English 'N <unit>s ago' plural form", () => {
    expect(parseRelativeTimeToISO("5 months ago", now)).toBe(
      new Date(now.getTime() - 5 * 30 * 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it("parses English days", () => {
    expect(parseRelativeTimeToISO("3 days ago", now)).toBe(
      new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
    );
  });
});
