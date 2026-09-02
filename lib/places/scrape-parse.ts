/**
 * Pure parsing for the Google Maps scraping mode (see
 * docs/superpowers/specs/2026-09-01-google-maps-scraper-design.md). Takes
 * raw aria-label / text-content strings extracted from the DOM by
 * scrape-browser.ts and turns them into typed values. No DOM, no I/O —
 * everything here is unit-testable without a real browser.
 */

/** "4,6 bintang 4.046 Ulasan" (id) or "4.6 stars 4,046 reviews" (en fallback). */
export function parseAggregateRating(ariaLabel: string): { rating: number; reviewCount: number } | null {
  const trimmed = ariaLabel.trim();

  const idMatch = trimmed.match(/^([\d.]+),(\d+)\s*bintang\s*([\d.]+)\s*ulasan$/i);
  if (idMatch) {
    const rating = parseFloat(`${idMatch[1].replace(/\./g, "")}.${idMatch[2]}`);
    const reviewCount = parseInt(idMatch[3].replace(/\./g, ""), 10);
    if (!Number.isNaN(rating) && !Number.isNaN(reviewCount)) return { rating, reviewCount };
  }

  const enMatch = trimmed.match(/^([\d,]+)\.(\d+)\s*stars?\s*([\d,]+)\s*reviews?$/i);
  if (enMatch) {
    const rating = parseFloat(`${enMatch[1].replace(/,/g, "")}.${enMatch[2]}`);
    const reviewCount = parseInt(enMatch[3].replace(/,/g, ""), 10);
    if (!Number.isNaN(rating) && !Number.isNaN(reviewCount)) return { rating, reviewCount };
  }

  return null;
}

/**
 * "4,6(4.047)" (id) or "4.6(4,047)" (en) — the rating and review count as
 * two separate text nodes combined, verified live on a place's own
 * standalone page (as opposed to the search-results-list view, where
 * parseAggregateRating's single combined aria-label applies instead). Both
 * layouts are real and scrape-browser.ts tries both.
 */
export function parseAggregateRatingFromCombinedText(text: string): { rating: number; reviewCount: number } | null {
  const trimmed = text.trim();

  const idMatch = trimmed.match(/^([\d.]+),(\d+)\((\d[\d.]*)\)$/);
  if (idMatch) {
    const rating = parseFloat(`${idMatch[1].replace(/\./g, "")}.${idMatch[2]}`);
    const reviewCount = parseInt(idMatch[3].replace(/\./g, ""), 10);
    if (!Number.isNaN(rating) && !Number.isNaN(reviewCount)) return { rating, reviewCount };
  }

  const enMatch = trimmed.match(/^([\d,]+)\.(\d+)\((\d[\d,]*)\)$/);
  if (enMatch) {
    const rating = parseFloat(`${enMatch[1].replace(/,/g, "")}.${enMatch[2]}`);
    const reviewCount = parseInt(enMatch[3].replace(/,/g, ""), 10);
    if (!Number.isNaN(rating) && !Number.isNaN(reviewCount)) return { rating, reviewCount };
  }

  return null;
}

/** "5 bintang" / "1 star" / "4 stars" — always a whole number, 1-5. */
export function parseReviewStars(ariaLabel: string): 1 | 2 | 3 | 4 | 5 | null {
  const trimmed = ariaLabel.trim().toLowerCase();
  const match = trimmed.match(/^(\d)\s*(?:bintang|stars?)$/);
  if (!match) return null;
  const stars = parseInt(match[1], 10);
  if (stars < 1 || stars > 5) return null;
  return stars as 1 | 2 | 3 | 4 | 5;
}

const ID_UNIT_MS: Record<string, number> = {
  menit: 60 * 1000,
  jam: 60 * 60 * 1000,
  hari: 24 * 60 * 60 * 1000,
  minggu: 7 * 24 * 60 * 60 * 1000,
  bulan: 30 * 24 * 60 * 60 * 1000,
  tahun: 365 * 24 * 60 * 60 * 1000,
};

const EN_UNIT_MS: Record<string, number> = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

/**
 * "sebulan lalu" / "5 bulan lalu" / "a month ago" / "5 months ago" ->
 * approximate ISO timestamp. Google Maps never exposes an absolute review
 * date in the DOM, so this is inherently an approximation (day-level
 * precision lost) — acceptable for trend charts, not for anything needing
 * an exact date. English fallback exists because Google's locale
 * detection can be swayed by server IP geolocation regardless of the
 * Accept-Language header the scraper sends.
 */
export function parseRelativeTimeToISO(text: string, now: Date = new Date()): string | null {
  const trimmed = text.trim().toLowerCase();

  const idMatch = trimmed.match(/^(se|\d+)\s*(menit|jam|hari|minggu|bulan|tahun)\s*(?:yang\s+)?lalu$/);
  if (idMatch) {
    const amount = idMatch[1] === "se" ? 1 : parseInt(idMatch[1], 10);
    const unitMs = ID_UNIT_MS[idMatch[2]];
    if (unitMs && !Number.isNaN(amount)) return new Date(now.getTime() - amount * unitMs).toISOString();
  }

  const enMatch = trimmed.match(/^(a|an|\d+)\s+(minute|hour|day|week|month|year)s?\s+ago$/);
  if (enMatch) {
    const amount = enMatch[1] === "a" || enMatch[1] === "an" ? 1 : parseInt(enMatch[1], 10);
    const unitMs = EN_UNIT_MS[enMatch[2]];
    if (unitMs && !Number.isNaN(amount)) return new Date(now.getTime() - amount * unitMs).toISOString();
  }

  return null;
}
