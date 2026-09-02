import puppeteerCore from "puppeteer-core";
import { addExtra } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "puppeteer-core";
import type { PlaceDetails, PlaceSearchResult } from "@/types/places";
import type { GoogleReview } from "@/types/google";
import {
  parseAggregateRating,
  parseAggregateRatingFromCombinedText,
  parseReviewStars,
  parseRelativeTimeToISO,
} from "./scrape-parse";

// Deliberately does NOT `import "server-only"` — same reasoning as
// lib/places/client.ts: nothing here needs to run outside Next, but
// keeping the whole lib/places/ directory consistent avoids surprises if
// a future script imports this module too.

const puppeteer = addExtra(puppeteerCore);
puppeteer.use(StealthPlugin());

async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const localExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!localExecutablePath) {
    throw new Error(
      "PUPPETEER_EXECUTABLE_PATH is not set. For local development, set it in .env.local to your " +
        'installed Chrome\'s path (e.g. "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe" ' +
        'on Windows, "/usr/bin/google-chrome" on Linux, or ' +
        '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" on macOS).'
    );
  }
  return puppeteer.launch({ executablePath: localExecutablePath, headless: true });
}

async function withBrowser<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  // Basic anti-detection posture (the agreed effort level — see the design
  // spec): stealth plugin (above) + a randomized delay before each request
  // so consecutive scrapes from one IP don't look scripted.
  await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 3000));

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({ "Accept-Language": "id-ID,id;q=0.9" });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

interface PlacePageBasics {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  userRatingCount: number | null;
}

/**
 * Extracts name/address/lat-lng/rating from whatever place page the given
 * Page is currently on. Shared by scrapeSearchPlaceText (after landing on
 * a search result) and scrapeGetPlaceDetails (after navigating directly to
 * a stored URL).
 */
async function scrapePlacePageBasics(page: Page): Promise<PlacePageBasics | null> {
  const url = page.url();
  const latLngMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

  const raw = await page.evaluate(() => {
    const addressBtn = document.querySelector('[aria-label^="Alamat:"], [aria-label^="Address:"]');

    // Two real layouts for the aggregate rating, both verified live:
    // (1) search-results-list view — one badge combines rating+count in a
    //     single aria-label, e.g. "4,6 bintang 4.046 Ulasan".
    // (2) a place's own standalone page — the badge's aria-label has only
    //     the rating ("4,6 bintang "), and the count sits as separate text
    //     ("4,6(4.047)") in a nearby ancestor element.
    const combinedRatingEl = document.querySelector(
      'span[role="img"][aria-label*="bintang" i][aria-label*="ulasan" i], span[role="img"][aria-label*="star" i][aria-label*="review" i]'
    );
    const soloRatingEl = document.querySelector(
      'span[role="img"][aria-label*="bintang" i], span[role="img"][aria-label*="star" i]'
    );

    const ratingAncestorTexts: string[] = [];
    let ancestor = soloRatingEl?.parentElement ?? null;
    for (let i = 0; i < 4 && ancestor; i++) {
      const text = ancestor.textContent?.trim() ?? "";
      if (text.length > 0 && text.length < 30) ratingAncestorTexts.push(text);
      ancestor = ancestor.parentElement;
    }

    return {
      title: document.title,
      address:
        addressBtn?.getAttribute("aria-label")?.replace(/^(Alamat|Address):\s*/i, "").trim() ?? null,
      ratingAriaLabel: combinedRatingEl?.getAttribute("aria-label") ?? null,
      ratingAncestorTexts,
    };
  });

  // Google sets the tab title to "<Place Name> - Google Maps" on a place
  // page — verified live during design, more reliable than hunting for a
  // specific heading element/class (which differs between a plain place
  // page and a place opened from a search-results split view).
  const name = raw.title.replace(/\s*-\s*Google Maps\s*$/i, "").trim();
  if (!name) return null;

  let aggregate = raw.ratingAriaLabel ? parseAggregateRating(raw.ratingAriaLabel) : null;
  if (!aggregate) {
    for (const text of raw.ratingAncestorTexts) {
      aggregate = parseAggregateRatingFromCombinedText(text);
      if (aggregate) break;
    }
  }

  return {
    name,
    address: raw.address,
    latitude: latLngMatch ? parseFloat(latLngMatch[1]) : null,
    longitude: latLngMatch ? parseFloat(latLngMatch[2]) : null,
    rating: aggregate?.rating ?? null,
    userRatingCount: aggregate?.reviewCount ?? null,
  };
}

/** Text-search bootstrap — used only by scripts/resolve-places.ts. */
export async function scrapeSearchPlaceText(query: string): Promise<PlaceSearchResult | null> {
  return withBrowser(async (page) => {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });

    if (/\/sorry\/|consent\.google\.com/.test(page.url())) {
      throw new Error(`Blocked or CAPTCHA'd while searching for "${query}" (redirected to ${page.url()})`);
    }

    // A distinctive query often makes Google redirect straight to the
    // place page — that URL is already clean, use it as-is. Otherwise,
    // click the first result in the results list — but capture its href
    // BEFORE clicking, not page.url() after: once Puppeteer clicks
    // through, the URL picks up this search's query context
    // (…!1s<query>!3m8…), and reloading THAT URL later makes Google
    // re-render a results list instead of a clean single-place page
    // (verified live), breaking a later scrapeGetPlaceDetails call
    // against it.
    let canonicalUrl = page.url();

    if (!canonicalUrl.includes("/maps/place/")) {
      const firstResult = await page.$('a[href*="/maps/place/"]');
      if (!firstResult) return null;

      const href = await page.evaluate((el) => el.getAttribute("href"), firstResult);
      if (href) canonicalUrl = href.startsWith("http") ? href : `https://www.google.com${href}`;

      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {}),
        firstResult.click(),
      ]);
    }

    const basics = await scrapePlacePageBasics(page);
    if (!basics) return null;

    return {
      placeId: canonicalUrl,
      name: basics.name,
      address: basics.address,
      latitude: basics.latitude,
      longitude: basics.longitude,
      rating: basics.rating,
      userRatingCount: basics.userRatingCount,
    };
  });
}

interface RawScrapedReview {
  reviewId: string;
  reviewerName: string;
  starAriaLabel: string | null;
  relativeTime: string | null;
  text: string | null;
}

/** Place details + reviews — placeUrl is a URL previously returned as `placeId`. */
export async function scrapeGetPlaceDetails(placeUrl: string): Promise<PlaceDetails> {
  if (!placeUrl.startsWith("https://www.google.com/maps/")) {
    throw new Error(
      `scrapeGetPlaceDetails expects a Google Maps URL (from a prior scrapeSearchPlaceText call), got: ` +
        `"${placeUrl}". This usually means the outlet's google_place_id was set while in "api" mode (an ` +
        `opaque Places API ID, not a URL) — re-run scripts/resolve-places.ts with GOOGLE_PLACES_MODE=scrape ` +
        `to replace it with a scraped URL.`
    );
  }
  return withBrowser(async (page) => {
    await page.goto(placeUrl, { waitUntil: "networkidle2", timeout: 30000 });

    if (/\/sorry\/|consent\.google\.com/.test(page.url())) {
      throw new Error(`Blocked or CAPTCHA'd while scraping ${placeUrl} (redirected to ${page.url()})`);
    }

    const basics = await scrapePlacePageBasics(page);
    if (!basics) {
      throw new Error(`Blocked or CAPTCHA'd while scraping ${placeUrl} (no page title found)`);
    }

    const reviewsTab = await page.$('[aria-label^="Ulasan untuk"], [aria-label^="Reviews for"]');
    if (!reviewsTab) {
      // A real place page always has a Reviews tab, even for a business
      // with zero reviews — its total absence (verified live) means
      // Google served a stripped-down page, a soft-block signal distinct
      // from the /sorry/ redirect check above. Throw immediately rather
      // than falling through to "0 reviews found" a few steps later.
      throw new Error(
        `Reviews tab not found while scraping ${placeUrl} — likely blocked/rate-limited (Google served a ` +
          `stripped-down page with no reviews section) or the markup changed.`
      );
    }
    await reviewsTab.click();
    await page.waitForSelector("div[data-review-id]", { timeout: 15000 }).catch(() => {});

    // Reviews lazy-load as the panel scrolls. A few scrolls is enough to
    // load well over 5 reviews (verified during design) without trying to
    // exhaustively paginate history — matches the API mode's own "up to a
    // handful per poll" character.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const firstReview = document.querySelector("div[data-review-id]");
        const scrollable = firstReview?.closest('[role="main"]') ?? firstReview?.parentElement?.parentElement;
        scrollable?.scrollBy(0, 800);
      });
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    const rawReviews: RawScrapedReview[] = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("div[data-review-id]")).map((el) => {
        const starEl = el.querySelector(
          'span[role="img"][aria-label$=" bintang"], span[role="img"][aria-label$=" star"], span[role="img"][aria-label$=" stars"]'
        );
        const timeEl = el.querySelector(".rsqaWe");
        const textEl = el.querySelector(".wiI7pd");
        return {
          reviewId: el.getAttribute("data-review-id") ?? "",
          reviewerName: el.getAttribute("aria-label") ?? "",
          starAriaLabel: starEl?.getAttribute("aria-label") ?? null,
          relativeTime: timeEl?.textContent?.trim() ?? null,
          text: textEl?.textContent?.trim() ?? null,
        };
      });
    });

    const reviews: GoogleReview[] = [];
    let skippedUnparseableTime = 0;
    for (const raw of rawReviews) {
      if (!raw.reviewId || !raw.starAriaLabel) continue;
      const stars = parseReviewStars(raw.starAriaLabel);
      if (!stars) continue;

      // Skip rather than inventing "now" for an unparseable time (format
      // outside id/en, or .rsqaWe markup drift) — a fake "now" timestamp
      // would misdate an old review as posted today and permanently
      // pollute the alert engine's 24h negative-review window
      // (google_created_at gets re-stamped to "now" again on every
      // re-sync via ingestGoogleReview's update path).
      const timestamp = raw.relativeTime ? parseRelativeTimeToISO(raw.relativeTime) : null;
      if (!timestamp) {
        skippedUnparseableTime += 1;
        continue;
      }

      reviews.push({
        reviewId: raw.reviewId,
        locationId: placeUrl,
        reviewer: { displayName: raw.reviewerName || "Google User", photoUrl: null },
        starRating: stars,
        comment: raw.text,
        createTime: timestamp,
        updateTime: timestamp,
      });
    }

    if (basics.rating === null && reviews.length === 0) {
      throw new Error(
        `Blocked, CAPTCHA'd, or markup changed while scraping ${placeUrl} (no rating and no reviews found)`
      );
    }

    if (reviews.length === 0 && skippedUnparseableTime > 0) {
      throw new Error(
        `Found ${skippedUnparseableTime} review(s) at ${placeUrl} but none had a parseable relative ` +
          `time (locale outside id/en, or .rsqaWe markup drift)`
      );
    }

    return {
      rating: basics.rating,
      userRatingCount: basics.userRatingCount,
      reviews,
    };
  });
}
